-- CCH E5-E CANDIDATE: LAB ONLY, NOT AN APPLIED SUPABASE MIGRATION.
-- Deliberately outside supabase/migrations to prevent automatic deployment.
-- Requires M1/M4 sovereign schemas; CI uses structurally faithful disposable fixture.
-- Cannot be merged/deployed without a new Camada Mestre authorization.
BEGIN;
ALTER TABLE public.health_consents
 DROP CONSTRAINT health_consents_consent_type_check;
ALTER TABLE public.health_consents ADD CONSTRAINT health_consents_consent_type_check
 CHECK (consent_type IN (
 'health_data_processing','private_media_storage','media_analysis',
 'coach_sharing','notifications','e5_personalized_review'));

-- LAB GOVERNANCE CANDIDATE: official policy version comes from this protected
-- registry, NEVER from a caller. No row is deployed/approved by this candidate.
CREATE TABLE public.health_cch_e5_policy_registry(
 policy_version text PRIMARY KEY CHECK(btrim(policy_version)<>'' AND length(policy_version)<=100),
 status text NOT NULL CHECK(status IN ('active','retired')),
 approved_at timestamptz NOT NULL,
 policy_digest text NOT NULL CHECK(length(policy_digest)=64),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX health_cch_e5_one_active_policy
 ON public.health_cch_e5_policy_registry((status)) WHERE status='active';
REVOKE ALL ON public.health_cch_e5_policy_registry FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.health_cch_e5_policy_registry TO authenticated;
ALTER TABLE public.health_cch_e5_policy_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY health_cch_e5_policy_registry_read ON public.health_cch_e5_policy_registry
 FOR SELECT TO authenticated USING(true);
-- Real text, digest, effective dates and retention must be approved and seeded
-- through a separate authorized governance migration, NOT through the app.

-- Keep M1 general-purpose rights; constrain ONLY E5 to the real athlete's auth identity.
-- Managers and coaches can still use existing M1 rules, not grant consent for the athlete.
DROP POLICY health_consents_insert ON public.health_consents;
CREATE POLICY health_consents_insert ON public.health_consents FOR INSERT TO authenticated
 WITH CHECK (
  public.health_can_manage_athlete_access(athlete_id)
  AND actor_auth_user_id=auth.uid()
  AND (consent_type<>'e5_personalized_review' OR
   EXISTS (SELECT 1 FROM public.health_athletes a WHERE a.id=athlete_id
    AND a.auth_user_id IS NOT NULL AND a.auth_user_id=auth.uid()
    AND details->'explicit_action'='true'::jsonb
    AND details->>'contract'='cch-e5-consent-v1'
    AND policy_version=(SELECT p.policy_version FROM public.health_cch_e5_policy_registry p WHERE p.status='active')))
 );

-- Server-owned chronology and actor identity. E5 cannot be back/future-dated
-- by an API caller to override an eventual revocation.
CREATE OR REPLACE FUNCTION public.health_cch_e5_stamp_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.consent_type='e5_personalized_review' THEN
  IF auth.uid() IS NULL OR NEW.actor_auth_user_id IS DISTINCT FROM auth.uid()
   OR NEW.details->>'contract' IS DISTINCT FROM 'cch-e5-consent-v1'
   OR NEW.details->'explicit_action' IS DISTINCT FROM 'true'::jsonb THEN
   RAISE EXCEPTION 'E5 consent requires explicit authenticated action'
    USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.health_cch_e5_policy_registry p
   WHERE p.status='active' AND p.policy_version=NEW.policy_version) THEN
   RAISE EXCEPTION 'E5 consent policy not active' USING ERRCODE='23514';
  END IF;
  NEW.occurred_at:=clock_timestamp();
  NEW.created_at:=NEW.occurred_at;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER health_cch_e5_consent_time_guard
 BEFORE INSERT ON public.health_consents FOR EACH ROW
 EXECUTE FUNCTION public.health_cch_e5_stamp_consent();

-- Fail closed for all readers without the same athlete identity, latest decision,
-- unambiguous timestamp and exact currently approved version passed by the caller.
CREATE OR REPLACE FUNCTION public.health_cch_e5_has_explicit_consent(
 p_athlete_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER
 SET search_path=public,pg_temp AS $$
DECLARE v_latest timestamptz;v_count integer;v_granted integer;v_version text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.health_athletes a
   WHERE a.id=p_athlete_id AND a.auth_user_id=auth.uid() AND a.status='active')
 THEN RETURN false; END IF;
 SELECT p.policy_version INTO v_version
 FROM public.health_cch_e5_policy_registry p WHERE p.status='active';
 IF v_version IS NULL THEN RETURN false; END IF;
 SELECT max(occurred_at) INTO v_latest FROM public.health_consents
 WHERE athlete_id=p_athlete_id AND consent_type='e5_personalized_review';
 IF v_latest IS NULL THEN RETURN false; END IF;
 SELECT count(*),count(*) FILTER (WHERE decision='granted' AND policy_version=v_version)
 INTO v_count,v_granted FROM public.health_consents
 WHERE athlete_id=p_athlete_id AND consent_type='e5_personalized_review'
 AND occurred_at=v_latest;
 RETURN v_count=1 AND v_granted=1;
