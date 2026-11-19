// UX/NT-06: a consulta traz uma linha extra apenas para comprovar se
// o limite visual foi ultrapassado, sem inferir completude fora do RLS.
export const M4_EVIDENCE_VISIBLE_LIMIT = 100;

export function projectM4EvidenceWindow<T>(rows: readonly T[]): { visible: T[]; hasMore: boolean } {
  return {
    visible: rows.slice(0, M4_EVIDENCE_VISIBLE_LIMIT),
    hasMore: rows.length > M4_EVIDENCE_VISIBLE_LIMIT,
  };
}
