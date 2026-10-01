import { createFileRoute } from "@tanstack/react-router";

const hostCookieName = "__Host-pc-shopee-review-test";
const developmentCookieName = "pc-shopee-review-test-dev";

export function technicalCookie(value: string, maxAge: number, request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  const cookieName = secure ? hostCookieName : developmentCookieName;
  const secureAttribute = secure ? "; Secure" : "";

  return `${cookieName}=${value}; Max-Age=${maxAge}; Path=/${secureAttribute}; HttpOnly; SameSite=Strict`;
}

function technicalHeaders(value: string, maxAge: number, request: Request) {
  return {
    "Cache-Control": "no-store",
    "Set-Cookie": technicalCookie(value, maxAge, request),
  };
}

export const Route = createFileRoute("/api/shopee-review/cookie-test")({
  server: {
    handlers: {
      POST: ({ request }) =>
        Response.json(
          { ok: true, developmentCookie: new URL(request.url).protocol !== "https:" },
          { headers: technicalHeaders("synthetic", 60, request) },
        ),
      DELETE: ({ request }) =>
        Response.json(
          { ok: true },
          { headers: technicalHeaders("", 0, request) },
        ),
    },
  },
});
