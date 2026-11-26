-- S05/E4 candidate checks on reduced synthetic fixture; no production DB.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $assert$
DECLARE x jsonb;
BEGIN
 x:=public.health_cch_e4_read_snapshot_candidate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001');
 IF x IS NULL OR x->>'contract'<>'cch-e4-snapshot-candidate-v1' OR x->>'sourceTruncated'<>'false'
 OR jsonb_array_length(x->'versionIds')<>1 OR jsonb_array_length(x->'sessions')<>1
 OR jsonb_array_length(x->'templates')<>1 OR jsonb_array_length(x->'sets')<>1
 OR x->'sets'->0->>'load_value'<>'80' OR x->'sessions'->0->>'record_status'<>'active'
 THEN RAISE EXCEPTION 'valid snapshot failed'; END IF;
 IF public.health_cch_e4_read_snapshot_candidate('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b1000000-0000-4000-8000-000000000001') IS NOT NULL
 OR public.health_cch_e4_read_snapshot_candidate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','b1000000-0000-4000-8000-000000000001') IS NOT NULL
 THEN RAISE EXCEPTION 'cross-athlete or program mismatch'; END IF;
 x:=public.health_cch_e4_read_snapshot_candidate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000002');
 IF x IS NULL OR x->>'sourceTruncated'<>'false' OR jsonb_array_length(x->'versionIds')<>0 THEN RAISE EXCEPTION 'authorized empty program not distinguished'; END IF;
END
$assert$;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $assert$
DECLARE x jsonb;
BEGIN
 x:=public.health_cch_e4_read_snapshot_candidate('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b1000000-0000-4000-8000-000000000001');
 IF x IS NULL OR x->'sets'->0->>'load_value'<>'20' THEN RAISE EXCEPTION 'owner B snapshot failed'; END IF;
 IF public.health_cch_e4_read_snapshot_candidate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'owner B reads A'; END IF;
END
$assert$;
SELECT set_config('request.jwt.claim.sub','',false);
DO $assert$
BEGIN
 IF public.health_cch_e4_read_snapshot_candidate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'missing subject accepted'; END IF;
END
$assert$;
RESET ROLE;
DO $assert$
BEGIN
 IF has_function_privilege('anon','public.health_cch_e4_read_snapshot_candidate(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'anon execution allowed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.health_cch_e4_read_snapshot_candidate(uuid,uuid)'::regprocedure AND provolatile='s' AND NOT prosecdef) THEN RAISE EXCEPTION 'snapshot function must be stable and invoker'; END IF;
END
$assert$;
-- Exact boundary and overflow sentinel; 299 extra valid sessions plus existing one.
INSERT INTO public.health_workout_sessions
SELECT ('a4100000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',
 '2026-11-25T12:00:00Z'::timestamptz,'completed','active' FROM generate_series(1,299) g;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $assert$
DECLARE x jsonb;
BEGIN
 x:=public.health_cch_e4_read_snapshot_candidate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001');
 IF x IS NULL OR x->>'sourceTruncated'<>'false' OR jsonb_array_length(x->'sessions')<>300 THEN RAISE EXCEPTION 'exact limit rejected'; END IF;
END
$assert$;
RESET ROLE;
INSERT INTO public.health_workout_sessions VALUES
 ('a4100000-0000-4000-8000-000000000300','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','2026-11-25T12:00:00Z','completed','active');
SET ROLE authenticated;
DO $assert$
DECLARE x jsonb;
BEGIN
 x:=public.health_cch_e4_read_snapshot_candidate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001');
 IF x IS NULL OR x->>'sourceTruncated'<>'true' OR jsonb_array_length(x->'sessions')<>0 OR jsonb_array_length(x->'sets')<>0 OR jsonb_array_length(x->'templates')<>0 OR jsonb_array_length(x->'versionIds')<>0 THEN RAISE EXCEPTION 'overflow must suppress partial evidence'; END IF;
END
$assert$;
RESET ROLE;
SELECT 'CCH_E4_ATOMIC_SNAPSHOT_CANDIDATE_PASS' AS result;
