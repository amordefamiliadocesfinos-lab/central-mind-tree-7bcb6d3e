import { test } from "node:test";
import assert from "node:assert/strict";
import { assertScopedProvisionIdentity } from "../../src/lib/admin/provision-identity-guard.ts";

const base = {
  requestedRole: null, existingAppRole: null,
  existingAppAuthId: null, existingAthleteAuthId: null,
  resolvedAuthId: null, healthAthleteSelected: true,
  modules: ["saude"],
};
test("existing Rafaela-like unlinked external profile can be provisioned for Health", () => {
  assert.doesNotThrow(() => assertScopedProvisionIdentity(base));
});
test("operational roles cannot be requested or converted", () => {
  assert.throws(() => assertScopedProvisionIdentity({ ...base, requestedRole: "Administrador" }));
  assert.throws(() => assertScopedProvisionIdentity({ ...base, existingAppRole: "VENDA" }));
  assert.throws(() => assertScopedProvisionIdentity({ ...base, existingAppRole: "PRODUÇÃO" }));
});
test("athlete linkage requires explicit Health grant", () => {
  assert.throws(() => assertScopedProvisionIdentity({ ...base, modules: [] }));
  assert.throws(() => assertScopedProvisionIdentity({ ...base, modules: ["crm"] }));
});
test("another Auth identity must never be reassigned by email or name", () => {
  assert.throws(() => assertScopedProvisionIdentity({ ...base, existingAppAuthId: "user-1" }));
  assert.throws(() => assertScopedProvisionIdentity({ ...base, existingAthleteAuthId: "user-2" }));
  assert.throws(() => assertScopedProvisionIdentity({
    ...base, existingAppAuthId: "user-1", resolvedAuthId: "user-3",
  }));
});
test("the same previously linked Auth may be reconciled", () => {
  assert.doesNotThrow(() => assertScopedProvisionIdentity({
    ...base, existingAppAuthId: "user-1", existingAthleteAuthId: "user-1",
    resolvedAuthId: "user-1",
  }));
});
