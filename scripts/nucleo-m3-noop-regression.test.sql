\set ON_ERROR_STOP on
-- Somente banco descartável, identidades fictícias e sem conteúdo privado.
INSERT INTO public.app_admin_capabilities (auth_user_id,capability)
VALUES ('11111111-1111-4111-8111-111111111111','nucleo_manage');
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';

INSERT INTO public.nucleo_development_workstreams(id,code,kind,title,description,next_action)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','M3TEST','modulo','Núcleo sintético','original','Original');
CREATE TEMP TABLE m3_test_before AS
SELECT updated_at,updated_by_auth_uid FROM public.nucleo_development_workstreams WHERE code='M3TEST';
CREATE TEMP TABLE m3_event_before AS SELECT count(*) as events FROM public.nucleo_development_events;
-- Retry identically: must NOT touch row or audit trail.
UPDATE public.nucleo_development_workstreams SET next_action='Original' WHERE code='M3TEST';
UPDATE public.nucleo_development_workstreams
 SET title='Núcleo sintético',description='original',next_action='Original',
     updated_at=now(),updated_by_auth_uid=auth.uid() WHERE code='M3TEST';

DO $check$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_development_events)<>(SELECT events FROM m3_event_before)
 THEN RAISE EXCEPTION 'M3 no-op created event'; END IF;
 IF (SELECT updated_at FROM public.nucleo_development_workstreams WHERE code='M3TEST')
 IS DISTINCT FROM (SELECT updated_at FROM m3_test_before)
 THEN RAISE EXCEPTION 'M3 no-op updated timestamp'; END IF;
END $check$;

UPDATE public.nucleo_development_workstreams SET next_action='Alterado'
WHERE code='M3TEST';
DO $changed$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_development_events)<>(SELECT events+1 FROM m3_event_before)
 THEN RAISE EXCEPTION 'M3 real edit did not create exactly one event'; END IF;
 IF (SELECT next_action FROM public.nucleo_development_workstreams WHERE code='M3TEST')<>'Alterado'
 THEN RAISE EXCEPTION 'M3 real edit not persisted'; END IF;
END $changed$;

UPDATE public.nucleo_development_workstreams SET next_action='Original' WHERE code='M3TEST';
DO $restored$
BEGIN
 IF (SELECT count(*) FROM public.nucleo_development_events)<>(SELECT events+2 FROM m3_event_before)
 THEN RAISE EXCEPTION 'M3 restore did not create exactly one event'; END IF;
 IF (SELECT count(*) FROM public.nucleo_development_events
 WHERE workstream_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 AND event_type='alterado' AND before_state->>'next_action'='Alterado'
 AND after_state->>'next_action'='Original')<>1
 THEN RAISE EXCEPTION 'M3 restoration evidence lost'; END IF;
END $restored$;
RESET ROLE;
SELECT 'PASS M3 no-op suppressed / real edit audited / restoration audited' AS result;
