import assert from "node:assert/strict";
import { handleShopeeReviewBff } from "../src/server/shopeeReviewBff.ts";

const appOrigin = "https://central-mind-tree.lovable.app";
const authUrl = "https://xkskyutmtlhivvpfxkjg.supabase.co/functions/v1/shopee-review-auth";
const validRequest = (path: string, init: RequestInit = {}) => new Request(`${appOrigin}${path}`, {
  ...init,
  headers: { Origin: appOrigin, ...(init.headers ?? {}) },
});
const sessionCookie = "__Host-pc-shopee-review=opaque-session";
const upstreamSessionCookie = `${sessionCookie}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=1800`;

let calls = 0;
const login = await handleShopeeReviewBff(
  validRequest("/api/shopee-review/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "review", password: "not-a-real-password" }),
  }),
  "login",
  {
    authUrl,
    fetcher: async (url, init) => {
      calls += 1;
      assert.equal(String(url), `${authUrl}/login`);
      assert.equal(new Headers(init?.headers).get("origin"), new URL(authUrl).origin);
      return Response.json({ ok: true, expires_at: "2030-01-01T00:00:00.000Z", token: "must-not-reach-browser" }, { headers: { "Set-Cookie": upstreamSessionCookie } });
    },
  },
);
assert.equal(login.status, 200);
assert.equal(calls, 1);
assert.equal(login.headers.get("cache-control"), "no-store");
assert.match(login.headers.get("set-cookie") ?? "", /^__Host-pc-shopee-review=opaque-session;/);
assert.match(login.headers.get("set-cookie") ?? "", /; Secure;/);
assert.match(login.headers.get("set-cookie") ?? "", /; HttpOnly;/);
assert.match(login.headers.get("set-cookie") ?? "", /SameSite=Strict/);
assert.match(login.headers.get("set-cookie") ?? "", /Path=\//);
assert.doesNotMatch(login.headers.get("set-cookie") ?? "", /Domain=/);
assert.deepEqual(await login.json(), { ok: true, expires_at: "2030-01-01T00:00:00.000Z" });

for (const origin of ["https://other.example", "null"]) {
  const blocked = await handleShopeeReviewBff(
    new Request(`${appOrigin}/api/shopee-review/login`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" }),
    "login",
    { authUrl, fetcher: async () => { throw new Error("must not call upstream"); } },
  );
  assert.equal(blocked.status, 403);
}

for (const endpoint of ["session", "data"] as const) {
  const missingSession = await handleShopeeReviewBff(
    validRequest(`/api/shopee-review/${endpoint}`, { method: "GET" }),
    endpoint,
    { authUrl, fetcher: async () => { throw new Error("must not call upstream"); } },
  );
  assert.equal(missingSession.status, 401);
  assert.match(missingSession.headers.get("set-cookie") ?? "", /^__Host-pc-shopee-review=;/);
}

const expired = await handleShopeeReviewBff(
  validRequest("/api/shopee-review/session", { method: "GET", headers: { Cookie: sessionCookie } }),
  "session",
  { authUrl, fetcher: async () => Response.json({ error: "Sessão de revisão inválida ou expirada" }, { status: 401 }) },
);
assert.equal(expired.status, 401);
assert.match(expired.headers.get("set-cookie") ?? "", /Max-Age=0/);

const logout = await handleShopeeReviewBff(
  validRequest("/api/shopee-review/logout", { method: "POST", headers: { "Content-Type": "application/json", Cookie: sessionCookie }, body: "{}" }),
  "logout",
  { authUrl, fetcher: async () => Response.json({ ok: true }, { headers: { "Set-Cookie": "__Host-pc-shopee-review=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0" } }) },
);
assert.equal(logout.status, 200);
assert.match(logout.headers.get("set-cookie") ?? "", /^__Host-pc-shopee-review=;/);
assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/);

console.log("shopee review BFF tests passed");
