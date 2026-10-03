-- F05 — Previsão de Ruptura / Prazo / Lead Time
-- Política canônica por identidade física + fornecedor.

CREATE TABLE IF NOT EXISTS public.purchase_replenishment_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  supplier_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  lead_time_days integer NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
  safety_days integer NOT NULL DEFAULT 0 CHECK (safety_days >= 0),
  is_preferred boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_replenishment_policies_identity_supplier_uq
ON public.purchase_replenishment_policies (
  product_id,
  COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  supplier_contact_id
);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_replenishment_policies_one_preferred_uq
ON public.purchase_replenishment_policies (
  product_id,
  COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE is_preferred = true AND is_active = true;

CREATE INDEX IF NOT EXISTS purchase_replenishment_policies_supplier_idx
ON public.purchase_replenishment_policies(supplier_contact_id);

DROP TRIGGER IF EXISTS trg_purchase_replenishment_policy_identity ON public.purchase_replenishment_policies;
CREATE TRIGGER trg_purchase_replenishment_policy_identity
BEFORE INSERT OR UPDATE OF product_id, variant_id
ON public.purchase_replenishment_policies
FOR EACH ROW EXECUTE FUNCTION public.assert_operational_physical_identity();

ALTER TABLE public.purchase_replenishment_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read replenishment policies" ON public.purchase_replenishment_policies;
CREATE POLICY "Authenticated read replenishment policies"
ON public.purchase_replenishment_policies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role manages replenishment policies" ON public.purchase_replenishment_policies;
CREATE POLICY "Service role manages replenishment policies"
ON public.purchase_replenishment_policies FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.upsert_purchase_replenishment_policy(
  p_product_id uuid,
  p_variant_id uuid,
  p_supplier_contact_id uuid,
  p_lead_time_days integer,
  p_safety_days integer,
  p_is_preferred boolean DEFAULT true,
  p_is_active boolean DEFAULT true,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_role text;
BEGIN
  SELECT au.role INTO v_role
  FROM public.app_users au
  WHERE au.auth_user_id = auth.uid()
    AND au.is_active = true
  LIMIT 1;

  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND COALESCE(v_role, '') NOT IN ('Administrador', 'LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'Apenas Administrador ou LIDER PRODUÇÃO pode configurar prazos de reposição.' USING ERRCODE = '42501';
  END IF;

  IF p_lead_time_days IS NULL OR p_lead_time_days < 0 OR p_safety_days IS NULL OR p_safety_days < 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_days');
  END IF;

  PERFORM public.assert_physical_identity(p_product_id, p_variant_id, 'purchase_replenishment_policies');

  IF NOT EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = p_supplier_contact_id
      AND c.is_active = true
      AND c.type IN ('fornecedor', 'ambos')
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_supplier');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_product_id::text || ':' || COALESCE(p_variant_id::text, 'simple'), 0
  ));

  IF COALESCE(p_is_preferred, false) AND COALESCE(p_is_active, true) THEN
    UPDATE public.purchase_replenishment_policies
    SET is_preferred = false, updated_at = now()
    WHERE product_id = p_product_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
      AND is_preferred = true
      AND is_active = true
      AND supplier_contact_id <> p_supplier_contact_id;
  END IF;

  SELECT id INTO v_id
  FROM public.purchase_replenishment_policies
  WHERE product_id = p_product_id
    AND variant_id IS NOT DISTINCT FROM p_variant_id
    AND supplier_contact_id = p_supplier_contact_id
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    INSERT INTO public.purchase_replenishment_policies (
      product_id, variant_id, supplier_contact_id,
      lead_time_days, safety_days, is_preferred, is_active, notes
    ) VALUES (
      p_product_id, p_variant_id, p_supplier_contact_id,
      p_lead_time_days, p_safety_days,
      COALESCE(p_is_preferred, true), COALESCE(p_is_active, true), NULLIF(trim(p_notes), '')
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.purchase_replenishment_policies
    SET lead_time_days = p_lead_time_days,
        safety_days = p_safety_days,
        is_preferred = COALESCE(p_is_preferred, is_preferred),
        is_active = COALESCE(p_is_active, is_active),
        notes = NULLIF(trim(p_notes), ''),
        updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'policy_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_purchase_replenishment_policy(uuid,uuid,uuid,integer,integer,boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_purchase_replenishment_policy(uuid,uuid,uuid,integer,integer,boolean,boolean,text) TO authenticated, service_role;
