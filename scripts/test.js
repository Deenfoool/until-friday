"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const files = fs.readdirSync(path.join(root, "tests")).filter((name) => name.endsWith(".test.js")).sort();
let failed = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, [path.join(root, "tests", file)], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000
  });
  if (result.status === 0) console.log(`PASS ${file}`);
  else {
    failed += 1;
    console.error(`FAIL ${file}\n${result.stdout || ""}${result.stderr || ""}${result.error?.message || ""}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} проверок прошло.`);
process.exitCode = failed ? 1 : 0;
