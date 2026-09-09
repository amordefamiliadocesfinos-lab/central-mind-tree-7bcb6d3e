// IA-07.4 — Resumo IA usa Contexto Vivo como memória histórica principal.
// Fatos operacionais seguem lidos diretamente das fontes canônicas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const LIVE_CONTEXT_VERSION = 1;
const RECENT_LIMITS = { history: 6, orders: 3, tasks: 3 } as const;
const LEGACY_FALLBACK_LIMITS = { history: 50, orders: 20 } as const;

function validLiveContext(value: any) {
  return value?.version === LIVE_CONTEXT_VERSION && typeof value?.contact_id === 'string';
}

async function bootstrapLiveContext(url: string, authorization: string | null, contactId: string) {
  // A única rotina que constrói a memória. Falha preserva o fallback atual.
  if (!authorization) return null;
  try {
    const response = await fetch(`${url}/functions/v1/crm-live-context-bootstrap`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId }),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return validLiveContext(body?.context) ? body.context : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contact_id: contactId } = await req.json();
    if (!contactId || typeof contactId !== "string") return json({ error: "contact_id é obrigatório" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const supabase = createClient(supabaseUrl, serviceRole);
    const [contactResult, liveResult] = await Promise.all([
      supabase.from("contacts")
        .select("id,name,fantasy_name,type,funnel_status,temperatura_lead,commercial_opt_out,origem_lead,ultimo_contato,next_action_text,next_action_date,notes,paid_orders_count,lifetime_value")
        .eq("id", contactId).maybeSingle(),
      supabase.from('crm_contact_live_context')
        .select('contact_id,summary,memory,source_event_at,updated_at,version')
        .eq('contact_id', contactId).maybeSingle(),
    ]);
    const contact = contactResult.data;
    if (!contact) return json({ error: "Contato não encontrado" }, 404);

    let liveContext = validLiveContext(liveResult.data) ? liveResult.data : null;
    if (!liveContext) liveContext = await bootstrapLiveContext(supabaseUrl, req.headers.get('Authorization'), contactId);

    const usingLiveMemory = Boolean(liveContext);
    const historyLimit = usingLiveMemory ? RECENT_LIMITS.history : LEGACY_FALLBACK_LIMITS.history;
    const orderLimit = usingLiveMemory ? RECENT_LIMITS.orders : LEGACY_FALLBACK_LIMITS.orders;
    const [{ data: conversation }, { data: tasks }, { data: history }, { data: orders }] = await Promise.all([
      supabase.from('service_conversations')
        .select('attendance_state,status,needs_reply,return_at,last_inbound_at,last_outbound_at,last_message_at')
        .eq('contact_id', contactId).order('last_message_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('tasks')
        .select('title,due_date,scheduled_date,source,status')
        .eq('contact_id', contactId).is('deleted_at', null).neq('status', 'concluida')
        .order('due_date', { ascending: true }).limit(RECENT_LIMITS.tasks),
      supabase.from("contact_history")
        .select("interaction_type,event_type,description,interaction_date,created_at")
        .eq("contact_id", contactId).order("interaction_date", { ascending: false }).limit(historyLimit),
      supabase.from("orders")
        .select("order_number,status,payment_status,total_value,order_date,due_date")
        .eq("contact_id", contactId).is('deleted_at', null).order("order_date", { ascending: false }).limit(orderLimit),
    ]);

    const ctxLines: string[] = [
      '--- FATOS CANÔNICOS ATUAIS (SOBERANOS) ---',
      `Contato: ${contact.name ?? '—'}${contact.fantasy_name ? ` (${contact.fantasy_name})` : ''}`,
      `Tipo: ${contact.type ?? '—'} | Funil: ${contact.funnel_status ?? '—'} | Temperatura: ${contact.temperatura_lead ?? '—'} | Opt-out: ${contact.commercial_opt_out ? 'sim' : 'não'}`,
      `Origem: ${contact.origem_lead ?? '—'} | Último contato: ${contact.ultimo_contato ?? '—'}`,
      `Notas internas: ${contact.notes ?? '—'}`,
      `Próxima ação: ${contact.next_action_text ?? '—'} (${contact.next_action_date ?? '—'})`,
      `Conversa: ${conversation?.attendance_state ?? '—'} / ${conversation?.status ?? '—'} | precisa responder: ${conversation?.needs_reply ? 'sim' : 'não'} | retorno: ${conversation?.return_at ?? '—'}`,
      `Tarefas atuais: ${(tasks ?? []).map((task: any) => `${task.title} (${task.source ?? '—'} · ${task.due_date ?? task.scheduled_date ?? 'sem data'})`).join(' | ') || 'nenhuma'}`,
      `Compras: ${contact.paid_orders_count ?? 0} pagas | LTV: ${contact.lifetime_value ?? 0}`,
      '',
      '--- MEMÓRIA VIVA (INTERPRETATIVA; MENOS AUTORITÁRIA QUE OS FATOS ACIMA) ---',
      `Resumo consolidado: ${liveContext?.summary ?? 'indisponível; usando fallback histórico'}`,
      `Preferências, interesses, objeções e padrões: ${JSON.stringify(liveContext?.memory ?? {})}`,
      '',
      `--- EVENTOS RECENTES (${history?.length ?? 0}) ---`,
      ...((history ?? []).map((event: any) => `[${event.interaction_date ?? event.created_at}] ${event.interaction_type ?? event.event_type ?? 'evento'}: ${event.description ?? ''}`)),
      '',
      `--- PEDIDOS RECENTES (${orders?.length ?? 0}) ---`,
      ...((orders ?? []).map((order: any) => `#${order.order_number ?? '—'} | ${order.order_date ?? '—'} | ${order.status ?? '—'}/${order.payment_status ?? '—'} | R$ ${order.total_value ?? 0}`)),
    ];

    const systemPrompt =
      'Você é um assistente comercial sênior. Gere um briefing curto, acionável e útil em português, em markdown, com: **🎯 Resumo**, **🌡️ Estágio & situação**, **💡 Pontos-chave**, **⚠️ Objeções/Riscos** (se houver) e **✅ Próxima ação recomendada** (quando aplicável). ' +
      'Regra obrigatória de precedência: FATOS CANÔNICOS ATUAIS vencem EVENTOS RECENTES; ambos vencem MEMÓRIA VIVA. A memória é interpretativa, não invente nem altere etapa, opt-out, pagamento, tarefa ou próxima ação. Se faltar informação, diga.';

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: ctxLines.join("\n") }],
      }),
    });
    if (!aiResp.ok) {
      if (aiResp.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos da IA esgotados. Adicione créditos no workspace." }, 402);
      console.error("contact-summary gateway error:", aiResp.status, await aiResp.text());
      return json({ error: "Erro no gateway de IA" }, 500);
    }

    const data = await aiResp.json();
    return json({
      summary: data?.choices?.[0]?.message?.content ?? "Sem resumo gerado.",
      context_metrics: { using_live_memory: usingLiveMemory, history_events: history?.length ?? 0, orders: orders?.length ?? 0 },
    });
  } catch (error) {
    console.error("contact-summary error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro desconhecido" }, 500);
  }
});
