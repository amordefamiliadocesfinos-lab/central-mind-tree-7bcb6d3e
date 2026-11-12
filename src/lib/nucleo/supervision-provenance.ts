import type { TechnicalEvidence } from "./development.types";
import type { SupervisionFinding } from "./supervision";

export type FindingSource = {
  id: string;
  source: TechnicalEvidence["source"];
  kind: TechnicalEvidence["kind"];
  externalKey: string;
  title: string;
  checkedAt: string | null;
  referenceUrl: string | null;
  recordedAt: string;
};

const REPO = "amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e";

/** Only canonical known GitHub source URLs may open from the supervision view. */
export function safeNucleoSourceUrl(value: string | null, source: TechnicalEvidence): string | null {
  if (!value || source.source !== "github") return null;
  if (!/^[0-9]+$/.test(source.external_key)) return null;
  const route = source.kind === "pull_request" ? "pull" :
    source.kind === "workflow_run" ? "actions/runs" : null;
  if (!route) return null;
  const expected = `https://github.com/${REPO}/${route}/${source.external_key}`;
  return value === expected ? expected : null;
}

/** No requests, mutation or completion inference. Only evidence already accessible under RLS. */
export function findNucleoFindingSources(
  finding: SupervisionFinding,
  evidences: TechnicalEvidence[],
): FindingSource[] {
  const expected = new Set(finding.evidenceIds);
  return evidences
    .filter(r => expected.has(r.id))
    .map(r => ({
      id: r.id, source: r.source, kind: r.kind, externalKey: r.external_key,
      title: r.title, checkedAt: r.checked_at, recordedAt: r.recorded_at,
      referenceUrl: safeNucleoSourceUrl(r.reference_url, r),
    }));
}
