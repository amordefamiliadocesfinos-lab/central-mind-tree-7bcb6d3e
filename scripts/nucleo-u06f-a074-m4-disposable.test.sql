\set ON_ERROR_STOP on
BEGIN;
-- Synthetic references only; this transaction never touches production.
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY);
INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('20261127194501') ON CONFLICT DO NOTHING;
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title,next_action) VALUES
('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','CRM','modulo','CRM CI','Checkpoint anterior'),
('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','SHO','modulo','Shopee CI','Checkpoint anterior');
DO $m4$
DECLARE a record;b record;c record; before_w jsonb;
 m constant uuid:='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 s constant uuid:='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
 q constant uuid:='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';
 dec constant text:='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/1037#issuecomment-7223290532';
BEGIN
 SELECT to_jsonb(w) INTO before_w FROM public.nucleo_development_workstreams w WHERE id=m;
 SELECT * INTO a FROM nucleo_u06f_private.register_m4_observation(q,m,'github','pull_request','1200','PR sintética','Observação técnica de teste, sem homologação.',dec);
 SELECT * INTO b FROM nucleo_u06f_private.register_m4_observation(q,m,'github','pull_request','1200','PR sintética','Observação técnica de teste, sem homologação.',dec);
 SELECT * INTO c FROM nucleo_u06f_private.register_m4_observation(gen_random_uuid(),s,'supabase','migration','20261127194501','Migration sintética','Ledger sintético de teste, sem homologação.',dec);
 IF a.id IS NULL OR a.id IS DISTINCT FROM b.id OR a.result<>'confirmado_por_readback' OR b.result<>'confirmado_existente' OR c.id IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.nucleo_development_evidence WHERE id=a.id AND registration_origin='administrativo_lovable' AND recorded_by_auth_uid IS NULL AND observed_state='observado' AND checked_at IS NULL AND snapshot='{}'::jsonb AND reference_url='https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/1200')
 OR (SELECT to_jsonb(w) FROM public.nucleo_development_workstreams w WHERE id=m) IS DISTINCT FROM before_w
 THEN RAISE EXCEPTION 'M4 readback, autoridade ou isolamento falhou'; END IF;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_m4_observation(q,m,'github','pull_request','1200','Título divergente','Observação técnica de teste, sem homologação.',dec);
 RAISE EXCEPTION 'request divergente aceito';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_m4_observation(gen_random_uuid(),m,'github','pull_request','1200','PR duplicada','Observação técnica de teste, sem homologação.',dec);
 RAISE EXCEPTION 'referência duplicada aceita';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_m4_observation(gen_random_uuid(),m,'github','commit','main','Fonte inválida','Observação técnica de teste, sem homologação.',dec);
 RAISE EXCEPTION 'fonte mutável aceita';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_m4_observation(gen_random_uuid(),m,'supabase','migration','19000101000000','Migration ausente','Observação técnica de teste, sem homologação.',dec);
 RAISE EXCEPTION 'migration ausente aceita';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM * FROM nucleo_u06f_private.register_m4_observation(gen_random_uuid(),gen_random_uuid(),'github','pull_request','1201','Frente ausente','Observação técnica de teste, sem homologação.',dec);
 RAISE EXCEPTION 'frente ausente aceita';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 INSERT INTO public.nucleo_development_evidence(workstream_id,source,kind,repository,external_key,reference_url,title,observed_state,checked_at,evidence_note,registration_origin,registration_reference,registration_request_id)
 VALUES(m,'github','pull_request','amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e','1201','https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/1201','Promoção indevida','verificado',now(),'Tentativa de promoção de teste','administrativo_lovable',dec,gen_random_uuid());
 RAISE EXCEPTION 'promoção indevida aceita';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM public.nucleo_development_evidence WHERE workstream_id IN(m,s))<>2 THEN RAISE EXCEPTION 'M4 contagem divergente'; END IF;
END $m4$;
INSERT INTO public.app_admin_capabilities(auth_user_id,capability) VALUES ('33333333-3333-4333-8333-333333333333','nucleo_manage');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
INSERT INTO public.nucleo_development_evidence(workstream_id,source,kind,repository,external_key,reference_url,title)
VALUES ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','github','pull_request','amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e','1202','https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/1202','Observação humana de teste');
DO $human$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.nucleo_development_evidence WHERE external_key='1202' AND registration_origin='auth_app' AND recorded_by_auth_uid=auth.uid()) THEN RAISE EXCEPTION 'M4 regressão humana'; END IF;
 BEGIN
 INSERT INTO public.nucleo_development_evidence(workstream_id,source,kind,repository,external_key,reference_url,title,registration_origin,registration_reference,registration_request_id)
 VALUES ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','github','pull_request','amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e','1203','https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/1203','Origem forjada','administrativo_lovable','fake',gen_random_uuid());
 RAISE EXCEPTION 'origem forjada aceita';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $human$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
DO $acl$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') AND (has_schema_privilege(rolname,'nucleo_u06f_private','USAGE') OR has_function_privilege(rolname,'nucleo_u06f_private.register_m4_observation(uuid,uuid,text,text,text,text,text,text)','EXECUTE'))) THEN RAISE EXCEPTION 'M4 escritor exposto'; END IF;
 BEGIN
 TRUNCATE public.nucleo_development_evidence;
 RAISE EXCEPTION 'histórico M4 truncado';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $acl$;
ROLLBACK;
SELECT 'PASS A07.4: M4 observations, two modules, replay, source, no promotion, M3 unchanged and human writer' AS result;
