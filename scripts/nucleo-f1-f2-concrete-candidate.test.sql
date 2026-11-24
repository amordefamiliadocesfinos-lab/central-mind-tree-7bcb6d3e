-- F1/F2 concrete candidate / disposable PostgreSQL only, no production references.
\set ON_ERROR_STOP on
INSERT INTO f12_core.workstreams VALUES
 ('636768e6-e782-4c7d-8132-e7381621be12','NUC','modulo',NULL),
 ('00000000-0000-4000-8000-000000000010','CRM','modulo',NULL),
 ('95833fbd-38b5-4a0a-abea-45f74214d533','NUC-M4','frente','636768e6-e782-4c7d-8132-e7381621be12'),
 ('00000000-0000-4000-8000-000000000011','CRM-M3','frente','00000000-0000-4000-8000-000000000010');
INSERT INTO f12_lab.specialties VALUES
 ('10000000-0000-4000-8000-000000000001','governanca-nuc','Governança do Núcleo','synthetic://general/v1','proposta','synthetic://provenance/gov'),
 ('10000000-0000-4000-8000-000000000002','seguranca-nuc','Segurança Núcleo','synthetic://general/security','proposta','synthetic://provenance/sec'),
 ('10000000-0000-4000-8000-000000000003','experiencia-ux','Experiência UX','synthetic://general/ux','proposta','synthetic://provenance/ux');
INSERT INTO f12_lab.instances VALUES
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','synthetic://identity/actor-a','actor-A'),
 ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','synthetic://identity/actor-b','actor-B'),
 ('20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','synthetic://identity/actor-c','actor-C'),
 ('20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004','synthetic://identity/expired','actor-expired'),
 ('20000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000005','synthetic://identity/revoked','actor-revoked'),
 ('20000000-0000-4000-8000-000000000006',NULL,'synthetic://identity/unverified','not-authenticated');
INSERT INTO f12_lab.assignments VALUES
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','primary','synthetic://method/nuc','synthetic://prov/assignment-a','active',now()-interval '1 day',NULL,NULL),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000011','primary','synthetic://method/crm','synthetic://prov/assignment-a-crm','active',now()-interval '1 day',NULL,NULL),
 ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','collaborator',NULL,'synthetic://prov/assignment-b','active',now()-interval '1 day',NULL,NULL),
 ('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','collaborator',NULL,'synthetic://prov/assignment-c','active',now()-interval '1 day',NULL,NULL),
 ('40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','collaborator',NULL,'synthetic://prov/expired','active',now()-interval '5 days',now()-interval '1 day',NULL),
 ('40000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000005','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','collaborator',NULL,'synthetic://prov/revoked','active',now()-interval '5 days',NULL,NULL);
INSERT INTO f12_lab.read_grants (id,assignment_id,auth_uid,permission,granted_at,valid_from,valid_until,revoked_at,decision_ref,granting_actor_ref) VALUES
 ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','read_context',now()-interval '1 day',now()-interval '1 day',NULL,NULL,'synthetic://decision/a','synthetic://grantor/steward'),
 ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','read_context',now()-interval '1 day',now()-interval '1 day',NULL,NULL,'synthetic://decision/a-crm','synthetic://grantor/steward'),
 ('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','read_context',now()-interval '1 day',now()-interval '1 day',NULL,NULL,'synthetic://decision/b','synthetic://grantor/steward'),
 ('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000003','read_context',now()-interval '1 day',now()-interval '1 day',NULL,NULL,'synthetic://decision/c','synthetic://grantor/steward'),
 ('50000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000004','read_context',now()-interval '5 days',now()-interval '5 days',NULL,NULL,'synthetic://decision/expired','synthetic://grantor/steward'),
 ('50000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000005','read_context',now()-interval '5 days',now()-interval '5 days',NULL,NULL,'synthetic://decision/revoked','synthetic://grantor/steward');
UPDATE f12_lab.read_grants SET revoked_at=now(), revoked_by_actor_ref='synthetic://revoker/steward',revocation_decision_ref='synthetic://decision/revoke-initial'
 WHERE id='50000000-0000-4000-8000-000000000006';
