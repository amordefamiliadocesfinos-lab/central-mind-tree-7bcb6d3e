type LiveContextEvent = {
  contactId: string | null | undefined;
  occurredAt: string;
  type: 'inbound' | 'outbound' | 'campaign_response';
  summary?: string | null;
};

/**
 * Atualização auxiliar e monotônica para writers de Edge Functions. Não lança:
 * a entrega da mensagem continua soberana mesmo se a memória estiver ausente.
 */
export async function refreshLiveContextAfterEvent(supabase: any, event: LiveContextEvent) {
  try {
    if (!event.contactId || Number.isNaN(Date.parse(event.occurredAt))) return;
    const { data: existing, error: readError } = await supabase
      .from('crm_contact_live_context')
      .select('contact_id,summary,memory,source_event_at,version')
      .eq('contact_id', event.contactId)
      .maybeSingle();
    if (readError) throw readError;

    const previousAt = existing?.source_event_at ? Date.parse(existing.source_event_at) : 0;
    if (previousAt >= Date.parse(event.occurredAt)) return;
    let campaignResponse = false;
    if (event.type === 'inbound') {
      const windowStart = new Date(Date.parse(event.occurredAt) - 7 * 86400000).toISOString();
      const { data: recipient } = await supabase
        .from('crm_campaign_recipients')
        .select('id')
        .eq('contact_id', event.contactId)
        .eq('status', 'sent')
        .gte('sent_at', windowStart)
        .lte('sent_at', event.occurredAt)
        .limit(1)
        .maybeSingle();
      campaignResponse = Boolean(recipient);
    }
    const addition = event.summary?.trim().slice(0, 700);
    const summaryLine = campaignResponse && addition ? `Resposta a campanha: ${addition}` : addition;
    const summary = summaryLine
      ? [existing?.summary?.trim(), summaryLine].filter(Boolean).join('\n').slice(-4000)
      : existing?.summary ?? null;
    const { error: writeError } = await supabase.from('crm_contact_live_context').upsert({
      contact_id: event.contactId,
      summary,
      memory: existing?.memory ?? {},
      source_event_at: event.occurredAt,
      version: existing?.version ?? 1,
    }, { onConflict: 'contact_id' });
    if (writeError) throw writeError;
  } catch (error) {
    console.warn('live context incremental update skipped', (error as Error).message);
  }
}
