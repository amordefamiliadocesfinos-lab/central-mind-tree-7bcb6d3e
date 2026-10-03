import { createFileRoute } from "@tanstack/react-router";

const CALLBACK_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

export const Route = createFileRoute("/api/shopee/oauth/callback")({
  server: {
    handlers: {
      GET: () => Response.json(
        {
          ok: false,
          status: "not_configured",
          message: "Callback OAuth Shopee reservado; troca de token ainda não configurada.",
        },
        {
          status: 503,
          headers: CALLBACK_HEADERS,
        },
      ),
    },
  },
});
