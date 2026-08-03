(function (root) {
  "use strict";

  const NativeMutationObserver = root.MutationObserver;
  if (!NativeMutationObserver || root.UntilFridayUiObserverHub) return;

  const subscribers = new Set();
  let nativeObserver = null;
  let scheduled = false;
  let pendingRecords = [];
  let nativeObserverCount = 0;

  function isWithin(target, node, subtree) {
    if (!target || !node) return false;
    if (target === node) return true;
    if (!subtree) return false;
    return typeof target.contains === "function" ? target.contains(node) : false;
  }

  function accepts(record, observation) {
    const options = observation.options || {};
    if (!isWithin(observation.target, record.target, Boolean(options.subtree))) return false;
    if (record.type === "childList") return Boolean(options.childList);
    if (record.type === "characterData") return Boolean(options.characterData);
    if (record.type === "attributes") {
      if (!options.attributes) return false;
      if (Array.isArray(options.attributeFilter) && options.attributeFilter.length) {
        return options.attributeFilter.includes(record.attributeName);
      }
      return true;
    }
    return false;
  }

  function filteredRecords(subscriber, records) {
    const result = [];
    for (const record of records) {
      if (subscriber.observations.some((observation) => accepts(record, observation))) {
        result.push(record);
      }
    }
    return result;
  }

  function flush() {
    scheduled = false;
    const records = pendingRecords;
    pendingRecords = [];

    for (const subscriber of [...subscribers]) {
      if (!subscriber.active) continue;
      const matching = filteredRecords(subscriber, records);
      if (!matching.length) continue;
      try {
        subscriber.callback(matching, subscriber.proxy);
      } catch (error) {
        console.error("Ошибка общего наблюдателя интерфейса", error);
      }
    }
  }

  function queue(records) {
    if (records?.length) pendingRecords.push(...records);
    if (scheduled) return;
    scheduled = true;
    const schedule = root.requestAnimationFrame || ((callback) => root.setTimeout(callback, 0));
    schedule(flush);
  }

  function ensureNativeObserver() {
    if (nativeObserver) return nativeObserver;
    nativeObserver = new NativeMutationObserver(queue);
    nativeObserverCount += 1;

    const target = root.document?.documentElement;
    if (target) {
      nativeObserver.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    } else {
      root.document?.addEventListener?.("DOMContentLoaded", () => {
        const lateTarget = root.document?.documentElement;
        if (!lateTarget || !nativeObserver) return;
        nativeObserver.observe(lateTarget, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
      }, { once: true });
    }
    return nativeObserver;
  }

  class SharedMutationObserver {
    constructor(callback) {
      if (typeof callback !== "function") throw new TypeError("MutationObserver callback must be a function");
      this.callback = callback;
      this.observations = [];
      this.active = true;
      this.proxy = this;
      subscribers.add(this);
      ensureNativeObserver();
    }

    observe(target, options = {}) {
      if (!target) throw new TypeError("MutationObserver target is required");
      this.active = true;
      const normalized = {
        childList: Boolean(options.childList),
        subtree: Boolean(options.subtree),
        attributes: Boolean(options.attributes || options.attributeFilter || options.attributeOldValue),
        characterData: Boolean(options.characterData || options.characterDataOldValue),
        attributeFilter: Array.isArray(options.attributeFilter) ? [...options.attributeFilter] : null
      };
      if (!normalized.childList && !normalized.attributes && !normalized.characterData) {
        throw new TypeError("At least one observation type must be enabled");
      }
      this.observations.push({ target, options: normalized });
      subscribers.add(this);
    }

    disconnect() {
      this.active = false;
      this.observations = [];
      subscribers.delete(this);
    }

    takeRecords() {
      const matching = filteredRecords(this, pendingRecords);
      if (!matching.length) return [];
      const matchingSet = new Set(matching);
      pendingRecords = pendingRecords.filter((record) => !matchingSet.has(record));
      return matching;
    }
  }

  root.MutationObserver = SharedMutationObserver;
  root.UntilFridayUiObserverHub = {
    NativeMutationObserver,
    SharedMutationObserver,
    flush,
    queue,
    stats: () => ({
      nativeObservers: nativeObserverCount,
      subscribers: subscribers.size,
      pendingRecords: pendingRecords.length,
      scheduled
    })
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
