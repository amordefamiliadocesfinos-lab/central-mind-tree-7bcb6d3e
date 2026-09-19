export const POST_SALE_RESULT_CODES = [
  'CRM-RES-023',
  'CRM-RES-024',
  'CRM-RES-025',
  'CRM-RES-026',
  'CRM-RES-027',
  'CRM-RES-028',
  'CRM-RES-029',
] as const;

export type PostSaleResultCode = typeof POST_SALE_RESULT_CODES[number];
export type PostSaleOutcomeKind = 'positive' | 'attention' | 'neutral';

export interface PostSaleOutcome {
  isPostSale: boolean;
  kind: PostSaleOutcomeKind | null;
  closesEligibility: boolean;
  opensRepurchaseByItself: boolean;
  reason: string;
}

const POST_SALE_RESULTS = new Set<string>(POST_SALE_RESULT_CODES);

/**
 * F3-F — interpretação conservadora do retorno canônico de pós-venda.
 *
 * Qualquer Resultado 023–029 encerra o sinal de elegibilidade daquela entrega,
 * pois houve acompanhamento registrado. Isso não transforma satisfação em
 * recompra automaticamente: recompra continua subordinada ao motor próprio.
 *
 * A classificação positive/attention/neutral é intencionalmente estrutural;
 * decisões específicas continuam pertencendo ao dicionário/transição canônica.
 */
export function classifyPostSaleOutcome(resultCode: string | null | undefined): PostSaleOutcome {
  if (!resultCode || !POST_SALE_RESULTS.has(resultCode)) {
    return {
      isPostSale: false,
      kind: null,
      closesEligibility: false,
      opensRepurchaseByItself: false,
      reason: 'Resultado informado não pertence ao conjunto canônico de pós-venda.',
    };
  }

  // CRM-RES-026 é o Resultado já usado pela base/testes como pós-venda positivo.
  if (resultCode === 'CRM-RES-026') {
    return {
      isPostSale: true,
      kind: 'positive',
      closesEligibility: true,
      opensRepurchaseByItself: false,
      reason: 'Pós-venda positivo registrado; acompanhamento concluído sem inferir recompra automaticamente.',
    };
  }

  return {
    isPostSale: true,
    kind: 'neutral',
    closesEligibility: true,
    opensRepurchaseByItself: false,
    reason: 'Resultado canônico de pós-venda registrado; o sinal daquela entrega deve ser considerado atendido.',
  };
}
