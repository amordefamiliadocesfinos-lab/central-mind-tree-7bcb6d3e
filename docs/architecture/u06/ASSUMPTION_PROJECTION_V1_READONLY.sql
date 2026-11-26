-- U06-A/B V1.0: consulta experimental de engenharia, sem mutação.
-- Selecionar um único código dentre SAU, NUC, CRM. Não é prova de JWT/RLS funcional.
WITH RECURSIVE
requested(code) AS (VALUES ('SAU'::text)),
root AS (
 SELECT w.id,w.code,w.title,w.status,w.specialist,w.next_action,w.blocker,w.updated_at
 FROM nucleo_development_workstreams w JOIN requested r ON w.code=r.code
 WHERE w.kind='modulo' AND w.code IN ('SAU','NUC','CRM')
),
tree AS (
 SELECT w.id,w.code,w.parent_id,w.kind,w.title,w.status,w.next_action,w.blocker,w.evidence_state,w.updated_at,ARRAY[r.id,w.id] AS visited
 FROM nucleo_development_workstreams w JOIN root r ON w.parent_id=r.id
 WHERE w.kind<>'modulo' AND w.id<>r.id
 UNION ALL
 SELECT w.id,w.code,w.parent_id,w.kind,w.title,w.status,w.next_action,w.blocker,w.evidence_state,w.updated_at,t.visited||w.id
 FROM nucleo_development_workstreams w JOIN tree t ON w.parent_id=t.id
 WHERE w.kind<>'modulo' AND NOT w.id=ANY(t.visited)
),
fm_ranked AS (
 SELECT f.id,f.section_code,f.version_no,f.title,f.body,f.source_reference,f.authority_state,f.evidence_level,f.recorded_at,
 dense_rank() OVER (PARTITION BY f.module_id,f.section_code ORDER BY f.version_no DESC) AS revision_rank
 FROM nucleo_module_knowledge_revisions f JOIN root r ON r.id=f.module_id
 WHERE f.section_code IN ('FM-03','FM-08','FM-09','FM-10')
),
fm_latest AS (SELECT * FROM fm_ranked WHERE revision_rank=1),
fm_conflicts AS (
 SELECT section_code FROM fm_latest GROUP BY section_code HAVING count(*)<>1
),
ac01 AS (
 SELECT a.id,a.lineage_id,a.version_no,a.title,a.contribution_kind,a.specialist_role,a.authority_state,a.source_kind,
 CASE WHEN a.source_kind='github' THEN a.source_locator ELSE NULL END AS source_locator,
 a.recorded_at
 FROM nucleo_specialist_contributions a JOIN root r ON a.module_id=r.id
)
SELECT 'nucleo_u06_assumption_projection_v1' AS contract,
 'consulta_engenharia_conector_administrativo' AS access_mode,
 'consultivo_nao_homologado' AS authority,
 statement_timestamp() AS read_at,
 (SELECT count(*) FROM root) AS root_count,
 CASE WHEN (SELECT count(*) FROM root)=1 THEN (SELECT to_jsonb(r) FROM root r) ELSE NULL END AS module_record,
 CASE WHEN (SELECT count(*) FROM root)=1 AND NOT EXISTS(SELECT 1 FROM fm_conflicts)
 THEN (SELECT coalesce(jsonb_agg(to_jsonb(f)-'revision_rank' ORDER BY f.section_code),'[]'::jsonb) FROM fm_latest f)
 ELSE '[]'::jsonb END AS fm_sections,
 (SELECT coalesce(jsonb_agg(section_code ORDER BY section_code),'[]'::jsonb) FROM fm_conflicts) AS fm_conflicts,
 (SELECT coalesce(jsonb_agg(expected.code ORDER BY expected.code),'[]'::jsonb)
 FROM (VALUES ('FM-03'),('FM-08'),('FM-09'),('FM-10')) expected(code)
 WHERE NOT EXISTS(SELECT 1 FROM fm_latest f WHERE f.section_code=expected.code)) AS fm_missing,
 CASE WHEN (SELECT count(*) FROM root)=1 THEN (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.lineage_id,a.version_no),'[]'::jsonb) FROM ac01 a) ELSE '[]'::jsonb END AS ac01_revisions,
 CASE WHEN (SELECT count(*) FROM root)=1 THEN (SELECT coalesce(jsonb_agg(to_jsonb(t)-'visited' ORDER BY t.code),'[]'::jsonb) FROM tree t) ELSE '[]'::jsonb END AS fronts,
 'Conferir mapas e checkpoints nas fontes originais; next_action é o registro integral, não certificação de vigência. Não executar operações por esta projeção.' AS reconciliation_rule;
