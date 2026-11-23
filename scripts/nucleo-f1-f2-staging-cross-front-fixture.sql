-- STAGING ONLY: second consultive card in SAME module+specialty but a
-- DIFFERENT front. Tests cross-front authorization rather than mere 404.
\set ON_ERROR_STOP on
INSERT INTO f12_lab.approved_card_sources
 (source_ref,specialty_id,module_id,front_id,public_label,origin_kind,verified,private_payload_included,authorization_ref)
 VALUES('synthetic://source/other-front','10000000-0000-4000-8000-000000000001',
 '636768e6-e782-4c7d-8132-e7381621be12','00000000-0000-4000-8000-000000000020',
 'synthetic different front','github_reference',true,false,'synthetic://approval/other-front');
INSERT INTO f12_lab.context_cards VALUES
 ('60000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000001',
 '636768e6-e782-4c7d-8132-e7381621be12','00000000-0000-4000-8000-000000000020',
 'checkpoint','synthetic different front','synthetic://source/other-front');
