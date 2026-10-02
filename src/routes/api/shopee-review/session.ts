import { createFileRoute } from "@tanstack/react-router";
import { handleShopeeReviewBff } from "../../../server/shopeeReviewBff";

export const Route = createFileRoute("/api/shopee-review/session")({
  server: {
    handlers: {
      GET: ({ request }) => handleShopeeReviewBff(request, "session"),
    },
  },
});
