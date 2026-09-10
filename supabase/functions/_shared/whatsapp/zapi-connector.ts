import type {
  ConnectionStatusResult,
  ConnectorActionResult,
  NormalizedWebhookEvent,
  ProfilePictureResult,
  SendTextResult,
  WhatsAppConnector,
} from './connector.ts';

const PROVIDER = 'zapi';

const MEDIA_PLACEHOLDERS: Record<string, string> = {
  audio: 'Áudio recebido',
  image: 'Imagem recebida',
  video: 'Vídeo recebido',
  document: 'Documento recebido',
  sticker: 'Figurinha recebida',
  location: 'Localização recebida',
  contact: 'Contato recebido',
  contacts: 'Contato recebido',
};

/** Implementação Z-API. Somente este arquivo conhece URLs e tokens do provedor. */
export class ZApiWhatsAppConnector implements WhatsAppConnector {
  readonly providerName = PROVIDER;
  readonly instanceReference: string;
  private readonly instanceToken: string;
  private readonly clientToken: string;

  constructor() {
    this.instanceReference = Deno.env.get('ZAPI_INSTANCE_ID') ?? '';
    this.instanceToken = Deno.env.get('ZAPI_INSTANCE_TOKEN') ?? '';
    this.clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') ?? '';
  }

  get isConfigured(): boolean {
    return Boolean(this.instanceReference && this.instanceToken && this.clientToken);
  }

  private get baseUrl(): string {
    return `https://api.z-api.io/instances/${this.instanceReference}/token/${this.instanceToken}`;
  }

  normalizeWebhook(payload: unknown): NormalizedWebhookEvent {
    const p = (payload ?? {}) as Record<string, any>;
    const eventType = String(p.type ?? '');
    const base: NormalizedWebhookEvent = {
      accepted: false,
      providerName: PROVIDER,
      providerInstanceRef: String(p.instanceId ?? this.instanceReference ?? ''),
      eventType,
    };

    if (eventType !== 'ReceivedCallback') {
      return { ...base, ignoredReason: `evento ignorado: ${eventType || 'desconhecido'}` };
    }
    if (p.isGroup === true || p.isNewsletter === true || p.broadcast === true) {
      return { ...base, ignoredReason: 'conversa de grupo/newsletter ignorada' };
    }

    const externalMessageId = p.messageId ? String(p.messageId) : undefined;
    if (!externalMessageId) {
      return { ...base, ignoredReason: 'evento sem messageId' };
    }

    const fromMe = p.fromMe === true;
    const phoneRaw = String(p.phone ?? '');

    let messageType = 'text';
    let content: string | undefined;

    if (p.text?.message != null) {
      content = String(p.text.message);
    } else if (p.audio) {
      messageType = 'audio';
      content = MEDIA_PLACEHOLDERS.audio;
    } else if (p.image) {
      messageType = 'image';
      content = MEDIA_PLACEHOLDERS.image;
    } else if (p.video) {
      messageType = 'video';
      content = MEDIA_PLACEHOLDERS.video;
    } else if (p.document) {
      messageType = 'document';
      content = MEDIA_PLACEHOLDERS.document;
    } else if (p.sticker) {
      messageType = 'sticker';
      content = MEDIA_PLACEHOLDERS.sticker;
    } else if (p.location) {
      messageType = 'location';
      content = MEDIA_PLACEHOLDERS.location;
    } else if (p.contact || p.contacts) {
      messageType = p.contacts ? 'contacts' : 'contact';
      content = MEDIA_PLACEHOLDERS[messageType];
    } else {
      messageType = 'unsupported';
      content = 'Mensagem não suportada';
    }

    const ts = Number(p.momment ?? p.moment ?? 0);
    return {
      ...base,
      accepted: true,
      externalMessageId,
      direction: fromMe ? 'outbound' : 'inbound',
      source: fromMe ? 'mobile' : 'provider',
      contactPhoneRaw: phoneRaw,
      contactName: p.chatName ? String(p.chatName) : (p.senderName ? String(p.senderName) : undefined),
      messageType,
      content,
      providerTimestamp: ts ? new Date(ts > 1e12 ? ts : ts * 1000).toISOString() : new Date().toISOString(),
      deduplicationKey: `${PROVIDER}:${base.providerInstanceRef}:${externalMessageId}:${eventType}`,
    };
  }

  async sendTextMessage(phone: string, message: string): Promise<SendTextResult> {
    if (!this.isConfigured) {
      return { ok: false, errorCode: 'not_configured', errorMessage: 'Integração WhatsApp não configurada' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({ phone, message }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          errorCode: `http_${res.status}`,
          errorMessage: String(body?.error ?? body?.message ?? 'Falha no envio'),
        };
      }
      return { ok: true, externalMessageId: body?.messageId ? String(body.messageId) : undefined };
    } catch (e) {
      return { ok: false, errorCode: 'network_error', errorMessage: (e as Error).message };
    }
  }

  async enableSentByMeNotifications(): Promise<ConnectorActionResult> {
    if (!this.isConfigured) {
      return { ok: false, errorCode: 'not_configured', errorMessage: 'Integração WhatsApp não configurada' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/update-notify-sent-by-me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({ notifySentByMe: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.value !== true) {
        return {
          ok: false,
          errorCode: `http_${res.status}`,
          errorMessage: String(body?.error ?? body?.message ?? 'Falha ao ativar mensagens enviadas pelo celular'),
        };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, errorCode: 'network_error', errorMessage: (e as Error).message };
    }
  }

  /** Consulta a foto de perfil atual. Retorna link temporário do provedor. */
  async getProfilePictureUrl(phone: string): Promise<ProfilePictureResult> {
    if (!this.isConfigured) {
      return { ok: false, errorCode: 'not_configured', errorMessage: 'Integração WhatsApp não configurada' };
    }
    try {
      const res = await fetch(
        `${this.baseUrl}/profile-picture?phone=${encodeURIComponent(phone)}`,
        { headers: { 'Client-Token': this.clientToken } },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, errorCode: `http_${res.status}`, errorMessage: 'Falha ao consultar foto de perfil' };
      }
      const link = body?.link ?? body?.url ?? body?.profileThumbnail ?? body?.imgUrl;
      if (!link || typeof link !== 'string' || !/^https?:\/\//i.test(link)) {
        return { ok: false, errorCode: 'no_picture', errorMessage: 'Sem foto de perfil disponível' };
      }
      return { ok: true, temporaryUrl: link };
    } catch (e) {
      return { ok: false, errorCode: 'network_error', errorMessage: (e as Error).message };
    }
  }

  async getConnectionStatus(): Promise<ConnectionStatusResult> {
    if (!this.isConfigured) {
      return { status: 'not_configured', instanceReference: this.instanceReference, providerName: PROVIDER };
    }
    try {
      const res = await fetch(`${this.baseUrl}/status`, {
        headers: { 'Client-Token': this.clientToken },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          status: 'degraded',
          instanceReference: this.instanceReference,
          providerName: PROVIDER,
          error: `http_${res.status}`,
        };
      }
      return {
        status: body?.connected === true ? 'connected' : 'disconnected',
        instanceReference: this.instanceReference,
        providerName: PROVIDER,
      };
    } catch (e) {
      return {
        status: 'unknown',
        instanceReference: this.instanceReference,
        providerName: PROVIDER,
        error: (e as Error).message,
      };
    }
  }
}

export function getWhatsAppConnector(): WhatsAppConnector {
  return new ZApiWhatsAppConnector();
}
