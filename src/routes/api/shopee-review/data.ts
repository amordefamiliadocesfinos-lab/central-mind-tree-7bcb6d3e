import { createFileRoute } from "@tanstack/react-router";
import { handleShopeeReviewBff } from "../../../server/shopeeReviewBff";

export const Route = createFileRoute("/api/shopee-review/data")({
  server: {
    handlers: {
      ANY: ({ request }) => handleShopeeReviewBff(request, "data"),
    },
  },
});
