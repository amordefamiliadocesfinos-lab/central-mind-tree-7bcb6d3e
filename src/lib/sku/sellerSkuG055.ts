// Jornada SKU V1.3 / G05.5. Contrato comercial derivado, não observação live Shopee.
// Nenhuma escrita fora da RPC oficial, nenhum bypass de auth/RLS.
import projection from '@/data/sellerSkuG055Projection.json';

export type CanonicalSkuRow = {
  account: string;
  channel_account_id: string;
  item_id: string;
  model_id: string;
  mapping_id: string;
  architecture: 'T30-2' | 'T40-2';
  canonical_sku: string;
  reconciliation_status: 'PLANEJADO' | 'BLOQUEADO_LOCAL';
};
export type CurrentSkuState = {
  mapping_id: string;
  canonical_sku: string;
  reconciliation_status: string;
  observation_kind: string;
  revision: number;
};
export type CoreMapping = {
  id: string;
  marketplace: string;
  channel_account_id: string | null;
  external_item_id: string | null;
  external_model_id: string | null;
};
export const G055_SOURCE = projection.source;
export const G055_ROWS = projection.rows as CanonicalSkuRow[];
export const G055_PILOT = '980cb680-5296-4342-b83d-4e09584a3fe0';
export const G055_ACCOUNTS = ['SHOPEE ADÃO','SHOPEE VIVIANE','SHOPEE CELIVIO','SHOPEE PRISCILA'] as const;

function requireCondition(condition: unknown, description: string): asserts condition {
  if (!condition) throw new Error('G05.5: ' + description);
}

export function verifyProjection(rows: readonly CanonicalSkuRow[] = G055_ROWS): void {
  requireCondition(rows.length === 168, 'quantidade canônica inesperada');
  const ids = new Set<string>();
  const keys = new Set<string>();
  const skuPerAccount = new Map<string, Set<string>>();
  let blocked = 0;
  for (const row of rows) {
    requireCondition(G055_ACCOUNTS.some(a => a === row.account), 'conta fora da matriz');
    requireCondition(/^[0-9]{1,30}$/.test(row.item_id) && /^[0-9]{1,30}$/.test(row.model_id), 'Item/Model inválido');
    requireCondition(row.architecture === 'T30-2' || row.architecture === 'T40-2', 'arquitetura inválida');
    requireCondition(new RegExp('^AF-TRF' + (row.architecture === 'T30-2' ? '30' : '40') + '-KT-(030|060|120)-[A-Z]{2,4}$').test(row.canonical_sku), 'SKU fora do dicionário');
    requireCondition(row.reconciliation_status === 'PLANEJADO' || row.reconciliation_status === 'BLOQUEADO_LOCAL', 'status inválido');
    requireCondition(!ids.has(row.mapping_id), 'mapping duplicado');
    ids.add(row.mapping_id);
    const key = [row.channel_account_id, row.item_id, row.model_id].join('|');
    requireCondition(!keys.has(key), 'chave oficial duplicada');
    keys.add(key);
    if (row.reconciliation_status === 'BLOQUEADO_LOCAL') blocked++;
    if (!skuPerAccount.has(row.account)) skuPerAccount.set(row.account, new Set());
    skuPerAccount.get(row.account)!.add(row.canonical_sku);
  }
  requireCondition(ids.has(G055_PILOT), 'piloto ausente');
  requireCondition(blocked === 24, 'quarentena física divergente');
  requireCondition(skuPerAccount.size === 4, 'contas divergentes');
  for (const name of G055_ACCOUNTS) {
    const sub = rows.filter(r => r.account === name);
    requireCondition(sub.length === 42, '42 mappings por conta inválidos');
    requireCondition(sub.filter(r => r.reconciliation_status === 'BLOQUEADO_LOCAL').length === 6, 'exceções por conta inválidas');
    requireCondition(skuPerAccount.get(name)?.size === 42, '42 SKUs por conta inválidos');
  }
  const first = skuPerAccount.get(G055_ACCOUNTS[0])!;
  for (const skus of skuPerAccount.values()) {
    requireCondition([...skus].every(sku => first.has(sku)), 'catálogo divergente entre contas');
  }
}

export function verifyMappings(rows: readonly CanonicalSkuRow[], found: readonly CoreMapping[]): void {
  requireCondition(found.length === rows.length, 'contagem de mappings no Core divergente');
  const indexed = new Map(found.map(m => [m.id, m]));
  requireCondition(indexed.size === found.length, 'mapping retornado em duplicidade');
  for (const row of rows) {
    const m = indexed.get(row.mapping_id);
    requireCondition(m && m.marketplace.toLowerCase() === 'shopee'
      && m.channel_account_id === row.channel_account_id
      && m.external_item_id === row.item_id
      && m.external_model_id === row.model_id, 'identidade oficial divergente: ' + row.mapping_id);
  }
}

/** Existing advanced/observed state must never be downgraded to UNKNOWN. */
export function classifyExisting(row: CanonicalSkuRow, state: CurrentSkuState | null): 'PENDENTE' | 'EXISTENTE' {
  if (!state) return 'PENDENTE';
  requireCondition(state.mapping_id === row.mapping_id && state.canonical_sku === row.canonical_sku, 'SKU já registrado diverge: ' + row.mapping_id);
  requireCondition(Number.isInteger(state.revision) && state.revision >= 1, 'revisão inválida');
  if (row.reconciliation_status === 'BLOQUEADO_LOCAL') {
    requireCondition(state.reconciliation_status === 'BLOQUEADO_LOCAL', 'exceção não bloqueada: ' + row.mapping_id);
  } else {
    requireCondition(state.reconciliation_status !== 'BLOQUEADO_LOCAL', 'mapping regular bloqueado: ' + row.mapping_id);
  }
  return 'EXISTENTE';
}

export function decisionPayload(row: CanonicalSkuRow) {
  return {
    offer_family: row.architecture === 'T30-2' ? 'Trufa 30 g' : 'Trufa 40 g',
    offer_architecture: row.architecture,
    canonical_sku: row.canonical_sku,
    canonical_decision_source: 'Matriz Unica V40 + Dicionario E03 / Jornada SKU V1.3',
    canonical_decided_at: null,
    observation_kind: 'UNKNOWN',
    observed_sku: null,
    observed_source: null,
    observed_at: null,
    reconciliation_status: row.reconciliation_status,
    last_evidence_ref: null,
    event_kind: row.reconciliation_status === 'BLOQUEADO_LOCAL' ? 'BLOQUEIO' : 'DECISAO',
    event_note: row.reconciliation_status === 'BLOQUEADO_LOCAL'
      ? 'Quarentena fisica #1138, sem autorizacao para editar Shopee'
      : 'Decisao comercial canonica G05.5; Seller SKU Shopee nao observado',
  };
}
