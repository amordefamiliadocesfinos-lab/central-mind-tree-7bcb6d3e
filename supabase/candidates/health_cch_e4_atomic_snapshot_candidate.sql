-- CCH S05/E4: candidate only. Not an active migration or production RPC.
-- A single STABLE SQL statement uses one MVCC snapshot for all four sources.
BEGIN;
CREATE OR REPLACE FUNCTION public.health_cch_e4_read_snapshot_candidate(p_athlete_id uuid,p_program_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $e4$
 WITH allowed AS MATERIALIZED (
   SELECT p.id FROM public.health_programs p
   WHERE p.id=p_program_id AND p.athlete_id=p_athlete_id
     AND auth.uid() IS NOT NULL AND public.health_can_read_athlete(p_athlete_id)
 ), version_probe AS MATERIALIZED (
   SELECT v.id FROM public.health_program_versions v
   JOIN allowed a ON a.id=v.program_id
   WHERE v.athlete_id=p_athlete_id ORDER BY v.id LIMIT 1001
 ), versions AS MATERIALIZED (
   SELECT id FROM version_probe ORDER BY id LIMIT 1000
 ), session_probe AS MATERIALIZED (
   SELECT s.id,s.program_version_id,s.session_template_id,s.started_at,s.status,s.record_status
   FROM public.health_workout_sessions s JOIN versions v ON v.id=s.program_version_id
   WHERE s.athlete_id=p_athlete_id AND s.status='completed' AND s.record_status='active'
   ORDER BY s.started_at DESC NULLS LAST,s.id LIMIT 301
 ), sessions AS MATERIALIZED (
   SELECT * FROM session_probe ORDER BY started_at DESC NULLS LAST,id LIMIT 300
 ), template_probe AS MATERIALIZED (
   SELECT t.id,t.program_version_id,t.code,t.status FROM public.health_session_templates t
   JOIN versions v ON v.id=t.program_version_id
   WHERE t.athlete_id=p_athlete_id ORDER BY t.id LIMIT 3001
 ), templates AS MATERIALIZED (
   SELECT * FROM template_probe ORDER BY id LIMIT 3000
 ), set_probe AS MATERIALIZED (
   SELECT w.id,w.session_id,w.status,w.set_type,w.reps,w.rir,w.load_value,w.load_unit
   FROM public.health_workout_sets w JOIN sessions s ON s.id=w.session_id
   WHERE w.athlete_id=p_athlete_id AND w.status='completed' AND w.set_type='working'
   ORDER BY w.id LIMIT 10001
 ), sets AS MATERIALIZED (
   SELECT * FROM set_probe ORDER BY id LIMIT 10000
 ), bounds AS (
   SELECT (SELECT count(*) FROM version_probe)>1000 OR
     (SELECT count(*) FROM session_probe)>300 OR
     (SELECT count(*) FROM template_probe)>3000 OR
     (SELECT count(*) FROM set_probe)>10000 AS truncated
 )
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM allowed) THEN NULL
 ELSE jsonb_build_object(
   'contract','cch-e4-snapshot-candidate-v1',
   'athleteId',p_athlete_id,'programId',p_program_id,
   'sourceTruncated',bounds.truncated,
   -- No partial evidence is returned as a valid review on overflow.
   'versionIds',CASE WHEN bounds.truncated THEN '[]'::jsonb ELSE
      COALESCE((SELECT jsonb_agg(v.id ORDER BY v.id) FROM versions v),'[]'::jsonb) END,
   'sessions',CASE WHEN bounds.truncated THEN '[]'::jsonb ELSE
      COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.started_at DESC NULLS LAST,s.id) FROM sessions s),'[]'::jsonb) END,
   'templates',CASE WHEN bounds.truncated THEN '[]'::jsonb ELSE
      COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM templates t),'[]'::jsonb) END,
   'sets',CASE WHEN bounds.truncated THEN '[]'::jsonb ELSE
      COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.id) FROM sets w),'[]'::jsonb) END
 ) END FROM bounds
$e4$;
REVOKE ALL ON FUNCTION public.health_cch_e4_read_snapshot_candidate(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_cch_e4_read_snapshot_candidate(uuid,uuid) TO authenticated;
COMMIT;