-- Synthetic metadata source approvals predate cards; no original documents copied.
INSERT INTO f12_lab.approved_card_sources
 (source_ref,specialty_id,module_id,front_id,public_label,origin_kind,verified,private_payload_included,authorization_ref)
 VALUES
 ('synthetic://source/nuc','10000000-0000-4000-8000-000000000001','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','synthetic NUC governance','github_reference',true,false,'synthetic://approval/nuc'),
 ('synthetic://source/crm','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000011','synthetic CRM governance','github_reference',true,false,'synthetic://approval/crm'),
 ('synthetic://source/sec','10000000-0000-4000-8000-000000000002','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','synthetic NUC security','m3_event_reference',true,false,'synthetic://approval/sec'),
 ('synthetic://source/ux','10000000-0000-4000-8000-000000000003','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','synthetic NUC UX','drive_metadata',true,false,'synthetic://approval/ux');
INSERT INTO f12_lab.context_cards VALUES
 ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','checkpoint','synthetic NUC governance','synthetic://source/nuc'),
 ('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000011','checkpoint','synthetic CRM governance','synthetic://source/crm'),
 ('60000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','checkpoint','synthetic NUC security','synthetic://source/sec'),
 ('60000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003','636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533','checkpoint','synthetic NUC UX','synthetic://source/ux');
INSERT INTO f12_core.admin_caps VALUES
 ('30000000-0000-4000-8000-000000000099','nucleo_manage',true,NULL);
DO $$
DECLARE seen integer;
BEGIN
 SELECT count(DISTINCT instance_id) INTO seen FROM f12_lab.assignments
 WHERE module_id='636768e6-e782-4c7d-8132-e7381621be12'
   AND status='active' AND valid_until IS NULL AND provenance_ref NOT LIKE '%revoked%';
 IF seen<>3 THEN RAISE EXCEPTION 'F2: three simultaneous distinct specialist instances expected, got %',seen; END IF;
 SELECT count(DISTINCT module_id) INTO seen FROM f12_lab.assignments WHERE instance_id='20000000-0000-4000-8000-000000000001';
 IF seen<>2 THEN RAISE EXCEPTION 'F2: shared specialty must span two modules'; END IF;
 SELECT count(DISTINCT local_method_ref) INTO seen FROM f12_lab.assignments WHERE instance_id='20000000-0000-4000-8000-000000000001';
 IF seen<>2 THEN RAISE EXCEPTION 'F2: separate adaptations'; END IF;
 IF (SELECT count(*) FROM f12_lab.specialties WHERE stable_code='governanca-nuc')<>1 THEN RAISE EXCEPTION 'duplicate general method'; END IF;
 IF (SELECT count(*) FROM f12_lab.grant_history WHERE event_kind='granted')<>6 THEN RAISE EXCEPTION 'no grant history on insert'; END IF;
 IF has_table_privilege('authenticated','f12_lab.context_cards','INSERT') OR
    has_table_privilege('authenticated','f12_lab.read_grants','INSERT') OR
    has_table_privilege('authenticated','f12_lab.assignments','UPDATE') OR
    has_table_privilege('authenticated','f12_lab.specialties','SELECT') OR
    has_table_privilege('authenticated','f12_lab.instances','SELECT') OR
    has_table_privilege('authenticated','f12_lab.grant_history','SELECT') OR
    NOT has_table_privilege('authenticated','f12_core.workstreams','SELECT') OR
    has_table_privilege('anon','f12_lab.context_cards','SELECT')
 THEN RAISE EXCEPTION 'privilege leak'; END IF;