END $$;
REVOKE ALL ON FUNCTION public.health_cch_e5_has_explicit_consent(uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_e5_has_explicit_consent(uuid)
 TO authenticated;

-- M4 retains its existing event table and append-only API. E5 is a restricted
-- subset of notes, not a new event_type or table.
-- Root E5 review + append-only correction chains. Every correction points
-- to the latest previous note of the SAME athlete/session and exact author.
-- No updates/deletes to original M4 events are permitted to authenticated.
CREATE OR REPLACE FUNCTION public.health_cch_e5_validate_session_note()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=public,pg_temp AS $$
DECLARE v_athlete_auth uuid;v_status text;v_record text;
 v_prev uuid;v_prev_actor uuid;v_is_correction boolean;
BEGIN
 IF NEW.event_type='note' AND NEW.payload->>'contract'='cch-e5-session-review-v1' THEN
  IF auth.uid() IS NULL OR NEW.created_by_auth_user_id IS DISTINCT FROM auth.uid()
   OR NEW.source<>'user' OR NEW.workout_exercise_id IS NOT NULL
   OR NEW.workout_set_id IS NOT NULL OR
   COALESCE(NEW.payload->>'recovery','') NOT IN ('good','poor','unknown') OR
   COALESCE(NEW.payload->>'symptoms','') NOT IN ('none','pain','unknown')
   OR NEW.payload->'explicit_confirmation' IS DISTINCT FROM 'true'::jsonb
  THEN RAISE EXCEPTION 'invalid E5 review attribution or payload' USING ERRCODE='23514';
  END IF;
  v_is_correction := NEW.payload ? 'replaces_event_id';
  IF NEW.payload <> (CASE WHEN v_is_correction THEN
    jsonb_build_object('contract','cch-e5-session-review-v1',
      'explicit_confirmation',true,'recovery',NEW.payload->>'recovery',
      'symptoms',NEW.payload->>'symptoms',
      'replaces_event_id',NEW.payload->>'replaces_event_id')
    ELSE jsonb_build_object('contract','cch-e5-session-review-v1',
      'explicit_confirmation',true,'recovery',NEW.payload->>'recovery',
      'symptoms',NEW.payload->>'symptoms') END)
  THEN RAISE EXCEPTION 'unexpected E5 review fields' USING ERRCODE='23514'; END IF;
  SELECT a.auth_user_id,s.status,s.record_status
   INTO v_athlete_auth,v_status,v_record
   FROM public.health_workout_sessions s JOIN public.health_athletes a
    ON a.id=s.athlete_id
   WHERE s.id=NEW.session_id AND s.athlete_id=NEW.athlete_id;
  IF v_athlete_auth IS DISTINCT FROM auth.uid() OR v_status IS DISTINCT FROM 'completed'
   OR v_record IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'E5 review only by athlete for completed/active session'
     USING ERRCODE='42501';
  END IF;
  -- Serialize corrections at the session row, including concurrent transactions.
  PERFORM 1 FROM public.health_workout_sessions s
   WHERE s.id=NEW.session_id AND s.athlete_id=NEW.athlete_id FOR UPDATE;
  IF v_is_correction THEN
   IF COALESCE(NEW.payload->>'replaces_event_id','') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   THEN RAISE EXCEPTION 'invalid predecessor ID' USING ERRCODE='23514'; END IF;
   v_prev:=(NEW.payload->>'replaces_event_id')::uuid;
   SELECT ev.created_by_auth_user_id INTO v_prev_actor
    FROM public.health_workout_events ev
    WHERE ev.id=v_prev AND ev.athlete_id=NEW.athlete_id
     AND ev.session_id=NEW.session_id AND ev.event_type='note'
     AND ev.payload->>'contract'='cch-e5-session-review-v1';
   IF v_prev_actor IS DISTINCT FROM auth.uid()
     OR EXISTS(SELECT 1 FROM public.health_workout_events newer
      WHERE newer.athlete_id=NEW.athlete_id AND newer.session_id=NEW.session_id
       AND newer.event_type='note'
       AND newer.payload->>'contract'='cch-e5-session-review-v1'
       AND newer.payload->>'replaces_event_id'=v_prev::text)
   THEN RAISE EXCEPTION 'E5 correction must replace latest owned event'
     USING ERRCODE='23514'; END IF;
  END IF;
  NEW.occurred_at:=clock_timestamp();
  NEW.recorded_at:=NEW.occurred_at;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER health_cch_e5_session_note_guard
 BEFORE INSERT ON public.health_workout_events FOR EACH ROW
 EXECUTE FUNCTION public.health_cch_e5_validate_session_note();

-- Exactly one root, but revisions are separate immutable events.
CREATE UNIQUE INDEX health_cch_e5_one_root_per_session
 ON public.health_workout_events(athlete_id,session_id)
 WHERE event_type='note' AND payload->>'contract'='cch-e5-session-review-v1'
  AND NOT (payload ? 'replaces_event_id');
CREATE UNIQUE INDEX health_cch_e5_one_successor_per_event
 ON public.health_workout_events(athlete_id,session_id,(payload->>'replaces_event_id'))
 WHERE event_type='note' AND payload->>'contract'='cch-e5-session-review-v1'
  AND (payload ? 'replaces_event_id');

-- Crucial: existing M4 policy is OR-capable; REPLACE rather than ADD a new
-- policy, so broad health_can_write_athlete cannot bypass E5 owner gate.
DROP POLICY health_workout_events_insert ON public.health_workout_events;
CREATE POLICY health_workout_events_insert ON public.health_workout_events
 FOR INSERT TO authenticated WITH CHECK (
 public.health_can_write_athlete(athlete_id)
 AND (created_by_auth_user_id IS NULL OR created_by_auth_user_id=auth.uid())
 AND (NOT (event_type='note' AND payload->>'contract'='cch-e5-session-review-v1')
  OR (created_by_auth_user_id=auth.uid() AND
   EXISTS (SELECT 1 FROM public.health_athletes a
    WHERE a.id=athlete_id AND a.auth_user_id=auth.uid())))
);
COMMIT;
