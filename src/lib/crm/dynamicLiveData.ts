export type CrmUnsupportedLiveDataKind =
  | 'current_price'
  | 'current_stock'
  | 'current_discount'
  | 'current_freight'
  | 'current_delivery_eta';

export interface CrmUnsupportedLiveDataRequirement {
  kind: CrmUnsupportedLiveDataKind;
  reason: string;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Detecta perguntas cujo fato atual NÃO está presente no CrmAiContext.
 * Pedido e pagamento ficam fora desta lista porque o contexto já transporta
 * pedidos recentes, status e paymentStatus; estes podem ser respondidos pelos
 * fatos vivos já disponíveis. Esta guarda cobre apenas fontes vivas ausentes.
 */
export function getUnsupportedCrmLiveDataRequirement(
  message: string | null | undefined,
): CrmUnsupportedLiveDataRequirement | null {
  const text = normalize(String(message ?? '').trim());
  if (!text) return null;

  if (/\b(preco|valor|quanto custa|quanto sai|tabela de preco|tabela de valor)\b/.test(text)) {
    return { kind: 'current_price', reason: 'Preço/valor vigente deve vir da fonte comercial viva.' };
  }
  if (/\b(estoque|disponibilidade|disponivel|tem pronta entrega|pronta entrega|tem agora)\b/.test(text)) {
    return { kind: 'current_stock', reason: 'Estoque/disponibilidade atual deve vir da fonte de estoque viva.' };
  }
  if (/\b(desconto|promocao|oferta|condicao especial)\b/.test(text)) {
    return { kind: 'current_discount', reason: 'Desconto/condição comercial atual deve vir da fonte comercial viva.' };
  }
  if (/\b(frete|valor do frete|custo do frete|quanto fica o frete|quanto sai o frete)\b/.test(text)) {
    return { kind: 'current_freight', reason: 'Frete atual depende da cotação/fonte logística viva.' };
  }
  if (/\b(prazo de entrega|previsao de entrega|quando chega|quando entrega|chega quando|entrega quando)\b/.test(text)) {
    return { kind: 'current_delivery_eta', reason: 'Previsão/prazo operacional atual deve vir da fonte logística viva.' };
  }

  return null;
}