END $$;
-- A wrong-module front must fail before insertion.
DO $$
BEGIN
 BEGIN
 INSERT INTO f12_lab.assignments VALUES
 ('40000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','636768e6-e782-4c7d-8132-e7381621be12','00000000-0000-4000-8000-000000000011','collaborator',NULL,'synthetic://invalid-front','active',now(),NULL,NULL);
 RAISE EXCEPTION 'foreign front unexpectedly allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='foreign front unexpectedly allowed' THEN RAISE; END IF; END;
 BEGIN
 INSERT INTO f12_lab.read_grants (id,assignment_id,auth_uid,permission,granted_at,valid_from,valid_until,revoked_at,decision_ref,granting_actor_ref) VALUES
 ('50000000-0000-4000-8000-000000000099','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','read_context',now(),now(),NULL,NULL,'synthetic://decision/other','synthetic://grantor/other');
 RAISE EXCEPTION 'cross-actor grant unexpectedly allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='cross-actor grant unexpectedly allowed' THEN RAISE; END IF; END;
 BEGIN
 INSERT INTO f12_lab.assignments SELECT '40000000-0000-4000-8000-000000000098'::uuid,specialty_id,instance_id,auth_uid,module_id,front_id,responsibility,local_method_ref,provenance_ref,status,valid_from,valid_until,closed_at
 FROM f12_lab.assignments WHERE id='40000000-0000-4000-8000-000000000001';
 RAISE EXCEPTION 'duplicate live assignment unexpectedly allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='duplicate live assignment unexpectedly allowed' THEN RAISE; END IF; END;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
DO $$BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards)<>2 THEN RAISE EXCEPTION 'actor-A 2 contexts expected'; END IF;
 IF (SELECT count(*) FROM f12_core.workstreams)<>0 THEN RAISE EXCEPTION 'scoped reader cannot see raw legacy M3'; END IF;
 IF (SELECT count(*) FROM f12_lab.context_cards WHERE specialty_id='10000000-0000-4000-8000-000000000002')<>0 THEN RAISE EXCEPTION 'cross specialty leak'; END IF;
 BEGIN
  INSERT INTO f12_lab.read_grants (id,assignment_id,auth_uid,permission,granted_at,valid_from,valid_until,revoked_at,decision_ref,granting_actor_ref) VALUES('50000000-0000-4000-8000-000000000098','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','read_context',now(),now(),NULL,NULL,'synthetic://decision/forged','synthetic://grantor/forged');
  RAISE EXCEPTION 'unauthorized reader created a grant';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',false);
DO $$BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards)<>1 THEN RAISE EXCEPTION 'actor-B isolated to security NUC'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',false);
DO $$BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards)<>1 THEN RAISE EXCEPTION 'actor-C isolated to UX NUC'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000004',false);
DO $$BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards)<>0 THEN RAISE EXCEPTION 'expired assignment should deny'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000005',false);
DO $$BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards)<>0 THEN RAISE EXCEPTION 'revoked grant should deny'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000099',false);
DO $$BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards)<>4 THEN RAISE EXCEPTION 'owner grant compatibility'; END IF;
 IF (SELECT count(*) FROM f12_core.workstreams)<>4 THEN RAISE EXCEPTION 'legacy M3 owner SELECT under RLS must work'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards)<>0 THEN RAISE EXCEPTION 'missing identity leaked'; END IF;
END $$;
RESET ROLE;
-- A real retraction in the disposable fixture is audited and takes effect on next read.
UPDATE f12_lab.read_grants SET revoked_at=now(),revoked_by_actor_ref='synthetic://revoker/steward',revocation_decision_ref='synthetic://decision/revoke-a'
 WHERE id='50000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
