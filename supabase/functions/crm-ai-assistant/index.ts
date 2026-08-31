// FRENTE 4.2 — Inteligência Assistida CRM: sugestão de Resultado.
// A função é SOMENTE LEITURA: recebe o CrmAiContext montado no frontend (F4.1),
// consulta o Lovable AI Gateway e devolve uma sugestão validada.
// Não grava Resultado, não altera etapa, tarefa, return_at, prioridade,
// opt-out, campanha e não envia mensagem.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface CatalogItem { code: string; label: string; description: string }

const SYSTEM_PROMPT = `Você é um analista de CRM brasileiro. Sua única tarefa é sugerir qual RESULTADO CANÔNICO representa o atendimento atual.

Regras OBRIGATÓRIAS:
- Escolha SOMENTE um código presente no catálogo enviado. Nunca invente código, etapa, próxima ação ou status.
- Se a conversa ainda NÃO tem informação suficiente para registrar um Resultado com segurança, responda suggested_result_code = null.
- Exemplo claro de null: o operador acabou de enviar uma mensagem e o cliente ainda não respondeu. NÃO sugira "Sem resposta" nesse caso.
- Conversa ambígua = confiança baixa ou null.
- Resposta de campanha usa o contexto normalmente; não existe Resultado especial de campanha.
- Opt-out é apenas informação de contexto; não muda a análise.
- confidence é um número entre 0 e 1.
- reason: uma frase curta, operacional, em português.

Responda APENAS com JSON puro: {"suggested_result_code": "CRM-RES-0XX" ou null, "confidence": 0.0-1.0, "reason": "..."}`;

function compactContext(ctx: any) {
  const messages = Array.isArray(ctx?.messages) ? ctx.messages.slice(-15) : [];
  const history = Array.isArray(ctx?.history) ? ctx.history.slice(0, 8) : [];
  return [
    `Etapa comercial: ${ctx?.contact?.stage ?? "—"}`,
    `Temperatura: ${ctx?.contact?.temperature ?? "—"} | Origem: ${ctx?.contact?.origin ?? "—"} | Opt-out: ${ctx?.contact?.optOut ? "sim" : "não"}`,
    `Estado do atendimento: ${ctx?.conversation?.state ?? "—"} | aguardando resposta nossa: ${ctx?.conversation?.needsReply ? "sim" : "não"}`,
    `Último inbound: ${ctx?.conversation?.lastInboundAt ?? "—"} | Último outbound: ${ctx?.conversation?.lastOutboundAt ?? "—"} | Retorno combinado: ${ctx?.conversation?.returnAt ?? "—"}`,
    `Último Resultado registrado: ${ctx?.lastResult ? `${ctx.lastResult.code} — ${ctx.lastResult.label} (${ctx.lastResultAt ?? "—"})` : "nenhum"}`,
    `Compras pagas: ${ctx?.purchases?.paidOrdersCount ?? 0} | Últimos pedidos: ${(ctx?.purchases?.lastOrders ?? []).map((o: any) => `#${o.orderNumber ?? o.id} ${o.status ?? ""}/${o.paymentStatus ?? ""}`).join(", ") || "nenhum"}`,
    `Campanha: ${ctx?.campaign ? `${ctx.campaign.campaignName} (enviada em ${ctx.campaign.sentAt}, respondeu: ${ctx.campaign.responded ? "sim" : "não"})` : "nenhuma"}`,
    `Tags: ${(ctx?.tags ?? []).join(", ") || "—"}`,
    "",
    `--- Últimas mensagens (${messages.length}, ordem cronológica) ---`,
    ...messages.map((m: any) => `[${m.createdAt}] ${m.direction === "inbound" ? "CLIENTE" : m.direction === "outbound" ? "OPERADOR" : "?"}: ${String(m.content ?? "").slice(0, 500)}`),
    "",
    `--- Histórico recente (${history.length}) ---`,
    ...history.map((h: any) => `[${h.at}] ${h.eventType ?? "-"}: ${h.description ?? ""}`),
  ].join("\n");
}

/** Validação server-side: código canônico existente + confiança normalizada. */
export function validateSuggestion(raw: any, catalog: CatalogItem[]) {
  if (!raw || typeof raw !== "object") return null;
  const codes = new Set(catalog.map((item) => item.code));
  const code = raw.suggested_result_code;
  let suggested: string | null = null;
  if (typeof code === "string" && code.trim()) {
    if (!codes.has(code.trim())) return null; // IA inventou código → resposta inválida
    suggested = code.trim();
  }
  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = suggested ? 0.5 : 0;
  if (confidence > 1) confidence = confidence / 100;
  confidence = Math.min(1, Math.max(0, confidence));
  const reason = typeof raw.reason === "string" && raw.reason.trim()
    ? raw.reason.trim().slice(0, 280)
    : (suggested ? "Sugestão baseada no contexto do atendimento." : "Ainda aguardando resposta do cliente.");
  return { suggested_result_code: suggested, confidence, reason };
}

function parseAiJson(content: string): any {
  const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* tenta extrair objeto */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const context = body?.context;
    const catalog: CatalogItem[] = Array.isArray(context?.catalogs?.results) ? context.catalogs.results : [];
    if (!context || !context.contact?.id) return json({ error: "context (CrmAiContext) é obrigatório" }, 400);
    if (!catalog.length) return json({ error: "catálogo de Resultados canônicos ausente no contexto" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const catalogText = catalog.map((item) => `${item.code} — ${item.label}: ${item.description}`).join("\n");
    const userContent = `--- CATÁLOGO DE RESULTADOS CANÔNICOS (${catalog.length}) ---\n${catalogText}\n\n--- CONTEXTO DO ATENDIMENTO ---\n${compactContext(context)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const detail = await aiResp.text();
      console.error("crm-ai-assistant gateway error:", aiResp.status, detail);
      if (aiResp.status === 429) return json({ error: "Limite de requisições da IA atingido. Tente novamente em instantes." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
      return json({ error: "Erro no gateway de IA" }, 502);
    }

    const data = await aiResp.json();
    const parsed = parseAiJson(String(data?.choices?.[0]?.message?.content ?? ""));
    const validated = validateSuggestion(parsed, catalog);
    if (!validated) {
      // Resposta malformada ou código inexistente: erro controlado, nunca quebra a Inbox.
      return json({ suggested_result_code: null, confidence: 0, reason: "Não foi possível interpretar a análise da IA com segurança.", invalid: true });
    }

    return json(validated);
  } catch (error) {
    console.error("crm-ai-assistant error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro desconhecido" }, 500);
  }
});
