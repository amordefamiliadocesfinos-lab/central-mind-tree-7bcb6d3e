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

const FAST_MODEL = 'google/gemini-2.5-flash';
// O gateway pode recusar temporariamente um modelo forte. A chamada abaixo
// volta ao Flash nessa situação, sem interromper o atendimento.
const STRONG_MODEL = 'google/gemini-2.5-pro';
const LOW_CONFIDENCE_THRESHOLD = 0.7;

type EscalationReason =
  | 'low_confidence'
  | 'conflicting_signals'
  | 'multiple_products_or_quantities'
  | 'relative_date'
  | 'multiple_plausible_readings'
  | 'ambiguous_context';

const ESCALATION_REASONS = new Set<EscalationReason>([
  'low_confidence', 'conflicting_signals', 'multiple_products_or_quantities',
  'relative_date', 'multiple_plausible_readings', 'ambiguous_context',
]);

function requestEscalationReasons(body: any): EscalationReason[] {
  const values = body?.routing?.escalationReasons;
  return Array.isArray(values)
    ? [...new Set(values.filter((value): value is EscalationReason => typeof value === 'string' && ESCALATION_REASONS.has(value as EscalationReason)))]
    : [];
}

async function requestGateway(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
) {
  return fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, response_format: { type: 'json_object' } }),
  });
}

async function requestReplyModel(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
) {
  const response = await requestGateway(apiKey, model, messages);
  if (response.ok || model === FAST_MODEL) return { response, modelUsed: model };

  // Escalonamento é auxiliar. Se Pro estiver indisponível, o caso continua no
  // modelo rápido em vez de transformar uma sugestão em falha operacional.
  console.warn('crm-ai-assistant strong model unavailable; falling back to Flash', response.status);
  return { response: await requestGateway(apiKey, FAST_MODEL, messages), modelUsed: FAST_MODEL };
}

const SYSTEM_PROMPT = `Você é um analista de CRM brasileiro. Sua única tarefa é sugerir qual RESULTADO CANÔNICO representa o atendimento atual.

Regras OBRIGATÓRIAS:
- Escolha SOMENTE um código presente no catálogo enviado. Nunca invente código, etapa, próxima ação ou status.
- Se a conversa ainda NÃO tem informação suficiente para registrar um Resultado com segurança, responda suggested_result_code = null.
- Exemplo claro de null: o operador acabou de enviar uma mensagem e o cliente ainda não respondeu. NÃO sugira "Sem resposta" nesse caso.
- Conversa ambígua = confiança baixa ou null.
- Resposta de campanha usa o contexto normalmente; não existe Resultado especial de campanha.
- Opt-out é apenas informação de contexto; não muda a análise.
- confidence é um número entre 0 e 1.
- reason: uma frase curta, operacional, em português (explicação sua, não evidência).
- evidence_quotes: no máximo 3 trechos CURTOS copiados LITERALMENTE de mensagens do contexto recente que sustentam o Resultado. Cópia exata, caractere por caractere, sem parafrasear, sem traduzir, sem corrigir, sem juntar trechos de mensagens diferentes. Se não houver evidência textual direta, use [].

Responda APENAS com JSON puro: {"suggested_result_code": "CRM-RES-0XX" ou null, "confidence": 0.0-1.0, "reason": "...", "evidence_quotes": ["..."]}`;

