import { createFileRoute } from "@tanstack/react-router";

const HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

const SHOPEE_SANDBOX_OAUTH_URL =
  "https://xkskyutmtlhivvpfxkjg.supabase.co/functions/v1/shopee-sandbox-oauth";

export const Route = createFileRoute("/api/shopee/oauth/start")({
  server: {
    handlers: {
      GET: async () => {
        return Response.redirect(`${SHOPEE_SANDBOX_OAUTH_URL}/authorize`, 302);
      },
    },
  },
});
