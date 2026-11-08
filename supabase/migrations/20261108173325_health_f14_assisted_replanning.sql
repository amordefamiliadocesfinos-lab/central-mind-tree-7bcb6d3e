-- F14 Health — assisted replanning workflow.
-- Records human replanning review without mutating specialist sources of truth.

CREATE TABLE public.health_replanning_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,

  source_review_run_id uuid NOT NULL,
  source_review_outcome_id uuid NOT NULL,
  source_outcome_code text NOT NULL CHECK (
    source_outcome_code IN (
      'review_goal',
      'review_training',
      'review_nutrition',
      'review_recovery',
      'review_multiple',
      'insufficient_data'
    )
  ),
  source_target_domains text[] NOT NULL DEFAULT '{}'::text[],
  source_snapshot jsonb NOT NULL,

  case_status text NOT NULL DEFAULT 'open'
    CHECK (case_status IN ('open','in_review','completed','voided')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],

  opened_by_auth_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE RESTRICT
    DEFAULT auth.uid(),
  opened_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  voided_at timestamptz NULL,
  void_reason text NULL,

  record_status text NOT NULL DEFAULT 'current'
    CHECK (record_status IN ('current','superseded')),
  supersedes_case_id uuid NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (id, athlete_id),

  CONSTRAINT health_replanning_cases_review_run_athlete_fkey
    FOREIGN KEY (source_review_run_id, athlete_id)
    REFERENCES public.health_longitudinal_review_runs(id, athlete_id)
    ON DELETE RESTRICT,

  CONSTRAINT health_replanning_cases_outcome_athlete_fkey
    FOREIGN KEY (source_review_outcome_id, athlete_id)
    REFERENCES public.health_longitudinal_review_outcomes(id, athlete_id)
    ON DELETE RESTRICT,

  CONSTRAINT health_replanning_cases_supersedes_athlete_fkey
    FOREIGN KEY (supersedes_case_id, athlete_id)
    REFERENCES public.health_replanning_cases(id, athlete_id)
    ON DELETE RESTRICT,

  CHECK (supersedes_case_id IS NULL OR supersedes_case_id <> id),
  CHECK (
    source_target_domains <@
    ARRAY['goal','training','nutrition','body','recovery']::text[]
  ),
  CHECK (pg_catalog.jsonb_typeof(source_snapshot)='object'),
  CHECK (void_reason IS NULL OR char_length(void_reason)<=4000),
  CHECK (
    (case_status='completed' AND completed_at IS NOT NULL AND voided_at IS NULL)
    OR (case_status='voided' AND voided_at IS NOT NULL AND completed_at IS NULL)
    OR (case_status IN ('open','in_review') AND completed_at IS NULL AND voided_at IS NULL)
  )
);

CREATE UNIQUE INDEX health_replanning_cases_source_outcome_unique_idx
ON public.health_replanning_cases(source_review_outcome_id);

CREATE UNIQUE INDEX health_replanning_cases_one_current_per_review_idx
ON public.health_replanning_cases(source_review_run_id)
WHERE record_status='current';

CREATE INDEX health_replanning_cases_athlete_opened_idx
ON public.health_replanning_cases(athlete_id, opened_at DESC);

CREATE INDEX health_replanning_cases_source_run_idx
ON public.health_replanning_cases(source_review_run_id, athlete_id);

CREATE INDEX health_replanning_cases_source_outcome_idx
ON public.health_replanning_cases(source_review_outcome_id, athlete_id);

CREATE INDEX health_replanning_cases_supersedes_idx
ON public.health_replanning_cases(supersedes_case_id, athlete_id)
WHERE supersedes_case_id IS NOT NULL;

CREATE INDEX health_replanning_cases_opened_by_idx
ON public.health_replanning_cases(opened_by_auth_user_id);

