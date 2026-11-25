// UX/NT-06: a consulta traz uma linha extra apenas para comprovar se
// o limite visual foi ultrapassado, sem inferir completude fora do RLS.
export const M4_EVIDENCE_VISIBLE_LIMIT = 100;

export function projectM4EvidenceWindow<T>(rows: readonly T[]): { visible: T[]; hasMore: boolean } {
  return {
    visible: rows.slice(0, M4_EVIDENCE_VISIBLE_LIMIT),
    hasMore: rows.length > M4_EVIDENCE_VISIBLE_LIMIT,
  };
}


// Somente metadados técnicos permitidos; não renderiza o snapshot bruto.
// Chaves históricas coexistem. Valores conflitantes não viram SHA confirmado.
export function projectM4SourceDetails(kind: string, snapshot: Record<string, unknown>, externalKey: string) {
  const validSha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{40}$/i.test(value);
  const keys = kind === "pull_request" ? ["merge_commit_sha", "merge_sha"] : kind === "workflow_run" ? ["head_sha"] : [];
  const candidates = keys.map(key => snapshot[key]).filter(value => value !== undefined && value !== null);
  const normalized = candidates.filter(validSha).map(value => value.toLowerCase());
  const conflict = candidates.length !== normalized.length || new Set(normalized).size > 1;
  const sha = kind === "commit" ? (validSha(externalKey) ? externalKey.toLowerCase() : null)
    : !conflict && normalized.length > 0 ? normalized[0] : null;
  return { sha, conflict, shaLabel: kind === "pull_request" ? "SHA de merge" : "SHA do commit" };
}
