import { CAMPAIGN_UNCONFIRMED_CODE, canSafelyRequeueCampaignRecipient, requiresCampaignSendReconciliation, isCampaignDispatchProtocolV2 } from './campaignReplaySafety';
function assert(v: unknown, message: string): asserts v { if (!v) throw new Error('CRM F0-B: ' + message); }

for (const error_code of [
  CAMPAIGN_UNCONFIRMED_CODE,
  'send_failed', 'timeout', 'unknown', 'provider_rejected',
  null,
]) {
  const row = { status: 'failed', error_code };
  assert(!canSafelyRequeueCampaignRecipient(row), `Falha ${error_code} com resultado incerto não pode voltar para fila.`);
  assert(requiresCampaignSendReconciliation(row), `Falha ${error_code} deve exigir conferência.`);
}
for (const error_code of ['not_configured', 'template_required', 'campaign_lookup_failed', 'campaign_claim_failed', 'missing_contact']) {
  const row = { status: 'failed', error_code, service_message_id: null, external_message_id: null };
  assert(canSafelyRequeueCampaignRecipient(row), `Pré-disparo ${error_code} é o único tipo reenfileirável.`);
  assert(!requiresCampaignSendReconciliation(row), `Pré-disparo ${error_code} não exige reconciliação de entrega.`);
}
for (const status of ['pending', 'sent', 'skipped', 'excluded']) {
  assert(!canSafelyRequeueCampaignRecipient({ status, error_code: 'template_required' }),
    `Status ${status} não pode sofrer retry de falha antiga.`);
}
assert(!canSafelyRequeueCampaignRecipient({
  status: 'failed', error_code: 'template_required', service_message_id: 'persisted-message',
}), 'Mesmo código pré-disparo com mensagem registrada não é seguro.');
assert(!canSafelyRequeueCampaignRecipient({
  status: 'failed', error_code: 'not_configured', external_message_id: 'wa-provider-message',
}), 'Mensagem externa identificada jamais pode ser automaticamente retransmitida.');
assert(isCampaignDispatchProtocolV2({ ok: true, campaign_dispatch_protocol: 2 }),
  'Runtime deve confirmar exatamente o protocolo 2 e sucesso autenticado.');
for (const response of [
  null, undefined, {}, { ok: false, campaign_dispatch_protocol: 2 },
  { ok: true, campaign_dispatch_protocol: 1 },
  { ok: true, campaign_dispatch_protocol: '2' },
  { error: 'Não autenticado', campaign_dispatch_protocol: 2 },
]) {
  assert(!isCampaignDispatchProtocolV2(response),
    'Resposta ausente, erro, protocolo antigo ou versão incorreta nunca autoriza envio.');
}
console.log('campaignReplaySafety.test: OK');
