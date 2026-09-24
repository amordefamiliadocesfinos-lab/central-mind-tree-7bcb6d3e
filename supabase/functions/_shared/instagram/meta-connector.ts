export type InstagramWebhookEvent = {
  accepted: boolean;
  ignoredReason?: string;
  providerName: 'meta_instagram_messaging';
  providerInstanceRef: string;
  eventType: 'message' | 'unknown';
  externalMessageId?: string;
  direction?: 'inbound' | 'outbound';
  source?: 'provider' | 'mobile';
  senderId?: string;
  recipientId?: string;
  username?: string;
  messageType?: string;
  content?: string;
  providerTimestamp?: string;
  deduplicationKey?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  mediaCaption?: string;
};

const PROVIDER = 'meta_instagram_messaging' as const;

function timestamp(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Date(numeric).toISOString() : new Date().toISOString();
}

function renderMessage(message: Record<string, unknown>) {
  const text = typeof message.message === 'object' && message.message
    ? message.message as Record<string, unknown>
    : {};
  const plainText = typeof text.text === 'string' ? text.text.trim() : '';
  const attachment = Array.isArray(text.attachments) ? text.attachments[0] as Record<string, unknown> | undefined : undefined;
  const payload = attachment?.payload && typeof attachment.payload === 'object'
    ? attachment.payload as Record<string, unknown>
    : {};
  const type = typeof attachment?.type === 'string' ? attachment.type : 'text';
  const labels: Record<string, string> = {
    image: 'Imagem recebida', video: 'Vídeo recebido', audio: 'Áudio recebido', file: 'Arquivo recebido',
    share: 'Compartilhamento recebido', fallback: 'Mensagem não suportada',
  };
  return {
    type,
    content: plainText || labels[type] || labels.fallback,
    mediaUrl: typeof payload.url === 'string' ? payload.url : undefined,
    mediaMimeType: typeof payload.mime_type === 'string' ? payload.mime_type : undefined,
    mediaFilename: typeof payload.name === 'string' ? payload.name : undefined,
    mediaCaption: plainText || undefined,
  };
}

export function instagramConversationHandle(accountId: string, scopedUserId: string) {
  return `instagram:${accountId}:${scopedUserId}`;
}

export function parseInstagramConversationHandle(handle: string | null | undefined) {
  const match = /^instagram:([^:]+):([^:]+)$/u.exec(String(handle ?? '').trim());
  return match ? { accountId: match[1], scopedUserId: match[2] } : null;
}

export function getInstagramSendUrl(graphVersion: string, accountId: string) {
  return `https://graph.instagram.com/${graphVersion}/${encodeURIComponent(accountId)}/messages`;
}

export function normalizeInstagramWebhooks(payload: unknown): InstagramWebhookEvent[] {
  const root = (payload ?? {}) as Record<string, unknown>;
  if (root.object !== 'instagram') return [];
  const events: InstagramWebhookEvent[] = [];
  for (const entry of Array.isArray(root.entry) ? root.entry as Record<string, unknown>[] : []) {
    const accountId = String(entry.id ?? '').trim();
    for (const event of Array.isArray(entry.messaging) ? entry.messaging as Record<string, unknown>[] : []) {
      const sender = event.sender as Record<string, unknown> | undefined;
      const recipient = event.recipient as Record<string, unknown> | undefined;
      const senderId = String(sender?.id ?? '').trim();
      const recipientId = String(recipient?.id ?? accountId).trim();
      const message = event.message as Record<string, unknown> | undefined;
      const messageId = String(message?.mid ?? '').trim();
      if (!accountId || !senderId || !recipientId || !messageId || !message) {
        continue;
      }
      const echo = message.is_echo === true;
      const rendered = renderMessage({ message });
      // Em echo, sender é a conta profissional e recipient é o usuário
      // Instagram. A conversa sempre é indexada pelo usuário externo.
      const externalUserId = echo ? recipientId : senderId;
      events.push({
        accepted: true,
        providerName: PROVIDER,
        providerInstanceRef: accountId,
        eventType: 'message',
        externalMessageId: messageId,
        direction: echo ? 'outbound' : 'inbound',
        source: echo ? 'mobile' : 'provider',
        senderId: externalUserId,
        recipientId: accountId,
        username: typeof sender?.username === 'string' ? sender.username : undefined,
        messageType: rendered.type,
        content: rendered.content,
        providerTimestamp: timestamp(event.timestamp),
        deduplicationKey: `${PROVIDER}:${accountId}:message:${messageId}`,
        mediaUrl: rendered.mediaUrl,
        mediaMimeType: rendered.mediaMimeType,
        mediaFilename: rendered.mediaFilename,
        mediaCaption: rendered.mediaCaption,
      });
    }
  }
  return events;
}

export async function sendInstagramText(input: { accountId: string; scopedUserId: string; message: string }) {
  const accessToken = Deno.env.get('META_INSTAGRAM_ACCESS_TOKEN') ?? '';
  const graphVersion = Deno.env.get('META_GRAPH_API_VERSION') ?? '';
  if (!accessToken || !graphVersion) return { ok: false, errorCode: 'not_configured', errorMessage: 'Instagram Messaging não configurado' };
  try {
    const response = await fetch(getInstagramSendUrl(graphVersion, input.accountId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: input.scopedUserId }, message: { text: input.message } }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return {
      ok: false,
      errorCode: body?.error?.code ? String(body.error.code) : `http_${response.status}`,
      errorMessage: String(body?.error?.error_user_msg ?? body?.error?.message ?? 'Falha no envio pelo Instagram'),
    };
    return { ok: true, externalMessageId: body?.message_id ? String(body.message_id) : undefined };
  } catch (error) {
    return { ok: false, errorCode: 'network_error', errorMessage: (error as Error).message };
  }
}
