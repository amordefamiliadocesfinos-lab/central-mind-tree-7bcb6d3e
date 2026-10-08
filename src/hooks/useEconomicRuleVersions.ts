import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EconomicRuleCandidate } from '@/lib/economic-engine/rre';

export type EconomicRuleEvidenceRecord = {
  id: string;
  rule_version_id: string;
  evidence_type: string;
  source_ref: string;
  observed_from: string | null;
  observed_to: string | null;
  marketplace_product_mapping_id: string | null;
  is_offer_specific: boolean;
  payload: Record<string, unknown>;
};

export type EconomicRuleVersionRecord = {
  id: string;
  engine_key: string;
  engine_version: string;
  rule_key: string;
  rule_version: string;
  marketplace: string;
  channel_account_id: string | null;
  marketplace_product_mapping_id: string | null;
  effective_from: string;
  effective_to: string | null;
  status: 'draft' | 'active' | 'retired';
  parameters: Record<string, unknown>;
  source_summary: string | null;
  supersedes_rule_version_id: string | null;
  evidence: EconomicRuleEvidenceRecord[];
};

const db = supabase as any;

export function useEconomicRuleVersions(
  channelAccountId: string | null,
  offerMappingId: string | null,
) {
  const [rules, setRules] = useState<EconomicRuleVersionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    if (!channelAccountId) {
      setRules([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: ruleRows, error: rulesError } = await db
      .from('economic_rule_versions')
      .select('*')
      .eq('engine_key', 'shopee-economic-v2')
      .eq('rule_key', 'structural-regime')
      .eq('marketplace', 'shopee')
      .eq('status', 'active')
      .eq('channel_account_id', channelAccountId)
      .order('effective_from', { ascending: false });

    if (rulesError) {
      setRules([]);
      setError(rulesError.message || 'Não foi possível carregar as regras econômicas versionadas.');
      setLoading(false);
      return;
    }

    const allRules = (ruleRows ?? []) as Omit<EconomicRuleVersionRecord, 'evidence'>[];
    const scopedRules = allRules.filter((rule) =>
      rule.marketplace_product_mapping_id === null ||
      rule.marketplace_product_mapping_id === offerMappingId,
    );

    const ids = scopedRules.map((rule) => rule.id);
    let evidenceRows: EconomicRuleEvidenceRecord[] = [];

    if (ids.length > 0) {
      const { data: evidence, error: evidenceError } = await db
        .from('economic_rule_evidence')
        .select('*')
        .in('rule_version_id', ids);

      if (evidenceError) {
        setRules([]);
        setError(evidenceError.message || 'Não foi possível carregar as evidências das regras econômicas.');
        setLoading(false);
        return;
      }
      evidenceRows = (evidence ?? []) as EconomicRuleEvidenceRecord[];
    }

    const evidenceByRule = new Map<string, EconomicRuleEvidenceRecord[]>();
    for (const evidence of evidenceRows) {
      const list = evidenceByRule.get(evidence.rule_version_id) ?? [];
      list.push(evidence);
      evidenceByRule.set(evidence.rule_version_id, list);
    }

    setRules(scopedRules.map((rule) => ({
      ...rule,
      evidence: evidenceByRule.get(rule.id) ?? [],
    })));
    setLoading(false);
  }, [channelAccountId, offerMappingId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const candidates = useMemo<EconomicRuleCandidate[]>(() => rules.map((rule) => ({
    id: rule.id,
    engineVersion: rule.engine_version,
    ruleVersion: rule.rule_version,
    channelAccountId: rule.channel_account_id,
    offerMappingId: rule.marketplace_product_mapping_id,
    effectiveFrom: rule.effective_from,
    effectiveTo: rule.effective_to,
    parameters: rule.parameters,
    sourceSummary: rule.source_summary,
    evidence: rule.evidence.map((evidence) => ({
      id: evidence.id,
      sourceRef: evidence.source_ref,
      evidenceType: evidence.evidence_type,
      observedFrom: evidence.observed_from,
      observedTo: evidence.observed_to,
      offerMappingId: evidence.marketplace_product_mapping_id,
      isOfferSpecific: evidence.is_offer_specific,
    })),
  })), [rules]);

  const byId = useMemo(() => new Map(rules.map((rule) => [rule.id, rule])), [rules]);

  return { rules, candidates, byId, loading, error, refetch: fetchRules };
}