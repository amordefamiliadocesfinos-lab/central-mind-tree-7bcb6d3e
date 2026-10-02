import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const serverModule = await import(pathToFileURL(path.resolve("dist/server/server.js")).href);
const keys = Reflect.ownKeys(serverModule);
console.log("SSR module exports", keys.map(String));

// ESM namespaces normally have a null prototype. Validate exported handler
// values, not the namespace itself: workerd unwraps each named export.
assert.equal(Object.getPrototypeOf(serverModule), null);
for (const key of keys) {
  if (typeof key === "symbol") continue;
  const value = serverModule[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
  let prototype = Object.getPrototypeOf(value);
  while (prototype !== Object.prototype) {
    assert.notEqual(
      prototype,
      null,
      `Export ${String(key)}: Exported value's prototype chain does not end in Object.`,
    );
    prototype = Object.getPrototypeOf(prototype);
  }
}

// The application entry source exports only default. Internal chunk-sharing
// exports must stay in internal chunks, not become public Worker entrypoints.
assert.deepEqual(Object.keys(serverModule), ["default"]);
const handler = serverModule.default;
assert.equal(Object.getPrototypeOf(handler), Object.prototype);
assert.equal(Object.getPrototypeOf(Object.getPrototypeOf(handler)), null);
assert.equal(typeof handler.fetch, "function");
const pending = handler.fetch(new Request("http://localhost/"));
assert.equal(typeof pending.then, "function");
const response = await pending;
assert.ok(response instanceof Response);
assert.equal(response.status, 200);
console.log("SSR Worker loader exports test passed");
