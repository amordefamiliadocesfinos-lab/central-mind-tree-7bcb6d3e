import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shopee-review")({
  component: ShopeeReviewTechnicalPage,
});

function ShopeeReviewTechnicalPage() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="text-xl font-semibold">Portal de revisão Shopee</h1>
      <p className="mt-2 text-sm text-muted-foreground">Infraestrutura técnica local. O portal permanece desativado.</p>
    </main>
  );
}
