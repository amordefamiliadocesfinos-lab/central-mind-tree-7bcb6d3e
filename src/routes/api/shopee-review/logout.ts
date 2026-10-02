import { createFileRoute } from "@tanstack/react-router";
import { handleShopeeReviewBff } from "../../../server/shopeeReviewBff";

export const Route = createFileRoute("/api/shopee-review/logout")({
  server: {
    handlers: {
      POST: ({ request }) => handleShopeeReviewBff(request, "logout"),
    },
  },
});
