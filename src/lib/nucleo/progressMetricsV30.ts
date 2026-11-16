import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";

export type OperationalRecord = Pick<
  DevelopmentWorkstream,
  "code" | "kind" | "status" | "next_action" | "evidence_state"
>;

export type FactualFraction = {
  numerator: number;
  denominator: number;
  percent: number | null;
};

/**
 * 0/0 is unmeasurable (null), never 0%. Invalid numerator/denominator cannot
 * be quietly represented as progress. The presentation supplies the meaning.
 */
export function factualFraction(numerator: number, denominator: number): FactualFraction {
  const valid = Number.isInteger(numerator) && Number.isInteger(denominator)
    && numerator >= 0 && denominator >= 0 && numerator <= denominator;
  if (!valid || denominator === 0) return {numerator, denominator, percent: null};
  return {numerator, denominator, percent: Math.round(numerator / denominator * 100)};
}

/** Count only fronts and subfronts in the currently loaded M3 universe. */
export function operationalMetrics(records: OperationalRecord[]) {
  const eligible = records.filter(row=>row.kind !== "modulo" && row.code !== "NUC");
  const total=eligible.length;
  const withNextAction=eligible.filter(row=>row.next_action.trim().length>0).length;
  const completedDeclared=eligible.filter(row=>row.status==="concluido").length;
  const evidenceDeclaredM3=eligible.filter(row=>row.evidence_state==="comprovada").length;
  return {
    total,
    nextAction: factualFraction(withNextAction,total),
    completedDeclared: factualFraction(completedDeclared,total),
    evidenceDeclaredM3: factualFraction(evidenceDeclaredM3,total),
  };
}
