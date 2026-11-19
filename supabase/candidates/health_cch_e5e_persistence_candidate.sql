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
    AND details->>'contract'='cch-e5-consent-v1'))
 );

-- Server-owned chronology and actor identity. E5 cannot be back/future-dated
-- by an API caller to override an eventual revocation.
CREATE OR REPLACE FUNCTION public.health_cch_e5_stamp_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=public,pg_temp AS $
BEGIN
 IF NEW.consent_type='e5_personalized_review' THEN
  IF auth.uid() IS NULL OR NEW.actor_auth_user_id IS DISTINCT FROM auth.uid()
   OR NEW.details->>'contract' IS DISTINCT FROM 'cch-e5-consent-v1'
   OR NEW.details->'explicit_action' IS DISTINCT FROM 'true'::jsonb THEN
   RAISE EXCEPTION 'E5 consent requires explicit authenticated action'
    USING ERRCODE='23514';
  END IF;
  NEW.occurred_at:=clock_timestamp();
  NEW.created_at:=NEW.occurred_at;
 END IF;
 RETURN NEW;
END $;
CREATE TRIGGER health_cch_e5_consent_time_guard
 BEFORE INSERT ON public.health_consents FOR EACH ROW
 EXECUTE FUNCTION public.health_cch_e5_stamp_consent();

-- Fail closed for all readers without the same athlete identity, latest decision,
-- unambiguous timestamp and exact currently approved version passed by the caller.
CREATE OR REPLACE FUNCTION public.health_cch_e5_has_explicit_consent(
 p_athlete_id uuid,p_policy_version text
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER
 SET search_path=public,pg_temp AS $$
DECLARE v_latest timestamptz;v_count integer;v_granted integer;v_version_ok integer;
BEGIN
 IF auth.uid() IS NULL OR NULLIF(btrim(p_policy_version),'') IS NULL OR
  NOT EXISTS (SELECT 1 FROM public.health_athletes a
   WHERE a.id=p_athlete_id AND a.auth_user_id=auth.uid()) THEN RETURN false; END IF;
 SELECT max(occurred_at) INTO v_latest FROM public.health_consents
  WHERE athlete_id=p_athlete_id AND consent_type='e5_personalized_review';
 IF v_latest IS NULL THEN RETURN false; END IF;
 SELECT count(*),count(*) FILTER (WHERE decision='granted'),
        count(*) FILTER (WHERE policy_version=p_policy_version)
  INTO v_count,v_granted,v_version_ok FROM public.health_consents
  WHERE athlete_id=p_athlete_id AND consent_type='e5_personalized_review'
   AND occurred_at=v_latest;
 RETURN v_count=1 AND v_granted=1 AND v_version_ok=1;
END $$;
REVOKE ALL ON FUNCTION public.health_cch_e5_has_explicit_consent(uuid,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_e5_has_explicit_consent(uuid,text)
 TO authenticated;

-- M4 retains its existing event table and append-only API. E5 is a restricted
-- subset of notes, not a new event_type or table.
CREATE OR REPLACE FUNCTION public.health_cch_e5_validate_session_note()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=public,pg_temp AS $$
DECLARE v_athlete_auth uuid;v_status text;v_record text;
BEGIN
 IF NEW.event_type='note' AND NEW.payload->>'contract'='cch-e5-session-review-v1' THEN
  IF auth.uid() IS NULL OR NEW.created_by_auth_user_id IS DISTINCT FROM auth.uid()
   OR NEW.source<>'user' OR NEW.workout_exercise_id IS NOT NULL
   OR NEW.workout_set_id IS NOT NULL OR
   NEW.payload<>jsonb_build_object('contract','cch-e5-session-review-v1',
    'explicit_confirmation',true,'recovery',NEW.payload->>'recovery',
    'symptoms',NEW.payload->>'symptoms') OR
   COALESCE(NEW.payload->>'recovery','') NOT IN ('good','poor','unknown') OR
   COALESCE(NEW.payload->>'symptoms','') NOT IN ('none','pain','unknown') THEN
    RAISE EXCEPTION 'invalid E5 review attribution or payload' USING ERRCODE='23514';
  END IF;
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
  NEW.occurred_at:=clock_timestamp();
  NEW.recorded_at:=NEW.occurred_at;
 END IF;
 RETURN NEW;
END $;
CREATE TRIGGER health_cch_e5_session_note_guard
 BEFORE INSERT ON public.health_workout_events FOR EACH ROW
 EXECUTE FUNCTION public.health_cch_e5_validate_session_note();

-- One immutable E5 review per session. A repeated client_event_id is already
-- covered by M4 UNIQUE(athlete_id,client_event_id).
CREATE UNIQUE INDEX health_cch_e5_one_note_per_session
 ON public.health_workout_events(athlete_id,session_id)
 WHERE event_type='note' AND payload->>'contract'='cch-e5-session-review-v1';

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
