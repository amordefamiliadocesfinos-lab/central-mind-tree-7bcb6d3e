import { createFileRoute } from "@tanstack/react-router";

const cookieName = "__Host-pc-shopee-review-test";

function technicalCookie(value: string, maxAge: number, request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  const secureAttribute = secure ? "; Secure" : "";

  return `${cookieName}=${value}; Max-Age=${maxAge}; Path=/${secureAttribute}; HttpOnly; SameSite=Strict`;
}

export const Route = createFileRoute("/api/shopee-review/cookie-test")({
  server: {
    handlers: {
      POST: ({ request }) =>
        Response.json(
          { ok: true, developmentCookie: new URL(request.url).protocol !== "https:" },
          { headers: { "Set-Cookie": technicalCookie("synthetic", 60, request) } },
        ),
      DELETE: ({ request }) =>
        Response.json(
          { ok: true },
          { headers: { "Set-Cookie": technicalCookie("", 0, request) } },
        ),
    },
  },
});
