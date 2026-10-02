const MAX_SESSION_SECONDS = 30 * 60;
const UPSTREAM_COOKIE_NAME = "__Host-pc-shopee-review";
const DEVELOPMENT_COOKIE_NAME = "pc-shopee-review-dev";

export type ReviewEndpoint = "login" | "session" | "data" | "logout";

type BffDependencies = {
  authUrl?: string;
  fetcher?: typeof fetch;
};

type UpstreamBody = Record<string, unknown>;

function noStoreHeaders(headers: HeadersInit = {}) {
  return { "Cache-Control": "no-store", ...headers };
}

function response(body: UpstreamBody, status: number, headers: HeadersInit = {}) {
  return Response.json(body, { status, headers: noStoreHeaders(headers) });
}

function currentOrigin(request: Request) {
  return new URL(request.url).origin;
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin === "null") return false;
  if (origin) return origin === currentOrigin(request);

  // Same-origin GET fetches may omit Origin. Do not accept a navigation or a
  // cross-site fetch in that case.
  return request.headers.get("sec-fetch-site") === "same-origin";
}

function hasJsonBody(request: Request) {
  return request.headers.get("content-type")?.split(";", 1)[0] === "application/json";
}

function browserCookieName(request: Request) {
  return new URL(request.url).protocol === "https:" ? UPSTREAM_COOKIE_NAME : DEVELOPMENT_COOKIE_NAME;
}

function extractCookie(cookieHeader: string | null, cookieName: string) {
  const prefix = `${cookieName}=`;
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function maxAgeFromSetCookie(cookie: string) {
  const match = /;\s*Max-Age=(\d+)/iu.exec(cookie);
  return Math.min(MAX_SESSION_SECONDS, Math.max(0, Number(match?.[1] ?? 0)));
}

function sessionCookieForBrowser(upstreamSetCookie: string, request: Request) {
  const value = extractCookie(upstreamSetCookie, UPSTREAM_COOKIE_NAME);
  if (value === null) return null;

  const maxAge = maxAgeFromSetCookie(upstreamSetCookie);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${browserCookieName(request)}=${value}; Max-Age=${maxAge}; Path=/${secure}; HttpOnly; SameSite=Strict`;
}

function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${browserCookieName(request)}=; Max-Age=0; Path=/${secure}; HttpOnly; SameSite=Strict`;
}

function configuredAuthUrl(dependencies: BffDependencies) {
  return dependencies.authUrl ?? process.env.SHOPEE_REVIEW_AUTH_URL;
}

async function parseJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

function safeError(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

function safeSuccess(endpoint: ReviewEndpoint, body: unknown): UpstreamBody {
  if (endpoint === "data" && body && typeof body === "object") return body as UpstreamBody;
  if ((endpoint === "login" || endpoint === "session") && body && typeof body === "object") {
    const expiresAt = "expires_at" in body && typeof body.expires_at === "string" ? body.expires_at : undefined;
    return expiresAt ? { ok: true, expires_at: expiresAt } : { ok: true };
  }
  return { ok: true };
}

function endpointMethod(endpoint: ReviewEndpoint) {
  return endpoint === "session" || endpoint === "data" ? "GET" : "POST";
}

export async function handleShopeeReviewBff(
  request: Request,
  endpoint: ReviewEndpoint,
  dependencies: BffDependencies = {},
) {
  const method = endpointMethod(endpoint);
  if (request.method !== method) return response({ error: "Método não permitido" }, 405);
  if (!hasSameOrigin(request)) return response({ error: "Origem não autorizada" }, 403);
  if (method === "POST" && !hasJsonBody(request)) return response({ error: "JSON obrigatório" }, 415);

  let body: unknown;
  if (method === "POST") {
    body = await parseJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) return response({ error: "JSON inválido" }, 400);
  }

  const browserCookie = extractCookie(request.headers.get("cookie"), browserCookieName(request));
  if ((endpoint === "session" || endpoint === "data") && !browserCookie) {
    return response({ error: "Sessão de revisão inválida ou expirada" }, 401, { "Set-Cookie": clearSessionCookie(request) });
  }

  const authUrl = configuredAuthUrl(dependencies);
  if (!authUrl) return response({ error: "Portal de revisão não configurado" }, 503);

  const target = new URL(`./${endpoint}`, authUrl.endsWith("/") ? authUrl : `${authUrl}/`);
  const headers = new Headers({ Origin: target.origin });
  if (method === "POST") headers.set("Content-Type", "application/json");
  if (browserCookie) headers.set("Cookie", `${UPSTREAM_COOKIE_NAME}=${browserCookie}`);

  let upstream: Response;
  try {
    upstream = await (dependencies.fetcher ?? fetch)(target, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body) : undefined,
    });
  } catch {
    return response({ error: "Portal de revisão indisponível" }, 503);
  }

  const upstreamBody = await upstream.json().catch(() => ({}));
  const upstreamCookie = upstream.headers.get("set-cookie");
  const browserSetCookie = upstreamCookie ? sessionCookieForBrowser(upstreamCookie, request) : null;
  const headersForBrowser: HeadersInit = browserSetCookie ? { "Set-Cookie": browserSetCookie } : {};

  if (!upstream.ok) {
    const errorHeaders: HeadersInit = upstream.status === 401 && !browserSetCookie
      ? { "Set-Cookie": clearSessionCookie(request) }
      : headersForBrowser;
    return response({ error: safeError(upstreamBody, "Portal de revisão indisponível") }, upstream.status, errorHeaders);
  }

  if (endpoint === "login" && !browserSetCookie) {
    return response({ error: "Não foi possível iniciar a sessão de revisão" }, 502);
  }

  return response(safeSuccess(endpoint, upstreamBody), 200, headersForBrowser);
}

export const shopeeReviewBffInternals = {
  browserCookieName,
  clearSessionCookie,
  hasSameOrigin,
  sessionCookieForBrowser,
};
