/**
 * Helper centralizado para abrir conversas no WhatsApp.
 * - Normaliza o telefone (remove caracteres, garante DDI 55 padrão BR).
 * - Detecta mobile vs desktop e usa a URL mais confiável para cada caso.
 * - Sempre abre em nova aba.
 */

export function normalizeBRPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  if (!clean) return null;
  // Número nacional brasileiro possui 10 ou 11 dígitos. Isso evita confundir
  // telefones do DDD 55 com números que já chegaram acompanhados do DDI +55.
  if (clean.length === 10 || clean.length === 11) return `55${clean}`;
  // Se já vier com DDI (Brasil ou outro país), respeita a identidade recebida.
  return clean;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  const full = normalizeBRPhone(phone);
  if (!full) return null;
  const text = message ? encodeURIComponent(message) : '';
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  // Em mobile, api.whatsapp.com/send abre o app nativo de forma mais confiável.
  if (isMobile) {
    return text
      ? `https://api.whatsapp.com/send?phone=${full}&text=${text}`
      : `https://api.whatsapp.com/send?phone=${full}`;
  }
  return text ? `https://wa.me/${full}?text=${text}` : `https://wa.me/${full}`;
}

export function openWhatsApp(phone: string | null | undefined, message?: string): boolean {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) return false;
  // Não usar `noopener` no terceiro argumento aqui: em alguns navegadores ele
  // abre a aba corretamente, mas retorna `null`, fazendo o CRM entender que o
  // WhatsApp foi bloqueado e não registrar o contato como atendido.
  const win = window.open(url, '_blank');
  if (!win) return false;
  try {
    win.opener = null;
  } catch {
    // ignore
  }
  return true;
}

/** Versão "broadcast" sem telefone fixo — abre o seletor de contato do WhatsApp com mensagem pré-preenchida. */
export function openWhatsAppBroadcast(message: string): void {
  const text = encodeURIComponent(message);
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const url = isMobile
    ? `https://api.whatsapp.com/send?text=${text}`
    : `https://wa.me/?text=${text}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
