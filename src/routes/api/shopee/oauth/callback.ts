import { createFileRoute } from "@tanstack/react-router";

const CALLBACK_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

export const Route = createFileRoute("/api/shopee/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const supabaseUrl = process.env["SUPABASE_URL"];
        if (!supabaseUrl) {
          return Response.json(
            {
              ok: false,
              status: "not_configured",
              message: "Backend OAuth Shopee não configurado.",
            },
            { status: 503, headers: CALLBACK_HEADERS },
          );
        }

        const incoming = new URL(request.url);
        const upstream = new URL(
          `${supabaseUrl.replace(/\/$/u, "")}/functions/v1/shopee-sandbox-oauth/callback`,
        );
        incoming.searchParams.forEach((value, key) => upstream.searchParams.append(key, value));

        const response = await fetch(upstream, {
          method: "GET",
          headers: { Accept: "text/html,application/json;q=0.9" },
          redirect: "manual",
        });

        const contentType = response.headers.get("content-type") ?? "text/plain; charset=utf-8";
        return new Response(await response.text(), {
          status: response.status,
          headers: {
            ...CALLBACK_HEADERS,
            "Content-Type": contentType,
          },
        });
      },
    },
  },
});
