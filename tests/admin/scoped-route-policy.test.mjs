import { test } from "node:test";
import assert from "node:assert/strict";
import { scopedRouteAllowed } from "../../src/lib/admin/scoped-route-policy.ts";

test("no grants: deny all routes", () => {
  for (const path of ["/", "/saude", "/saude/treino", "/crm", "/financeiro", "/admin/usuarios"]) {
    assert.equal(scopedRouteAllowed(path, []), false, path);
  }
});
test("health-only grants allow only /saude and children", () => {
  for (const path of ["/saude", "/saude/treino", "/saude/alimentacao", "/saude/evolucao"]) {
    assert.equal(scopedRouteAllowed(path, ["saude"]), true, path);
  }
  for (const path of ["/", "/saude-maliciosa", "/crm", "/financeiro", "/operacoes", "/admin/usuarios"]) {
    assert.equal(scopedRouteAllowed(path, ["saude"]), false, path);
  }
});
test("commercial module selections are not executable until domain APIs/RLS pass security review", () => {
  assert.equal(scopedRouteAllowed("/crm", ["crm", "saude"]), false);
  assert.equal(scopedRouteAllowed("/financeiro", ["financeiro"]), false);
  assert.equal(scopedRouteAllowed("/producao-operador", ["producao"]), false);
});
