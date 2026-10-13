import { canOfferCrmCampaignFormalReconciliation } from './campaignFormalReconciliation';
import { assessCampaignDispatchEvidence, type CampaignDispatchRecipient, type CampaignDispatchMessage } from './campaignDispatchEvidence';
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error('CRM F0-D: ' + message);
}
const recipient: CampaignDispatchRecipient = {
  id: 'recipient-one', status: 'failed', conversation_id: 'conversation-one',
  rendered_message: 'Olá, cliente', service_message_id: 'message-one',
  error_code: 'dispatch_unconfirmed',
};
const message: CampaignDispatchMessage = {
  id: 'message-one', conversation_id: 'conversation-one',
  source: 'crm', direction: 'outbound',
  content: 'Olá, cliente', delivery_status: 'sent',
  external_message_id: 'wamid-one', created_at: '2026-10-13T18:00:00Z',
  provider_name: 'meta',
};
const evaluate = (override: Partial<CampaignDispatchMessage> = {}, r = recipient) =>
  assessCampaignDispatchEvidence({ recipient: r, lookup: 'found', message: {...message, ...override} });
for (const delivery_status of ['sent', 'delivered', 'read']) {
  const evidence = evaluate({delivery_status});
  assert(canOfferCrmCampaignFormalReconciliation({isAdmin:true,recipient,evidence}),
    `Evidência exata e externa para ${delivery_status} permite somente abrir confirmação administrativa.`);
  assert(!canOfferCrmCampaignFormalReconciliation({isAdmin:false,recipient,evidence}),
    'Operador sem papel administrador não pode iniciar conciliação.');
  assert(!evidence.replayAuthorized, 'Conciliação nunca autoriza reenvio.');
}
for (const delivery_status of ['pending','failed',null]) {
  const evidence = evaluate({delivery_status,external_message_id: null});
  assert(!canOfferCrmCampaignFormalReconciliation({isAdmin:true,recipient,evidence}),
    `Status ${delivery_status} não é comprovação formal de envio.`);
}
const evidence = evaluate();
assert(!canOfferCrmCampaignFormalReconciliation({
  isAdmin:true,recipient:{...recipient,service_message_id:'outro'},evidence,
}), 'Nenhuma mensagem de outro destinatário pode entrar em conciliação.');
assert(!canOfferCrmCampaignFormalReconciliation({
  isAdmin:true,recipient:{...recipient,status:'sent'},evidence,
}), 'Confirmação só parte de erro não resolvido.');
assert(!canOfferCrmCampaignFormalReconciliation({
  isAdmin:true,recipient:{...recipient,external_message_id:'outro-wamid'},evidence,
}), 'Referência externa divergente invalida o pedido.');
assert(!canOfferCrmCampaignFormalReconciliation({
  isAdmin:true,recipient,evidence:evaluate({id:'outra-mensagem'}),
}), 'Mensagem diferente não é prova.');
assert(!canOfferCrmCampaignFormalReconciliation({
  isAdmin:true,recipient,evidence:evaluate({external_message_id:null}),
}), 'Sem ID externo a confirmação não pode ser oferecida.');
console.log('campaignFormalReconciliation.test: OK');
