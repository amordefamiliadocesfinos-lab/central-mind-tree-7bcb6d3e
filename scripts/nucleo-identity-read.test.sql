-- Disposable fixtures only. Original M1/M3/M4/FM/AC-01 migrations are applied first.
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title) VALUES
 ('10000000-0000-0000-0000-000000000001','NUC','modulo','Núcleo sintético'),
 ('10000000-0000-0000-0000-000000000002','CRM','modulo','CRM sintético');
INSERT INTO public.nucleo_development_workstreams(id,code,kind,title,parent_id) VALUES
 ('10000000-0000-0000-0000-000000000003','NUC-F1','frente','Frente sintética','10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000004','NUC-F2','frente','Outra frente sintética','10000000-0000-0000-0000-000000000001');
CREATE FUNCTION public.identity_assert(value boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
 BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERT: %',message; END IF; END $$;
GRANT EXECUTE ON FUNCTION public.identity_assert(boolean,text) TO authenticated,anon;
INSERT INTO nucleo_identity.specialties VALUES
 ('20000000-0000-0000-0000-000000000001','governance','Governança','synthetic://method/general','synthetic://review/1'),
 ('20000000-0000-0000-0000-000000000002','security','Segurança','synthetic://method/security','synthetic://review/2'),
 ('20000000-0000-0000-0000-000000000003','design','Design','synthetic://method/design','synthetic://review/3');
INSERT INTO nucleo_identity.instances VALUES
 ('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Instância A','synthetic://identity/a'),
 ('30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','Instância B','synthetic://identity/b'),
 ('30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003','Instância C','synthetic://identity/c');
INSERT INTO nucleo_identity.assignments(id,specialty_id,instance_id,auth_uid,module_id,front_id,responsibility,local_method_ref,provenance_ref,valid_from,valid_until) VALUES
 ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','primary','synthetic://method/nuc','synthetic://assignment/a',now()-interval '1 day',now()+interval '1 day'),
 ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',null,'collaborator',null,'synthetic://assignment/b',now()-interval '1 day',now()+interval '1 day'),
 ('50000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',null,'collaborator',null,'synthetic://assignment/c',now()-interval '1 day',now()+interval '1 day'),
 ('50000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',null,'primary','synthetic://method/crm','synthetic://assignment/d',now()-interval '1 day',now()+interval '1 day');
SELECT public.identity_assert((SELECT count(DISTINCT instance_id)=3 FROM nucleo_identity.assignments WHERE module_id='10000000-0000-0000-0000-000000000001'),'three instances in NUC');
SELECT public.identity_assert((SELECT count(DISTINCT module_id)=2 FROM nucleo_identity.assignments WHERE specialty_id='20000000-0000-0000-0000-000000000001'),'one specialty two modules');
INSERT INTO nucleo_identity.read_grants(id,assignment_id,auth_uid,scope_kind,valid_from,valid_until,decision_ref,actor_ref)
SELECT ('60000000-0000-0000-0000-'||right(id::text,12))::uuid,id,auth_uid,
 CASE WHEN front_id IS NULL THEN 'module' ELSE 'front' END,
 now()-interval '1 hour',now()+interval '1 hour','synthetic://decision/'||id,'synthetic://actor/reviewer'
FROM nucleo_identity.assignments;
-- Use the actual existing AC-01 writer twice; identity association never edits it.
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO public.nucleo_specialist_contributions(id,module_id,workstream_id,specialist_role,contribution_kind,title,source_kind,source_locator,request_id)
 VALUES('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','Papel original sintético','aprendizado','Aprendizado sintético','github','synthetic://learning/v1','81000000-0000-0000-0000-000000000001');
INSERT INTO public.nucleo_specialist_contributions(id,module_id,workstream_id,specialist_role,contribution_kind,title,source_kind,source_locator,request_id,parent_revision_id)
 VALUES('80000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','Papel original sintético','aprendizado','Aprendizado sintético v2','github','synthetic://learning/v2','81000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001');
INSERT INTO public.nucleo_module_knowledge_revisions(id,module_id,section_code,version_no,title,body)
 VALUES('82000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','FM-09',1,'Evolução sintética','Conteúdo privado sintético, nunca projetado.');
INSERT INTO public.nucleo_development_evidence(id,workstream_id,source,kind,repository,external_key,reference_url,title)
 VALUES('83000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','github','commit','amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e','synthetic-only','https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/commit/synthetic','Commit sintético');
INSERT INTO nucleo_identity.references(id,assignment_id,contribution_id,label,source_ref,review_ref,reviewed_by_auth_uid) VALUES
 ('70000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002','Aprendizado revisado','synthetic://learning/v2','synthetic://review/learning','40000000-0000-0000-0000-000000000002');
INSERT INTO nucleo_identity.references(id,assignment_id,fm_id,label,source_ref,review_ref,reviewed_by_auth_uid) VALUES
 ('70000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002','82000000-0000-0000-0000-000000000001','FM revisada','synthetic://fm/reference','synthetic://review/fm','40000000-0000-0000-0000-000000000002');
INSERT INTO nucleo_identity.references(id,assignment_id,evidence_id,label,source_ref,review_ref,reviewed_by_auth_uid) VALUES
 ('70000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001','M4 revisada','synthetic://evidence/reference','synthetic://review/m4','40000000-0000-0000-0000-000000000002');
INSERT INTO nucleo_identity.references(id,assignment_id,event_id,label,source_ref,review_ref,reviewed_by_auth_uid)
SELECT '70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',id,
 'Checkpoint sintético','synthetic://checkpoint/1','synthetic://review/checkpoint','40000000-0000-0000-0000-000000000002'
 FROM public.nucleo_development_events WHERE workstream_id='10000000-0000-0000-0000-000000000003';
-- Negative ownership/context/history/idempotency constraints under owner, not bypassed by RLS.
DO $$BEGIN
 BEGIN
  INSERT INTO nucleo_identity.assignments SELECT '50000000-0000-0000-0000-000000000099',specialty_id,instance_id,auth_uid,module_id,front_id,responsibility,local_method_ref,provenance_ref,valid_from,valid_until,closed_at FROM nucleo_identity.assignments WHERE id='50000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'duplicate assignment accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  UPDATE nucleo_identity.assignments SET auth_uid='40000000-0000-0000-0000-000000000002' WHERE id='50000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'history mutation accepted'; EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'IDENTITY_HISTORY_IMMUTABLE' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO nucleo_identity.references(id,assignment_id,event_id,label,source_ref,review_ref,reviewed_by_auth_uid)
   SELECT gen_random_uuid(),'50000000-0000-0000-0000-000000000001',id,'Wrong front label','synthetic://wrong','synthetic://review','40000000-0000-0000-0000-000000000001'
   FROM public.nucleo_development_events WHERE workstream_id='10000000-0000-0000-0000-000000000004';
  RAISE EXCEPTION 'cross-front reference accepted'; EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'IDENTITY_REFERENCE_CONTEXT_MISMATCH' THEN RAISE; END IF; END;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='40000000-0000-0000-0000-000000000001';
SELECT public.identity_assert((SELECT count(*)=0 FROM public.app_admin_capabilities),'no global capability');
SELECT public.identity_assert((SELECT count(*)=0 FROM public.nucleo_development_workstreams),'raw M3 stays private');
SELECT public.identity_assert((SELECT count(*)=2 FROM nucleo_identity.assignments),'only own assignments');
SELECT public.identity_assert((SELECT count(*)=1 FROM nucleo_identity.specialties),'only granted specialty');
SELECT public.identity_assert(jsonb_array_length(public.nucleo_identity_assignments_read('10000000-0000-0000-0000-000000000001'))=1,'scoped module selector');
SELECT public.identity_assert(public.nucleo_identity_context_read('50000000-0000-0000-0000-000000000002') IS NULL,'other user denied');
SELECT public.identity_assert(public.nucleo_identity_context_read('50000000-0000-0000-0000-000000000001')->>'local_method_ref'='synthetic://method/nuc','own local method');
SELECT public.identity_assert(public.nucleo_identity_context_read('50000000-0000-0000-0000-000000000004')->>'local_method_ref'='synthetic://method/crm','other module same specialty separate adaptation');
SELECT public.identity_assert(jsonb_array_length(public.nucleo_identity_context_read('50000000-0000-0000-0000-000000000001')->'references')=3,'only reviewed matching checkpoint/AC01/M4');
SELECT public.identity_assert((SELECT count(*)=0 FROM public.nucleo_specialist_contributions),'raw AC01 stays private');
SELECT public.identity_assert((SELECT count(*)=0 FROM public.nucleo_module_knowledge_revisions),'raw FM stays private');
DO $$BEGIN
 BEGIN UPDATE nucleo_identity.read_grants SET revoked_at=now(); RAISE EXCEPTION 'client write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO nucleo_identity.specialties VALUES(gen_random_uuid(),'forged','Forged','synthetic://method','synthetic://origin'); RAISE EXCEPTION 'client identity creation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Expiration and future start are evaluated on every read, not a cached authorization.
UPDATE nucleo_identity.read_grants SET revoked_at=now(),revocation_ref='synthetic://revoke/first',revoked_by_actor_ref='synthetic://actor/reviewer' WHERE assignment_id='50000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT public.identity_assert(public.nucleo_identity_context_read('50000000-0000-0000-0000-000000000001') IS NULL,'revoked access denied');
SELECT public.identity_assert(NOT EXISTS(SELECT 1 FROM nucleo_identity.assignments WHERE id='50000000-0000-0000-0000-000000000001'),'direct assignment method also hidden after revocation');
RESET ROLE;
INSERT INTO nucleo_identity.read_grants VALUES('60000000-0000-0000-0000-000000000099','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','front',now()-interval '2 hours',now()-interval '1 hour','synthetic://decision/expired','synthetic://actor/reviewer',null,null,null);
SET ROLE authenticated;
SELECT public.identity_assert(public.nucleo_identity_context_read('50000000-0000-0000-0000-000000000001') IS NULL,'expired access denied');
SET request.jwt.claim.sub='40000000-0000-0000-0000-000000000099';
SELECT public.identity_assert(public.nucleo_identity_assignments_read('10000000-0000-0000-0000-000000000001')='[]'::jsonb,'unassigned successor has no inherited access');
RESET ROLE;
SET ROLE anon;
DO $$BEGIN
 BEGIN PERFORM public.nucleo_identity_context_read('50000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'anonymous RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT public.identity_assert((SELECT count(*)=4 FROM public.nucleo_development_workstreams),'legacy rows preserved');
SELECT public.identity_assert((SELECT count(*)=4 FROM nucleo_identity.references),'checkpoint/AC01/FM/M4 references preserved');
SELECT public.identity_assert((SELECT count(*)=2 AND min(version_no)=1 AND max(version_no)=2 AND count(DISTINCT lineage_id)=1 AND min(recorded_by_auth_uid::text)='11111111-1111-4111-8111-111111111111' FROM public.nucleo_specialist_contributions),'AC01 lineage/versions/authorship preserved');
SELECT public.identity_assert(NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nucleo_identity' AND p.prosecdef),'no definer bypass');
