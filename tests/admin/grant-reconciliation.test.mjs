import { test } from "node:test";
import assert from "node:assert/strict";
import { sameModuleGrants } from "../../src/lib/admin/grant-reconciliation.ts";

test("equal grants are idempotent regardless of order", () => {
  assert.equal(sameModuleGrants(["saude", "crm"], ["crm", "saude"]), true);
});
test("duplicates do not create false changes", () => {
  assert.equal(sameModuleGrants(["saude"], ["saude", "saude"]), true);
});
test("revocations and added grants are material changes", () => {
  assert.equal(sameModuleGrants(["saude"], []), false);
  assert.equal(sameModuleGrants(["saude"], ["saude", "financeiro"]), false);
});
test("empty grants match empty grants", () => {
  assert.equal(sameModuleGrants([], []), true);
});
