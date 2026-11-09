import { test } from "node:test";
import assert from "node:assert/strict";
import { assertRolloutModules } from "../../src/lib/admin/rollout-module-policy.ts";

test("empty grants are a safe deny-by-default state", () => {
  assert.doesNotThrow(() => assertRolloutModules([]));
});
test("health-only grant is in the initial staged rollout", () => {
  assert.doesNotThrow(() => assertRolloutModules(["saude"]));
});
test("business grants remain blocked even when paired with health", () => {
  for (const module of ["crm", "financeiro", "operacoes", "digital", "producao", "dashboard", "assistente"]) {
    assert.throws(() => assertRolloutModules(["saude", module]));
  }
});
