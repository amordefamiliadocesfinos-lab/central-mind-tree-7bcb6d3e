import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const entryPath = path.resolve("dist/server/server.js");

assert.ok(existsSync(entryPath), "Build SSR ausente: execute o build antes deste teste.");

const serverModule = await import(pathToFileURL(entryPath).href);
const server = serverModule.default;

assert.equal(typeof server, "object", "O export default SSR precisa ser um objeto.");
assert.notEqual(server, null, "O export default SSR não pode ser nulo.");
assert.equal(typeof server.fetch, "function", "O export default SSR precisa expor fetch().");
assert.equal(
  Object.getPrototypeOf(server),
  Object.prototype,
  "O export default SSR precisa ser um objeto simples, compatível com o Worker Loader.",
);
assert.equal(
  Object.getPrototypeOf(Object.getPrototypeOf(server)),
  null,
  "A cadeia de protótipos do export SSR precisa terminar em Object.",
);

const response = await server.fetch(new Request("http://localhost/"));

assert.ok(response instanceof Response, "O handler SSR precisa retornar uma Response.");
assert.equal(response.status, 200, "A rota raiz SSR precisa responder 200.");

console.log("SSR worker export test passed");
