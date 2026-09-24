import {
  getInstagramSendUrl,
  instagramConversationHandle,
  normalizeInstagramWebhooks,
  parseInstagramConversationHandle,
} from './meta-connector.ts';

const accountId = '17841457669727137';
const customerId = '17840000000000001';

function messageFixture(overrides: Record<string, unknown> = {}) {
  return {
    object: 'instagram',
    entry: [{
      id: accountId,
      messaging: [{
        sender: { id: customerId, username: 'cliente_teste' },
        recipient: { id: accountId },
        timestamp: 1_727_000_000_000,
        message: { mid: 'mid.sanitized.1', text: 'Olá, gostaria de saber mais.' },
        ...overrides,
      }],
    }],
  };
}

Deno.test('normaliza DM de texto preservando conta e identidade externa', () => {
  const [event] = normalizeInstagramWebhooks(messageFixture());
  if (!event) throw new Error('Evento não normalizado');
  if (event.direction !== 'inbound' || event.senderId !== customerId || event.recipientId !== accountId) throw new Error('Identidade inbound incorreta');
  if (event.content !== 'Olá, gostaria de saber mais.' || event.externalMessageId !== 'mid.sanitized.1') throw new Error('Conteúdo ou ID externo incorreto');
  if (event.deduplicationKey !== `meta_instagram_messaging:${accountId}:message:mid.sanitized.1`) throw new Error('Chave de deduplicação incorreta');
});

Deno.test('preserva conversa segura quando username não vem no payload', () => {
  const fixture = messageFixture({ sender: { id: customerId } });
  const [event] = normalizeInstagramWebhooks(fixture);
  if (!event || event.username !== undefined) throw new Error('Username ausente foi tratado incorretamente');
  const handle = instagramConversationHandle(accountId, event.senderId!);
  const parsed = parseInstagramConversationHandle(handle);
  if (!parsed || parsed.accountId !== accountId || parsed.scopedUserId !== customerId) throw new Error('Handle canônico inválido');
});

Deno.test('normaliza echo pelo usuário destinatário, sem trocar a identidade da conversa', () => {
  const [event] = normalizeInstagramWebhooks(messageFixture({
    sender: { id: accountId },
    recipient: { id: customerId },
    message: { mid: 'mid.sanitized.echo', text: 'Resposta enviada', is_echo: true },
  }));
  if (!event || event.direction !== 'outbound' || event.senderId !== customerId || event.recipientId !== accountId) throw new Error('Echo não preservou o usuário externo');
});

Deno.test('degrada attachment sem URL como evento explícito e ignora payload fora do Instagram', () => {
  const [attachment] = normalizeInstagramWebhooks(messageFixture({
    message: { mid: 'mid.sanitized.media', attachments: [{ type: 'image', payload: {} }] },
  }));
  if (!attachment || attachment.content !== 'Imagem recebida' || attachment.messageType !== 'image') throw new Error('Attachment não foi degradado explicitamente');
  if (normalizeInstagramWebhooks({ object: 'page', entry: [] }).length !== 0) throw new Error('Payload de outro canal não foi ignorado');
});

Deno.test('sender Instagram usa exclusivamente graph.instagram.com', () => {
  const url = getInstagramSendUrl('v26.0', accountId);
  if (url !== `https://graph.instagram.com/v26.0/${accountId}/messages`) throw new Error('Endpoint de envio Instagram incorreto');
  if (url.includes('graph.facebook.com')) throw new Error('Fluxo Instagram não pode usar graph.facebook.com');
});
