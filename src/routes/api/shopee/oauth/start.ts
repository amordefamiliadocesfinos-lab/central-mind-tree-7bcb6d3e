import { createFileRoute } from "@tanstack/react-router";

const HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

export const Route = createFileRoute("/api/shopee/oauth/start")({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = process.env["SUPABASE_URL"];
        if (!supabaseUrl) {
          return Response.json(
            { ok: false, error: "Shopee Sandbox OAuth backend indisponível." },
            { status: 503, headers: HEADERS },
          );
        }

        const target = `${supabaseUrl.replace(/\/$/u, "")}/functions/v1/shopee-sandbox-oauth/authorize`;
        return Response.redirect(target, 302);
      },
    },
  },
});
