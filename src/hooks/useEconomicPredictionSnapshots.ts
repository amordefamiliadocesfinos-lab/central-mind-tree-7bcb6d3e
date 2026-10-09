import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type EconomicPredictionSnapshotInsert = {
  engine_key: string;
  engine_version: string;
  rule_version_id: string | null;
  rule_version: string | null;
  marketplace: string;
  channel_account_id: string | null;
  marketplace_product_mapping_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  commercial_presentation_id: string | null;
  effective_at: string;
  confidence: 'high' | 'medium' | 'low';
  input_snapshot: Record<string, unknown>;
  result_snapshot: Record<string, unknown>;
  evidence_snapshot: Record<string, unknown>;
  pending_snapshot: unknown[];
  decision_note?: string | null;
};

const db = supabase as any;

export function useEconomicPredictionSnapshots() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSnapshotId, setLastSnapshotId] = useState<string | null>(null);

  const createSnapshot = useCallback(async (payload: EconomicPredictionSnapshotInsert) => {
    setSaving(true);
    setError(null);

    const { data, error: insertError } = await db
      .from('economic_prediction_snapshots')
      .insert(payload)
      .select('id, snapshot_key, created_at')
      .single();

    if (insertError) {
      setError(insertError.message || 'Não foi possível congelar a previsão econômica.');
      setSaving(false);
      return null;
    }

    setLastSnapshotId(data?.id ?? null);
    setSaving(false);
    return data ?? null;
  }, []);

  return { createSnapshot, saving, error, lastSnapshotId };
}