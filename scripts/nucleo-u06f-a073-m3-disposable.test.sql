\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title,next_action)
VALUES ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','CRM','modulo','CRM CI','Histórico inicial. Ação vigente: conferir fontes.');
DO $m3$
DECLARE a record;b record;c record;w public.nucleo_development_workstreams%ROWTYPE;e public.nucleo_development_events%ROWTYPE;
 m constant uuid:='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 q constant uuid:='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
 q2 constant uuid:='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';
 dec constant text:='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/1037#issuecomment-7223290532';
 ts timestamptz; old_action text;
BEGIN
 SELECT * INTO w FROM public.nucleo_development_workstreams WHERE id=m;
 ts:=w.updated_at; old_action:=w.next_action;
 SELECT * INTO a FROM nucleo_u06f_private.register_m3_checkpoint(q,m,ts,old_action,'Checkpoint documental sintético','Reconciliar o conhecimento de teste.',dec);
 SELECT * INTO b FROM nucleo_u06f_private.register_m3_checkpoint(q,m,ts,old_action,'Checkpoint documental sintético','Reconciliar o conhecimento de teste.',dec);
 IF a.event_id IS NULL OR a.event_id IS DISTINCT FROM b.event_id OR a.result<>'confirmado_por_readback' OR b.result<>'confirmado_existente' THEN RAISE EXCEPTION 'M3 replay falhou'; END IF;
 SELECT * INTO e FROM public.nucleo_development_events WHERE id=a.event_id;
 IF e.actor_auth_uid IS NOT NULL OR e.registration_origin<>'administrativo_lovable'
 OR e.before_state->>'next_action' IS DISTINCT FROM old_action
 OR (e.before_state-ARRAY['next_action','updated_at','updated_by_auth_uid']) IS DISTINCT FROM (e.after_state-ARRAY['next_action','updated_at','updated_by_auth_uid'])
 OR e.after_state->>'next_action' NOT LIKE '%Histórico inicial. Ação então vigente (histórica): conferir fontes.%'
 OR (SELECT count(*) FROM regexp_matches(e.after_state->>'next_action','Ação vigente:','g'))<>1
 THEN RAISE EXCEPTION 'M3 histórico/delta/autoria inválido'; END IF;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_m3_checkpoint(gen_random_uuid(),m,ts,old_action,'Checkpoint obsoleto de teste','Executar ação concorrente de teste.',dec);
 RAISE EXCEPTION 'M3 CAS obsoleto aceito';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_m3_checkpoint(q,m,ts,old_action,'Checkpoint divergente de teste','Reconciliar o conhecimento de teste.',dec);
 RAISE EXCEPTION 'M3 request divergente aceito';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 SELECT * INTO w FROM public.nucleo_development_workstreams WHERE id=m;
 SELECT * INTO c FROM nucleo_u06f_private.register_m3_checkpoint(q2,m,w.updated_at,w.next_action,'Segundo checkpoint sintético','Preservar a próxima ação de teste.',dec);
 SELECT * INTO b FROM nucleo_u06f_private.register_m3_checkpoint(q,m,ts,old_action,'Checkpoint documental sintético','Reconciliar o conhecimento de teste.',dec);
 IF b.event_id<>a.event_id OR b.result<>'confirmado_existente'
 OR (SELECT next_action FROM public.nucleo_development_workstreams WHERE id=m) NOT LIKE '%Ação vigente: Preservar a próxima ação de teste.'
 OR (SELECT count(*) FROM public.nucleo_development_events WHERE workstream_id=m AND registration_origin='administrativo_lovable')<>2
 THEN RAISE EXCEPTION 'M3 replay posterior modificou estado'; END IF;
 BEGIN
 INSERT INTO public.nucleo_development_events(workstream_id,event_type,before_state,after_state,registration_origin,registration_reference,registration_request_id)
 VALUES(m,'alterado','{}','{}','administrativo_lovable',dec,gen_random_uuid());
 RAISE EXCEPTION 'M3 evento fabricado aceito';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $m3$;
INSERT INTO public.app_admin_capabilities(auth_user_id,capability) VALUES ('33333333-3333-4333-8333-333333333333','nucleo_manage');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
UPDATE public.nucleo_development_workstreams SET next_action='Checkpoint humano legítimo de teste' WHERE id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
DO $human$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.nucleo_development_events WHERE workstream_id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' AND registration_origin='auth_app' AND actor_auth_uid=auth.uid() AND after_state->>'next_action'='Checkpoint humano legítimo de teste') THEN RAISE EXCEPTION 'M3 regressão humana'; END IF;
END $human$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
DO $acl$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') AND (has_schema_privilege(rolname,'nucleo_u06f_private','USAGE') OR has_function_privilege(rolname,'nucleo_u06f_private.register_m3_checkpoint(uuid,uuid,timestamptz,text,text,text,text)','EXECUTE'))) THEN RAISE EXCEPTION 'M3 escritor exposto'; END IF;
 BEGIN
 TRUNCATE public.nucleo_development_events;
 RAISE EXCEPTION 'M3 histórico truncado';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $acl$;
ROLLBACK;
SELECT 'PASS A07.3: M3 CAS, historical markers, exact replay after later update, restricted delta and human event' AS result;
