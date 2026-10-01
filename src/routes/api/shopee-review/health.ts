import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/shopee-review/health")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true, runtime: "server", portal: "disabled" }),
    },
  },
});