CREATE TABLE public.health_replanning_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.health_athletes(id) ON DELETE CASCADE,
  case_id uuid NOT NULL,
  domain text NOT NULL CHECK (
    domain IN ('goal','training','nutrition','body','recovery')
  ),

  item_status text NOT NULL DEFAULT 'pending'
    CHECK (
      item_status IN (
        'pending',
        'keep_current',
        'revise',
        'defer',
        'not_applicable'
      )
    ),
  decision_notes text NULL,
  evidence_snapshot jsonb NOT NULL,

  decided_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz NULL,

  record_status text NOT NULL DEFAULT 'current'
    CHECK (record_status IN ('current','superseded')),
  supersedes_item_id uuid NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (id, case_id, athlete_id),

  CONSTRAINT health_replanning_items_case_athlete_fkey
    FOREIGN KEY (case_id, athlete_id)
    REFERENCES public.health_replanning_cases(id, athlete_id)
    ON DELETE RESTRICT,

  CONSTRAINT health_replanning_items_supersedes_case_athlete_fkey
    FOREIGN KEY (supersedes_item_id, case_id, athlete_id)
    REFERENCES public.health_replanning_items(id, case_id, athlete_id)
    ON DELETE RESTRICT,

  CHECK (supersedes_item_id IS NULL OR supersedes_item_id <> id),
  CHECK (pg_catalog.jsonb_typeof(evidence_snapshot)='object'),
  CHECK (decision_notes IS NULL OR char_length(decision_notes)<=4000),
  CHECK (
    (item_status='pending' AND decided_at IS NULL AND decided_by_auth_user_id IS NULL)
    OR (item_status<>'pending' AND decided_at IS NOT NULL AND decided_by_auth_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX health_replanning_items_one_current_domain_idx
ON public.health_replanning_items(case_id, domain)
WHERE record_status='current';

CREATE INDEX health_replanning_items_case_idx
ON public.health_replanning_items(case_id, athlete_id);

CREATE INDEX health_replanning_items_athlete_idx
ON public.health_replanning_items(athlete_id, created_at DESC);

CREATE INDEX health_replanning_items_supersedes_idx
ON public.health_replanning_items(supersedes_item_id, case_id, athlete_id)
WHERE supersedes_item_id IS NOT NULL;

CREATE INDEX health_replanning_items_decided_by_idx
ON public.health_replanning_items(decided_by_auth_user_id)
WHERE decided_by_auth_user_id IS NOT NULL;

ALTER TABLE public.health_replanning_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_replanning_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.health_replanning_cases,
  public.health_replanning_items
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON
  public.health_replanning_cases,
  public.health_replanning_items
TO authenticated;

CREATE POLICY health_replanning_cases_select
ON public.health_replanning_cases
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE POLICY health_replanning_items_select
ON public.health_replanning_items
FOR SELECT TO authenticated
USING (public.health_can_read_athlete(athlete_id));

CREATE OR REPLACE FUNCTION public.health_f14_open_replanning_case(
  p_review_run_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.health_longitudinal_review_runs%ROWTYPE;
  v_outcome public.health_longitudinal_review_outcomes%ROWTYPE;
  v_existing public.health_replanning_cases%ROWTYPE;
  v_domains text[];
  v_snapshot jsonb;
  v_reasons text[];
  v_case_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT r.*
  INTO v_run
  FROM public.health_longitudinal_review_runs r
  WHERE r.id=p_review_run_id
    AND r.record_status='current';

  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'current longitudinal review run not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_run.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  SELECT o.*
  INTO v_outcome
  FROM public.health_longitudinal_review_outcomes o
  WHERE o.review_run_id=v_run.id
    AND o.athlete_id=v_run.athlete_id
    AND o.record_status='current';

  IF v_outcome.id IS NULL THEN
    RAISE EXCEPTION 'current longitudinal review outcome is required';
  END IF;

  IF v_outcome.outcome_code='continue_observation' THEN
    RAISE EXCEPTION 'current outcome does not require replanning';
  END IF;

  v_domains := COALESCE(v_outcome.target_domains,'{}'::text[]);

  IF v_outcome.outcome_code<>'insufficient_data'
     AND pg_catalog.cardinality(v_domains)=0 THEN
    RAISE EXCEPTION 'replanning outcome requires at least one target domain';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_run.id::text || '|F14_REPLANNING',0)
  );

  SELECT c.*
  INTO v_existing
  FROM public.health_replanning_cases c
  WHERE c.source_review_run_id=v_run.id
    AND c.record_status='current'
  FOR UPDATE;

  IF v_existing.id IS NOT NULL
     AND v_existing.source_review_outcome_id=v_outcome.id THEN
    RETURN v_existing.id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.health_replanning_cases c
    WHERE c.source_review_outcome_id=v_outcome.id
  ) THEN
    SELECT c.id
    INTO v_case_id
    FROM public.health_replanning_cases c
    WHERE c.source_review_outcome_id=v_outcome.id
    ORDER BY c.created_at DESC
    LIMIT 1;
    RETURN v_case_id;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.health_replanning_cases
    SET record_status='superseded',
        updated_at=now()
    WHERE id=v_existing.id
      AND athlete_id=v_existing.athlete_id
      AND record_status='current';
  END IF;

  v_snapshot := pg_catalog.jsonb_build_object(
    'review_run',pg_catalog.jsonb_build_object(
      'id',v_run.id,
      'as_of_date',v_run.as_of_date,
      'window_days',v_run.window_days,
      'current_start_date',v_run.current_start_date,
      'current_end_date',v_run.current_end_date,
      'prior_start_date',v_run.prior_start_date,
      'prior_end_date',v_run.prior_end_date,
      'run_status',v_run.run_status,
      'available_domains',v_run.available_domains,
      'unavailable_domains',v_run.unavailable_domains,
      'reason_codes',v_run.reason_codes,
      'algorithm_version',v_run.algorithm_version,
      'evidence_snapshot',v_run.evidence_snapshot
    ),
    'review_outcome',pg_catalog.jsonb_build_object(
      'id',v_outcome.id,
      'outcome_code',v_outcome.outcome_code,
      'target_domains',v_outcome.target_domains,
      'notes',v_outcome.notes,
      'reviewed_at',v_outcome.reviewed_at
    ),
    'automatic_replanning',false,
    'specialist_mutation',false,
    'human_decision_required',true
  );

  v_reasons := ARRAY[
    'F14_HUMAN_REPLANNING_WORKFLOW',
    'NO_AUTOMATIC_REPLANNING',
    'NO_SPECIALIST_MUTATION'
  ]::text[];

  IF v_outcome.outcome_code='insufficient_data' THEN
    v_reasons := pg_catalog.array_append(
      v_reasons,
      'SOURCE_OUTCOME_INSUFFICIENT_DATA'
    );
  END IF;

  INSERT INTO public.health_replanning_cases (
    athlete_id,
    source_review_run_id,
    source_review_outcome_id,
    source_outcome_code,
    source_target_domains,
    source_snapshot,
    case_status,
    reason_codes,
    supersedes_case_id
  ) VALUES (
    v_run.athlete_id,
    v_run.id,
    v_outcome.id,
    v_outcome.outcome_code,
    v_domains,
    v_snapshot,
    'open',
    v_reasons,
    v_existing.id
  )
  RETURNING id INTO v_case_id;

  INSERT INTO public.health_replanning_items (
    athlete_id,
    case_id,
    domain,
    item_status,
    evidence_snapshot
  )
  SELECT
    v_run.athlete_id,
    v_case_id,
    d,
    'pending',
    CASE
      WHEN d='goal' THEN pg_catalog.jsonb_build_object(
        'goal_context',v_run.evidence_snapshot->'goal_context',
        'phase_context',v_run.evidence_snapshot->'phase_context'
      )
      ELSE pg_catalog.jsonb_build_object(
        'domain',d,
        'evidence',COALESCE(v_run.evidence_snapshot->d,'null'::jsonb)
      )
    END
  FROM pg_catalog.unnest(v_domains) AS d;

  RETURN v_case_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_f14_record_replanning_item_decision(
  p_case_id uuid,
  p_domain text,
  p_decision_code text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_case public.health_replanning_cases%ROWTYPE;
  v_item public.health_replanning_items%ROWTYPE;
  v_notes text;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_decision_code NOT IN (
    'keep_current','revise','defer','not_applicable'
  ) THEN
    RAISE EXCEPTION 'invalid replanning decision';
  END IF;

  SELECT c.*
  INTO v_case
  FROM public.health_replanning_cases c
  WHERE c.id=p_case_id
    AND c.record_status='current';

  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'current replanning case not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_case.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF v_case.case_status IN ('completed','voided') THEN
    RAISE EXCEPTION 'replanning case is closed';
  END IF;

  SELECT i.*
  INTO v_item
  FROM public.health_replanning_items i
  WHERE i.case_id=v_case.id
    AND i.athlete_id=v_case.athlete_id
    AND i.domain=p_domain
    AND i.record_status='current'
  FOR UPDATE;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'current replanning item not found';
  END IF;

  v_notes := NULLIF(pg_catalog.btrim(COALESCE(p_notes,'')),'');

  IF v_item.item_status=p_decision_code
     AND COALESCE(v_item.decision_notes,'')=COALESCE(v_notes,'') THEN
    RETURN v_item.id;
  END IF;

  UPDATE public.health_replanning_items
  SET record_status='superseded',
      updated_at=now()
  WHERE id=v_item.id
    AND record_status='current';

  INSERT INTO public.health_replanning_items (
    athlete_id,
    case_id,
    domain,
    item_status,
    decision_notes,
    evidence_snapshot,
    decided_by_auth_user_id,
    decided_at,
    supersedes_item_id
  ) VALUES (
    v_item.athlete_id,
    v_item.case_id,
    v_item.domain,
    p_decision_code,
    v_notes,
    v_item.evidence_snapshot,
    auth.uid(),
    now(),
    v_item.id
  )
  RETURNING id INTO v_new_id;

  UPDATE public.health_replanning_cases
  SET case_status=CASE WHEN case_status='open' THEN 'in_review' ELSE case_status END,
      updated_at=now()
  WHERE id=v_case.id
    AND record_status='current';

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_f14_complete_replanning_case(
  p_case_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_case public.health_replanning_cases%ROWTYPE;
  v_pending integer;
  v_total integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT c.*
  INTO v_case
  FROM public.health_replanning_cases c
  WHERE c.id=p_case_id
    AND c.record_status='current'
  FOR UPDATE;

  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'current replanning case not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_case.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF v_case.case_status='voided' THEN
    RAISE EXCEPTION 'voided replanning case cannot be completed';
  END IF;

  IF v_case.case_status='completed' THEN
    RETURN v_case.id;
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE i.item_status='pending')
  INTO v_total,v_pending
  FROM public.health_replanning_items i
  WHERE i.case_id=v_case.id
    AND i.athlete_id=v_case.athlete_id
    AND i.record_status='current';

  IF v_pending>0 THEN
    RAISE EXCEPTION 'all replanning items require a human decision';
  END IF;

  IF v_total=0 AND v_case.source_outcome_code<>'insufficient_data' THEN
    RAISE EXCEPTION 'replanning case has no review items';
  END IF;

  UPDATE public.health_replanning_cases
  SET case_status='completed',
      completed_at=now(),
      updated_at=now()
  WHERE id=v_case.id
    AND record_status='current';

  RETURN v_case.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.health_f14_void_replanning_case(
  p_case_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_case public.health_replanning_cases%ROWTYPE;
  v_reason text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  v_reason := NULLIF(pg_catalog.btrim(COALESCE(p_reason,'')),'');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'void reason is required';
  END IF;
  IF char_length(v_reason)>4000 THEN
    RAISE EXCEPTION 'void reason is too long';
  END IF;

  SELECT c.*
  INTO v_case
  FROM public.health_replanning_cases c
  WHERE c.id=p_case_id
    AND c.record_status='current'
  FOR UPDATE;

  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'current replanning case not found';
  END IF;

  IF NOT public.health_can_write_athlete(v_case.athlete_id) THEN
    RAISE EXCEPTION 'not authorized for athlete';
  END IF;

  IF v_case.case_status='completed' THEN
    RAISE EXCEPTION 'completed replanning case cannot be voided';
  END IF;

  IF v_case.case_status='voided' THEN
    RETURN v_case.id;
  END IF;

  UPDATE public.health_replanning_cases
  SET case_status='voided',
      voided_at=now(),
      void_reason=v_reason,
      updated_at=now()
  WHERE id=v_case.id
    AND record_status='current';

  RETURN v_case.id;
END;
$$;

REVOKE ALL ON FUNCTION public.health_f14_open_replanning_case(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_f14_record_replanning_item_decision(uuid,text,text,text)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_f14_complete_replanning_case(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_f14_void_replanning_case(uuid,text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.health_f14_open_replanning_case(uuid)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_f14_record_replanning_item_decision(uuid,text,text,text)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_f14_complete_replanning_case(uuid)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_f14_void_replanning_case(uuid,text)
TO authenticated;
