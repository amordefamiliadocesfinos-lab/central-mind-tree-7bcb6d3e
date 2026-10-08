import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const LIVE_CONTEXT_VERSION = 1;

function parseJson(content: string): Record<string, unknown> | null {
  const cleaned = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* tenta o objeto contido na resposta */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function asList(value: unknown, maximum = 20): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().slice(0, 500))
    .filter(Boolean);
  return list.length ? [...new Set(list)].slice(0, maximum) : undefined;
}

function normalizeMemory(value: unknown, purchasePattern: Record<string, unknown>) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const memory = {
    ...(asList(raw.preferences) ? { preferences: asList(raw.preferences) } : {}),
    ...(asList(raw.objections) ? { objections: asList(raw.objections) } : {}),
    ...(asList(raw.interests) ? { interests: asList(raw.interests) } : {}),
    ...(asList(raw.persistent_facts) ? { persistent_facts: asList(raw.persistent_facts) } : {}),
    ...(Object.keys(purchasePattern).length ? { purchase_pattern: purchasePattern } : {}),
  };
  return memory;
}

function derivePurchasePattern(orders: any[], orderItems: any[]): Record<string, unknown> {
  const paid = orders
    .filter(order => {
      const paymentStatus = String(order.payment_status ?? '').toLowerCase();
      const orderStatus = String(order.status ?? '').toLowerCase();
      return ['pago', 'paid', 'concluido', 'concluida', 'completed'].includes(paymentStatus)
        || ['concluido', 'concluida', 'completed'].includes(orderStatus);
    })
    .map(order => String(order.order_date ?? ''))
    .filter(date => !Number.isNaN(Date.parse(date)))
    .sort();
  const pattern: Record<string, unknown> = {};
  if (paid.length) pattern.last_purchase_at = paid[paid.length - 1];
  if (paid.length >= 2) {
    const intervals = paid.slice(1).map((date, index) => (Date.parse(date) - Date.parse(paid[index])) / 86400000).filter(days => days > 0);
    if (intervals.length) pattern.approximate_frequency_days = Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length);
  }
  const recurring = new Map<string, number>();
  for (const item of orderItems) {
    if (typeof item.product_id === 'string') recurring.set(item.product_id, (recurring.get(item.product_id) ?? 0) + 1);
  }
  const productIds = [...recurring].filter(([, count]) => count >= 2).map(([productId]) => productId).slice(0, 20);
  if (productIds.length) pattern.recurring_product_ids = productIds;
  return pattern;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''));
  if (claimsError || !claimsData?.claims) return json({ error: 'Não autenticado' }, 401);

  const body = await req.json().catch(() => null);
  const contactId = typeof body?.contact_id === 'string' ? body.contact_id.trim() : '';
  if (!contactId) return json({ error: 'contact_id é obrigatório' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: existing, error: existingError } = await supabase
    .from('crm_contact_live_context')
    .select('contact_id, summary, memory, source_event_at, updated_at, version')
    .eq('contact_id', contactId)
    .maybeSingle();
  if (existingError) return json({ error: existingError.message }, 500);
  if (existing?.version === LIVE_CONTEXT_VERSION) return json({ context: existing, bootstrapped: false });

  const [{ data: contact }, { data: history }, { data: conversations }, { data: orders }, { data: tags }, { data: campaignRecipients }] = await Promise.all([
    supabase.from('contacts').select('id,name,funnel_status,origem_lead,temperatura_lead,notes,paid_orders_count,lifetime_value,last_purchase_date,last_payment_date').eq('id', contactId).maybeSingle(),
    supabase.from('contact_history').select('event_type,event_code,description,event_metadata,interaction_date').eq('contact_id', contactId).order('interaction_date', { ascending: false }).limit(60),
    supabase.from('service_conversations').select('id,last_message_at,last_inbound_at,last_outbound_at').eq('contact_id', contactId).order('last_message_at', { ascending: false }).limit(1),
    supabase.from('orders').select('id,order_number,status,payment_status,total_value,order_date').eq('contact_id', contactId).is('deleted_at', null).order('order_date', { ascending: false }).limit(20),
    supabase.from('contact_tag_assignments').select('tag:contact_tags(name)').eq('contact_id', contactId),
    supabase.from('crm_campaign_recipients').select('sent_at,status,campaign:crm_campaigns(name)').eq('contact_id', contactId).eq('status', 'sent').order('sent_at', { ascending: false }).limit(3),
  ]);
  if (!contact) return json({ error: 'Contato não encontrado' }, 404);

  const orderIds = (orders ?? []).map(order => order.id).filter(Boolean);
  const conversationId = conversations?.[0]?.id;
  const [{ data: orderItems }, { data: messages }] = await Promise.all([
    orderIds.length ? supabase.from('order_items').select('product_id').in('order_id', orderIds) : Promise.resolve({ data: [] }),
    conversationId ? supabase.from('service_messages').select('direction,sender,content,created_at').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
  ]);

  const purchasePattern = derivePurchasePattern(orders ?? [], orderItems ?? []);
  const tagsText = (tags ?? []).map((row: any) => row?.tag?.name).filter(Boolean).join(', ') || '—';
  const campaignText = (campaignRecipients ?? []).map((row: any) => `${row?.campaign?.name ?? 'Campanha'} em ${row.sent_at ?? '—'}`).join(' | ') || 'nenhuma';
  const facts = [
    `Contato: ${contact.name ?? '—'} | etapa: ${contact.funnel_status ?? '—'} | origem: ${contact.origem_lead ?? '—'} | temperatura: ${contact.temperatura_lead ?? '—'}`,
    `Indicadores de compra: ${contact.paid_orders_count ?? 0} pedidos pagos | LTV: ${contact.lifetime_value ?? 0} | última compra: ${contact.last_purchase_date ?? contact.last_payment_date ?? '—'}`,
    `Tags: ${tagsText}`,
    `Campanhas recentes: ${campaignText}`,
    `Notas internas: ${contact.notes ?? '—'}`,
    '--- Mensagens recentes ---',
    ...(messages ?? []).reverse().map((message: any) => `[${message.created_at}] ${message.direction ?? message.sender ?? '?'}: ${String(message.content ?? '').slice(0, 700)}`),
    '--- Histórico comercial ---',
    ...(history ?? []).slice(0, 60).map((event: any) => `[${event.interaction_date}] ${event.event_type ?? event.event_code ?? 'evento'}: ${String(event.description ?? '').slice(0, 700)}`),
    '--- Pedidos ---',
    ...(orders ?? []).map((order: any) => `#${order.order_number ?? order.id} ${order.order_date ?? '—'} ${order.status ?? '—'}/${order.payment_status ?? '—'} R$ ${order.total_value ?? 0}`),
  ].join('\n');

  const prompt = `Você consolida memória interpretativa de CRM. Use SOMENTE evidências do contexto. Não decida etapa, Resultado, prioridade, pagamento, tarefa ou próxima ação. Não invente fatos.\n\nRetorne JSON puro com: {"summary":"texto curto ou null","preferences":["..."],"objections":["..."],"interests":["..."],"persistent_facts":["..."]}. Use arrays vazios quando não houver evidência.\n\n${facts}`;
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return json({ error: 'LOVABLE_API_KEY não configurada' }, 500);
  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'system', content: 'Responda apenas JSON válido.' }, { role: 'user', content: prompt }], response_format: { type: 'json_object' } }),
  });
  if (!aiResponse.ok) return json({ error: 'Não foi possível gerar o Contexto Vivo agora.' }, 502);
  const generated = parseJson(String((await aiResponse.json())?.choices?.[0]?.message?.content ?? ''));
  const summary = typeof generated?.summary === 'string' && generated.summary.trim() ? generated.summary.trim().slice(0, 4000) : null;
  const sourceEventAt = [
    conversations?.[0]?.last_message_at,
    history?.[0]?.interaction_date,
    orders?.[0]?.order_date,
  ].filter(Boolean).sort().at(-1) ?? null;
  const { data: saved, error: saveError } = await supabase
    .from('crm_contact_live_context')
    .upsert({ contact_id: contactId, summary, memory: normalizeMemory(generated, purchasePattern), source_event_at: sourceEventAt, version: LIVE_CONTEXT_VERSION }, { onConflict: 'contact_id' })
    .select('contact_id, summary, memory, source_event_at, updated_at, version')
    .single();
  if (saveError) return json({ error: saveError.message }, 500);
  return json({ context: saved, bootstrapped: true });
});
