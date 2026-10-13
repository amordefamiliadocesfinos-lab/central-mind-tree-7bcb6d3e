import { assessCampaignDispatchEvidence, type CampaignDispatchMessage, type CampaignDispatchRecipient } from './campaignDispatchEvidence';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error('CRM F0-C: ' + message);
}
const recipient: CampaignDispatchRecipient = {
  id: 'recipient-1', status: 'failed', conversation_id: 'conv-1',
  rendered_message: 'Olá, Maria', service_message_id: 'message-1',
  error_code: 'dispatch_unconfirmed',
};
const msg: CampaignDispatchMessage = {
  id: 'message-1', conversation_id: 'conv-1', source: 'crm',
  direction: 'outbound', content: 'Olá, Maria', delivery_status: 'sent',
  external_message_id: 'wamid-1', created_at: '2026-10-13T18:00:00Z', provider_name: 'meta',
};
function evidence(partial: Partial<CampaignDispatchMessage>, r = recipient) {
  return assessCampaignDispatchEvidence({recipient:r, lookup:'found', message:{...msg,...partial}});
}
const sent = evidence({});
assert(sent.state === 'provider_accepted' && sent.providerMessageId === 'wamid-1'
  && !sent.replayAuthorized && !sent.message.includes('entrega confirmada'),
  'Status sent e ID externo representam aceite, não entrega, nem habilitam replay.');
const delivered = evidence({delivery_status:'delivered'});
assert(delivered.state === 'provider_delivered' && !delivered.replayAuthorized,
  'Entrega reportada pelo histórico não altera estado do destinatário automaticamente.');
const read = evidence({delivery_status:'read'});
assert(read.state === 'provider_read' && !read.replayAuthorized,
  'Leitura registrada não pode autorizar retransmissão.');
const failed = evidence({delivery_status:'failed',external_message_id:null});
assert(failed.state === 'failed_unconfirmed' && !failed.replayAuthorized,
  'Falha registrada não prova que provedor não recebeu.');
const pending = evidence({delivery_status:'pending',external_message_id:null});
assert(pending.state === 'pending_unconfirmed' && !pending.replayAuthorized,
  'Pending continua incerto.');
const noId = evidence({delivery_status:'sent',external_message_id:null});
assert(noId.state === 'sent_without_provider_id' && !noId.replayAuthorized,
  'Status enviado sem id do provedor não confirma entrega.');
const mismatches: Array<Partial<CampaignDispatchMessage>> = [
  {id:'message-2'}, {conversation_id:'conv-2'}, {source:'provider'},
  {direction:'inbound'}, {content:'Mensagem de outro contato'},
];
for (const part of mismatches) {
  assert(evidence(part).state === 'mismatched',
    'ID, conversa, origem, direção e texto devem corresponder ao recipient exato.');
}
assert(evidence({}, {...recipient,external_message_id:'outro-id'}).state === 'mismatched',
  'Identificador externo conflitante não pode ser reconciliado por aproximação.');
for (const [lookup,expected] of [
  ['loading','checking'],['not_requested','checking'],
  ['missing','not_found'],['error','unavailable'],
] as const) {
  const found = assessCampaignDispatchEvidence({recipient,lookup,message:lookup==='loading'?msg:null});
  assert(found.state===expected && !found.replayAuthorized,
    'Consulta sem evidência não libera reenvio.');
}
assert(assessCampaignDispatchEvidence({
  recipient:{...recipient,service_message_id:null},lookup:'found',message:msg,
}).state === 'without_reference','Não buscar envio por data/nome sem id explícito.');
assert(assessCampaignDispatchEvidence({
  recipient:{...recipient,status:'sent'},lookup:'found',message:msg,
}).state === 'not_applicable','Recipiente já enviado não entra em revisão de falha.');
console.log('campaignDispatchEvidence.test: OK');
