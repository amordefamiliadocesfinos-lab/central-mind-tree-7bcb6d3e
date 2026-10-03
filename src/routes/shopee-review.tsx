import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useState } from "react";

type ReviewAccount = {
  name: string;
  shopId: string;
  status: string;
  scope: string;
};

type ReviewOrder = {
  id: string;
  buyer: string;
  status: string;
  logistics: string;
};

type ReviewProduct = {
  name: string;
  variation: string;
  conversion: string;
};

type ReviewData = {
  accounts: ReviewAccount[];
  orders: ReviewOrder[];
  products: ReviewProduct[];
};

type ReviewSession = {
  ok: true;
  expires_at?: string;
};

type ReviewState = "checking" | "signed-out" | "signed-in";

export const Route = createFileRoute("/shopee-review")({
  component: ShopeeReviewPage,
});

async function requestReview<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/shopee-review/${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
  });
  const body = await response.json().catch(() => ({})) as { error?: string } & Partial<T>;
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a solicitação.");
  return body as T;
}

function ShopeeReviewPage() {
  const [state, setState] = useState<ReviewState>("checking");
  const [data, setData] = useState<ReviewData | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReview = useCallback(async () => {
    const [session, fixtures] = await Promise.all([
      requestReview<ReviewSession>("session"),
      requestReview<ReviewData>("data"),
    ]);
    setExpiresAt(session.expires_at ?? null);
    setData(fixtures);
    setState("signed-in");
  }, []);

  useEffect(() => {
    requestReview<ReviewSession>("session")
      .then(() => loadReview())
      .catch(() => setState("signed-out"));
  }, [loadReview]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    try {
      await requestReview<ReviewSession>("login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      event.currentTarget.reset();
      await loadReview();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível acessar o ambiente de revisão.");
      setState("signed-out");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setError("");
    setLoading(true);
    try {
      await requestReview<{ ok: true }>("logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Não foi possível encerrar a sessão.");
    } finally {
      setData(null);
      setExpiresAt(null);
      setState("signed-out");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-orange-400">Painel Central</p>
          <h1 className="mt-2 text-2xl font-semibold">Ambiente de Revisão Shopee</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Demonstração isolada, temporária e somente leitura. Nenhum dado operacional, cliente ou token real é exibido.
          </p>
        </header>

        {state === "checking" && (
          <section className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
            <p className="text-sm text-slate-300">Verificando sessão de revisão…</p>
          </section>
        )}

        {state === "signed-out" && (
          <section className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Acesso de revisão</h2>
            <p className="mt-2 text-sm text-slate-400">
              Use exclusivamente as credenciais temporárias fornecidas para homologação.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="username">Identificador de revisão</label>
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="password">Senha temporária</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-orange-400"
                />
              </div>

              <p className="min-h-5 text-sm text-red-300" role="alert">{error}</p>

              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Validando…" : "Acessar ambiente demonstrativo"}
              </button>
            </form>
          </section>
        )}

        {state === "signed-in" && data && (
          <section className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Visão demonstrativa</h2>
                <p className="mt-1 text-sm text-slate-400">Dados sintéticos · somente leitura · sem ações operacionais</p>
                {expiresAt && <p className="mt-1 text-xs text-slate-500">Sessão temporária: {new Date(expiresAt).toLocaleString("pt-BR")}</p>}
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleLogout}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium hover:border-slate-400 disabled:opacity-60"
              >
                Encerrar sessão
              </button>
            </div>

            {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}

            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              <DemoCard title="Contas">
                {data.accounts.map((item) => (
                  <div key={item.shopId} className="border-b border-slate-800 py-3 last:border-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.shopId}</p>
                    <p className="mt-2 text-sm text-slate-300">{item.status}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.scope}</p>
                  </div>
                ))}
              </DemoCard>

              <DemoCard title="Pedidos">
                {data.orders.map((item) => (
                  <div key={item.id} className="border-b border-slate-800 py-3 last:border-0">
                    <p className="font-medium">{item.id}</p>
                    <p className="mt-1 text-sm text-slate-300">{item.status}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.logistics}</p>
                  </div>
                ))}
              </DemoCard>

              <DemoCard title="Catálogo">
                {data.products.map((item) => (
                  <div key={`${item.name}-${item.variation}`} className="border-b border-slate-800 py-3 last:border-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-300">{item.variation}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.conversion}</p>
                  </div>
                ))}
              </DemoCard>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function DemoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-slate-700 bg-slate-950 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-300">{title}</h3>
      <div className="mt-2">{children}</div>
    </article>
  );
}
