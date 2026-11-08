/**
 * Live access-control smoke test: READ ONLY.
 * Run only against an authorized staging environment (or approved production
 * test identities with known fixtures). Never prints JWTs or user records.
 *
 * Required env:
 *   ACCESS_TEST_URL, ACCESS_TEST_PUBLISHABLE_KEY
 *   ACCESS_TEST_SCOPED_JWT, ACCESS_TEST_LEGACY_JWT
 *   ACCESS_TEST_OWN_ATHLETE_ID, ACCESS_TEST_OTHER_ATHLETE_ID
 *
 * This suite tests HTTP Supabase Data API behavior. It does NOT prove
 * security of Edge Functions, arbitrary RPCs, Storage, or Realtime.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const env = process.env;
const required = [
  "ACCESS_TEST_URL",
  "ACCESS_TEST_PUBLISHABLE_KEY",
  "ACCESS_TEST_SCOPED_JWT",
  "ACCESS_TEST_LEGACY_JWT",
  "ACCESS_TEST_OWN_ATHLETE_ID",
  "ACCESS_TEST_OTHER_ATHLETE_ID",
];
const missing = required.filter((key) => !env[key]);
if (missing.length) {
  throw new Error(`Missing secrets or fixtures: ${missing.join(", ")}. Refusing to claim live security PASS.`);
}
const baseUrl = new URL(env.ACCESS_TEST_URL);
if (!["https:"].includes(baseUrl.protocol)) throw new Error("Test API must use HTTPS.");
const api = new URL("/rest/v1/", baseUrl).toString();
const key = env.ACCESS_TEST_PUBLISHABLE_KEY;

async function listAs(role, table, params) {
  const jwt = role === "scoped" ? env.ACCESS_TEST_SCOPED_JWT
    : role === "legacy" ? env.ACCESS_TEST_LEGACY_JWT
    : null;
  const url = new URL(table, api);
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  const headers = { apikey: key, Accept: "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  else headers.Authorization = `Bearer ${key}`;
  const resp = await fetch(url, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(15000) });
  const data = await resp.text();
  if (resp.status === 401 || resp.status === 403) return { denied: true, count: 0, status: resp.status };
  if (!resp.ok) throw new Error(`Unexpected ${role} ${table} status ${resp.status}; check database/API setup.`);
  const rows = JSON.parse(data);
  if (!Array.isArray(rows)) throw new Error(`Unexpected ${role} ${table} shape.`);
  return { denied: false, count: rows.length, status: resp.status };
}
const businessTables = ["contacts","financial_accounts","financial_movements","ai_insights","tasks"];
for (const table of businessTables) {
  test(`anonymous and scoped Health cannot read business table ${table}`, async () => {
    const query = { select: "id", limit: "1" };
    const [anon, scoped] = await Promise.all([listAs("anon",table,query),listAs("scoped",table,query)]);
    assert.equal(anon.count, 0, `Anonymous user can read ${table}`);
    assert.equal(scoped.count, 0, `Scoped Health user can read ${table}`);
  });
}
test("legacy authorized user can still read seeded contacts", async () => {
  const r = await listAs("legacy","contacts",{ select:"id",limit:"1" });
  assert.equal(r.count,1,"Legacy fixture must exist and remain readable");
});
test("Health scoped user can read their own seeded athlete", async () => {
  const r = await listAs("scoped","health_athletes",{
    select: "id",id: `eq.${env.ACCESS_TEST_OWN_ATHLETE_ID}`,limit:"1"
  });
  assert.equal(r.count,1,"Own athlete must remain available");
});
test("Health scoped user cannot read a different seeded athlete", async () => {
  const r = await listAs("scoped","health_athletes",{
    select: "id",id: `eq.${env.ACCESS_TEST_OTHER_ATHLETE_ID}`,limit:"1"
  });
  assert.equal(r.count,0,"Other athlete must not be visible");
});