/** Compilador enxuto: fatos soberanos → tarefa → recente → memória. */
function compactContext(ctx: any) {
  const messages = Array.isArray(ctx?.messages) ? ctx.messages.slice(-8) : [];
  const history = Array.isArray(ctx?.history) ? ctx.history.slice(0, 4) : [];
  const tasks = Array.isArray(ctx?.tasks) ? ctx.tasks.slice(0, 3) : [];
  const officialTask = tasks.find((task: any) => task?.source === 'crm_next_action');
  const memory = ctx?.liveContext?.memory ?? {};
  const compactList = (value: unknown) => Array.isArray(value)
    ? value.slice(0, 6).map((item) => String(item).slice(0, 180))
    : [];
  return [
    "--- FATOS CANÔNICOS ATUAIS (SOBERANOS) ---",
    `Etapa comercial: ${ctx?.contact?.stage ?? "—"}`,
    `Temperatura: ${ctx?.contact?.temperature ?? "—"} | Origem: ${ctx?.contact?.origin ?? "—"} | Opt-out: ${ctx?.contact?.optOut ? "sim" : "não"}`,
    `Estado do atendimento: ${ctx?.conversation?.state ?? "—"} | aguardando resposta nossa: ${ctx?.conversation?.needsReply ? "sim" : "não"}`,
    `Último inbound: ${ctx?.conversation?.lastInboundAt ?? "—"} | Último outbound: ${ctx?.conversation?.lastOutboundAt ?? "—"} | Retorno combinado: ${ctx?.conversation?.returnAt ?? "—"}`,
    `Último Resultado registrado: ${ctx?.lastResult ? `${ctx.lastResult.code} — ${ctx.lastResult.label} (${ctx.lastResultAt ?? "—"})` : "nenhum"}`,
    `Próxima Ação oficial: ${ctx?.nextAction ? `${ctx.nextAction.code} — ${ctx.nextAction.label} | prazo: ${ctx.nextAction.dueAt ?? '—'}` : 'nenhuma'}`,
    `Tarefa oficial pendente: ${officialTask ? `${officialTask.title} | prazo: ${officialTask.dueAt ?? '—'}` : 'nenhuma'}`,
    `Compras pagas: ${ctx?.purchases?.paidOrdersCount ?? 0} | Últimos pedidos: ${(ctx?.purchases?.lastOrders ?? []).map((o: any) => `#${o.orderNumber ?? o.id} ${o.status ?? ""}/${o.paymentStatus ?? ""}`).join(", ") || "nenhum"}`,
    `Campanha: ${ctx?.campaign ? `${ctx.campaign.campaignName} (enviada em ${ctx.campaign.sentAt}, respondeu: ${ctx.campaign.responded ? "sim" : "não"})` : "nenhuma"}`,
    "",
    "--- MEMÓRIA VIVA (INTERPRETATIVA; NUNCA SUBSTITUI FATOS CANÔNICOS) ---",
    `Resumo consolidado: ${String(ctx?.liveContext?.summary ?? "ainda não disponível").slice(0, 900)}`,
    `Preferências: ${JSON.stringify(compactList(memory.preferences))} | Interesses: ${JSON.stringify(compactList(memory.interests))} | Padrão de compra: ${JSON.stringify(memory.purchase_pattern ?? {})}`,
    "",
    `--- CONTEXTO RECENTE (${messages.length} mensagens, ordem cronológica) ---`,
    ...messages.map((m: any) => `[${m.createdAt}] ${m.direction === "inbound" ? "CLIENTE" : m.direction === "outbound" ? "OPERADOR" : "?"}: ${String(m.content ?? "").slice(0, 500)}`),
    "",
    `--- Eventos recentes (${history.length}) ---`,
    ...history.map((h: any) => `[${h.at}] ${h.eventType ?? "-"}: ${String(h.description ?? "").slice(0, 280)}`),
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

// FRENTE 4.3 — modo "next_action": a IA NÃO decide a Próxima Ação. O motor
// canônico (getCrmTransition) já decidiu no frontend; aqui a IA só explica e,
// em ambiguidade legítima, escolhe entre os candidatos canônicos enviados.
const NEXT_ACTION_SYSTEM_PROMPT = `Você é um analista de CRM brasileiro. A Próxima Ação já foi decidida por um motor determinístico canônico.

Regras OBRIGATÓRIAS:
- NUNCA invente uma próxima ação. Nunca escreva texto livre no lugar de um código CRM-PA-xxx.
- Se o motor já indicou uma próxima ação, apenas explique em uma frase curta por que ela faz sentido. Nesse caso chosen_next_action_code deve ser null.
- Se o motor indicou ausência de próxima ação e o campo "ambiguo" for true, você pode escolher UM código da lista de candidatos enviada, ou null se nenhuma ação imediata for necessária.
- Se "ambiguo" for false, chosen_next_action_code é obrigatoriamente null.
- Nunca sugira data, prazo ou agendamento.
- explanation: uma frase curta, operacional, em português.

Responda APENAS com JSON puro: {"explanation": "...", "chosen_next_action_code": "CRM-PA-0XX" ou null}`;

function handleNextActionMode(body: any, apiKey: string) {
  const context = body?.context;
  const candidates: CatalogItem[] = Array.isArray(body?.candidates) ? body.candidates : [];
  const allowed = new Set(candidates.map((item) => item.code));
  const ambiguous = Boolean(body?.ambiguous);
  const decision = body?.decision ?? {};

  const userContent = [
    `Resultado registrado/sugerido: ${body?.result?.code ?? "—"} — ${body?.result?.label ?? "—"}`,
    `Decisão do motor canônico — próxima ação: ${decision.nextActionCode ?? "nenhuma (ausência legítima)"}`,
    `Motivo do motor: ${decision.reason ?? "—"}`,
    `Política temporal: ${decision.temporalPolicy ?? "—"} | exige data: ${decision.requiresDate ? "sim" : "não"}`,
    `ambiguo: ${ambiguous}`,
    `Candidatos canônicos permitidos: ${candidates.map((item) => `${item.code} — ${item.label}`).join(" | ") || "nenhum"}`,
    "",
    "--- CONTEXTO DO ATENDIMENTO ---",
    compactContext(context),
  ].join("\n");

  // Próxima Ação é canônica: explicação sempre fica no modelo rápido e nunca
  // passa a decidir o que o motor já resolveu.
  return requestGateway(apiKey, FAST_MODEL, [
    { role: 'system', content: NEXT_ACTION_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]).then(async (aiResp) => {
    if (!aiResp.ok) {
      const detail = await aiResp.text();
      console.error("crm-ai-assistant next_action gateway error:", aiResp.status, detail);
      if (aiResp.status === 429) return json({ error: "Limite de requisições da IA atingido. Tente novamente em instantes." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
      return json({ error: "Erro no gateway de IA" }, 502);
    }
    const data = await aiResp.json();
    const parsed = parseAiJson(String(data?.choices?.[0]?.message?.content ?? ""));
    const explanation = typeof parsed?.explanation === "string" ? parsed.explanation.trim().slice(0, 280) : "";
    const rawChoice = typeof parsed?.chosen_next_action_code === "string" ? parsed.chosen_next_action_code.trim() : "";
    // Validação server-side: escolha só é aceita em ambiguidade e dentro do catálogo permitido.
    const chosen = ambiguous && rawChoice && allowed.has(rawChoice) ? rawChoice : null;
    return json({ explanation, chosen_next_action_code: chosen });
  });
}

// FRENTE 4.4 — modo "reply": resposta sugerida contextual. Somente leitura:
// a função NUNCA envia mensagem (não chama whatsapp-send) e não grava nada.
const REPLY_SYSTEM_PROMPT = `Você é um atendente comercial brasileiro experiente escrevendo por WhatsApp em nome da empresa.

Sua tarefa: sugerir a PRÓXIMA MENSAGEM que o operador enviaria ao cliente, coerente com o Resultado do atendimento e com a Próxima Ação recomendada.

Regras OBRIGATÓRIAS:
- Retorne suggested_reply = null quando NÃO houver motivo real para responder agora. Exemplos: o operador acabou de enviar mensagem e o cliente não respondeu; estamos aguardando o cliente; conversa encerrada sem ação atual; contexto insuficiente. Nunca escreva mensagem só para preencher espaço.
- Coerência: interesse demonstrado → avançar a conversa, nunca encerrar. Proposta em análise → respeitar o tempo do cliente, sem pressão indevida. Pagamento confirmado → reconhecer e orientar o próximo passo. Não deseja contato → NUNCA gerar nova abordagem promocional (retorne null).
- OPT-OUT: se o contato está em opt-out comercial e a última mensagem NÃO é do cliente, retorne null. Se o cliente enviou mensagem recente, pode responder àquela mensagem, sem oferta comercial nova.
- Escreva em português do Brasil, tom humano e direto, 1 a 4 frases, sem emojis em excesso, sem placeholders como [nome]. Use o primeiro nome do contato quando fizer sentido.
- A DECISÃO OPERACIONAL é recebida pronta: não escolha nem altere Resultado, Próxima Ação, responsabilidade ou risco. O PERFIL influencia somente tom, tamanho e forma de escrever.
- Nunca exponha tags, notas internas, objeções, riscos, memória interna ou lógica do CRM na mensagem ao cliente.
- Evite frases genéricas/robóticas como "fico à disposição", "será um prazer", "estamos à disposição" e urgência artificial.
- Nunca prometa prazo, preço ou desconto que não esteja no contexto. Nunca invente data de agendamento.
- O bloco CONHECIMENTO RELEVANTE é apenas apoio para fatos estáveis. Use-o somente se responder diretamente à dúvida e nunca cite FAQ, base, sistema ou fonte interna.
- Em conflito, fatos canônicos atuais e acontecimentos recentes prevalecem sobre o conhecimento. Nunca use conhecimento estático para afirmar estoque, disponibilidade, preço vigente, desconto, prazo operacional atual, status de pedido, pagamento confirmado, tarefa, Resultado ou Próxima Ação.
- Se o conhecimento não bastar, não preencha a lacuna por inferência: responda apenas com o que os fatos permitem ou retorne null quando não houver resposta útil.
- Pedido direto do cliente por chave PIX, catálogo, endereço, link, valor ou informação prometida é responsabilidade do operador quando não houver regra factual exigindo outro dado. Não invente CPF, nome ou requisito adicional.
- Expressões relativas em mensagem histórica ("amanhã", "depois", "semana que vem") são relativas ao timestamp exibido ao lado daquela mensagem. Se o prazo calculado já passou, não o trate como compromisso futuro.

Responda APENAS com JSON puro: {"suggested_reply": "texto" ou null, "reason": "frase curta explicando", "tone": "cordial|consultivo|objetivo|acolhedor" ou null}`;

async function handleReplyMode(body: any, apiKey: string) {
  const context = body?.context;
  const lastMessage = Array.isArray(context?.messages) && context.messages.length
    ? context.messages[context.messages.length - 1]
    : null;
  const lastIsInbound = lastMessage?.direction === "inbound";
  const optOut = Boolean(context?.contact?.optOut);
  const decision = body?.decision ?? {};
  const profile = body?.communicationProfile ?? {};
  const knowledge = Array.isArray(body?.knowledgeContext?.items) ? body.knowledgeContext.items.slice(0, 5) : [];
  const authoritativeKnowledgeAnswer = typeof body?.knowledgeContext?.authoritativeAnswer === 'string'
    ? body.knowledgeContext.authoritativeAnswer.trim()
    : '';

  // Guarda determinística: opt-out sem inbound recente nunca gera abordagem.
  if (optOut && !lastIsInbound) {
    return json({
      suggested_reply: null,
      reason: "Contato em opt-out comercial e sem mensagem recente do cliente: nova abordagem não é permitida.",
      tone: null,
    });
  }

  // A Camada A decide se há resposta legítima. Nenhuma variação de modelo ou
  // prompt pode transformar uma ausência de ação em texto para o cliente.
  if (decision.shouldReply === false) {
    return json({
      suggested_reply: null,
      reason: typeof decision.reason === 'string' && decision.reason.trim()
        ? decision.reason.trim().slice(0, 280)
        : 'A decisão operacional indica que não há resposta necessária no momento.',
      tone: null,
      intent: 'none',
      length: 'short',
    });
  }

  // FAQ estável e diretamente aplicável vence memória interpretativa e qualquer
  // inferência do modelo. O helper pode combinar até três fatos explícitos da
  // mesma pergunta; fatos dinâmicos jamais chegam por esta via.
  if (lastIsInbound && authoritativeKnowledgeAnswer) {
    return json({
      suggested_reply: authoritativeKnowledgeAnswer,
      reason: 'Resposta baseada em conhecimento estável aplicável.',
      tone: 'objetivo',
      intent: 'answer',
      length: 'short',
    });
  }

  const userContent = [
    '--- DECISÃO OPERACIONAL ESTRUTURADA (NÃO REESCREVER) ---',
    `Situação: ${decision.situation ?? '—'} | Intenção percebida: ${decision.perceivedIntent ?? '—'} | Intenção comercial: ${decision.commercialIntent ?? 'unknown'} | Responsabilidade: ${decision.responsibility ?? 'unknown'}`,
    `Resultado: ${decision.suggestedResult?.code ?? '—'} | Próxima ação: ${decision.nextAction?.code ?? '—'} | Deve responder: ${decision.shouldReply ? 'sim' : 'não'}`,
    `Estado decisório: ${decision.decisionState ?? 'unknown'} | Pagamento: ${decision.paymentState ?? 'none'} | Ambiguidade: ${decision.ambiguity ?? '—'} | Riscos: ${(decision.riskFlags ?? []).join(', ') || 'nenhum'} | Razão: ${decision.reason ?? '—'}`,
    '',
    '--- PERFIL DE COMUNICAÇÃO (INFLUENCIA SOMENTE A FORMA DE ESCREVER) ---',
    `Status: ${profile.status ?? 'building'} | Formalidade: ${profile.formality ?? 'low'} | Tamanho: ${profile.preferredLength ?? 'short'} | Tom: ${profile.generalTone ?? 'cordial'}`,
    `Follow-up: ${profile.followUpStyle ?? 'leve e sem pressão'} | Evitar: ${(profile.avoidedExpressions ?? []).join(' | ') || '—'}`,
    `Exemplos aprovados: ${(profile.approvedExamples ?? []).join(' | ') || 'nenhum'}`,
    '',
    `Resultado do atendimento (sugerido/selecionado): ${body?.result?.code ?? "—"} — ${body?.result?.label ?? "—"}`,
    `Próxima Ação recomendada: ${body?.nextAction?.code ?? "nenhuma ação imediata"} — ${body?.nextAction?.label ?? "—"}`,
    `Última mensagem é do cliente: ${lastIsInbound ? "sim" : "não"}`,
    `Opt-out comercial: ${optOut ? "sim" : "não"}`,
    "",
    "--- CONHECIMENTO RELEVANTE (FATOS ESTÁVEIS; NUNCA SUBSTITUI FATOS CANÔNICOS) ---",
    knowledge.length
      ? knowledge.map((item: any) => `Pergunta: ${String(item.question ?? '').slice(0, 280)}\nResposta: ${String(item.answer ?? '').slice(0, 700)}\nCategoria: ${String(item.category ?? 'geral')}`).join('\n\n')
      : 'Nenhum item aplicável.',
    "",
    "--- CONTEXTO PARA A RESPOSTA ---",
    compactCommunicationContext(context),
  ].join("\n");

  const escalationReasons = requestEscalationReasons(body);
  const routed = await requestReplyModel(
    apiKey,
    escalationReasons.length ? STRONG_MODEL : FAST_MODEL,
    [
      { role: 'system', content: REPLY_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  );
  const aiResp = routed.response;

  if (!aiResp.ok) {
    const detail = await aiResp.text();
    console.error("crm-ai-assistant reply gateway error:", aiResp.status, detail);
    if (aiResp.status === 429) return json({ error: "Limite de requisições da IA atingido. Tente novamente em instantes." }, 429);
    if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
    return json({ error: "Erro no gateway de IA" }, 502);
  }

  const data = await aiResp.json();
  const parsed = parseAiJson(String(data?.choices?.[0]?.message?.content ?? ""));
  const rawReply = typeof parsed?.suggested_reply === "string" ? parsed.suggested_reply.trim() : "";
  const reply = rawReply ? rawReply.slice(0, 1200) : null;
  const reason = typeof parsed?.reason === "string" && parsed.reason.trim()
    ? parsed.reason.trim().slice(0, 280)
    : (reply ? "Resposta alinhada ao Resultado e à Próxima Ação." : "Nenhuma resposta necessária no momento.");
  const tone = typeof parsed?.tone === "string" && parsed.tone.trim() ? parsed.tone.trim().slice(0, 40) : null;
  return json({ suggested_reply: reply, reason, tone, model_used: routed.modelUsed, escalation_reasons: escalationReasons });
}

/** Contexto de fala: exclui tags, objeções, fatos persistentes e notas internas. */
function compactCommunicationContext(ctx: any) {
  const messages = Array.isArray(ctx?.messages) ? ctx.messages.slice(-8) : [];
  const memory = ctx?.liveContext?.memory ?? {};
  const tasks = Array.isArray(ctx?.tasks) ? ctx.tasks.slice(0, 3) : [];
  const officialTask = tasks.find((task: any) => task?.source === 'crm_next_action');
  return [
    `Cliente: ${ctx?.contact?.name ?? '—'} | Etapa: ${ctx?.contact?.stage ?? '—'}`,
    `Estado do atendimento: ${ctx?.conversation?.state ?? '—'} | aguarda nossa resposta: ${ctx?.conversation?.needsReply ? 'sim' : 'não'} | return_at: ${ctx?.conversation?.returnAt ?? '—'}`,
    `Último Resultado: ${ctx?.lastResult ? `${ctx.lastResult.code} — ${ctx.lastResult.label}` : 'nenhum'} | Próxima ação oficial: ${ctx?.nextAction ? `${ctx.nextAction.code} — ${ctx.nextAction.label} | prazo: ${ctx.nextAction.dueAt ?? '—'}` : 'nenhuma'}`,
    `Tarefa oficial pendente: ${officialTask ? `${officialTask.title} | prazo: ${officialTask.dueAt ?? '—'}` : 'nenhuma'} | Opt-out: ${ctx?.contact?.optOut ? 'sim' : 'não'}`,
    `Preferências/interesses relevantes: ${JSON.stringify({ preferences: (memory.preferences ?? []).slice(0, 6), interests: (memory.interests ?? []).slice(0, 6), purchase_pattern: memory.purchase_pattern ?? {} })}`,
    '--- MENSAGENS RECENTES ---',
    ...messages.map((m: any) => `[${m.createdAt}] ${m.direction === 'inbound' ? 'CLIENTE' : 'OPERADOR'}: ${String(m.content ?? '').slice(0, 500)}`),
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const context = body?.context;

    if (body?.mode === "reply") {
      if (!context || !context.contact?.id) return json({ error: "context (CrmAiContext) é obrigatório" }, 400);
      const key = Deno.env.get("LOVABLE_API_KEY");
      if (!key) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
      return await handleReplyMode(body, key);
    }

    if (body?.mode === "next_action") {
      if (!context || !context.contact?.id) return json({ error: "context (CrmAiContext) é obrigatório" }, 400);
      const key = Deno.env.get("LOVABLE_API_KEY");
      if (!key) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
      return await handleNextActionMode(body, key);
    }

    const catalog: CatalogItem[] = Array.isArray(context?.catalogs?.results) ? context.catalogs.results : [];
    if (!context || !context.contact?.id) return json({ error: "context (CrmAiContext) é obrigatório" }, 400);
    if (!catalog.length) return json({ error: "catálogo de Resultados canônicos ausente no contexto" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const catalogText = catalog.map((item) => `${item.code} — ${item.label}: ${item.description}`).join("\n");
    const userContent = `--- CATÁLOGO DE RESULTADOS CANÔNICOS (${catalog.length}) ---\n${catalogText}\n\n--- CONTEXTO DO ATENDIMENTO ---\n${compactContext(context)}`;

    const gatewayMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ];
    const aiResp = await requestGateway(LOVABLE_API_KEY, FAST_MODEL, gatewayMessages);

    if (!aiResp.ok) {
      const detail = await aiResp.text();
      console.error("crm-ai-assistant gateway error:", aiResp.status, detail);
      if (aiResp.status === 429) return json({ error: "Limite de requisições da IA atingido. Tente novamente em instantes." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
      return json({ error: "Erro no gateway de IA" }, 502);
    }

    const data = await aiResp.json();
    const parsed = parseAiJson(String(data?.choices?.[0]?.message?.content ?? ""));
    let validated = validateSuggestion(parsed, catalog);
    const escalationReasons = requestEscalationReasons(body);
    if (!validated || validated.confidence < LOW_CONFIDENCE_THRESHOLD) {
      escalationReasons.push('low_confidence');
    }

    let modelUsed = FAST_MODEL;
    if (escalationReasons.length) {
      const strong = await requestGateway(LOVABLE_API_KEY, STRONG_MODEL, gatewayMessages);
      if (strong.ok) {
        const strongData = await strong.json();
        const strongParsed = parseAiJson(String(strongData?.choices?.[0]?.message?.content ?? ''));
        const strongValidated = validateSuggestion(strongParsed, catalog);
        if (strongValidated) {
          validated = strongValidated;
          modelUsed = STRONG_MODEL;
        }
      } else {
        // O escalonamento não é requisito para a disponibilidade do CRM.
        console.warn('crm-ai-assistant strong model unavailable; keeping Flash result', strong.status);
      }
    }
    if (!validated) {
      // Resposta malformada ou código inexistente: erro controlado, nunca quebra a Inbox.
      return json({ suggested_result_code: null, confidence: 0, reason: "Não foi possível interpretar a análise da IA com segurança.", invalid: true });
    }

    return json({ ...validated, model_used: modelUsed, escalation_reasons: [...new Set(escalationReasons)] });
  } catch (error) {
    console.error("crm-ai-assistant error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro desconhecido" }, 500);
  }
});