DO $$BEGIN
 IF (SELECT count(*) FROM f12_lab.context_cards)<>1 THEN RAISE EXCEPTION 'revocation must remove NUC and retain CRM'; END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM f12_lab.grant_history WHERE grant_id='50000000-0000-4000-8000-000000000001')<>2 THEN
 RAISE EXCEPTION 'grant/revocation history missing'; END IF;
 BEGIN
 UPDATE f12_lab.assignments SET module_id='00000000-0000-4000-8000-000000000010' WHERE id='40000000-0000-4000-8000-000000000001';
 RAISE EXCEPTION 'historical assignment overwritten';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='historical assignment overwritten' THEN RAISE; END IF; END;
 BEGIN
 UPDATE f12_lab.read_grants SET revoked_at=NULL WHERE id='50000000-0000-4000-8000-000000000001';
 RAISE EXCEPTION 'grant un-revoked';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='grant un-revoked' THEN RAISE; END IF; END;
 IF NOT EXISTS (SELECT 1 FROM f12_lab.grant_history
   WHERE grant_id='50000000-0000-4000-8000-000000000001' AND event_kind='revoked'
   AND actor_ref='synthetic://revoker/steward' AND decision_ref='synthetic://decision/revoke-a')
 THEN RAISE EXCEPTION 'revocation lacks distinct actor and decision'; END IF;
 RAISE NOTICE 'PASS concrete F1/F2 SQL lab: N:N, methods, contextual RLS, invalid front, no writer, revoked/expired, admin, history';
END $$;

-- F4: exercise the AC-01 association independently of context-card counts.
BEGIN;
INSERT INTO f12_core.ac01_reference_fixture
 (id,lineage_id,version_no,module_id,workstream_id,specialist_role,contribution_kind,source_kind,source_locator,authority_state,recorded_by_auth_uid)
 VALUES ('71000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001',1,
 '636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533',
 'Especialista Núcleo 2.0','mapa','github','synthetic://ac01/mapa','proposta','30000000-0000-4000-8000-000000000001');
INSERT INTO f12_lab.ac01_specialty_links(source_ref,contribution_id,assignment_id,declared_role,linked_by_auth_uid)
 VALUES ('synthetic://source/nuc','71000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001','Especialista Núcleo 2.0','30000000-0000-4000-8000-000000000099');
DO $f4$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM f12_lab.ac01_specialty_links l JOIN f12_core.ac01_reference_fixture c ON c.id=l.contribution_id
 WHERE c.authority_state='proposta' AND c.version_no=1 AND c.recorded_by_auth_uid='30000000-0000-4000-8000-000000000001'
 AND l.linked_by_auth_uid='30000000-0000-4000-8000-000000000099') THEN RAISE EXCEPTION 'F4 original provenance lost'; END IF;
 BEGIN
 INSERT INTO f12_lab.ac01_specialty_links(source_ref,contribution_id,assignment_id,declared_role,linked_by_auth_uid)
 VALUES ('synthetic://source/crm','71000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','Especialista Núcleo 2.0','30000000-0000-4000-8000-000000000099');
 RAISE EXCEPTION 'F4 wrong module accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'F4_AC01_LINK_CONTEXT_OR_REVIEW_MISMATCH' THEN RAISE; END IF; END;
 BEGIN
 INSERT INTO f12_lab.ac01_specialty_links(source_ref,contribution_id,assignment_id,declared_role,linked_by_auth_uid)
 VALUES ('synthetic://source/sec','71000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','Especialista Núcleo 2.0','30000000-0000-4000-8000-000000000002');
 RAISE EXCEPTION 'F4 unreviewed link accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'F4_AC01_LINK_CONTEXT_OR_REVIEW_MISMATCH' THEN RAISE; END IF; END;
 BEGIN
 UPDATE f12_lab.ac01_specialty_links SET declared_role='other' WHERE source_ref='synthetic://source/nuc';
 RAISE EXCEPTION 'F4 mutable association';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'approved source metadata is immutable' THEN RAISE; END IF; END;
 IF has_table_privilege('authenticated','f12_lab.ac01_specialty_links','INSERT') OR
 has_table_privilege('authenticated','f12_lab.ac01_specialty_links','SELECT') OR
 has_table_privilege('authenticated','f12_core.ac01_reference_fixture','SELECT') THEN RAISE EXCEPTION 'F4 raw access leaked'; END IF;
 RAISE NOTICE 'PASS F4 association: existing AC01 identity, original author and state, cross-module and unauthorized reviewer denied, immutable and private';
END $f4$;
ROLLBACK;
