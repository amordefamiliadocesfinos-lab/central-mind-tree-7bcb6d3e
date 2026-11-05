-- OPERACOES 9 / P2: UNAPPLIED CANDIDATE. NOT AN ACTIVE MIGRATION.
-- Append-only attestation binds one physical opening to authenticated actor,
-- exact family, location, count and one atomic original-container conversion.
-- Does NOT prove that a physical fact happened independently: operator attests.
-- Must be reviewed against LIVE role model and authorization before deployment.
CREATE TABLE public.p2_four_open_attestations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text NOT NULL UNIQUE CHECK(length(btrim(event_key)) BETWEEN 1 AND 180),
 family text NOT NULL CHECK(family IN ('italac','sorbato','acido','ivoti')),
 opening_action text NOT NULL CHECK(opening_action IN
    ('open_original_box','open_intact_unit','open_original_package','open_original_bucket')),
 container_count integer NOT NULL CHECK(container_count BETWEEN 1 AND 10000),
 storage_location_id uuid NOT NULL REFERENCES public.storage_locations(id),
 attested_by uuid NOT NULL,
 attested_at timestamptz NOT NULL DEFAULT now(),
 physical_confirmation boolean NOT NULL CHECK(physical_confirmation),
 evidence_note text NOT NULL CHECK(length(btrim(evidence_note)) BETWEEN 15 AND 1200),
 source_event_key text NOT NULL UNIQUE,
 result jsonb NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT p2_attestation_exact_action CHECK (
   (family='italac' AND opening_action IN ('open_original_box','open_intact_unit'))
   OR (family IN ('sorbato','acido') AND opening_action='open_original_package')
   OR (family='ivoti' AND opening_action='open_original_bucket')
 )
);
ALTER TABLE public.p2_four_open_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY p2_open_attestations_read ON public.p2_four_open_attestations
 FOR SELECT TO authenticated USING (attested_by=(SELECT auth.uid()));
REVOKE ALL ON public.p2_four_open_attestations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.p2_four_open_attestations TO authenticated;

CREATE OR REPLACE FUNCTION public.p2_four_attest_and_open(
 p_family text,p_action text,p_count integer,p_location_id uuid,
 p_event_key text,p_physical_confirmation boolean,p_evidence_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $p2$
DECLARE
 v_actor uuid;
 v_id uuid;
 v_role text;
 v_result jsonb;
 v_key text;
BEGIN
 v_actor:=auth.uid();
 v_role:=public.current_app_user_role();
 IF v_actor IS NULL OR COALESCE(v_role,'') NOT IN ('Administrador','LIDER PRODUÇÃO')
 THEN RAISE EXCEPTION 'p2_physical_open_role_required'; END IF;
 IF p_physical_confirmation IS DISTINCT FROM TRUE
 THEN RAISE EXCEPTION 'p2_physical_confirmation_required'; END IF;
 IF p_count IS NULL OR p_count<1 OR p_count>10000 OR p_location_id IS NULL
 THEN RAISE EXCEPTION 'p2_invalid_open_count_or_location'; END IF;
 IF p_event_key IS NULL OR length(btrim(p_event_key)) NOT BETWEEN 1 AND 180
 THEN RAISE EXCEPTION 'p2_invalid_open_event_key'; END IF;
 IF p_evidence_note IS NULL OR length(btrim(p_evidence_note)) NOT BETWEEN 15 AND 1200
 THEN RAISE EXCEPTION 'p2_open_evidence_detail_required'; END IF;
 IF NOT (
   (p_family='italac' AND p_action IN ('open_original_box','open_intact_unit'))
   OR (p_family IN ('sorbato','acido') AND p_action='open_original_package')
   OR (p_family='ivoti' AND p_action='open_original_bucket')
 ) THEN RAISE EXCEPTION 'p2_open_family_action_mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.storage_locations WHERE id=p_location_id AND is_active)
 THEN RAISE EXCEPTION 'p2_invalid_or_inactive_location'; END IF;
 v_key:='p2:physical_open:'||p_event_key;
 IF length(v_key)>220 THEN RAISE EXCEPTION 'p2_invalid_open_event_key'; END IF;

 -- Explicitly fail on replay rather than silently crediting any grams again.
 IF EXISTS (SELECT 1 FROM public.p2_four_open_attestations WHERE event_key=p_event_key)
 THEN RAISE EXCEPTION 'p2_open_event_already_attested'; END IF;
 v_id:=gen_random_uuid();
 INSERT INTO public.p2_four_open_attestations(
  id,event_key,family,opening_action,container_count,storage_location_id,
  attested_by,physical_confirmation,evidence_note,source_event_key
 ) VALUES (
  v_id,p_event_key,p_family,p_action,p_count,p_location_id,
  v_actor,TRUE,p_evidence_note,v_key
 );
 -- If the sealed stock is missing or grams conversion fails, this inserted
 -- attestation is rolled back together with all stock and movement changes.
 v_result:=public.p2_four_apply_internal(
  p_family,p_action,p_count,p_location_id,v_key,
  'p2_open_attestation',v_id,'opening_attestation:'||v_id::text,NULL
 );
 UPDATE public.p2_four_open_attestations
 SET result=v_result WHERE id=v_id;
 RETURN jsonb_build_object('attestationId',v_id,'physicalStockResult',v_result);
END;
$p2$;
REVOKE ALL ON FUNCTION public.p2_four_attest_and_open(
 text,text,integer,uuid,text,boolean,text
) FROM PUBLIC,anon,authenticated,service_role;
-- Only authenticated operational users can call the authorized wrapper;
-- the wrapper checks auth.uid() and the canonical active app_users role.
GRANT EXECUTE ON FUNCTION public.p2_four_attest_and_open(
 text,text,integer,uuid,text,boolean,text
) TO authenticated;
