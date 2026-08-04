(function (root) {
  "use strict";

  if (root.UntilFridayMinP2P) return;

  const Min = root.UntilFridayMinMessenger;
  const PeerCtor = root.Peer;
  if (!Min) return;

  const STORAGE_KEY = Min.STORAGE_KEY;
  const PEER_ID_KEY = "until-friday-min-peer-id-v1";
  const ICON_ROOT = "https://img.icons8.com/fluency-systems-regular";
  const icon = (name, size = 22) => `${ICON_ROOT}/${size}/${name}.png`;
  const connections = new Map();
  const signatures = new Map();
  const remoteSignatures = new Map();
  let peer = null;
  let peerId = "";
  let status = PeerCtor ? "Запуск P2P…" : "PeerJS не загрузился";
  let currentCall = null;
  let localStream = null;
  let pollTimer = null;

  function uid() {
    return root.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function safePeerId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  }

  function localId() {
    let value = safePeerId(root.localStorage?.getItem(PEER_ID_KEY));
    if (!value) {
      value = `min-${uid().replaceAll("-", "").slice(0, 14)}`;
      root.localStorage?.setItem(PEER_ID_KEY, value);
    }
    return value;
  }

  function dispatchStorage(json) {
    try {
      root.dispatchEvent(new StorageEvent("storage", {
        key: STORAGE_KEY,
        oldValue: null,
        newValue: json,
        storageArea: root.localStorage,
        url: root.location?.href || ""
      }));
    } catch {
      const event = new Event("storage");
      Object.defineProperty(event, "key", { value: STORAGE_KEY });
      Object.defineProperty(event, "newValue", { value: json });
      root.dispatchEvent(event);
    }
  }

  function mutateState(updater) {
    try {
      const raw = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || "{}");
      const state = Min.normalize(raw);
      updater(state);
      state.updatedAt = new Date().toISOString();
      const json = JSON.stringify(state);
      root.localStorage?.setItem(STORAGE_KEY, json);
      dispatchStorage(json);
      root.dispatchEvent(new CustomEvent("until-friday-min-state-change", { detail: { reason: "p2p" } }));
      return state;
    } catch (error) {
      console.warn("MIN P2P state update failed", error);
      return null;
    }
  }

  function profilePayload() {
    const profile = Min.getState().profile;
    return {
      name: profile.name,
      username: profile.username,
      color: profile.avatarColor,
      letter: String(profile.name || "?").slice(0, 1).toUpperCase()
    };
  }

  function remoteUserId(id) {
    return `peer-user-${safePeerId(id)}`;
  }

  function chatIdFor(id) {
    return `p2p-${[peerId, safePeerId(id)].sort().join("--")}`;
  }

  function ensurePeerChat(remoteId, profile = {}) {
    const cleanId = safePeerId(remoteId);
    if (!cleanId) return null;
    const userId = remoteUserId(cleanId);
    const chatId = chatIdFor(cleanId);
    let result = null;
    mutateState((state) => {
      let user = state.users.find((item) => item.id === userId);
      if (!user) {
        user = {
          id: userId,
          name: profile.name || cleanId,
          username: profile.username || cleanId,
          letter: profile.letter || String(profile.name || cleanId).slice(0, 1).toUpperCase(),
          color: profile.color || "#4f83b7",
          status: "P2P · в сети",
          peerId: cleanId
        };
        state.users.push(user);
      } else {
        Object.assign(user, {
          name: profile.name || user.name,
          username: profile.username || user.username,
          letter: profile.letter || user.letter,
          color: profile.color || user.color,
          status: "P2P · в сети",
          peerId: cleanId
        });
      }
      let chat = state.chats.find((item) => item.id === chatId);
      if (!chat) {
        chat = {
          id: chatId,
          type: "private",
          title: user.name,
          memberIds: ["self", userId],
          createdAt: new Date().toISOString(),
          pinned: false,
          archived: false,
          muted: false,
          unread: 0,
          color: user.color,
          description: `Прямое WebRTC-соединение · MIN-ID ${cleanId}`,
          network: { provider: "peerjs", peerId: cleanId }
        };
        state.chats.unshift(chat);
      } else {
        chat.title = user.name;
        chat.color = user.color;
        chat.network = { provider: "peerjs", peerId: cleanId };
      }
      result = chat;
    });
    return result;
  }

  async function serializeAttachments(attachments) {
    const result = [];
    for (const attachment of attachments || []) {
      try {
        const record = await Min.readMedia(attachment.id);
        result.push({
          id: attachment.id,
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          blob: record?.blob || null
        });
      } catch {
        result.push({ ...attachment, blob: null });
      }
    }
    return result;
  }

  async function receiveAttachments(items) {
    const result = [];
    for (const item of items || []) {
      if (item.blob instanceof Blob) {
        try {
          result.push(await Min.storeMedia(item.blob, item.name));
          continue;
        } catch {}
      }
      result.push({ id: item.id || uid(), name: item.name || "файл", type: item.type || "application/octet-stream", size: Number(item.size || 0) });
    }
    return result;
  }

  function messageSignature(message) {
    return JSON.stringify({
      text: message.text,
      editedAt: message.editedAt,
      deleted: message.deleted,
      pinned: message.pinned,
      replyTo: message.replyTo,
      forwardedFrom: message.forwardedFrom,
      reactions: message.reactions,
      attachments: (message.attachments || []).map((item) => [item.id, item.name, item.size])
    });
  }

  async function sendFullMessage(connection, message) {
    const payload = {
      ...message,
      senderId: peerId,
      attachments: await serializeAttachments(message.attachments)
    };
    connection.send({ type: "message-sync", sourceId: message.id, message: payload, profile: profilePayload() });
  }

  function sendReactionPatch(connection, message) {
    const reacted = Object.entries(message.reactions || {})
      .filter(([, users]) => users.includes("self"))
      .map(([emoji]) => emoji);
    connection.send({ type: "reaction-patch", sourceId: message.network?.sourceId, reacted, profile: profilePayload() });
  }

  async function receiveMessage(remoteId, packet) {
    const chat = ensurePeerChat(remoteId, packet.profile);
    if (!chat || !packet.message) return;
    const source = packet.message;
    const localMessageId = `p2p-msg-${safePeerId(remoteId)}-${packet.sourceId}`;
    const attachments = await receiveAttachments(source.attachments);
    mutateState((state) => {
      const userId = remoteUserId(remoteId);
      let message = state.messages.find((item) => item.id === localMessageId);
      const next = {
        id: localMessageId,
        chatId: chat.id,
        senderId: userId,
        text: String(source.text || ""),
        createdAt: source.createdAt || new Date().toISOString(),
        editedAt: source.editedAt || null,
        deleted: Boolean(source.deleted),
        pinned: Boolean(source.pinned),
        attachments,
        replyTo: null,
        forwardedFrom: source.forwardedFrom || null,
        reactions: source.reactions || {},
        status: "delivered",
        network: { provider: "peerjs", peerId: remoteId, sourceId: packet.sourceId }
      };
      if (message) Object.assign(message, next);
      else {
        state.messages.push(next);
        const targetChat = state.chats.find((item) => item.id === chat.id);
        if (targetChat) targetChat.unread = Number(targetChat.unread || 0) + 1;
      }
    });
  }

  function receiveReactionPatch(remoteId, packet) {
    if (!packet.sourceId) return;
    mutateState((state) => {
      const message = state.messages.find((item) => item.id === packet.sourceId && item.senderId === "self");
      if (!message) return;
      message.reactions ||= {};
      const actor = remoteUserId(remoteId);
      const active = new Set(packet.reacted || []);
      const emojis = new Set([...Object.keys(message.reactions), ...active]);
      for (const emoji of emojis) {
        const users = new Set(message.reactions[emoji] || []);
        active.has(emoji) ? users.add(actor) : users.delete(actor);
        if (users.size) message.reactions[emoji] = [...users];
        else delete message.reactions[emoji];
      }
    });
  }

  function setStatus(text) {
    status = text;
    decorateAll();
  }

  function handleData(connection, data) {
    if (!data || typeof data !== "object") return;
    const remoteId = safePeerId(connection.peer);
    if (data.type === "hello" || data.type === "hello-ack") {
      ensurePeerChat(remoteId, data.profile);
      if (data.type === "hello") connection.send({ type: "hello-ack", profile: profilePayload(), peerId });
      setStatus(`Соединено с ${data.profile?.name || remoteId}`);
      return;
    }
    if (data.type === "message-sync") receiveMessage(remoteId, data);
    if (data.type === "reaction-patch") receiveReactionPatch(remoteId, data);
    if (data.type === "typing") updateTyping(remoteId, Boolean(data.active));
  }

  function setupConnection(connection) {
    const remoteId = safePeerId(connection.peer);
    if (!remoteId) return;
    const previous = connections.get(remoteId);
    if (previous && previous !== connection) previous.close?.();
    connections.set(remoteId, connection);
    connection.on("open", () => {
      connection.send({ type: "hello", profile: profilePayload(), peerId });
      ensurePeerChat(remoteId, {});
      setStatus(`P2P-соединение установлено: ${remoteId}`);
      startPolling();
    });
    connection.on("data", (data) => handleData(connection, data));
    connection.on("close", () => {
      connections.delete(remoteId);
      markOffline(remoteId);
      setStatus(connections.size ? "Часть P2P-контактов в сети" : "P2P включён, подключений нет");
    });
    connection.on("error", (error) => setStatus(`Ошибка соединения: ${error.type || error.message || "неизвестно"}`));
  }

  function connect(remoteId) {
    const clean = safePeerId(remoteId);
    if (!peer || !clean || clean === peerId) return false;
    setStatus(`Подключение к ${clean}…`);
    const connection = peer.connect(clean, { reliable: true, serialization: "binary" });
    setupConnection(connection);
    return true;
  }

  function markOffline(remoteId) {
    mutateState((state) => {
      const user = state.users.find((item) => item.id === remoteUserId(remoteId));
      if (user) user.status = "P2P · не в сети";
    });
  }

  function updateTyping(remoteId, active) {
    mutateState((state) => {
      const user = state.users.find((item) => item.id === remoteUserId(remoteId));
      if (user) user.status = active ? "печатает…" : "P2P · в сети";
    });
  }

  async function syncOutgoing() {
    if (!connections.size) return;
    const state = Min.getState();
    for (const [remoteId, connection] of connections) {
      if (!connection.open) continue;
      const chat = state.chats.find((item) => item.network?.provider === "peerjs" && item.network.peerId === remoteId);
      if (!chat) continue;
      for (const message of state.messages.filter((item) => item.chatId === chat.id)) {
        if (message.senderId === "self") {
          const key = `${remoteId}:own:${message.id}`;
          const signature = messageSignature(message);
          if (signatures.get(key) !== signature) {
            signatures.set(key, signature);
            await sendFullMessage(connection, message);
          }
        } else if (message.network?.peerId === remoteId) {
          const key = `${remoteId}:remote:${message.id}`;
          const signature = JSON.stringify(message.reactions || {});
          if (remoteSignatures.get(key) !== signature) {
            remoteSignatures.set(key, signature);
            sendReactionPatch(connection, message);
          }
        }
      }
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = root.setInterval(syncOutgoing, 700);
  }

  function stopPolling() {
    if (!pollTimer) return;
    root.clearInterval(pollTimer);
    pollTimer = null;
  }

  function initPeer() {
    if (!PeerCtor) return;
    peerId = localId();
    try {
      peer = new PeerCtor(peerId, { debug: 1 });
    } catch (error) {
      setStatus(`P2P не запустился: ${error.message || error}`);
      return;
    }
    peer.on("open", (id) => {
      peerId = id;
      root.localStorage?.setItem(PEER_ID_KEY, id);
      setStatus("P2P включён, подключений нет");
      startPolling();
    });
    peer.on("connection", setupConnection);
    peer.on("call", answerCall);
    peer.on("disconnected", () => setStatus("Связь с сигнальным сервером потеряна"));
    peer.on("error", (error) => setStatus(`P2P: ${error.type || error.message || "ошибка"}`));
  }

  function settingsPanel() {
    return `<section class="min-p2p-settings" data-min-p2p-panel><h2>Прямое P2P-соединение</h2><div class="min-p2p-status"><span class="${connections.size ? "online" : ""}"></span><div><b>${escapeHtml(status)}</b><small>Сообщения и звонки идут через WebRTC. PeerJS Cloud используется только для знакомства браузеров.</small></div></div><label><div><b>Ваш MIN-ID</b><small>Передайте этот идентификатор собеседнику.</small></div><div class="min-p2p-copy"><input readonly value="${escapeHtml(peerId || localId())}"><button data-min-p2p-copy><img src="${icon("copy")}" alt=""></button></div></label><label><div><b>MIN-ID собеседника</b><small>Оба браузера должны быть открыты одновременно.</small></div><div class="min-p2p-connect"><input data-min-p2p-remote placeholder="min-xxxxxxxxxxxx"><button data-min-p2p-connect>Подключиться</button></div></label><p>Это настоящий прямой канал, но не полноценная облачная инфраструктура: нет офлайн-доставки, восстановления аккаунта и серверного архива.</p></section>`;
  }

  function contactButton() {
    return `<button class="min-p2p-contact-button" data-min-p2p-open><img src="${icon("connect")}" alt="">Подключиться по MIN-ID</button>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function decorate(container) {
    const settings = container.querySelector(".min-settings");
    if (settings && !settings.querySelector("[data-min-p2p-panel]")) settings.insertAdjacentHTML("beforeend", settingsPanel());
    const contactsHeader = container.querySelector(".min-page > header");
    if (contactsHeader && container.querySelector(".min-contact-grid") && !contactsHeader.querySelector("[data-min-p2p-open]")) contactsHeader.insertAdjacentHTML("beforeend", contactButton());
  }

  function decorateAll() {
    document.querySelectorAll(".min-app").forEach(decorate);
  }

  function activePeerChat(element) {
    const chatId = element.closest(".min-app")?.querySelector(".min-conversation")?.dataset.chatId;
    const chat = Min.chatById(chatId);
    return chat?.network?.provider === "peerjs" ? chat : null;
  }

  function showConnectDialog() {
    const value = prompt("Введите MIN-ID собеседника");
    if (value) connect(value);
  }

  function createCallOverlay(chat, type) {
    const app = document.querySelector(".min-app");
    if (!app) return null;
    app.querySelector("[data-min-p2p-call]")?.remove();
    const wrapper = document.createElement("div");
    wrapper.className = "min-p2p-call-overlay";
    wrapper.dataset.minP2pCall = "true";
    wrapper.innerHTML = `<section><div class="min-p2p-remote-video"><video data-min-p2p-remote-video autoplay playsinline></video><span>Ожидание собеседника…</span></div><video data-min-p2p-local-video autoplay muted playsinline></video><h2>${escapeHtml(chat.title)}</h2><p>${type === "video" ? "Видеозвонок" : "Аудиозвонок"} через WebRTC</p><div><button data-min-p2p-mic><img src="${icon("microphone")}" alt=""></button><button data-min-p2p-camera><img src="${icon("video-call")}" alt=""></button><button class="hangup" data-min-p2p-hangup><img src="${icon("end-call")}" alt=""></button></div></section>`;
    app.appendChild(wrapper);
    return wrapper;
  }

  async function startCall(chat, type) {
    const remoteId = chat.network.peerId;
    if (!peer || !connections.get(remoteId)?.open) {
      alert("Сначала подключитесь к собеседнику по MIN-ID.");
      return;
    }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      const overlay = createCallOverlay(chat, type);
      const local = overlay?.querySelector("[data-min-p2p-local-video]");
      if (local) local.srcObject = localStream;
      currentCall = peer.call(remoteId, localStream, { metadata: { profile: profilePayload(), type } });
      currentCall.on("stream", (stream) => attachRemoteStream(overlay, stream));
      currentCall.on("close", endCall);
      currentCall.on("error", endCall);
    } catch {
      alert("МИН не получил доступ к камере или микрофону.");
    }
  }

  async function answerCall(call) {
    const profile = call.metadata?.profile || {};
    const chat = ensurePeerChat(call.peer, profile);
    if (!confirm(`${profile.name || call.peer} звонит через МИН. Ответить?`)) {
      call.close();
      return;
    }
    const type = call.metadata?.type === "video" ? "video" : "audio";
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      const overlay = createCallOverlay(chat, type);
      const local = overlay?.querySelector("[data-min-p2p-local-video]");
      if (local) local.srcObject = localStream;
      currentCall = call;
      call.answer(localStream);
      call.on("stream", (stream) => attachRemoteStream(overlay, stream));
      call.on("close", endCall);
      call.on("error", endCall);
    } catch {
      call.close();
    }
  }

  function attachRemoteStream(overlay, stream) {
    const remote = overlay?.querySelector("[data-min-p2p-remote-video]");
    const label = overlay?.querySelector(".min-p2p-remote-video span");
    if (remote) remote.srcObject = stream;
    if (label) label.remove();
  }

  function endCall() {
    currentCall?.close?.();
    currentCall = null;
    localStream?.getTracks?.().forEach((track) => track.stop());
    localStream = null;
    document.querySelector("[data-min-p2p-call]")?.remove();
  }

  document.addEventListener("click", (event) => {
    const copy = event.target.closest("[data-min-p2p-copy]");
    if (copy) {
      navigator.clipboard?.writeText(peerId || localId());
      copy.classList.add("done");
      root.setTimeout(() => copy.classList.remove("done"), 800);
      return;
    }
    const connectButton = event.target.closest("[data-min-p2p-connect]");
    if (connectButton) {
      const input = connectButton.closest("label")?.querySelector("[data-min-p2p-remote]");
      if (input?.value) connect(input.value);
      return;
    }
    if (event.target.closest("[data-min-p2p-open]")) {
      showConnectDialog();
      return;
    }
    const callButton = event.target.closest("[data-min-call]");
    if (callButton) {
      const chat = activePeerChat(callButton);
      if (chat) {
        event.preventDefault();
        event.stopImmediatePropagation();
        startCall(chat, callButton.dataset.minCall);
      }
      return;
    }
    if (event.target.closest("[data-min-p2p-hangup]")) {
      endCall();
      return;
    }
    const mic = event.target.closest("[data-min-p2p-mic]");
    if (mic && localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) track.enabled = !track.enabled;
      mic.classList.toggle("off", track ? !track.enabled : true);
      return;
    }
    const camera = event.target.closest("[data-min-p2p-camera]");
    if (camera && localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) track.enabled = !track.enabled;
      camera.classList.toggle("off", track ? !track.enabled : true);
    }
  }, true);

  document.addEventListener("input", (event) => {
    const textarea = event.target.closest(".min-conversation textarea[data-min-text]");
    if (!textarea) return;
    const chat = activePeerChat(textarea);
    const connection = chat ? connections.get(chat.network.peerId) : null;
    if (connection?.open) connection.send({ type: "typing", active: Boolean(textarea.value) });
  });

  const observer = new MutationObserver(() => decorateAll());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  root.addEventListener("beforeunload", () => {
    stopPolling();
    endCall();
    for (const connection of connections.values()) connection.close?.();
    peer?.destroy?.();
  });

  initPeer();
  decorateAll();

  root.UntilFridayMinP2P = {
    get peerId() { return peerId; },
    get status() { return status; },
    get connections() { return connections; },
    connect,
    ensurePeerChat,
    syncOutgoing,
    startCall,
    endCall,
    decorateAll
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
