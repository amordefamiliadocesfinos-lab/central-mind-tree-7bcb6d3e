-- Supplier Center V1 — foundation only.
-- Extends the existing canonical Contacts / Products / Purchases model.
-- This migration intentionally does NOT backfill contacts, create canonical products,
-- create purchase orders, change product costs, create financial entries, or move stock.

-- ---------------------------------------------------------------------------
-- 1. Procurement profile: 1:1 extension of the canonical contact.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.supplier_procurement_profiles (
  supplier_contact_id uuid PRIMARY KEY
    REFERENCES public.contacts(id) ON DELETE CASCADE,
  lifecycle_status text NOT NULL DEFAULT 'prospectado',
  source text NULL,
  last_contact_at timestamptz NULL,
  next_action_at timestamptz NULL,
  next_action_text text NULL,
  general_min_order_amount numeric NULL,
  freight_terms text NULL,
  discard_reason text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_procurement_profiles_status_check
    CHECK (lifecycle_status IN (
      'prospectado',
      'em_contato',
      'em_avaliacao',
      'qualificado',
      'operacional',
      'standby',
      'descartado'
    )),
  CONSTRAINT supplier_procurement_profiles_min_order_check
    CHECK (general_min_order_amount IS NULL OR general_min_order_amount >= 0)
);

CREATE INDEX IF NOT EXISTS supplier_procurement_profiles_status_idx
  ON public.supplier_procurement_profiles(lifecycle_status);

CREATE INDEX IF NOT EXISTS supplier_procurement_profiles_next_action_idx
  ON public.supplier_procurement_profiles(next_action_at)
  WHERE next_action_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Supply groups: purchasing/comparison need, NOT a physical product identity.
-- Examples: Leite Condensado, Chocolate Branco, Glucose de Milho.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.supply_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  comparison_unit text NULL,
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supply_groups_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT supply_groups_comparison_unit_not_blank
    CHECK (comparison_unit IS NULL OR btrim(comparison_unit) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS supply_groups_name_uq
  ON public.supply_groups(lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.supply_group_product_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_group_id uuid NOT NULL
    REFERENCES public.supply_groups(id) ON DELETE CASCADE,
  product_id uuid NOT NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid NULL
    REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS supply_group_product_links_identity_uq
  ON public.supply_group_product_links(
    supply_group_id,
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS supply_group_product_links_product_idx
  ON public.supply_group_product_links(
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

DROP TRIGGER IF EXISTS trg_supply_group_product_link_identity
  ON public.supply_group_product_links;
CREATE TRIGGER trg_supply_group_product_link_identity
  BEFORE INSERT OR UPDATE OF product_id, variant_id
  ON public.supply_group_product_links
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_operational_physical_identity();

-- ---------------------------------------------------------------------------
-- 3. Supplier documents before a Purchase exists.
-- Uses the existing private order-documents storage bucket, with suppliers/<id>/...
-- metadata paths. Purchase documents remain in purchase_documents.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_contact_id uuid NOT NULL
    REFERENCES public.contacts(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'other',
  file_name text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  storage_bucket text NOT NULL DEFAULT 'order-documents',
  storage_path text NOT NULL,
  mime_type text NULL,
  file_size bigint NULL,
  document_date date NULL,
  valid_until date NULL,
  extraction_status text NOT NULL DEFAULT 'not_processed',
  extracted_data jsonb NULL,
  supersedes_document_id uuid NULL
    REFERENCES public.supplier_documents(id) ON DELETE SET NULL,
  notes text NULL,
  uploaded_by uuid NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_documents_type_check
    CHECK (document_type IN (
      'catalog',
      'price_list',
      'quote',
      'technical_sheet',
      'commercial_policy',
      'image',
      'other'
    )),
  CONSTRAINT supplier_documents_extraction_status_check
    CHECK (extraction_status IN (
      'not_processed',
      'parsed',
      'review_required',
      'confirmed',
      'failed'
    )),
  CONSTRAINT supplier_documents_file_name_not_blank
    CHECK (btrim(file_name) <> ''),
  CONSTRAINT supplier_documents_storage_bucket_not_blank
    CHECK (btrim(storage_bucket) <> ''),
  CONSTRAINT supplier_documents_storage_path_not_blank
    CHECK (btrim(storage_path) <> ''),
  CONSTRAINT supplier_documents_file_size_check
    CHECK (file_size IS NULL OR file_size >= 0),
  CONSTRAINT supplier_documents_storage_path_uq
    UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS supplier_documents_supplier_idx
  ON public.supplier_documents(supplier_contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS supplier_documents_type_idx
  ON public.supplier_documents(supplier_contact_id, document_type);

CREATE INDEX IF NOT EXISTS supplier_documents_extraction_idx
  ON public.supplier_documents(extraction_status)
  WHERE extraction_status <> 'confirmed';

-- ---------------------------------------------------------------------------
-- 4. Supplier catalog items: pre-canonical opportunities.
-- They do NOT create Products or Purchase Presentations automatically.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.supplier_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_contact_id uuid NOT NULL
    REFERENCES public.contacts(id) ON DELETE CASCADE,
  supplier_document_id uuid NULL
    REFERENCES public.supplier_documents(id) ON DELETE SET NULL,
  supply_group_id uuid NULL
    REFERENCES public.supply_groups(id) ON DELETE SET NULL,
  supplier_code text NULL,
  original_description text NOT NULL,
  normalized_name text NULL,
  brand text NULL,
  presentation_label text NULL,
  purchase_unit_label text NULL,
  declared_content_qty numeric NULL,
  declared_content_unit text NULL,
  status text NOT NULL DEFAULT 'nao_revisado',
  product_id uuid NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid NULL
    REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  purchase_presentation_id uuid NULL
    REFERENCES public.purchase_presentations(id) ON DELETE SET NULL,
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_catalog_items_description_not_blank
    CHECK (btrim(original_description) <> ''),
  CONSTRAINT supplier_catalog_items_status_check
    CHECK (status IN (
      'nao_revisado',
      'oportunidade',
      'relacionado',
      'standby',
      'descartado'
    )),
  CONSTRAINT supplier_catalog_items_content_qty_check
    CHECK (declared_content_qty IS NULL OR declared_content_qty > 0),
  CONSTRAINT supplier_catalog_items_canonical_link_check
    CHECK (
      product_id IS NOT NULL
      OR (variant_id IS NULL AND purchase_presentation_id IS NULL)
    ),
  CONSTRAINT supplier_catalog_items_related_status_check
    CHECK (status <> 'relacionado' OR product_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS supplier_catalog_items_supplier_status_idx
  ON public.supplier_catalog_items(supplier_contact_id, status);

CREATE INDEX IF NOT EXISTS supplier_catalog_items_group_idx
  ON public.supplier_catalog_items(supply_group_id)
  WHERE supply_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS supplier_catalog_items_document_idx
  ON public.supplier_catalog_items(supplier_document_id)
  WHERE supplier_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS supplier_catalog_items_product_idx
  ON public.supplier_catalog_items(
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE product_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Integrity helpers.
-- Procurement profile/document/catalog rows may only point to supplier contacts.
-- Catalog canonical links must preserve the Product/Variant/Presentation identity.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_procurement_supplier_contact(
  p_supplier_contact_id uuid,
  p_context text
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_type text;
BEGIN
  SELECT type
    INTO v_type
  FROM public.contacts
  WHERE id = p_supplier_contact_id;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'Contato de fornecedor não encontrado para %.', p_context;
  END IF;

  IF v_type NOT IN ('fornecedor', 'ambos') THEN
    RAISE EXCEPTION 'Contato precisa ser fornecedor ou ambos em %.', p_context;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_supplier_procurement_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_procurement_supplier_contact(
    NEW.supplier_contact_id,
    'supplier_procurement_profiles'
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_supplier_procurement_profile
  ON public.supplier_procurement_profiles;
CREATE TRIGGER trg_validate_supplier_procurement_profile
  BEFORE INSERT OR UPDATE OF supplier_contact_id
  ON public.supplier_procurement_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_supplier_procurement_profile();

CREATE OR REPLACE FUNCTION public.validate_supplier_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_previous_supplier uuid;
BEGIN
  PERFORM public.assert_procurement_supplier_contact(
    NEW.supplier_contact_id,
    'supplier_documents'
  );

  IF NEW.supersedes_document_id IS NOT NULL THEN
    SELECT supplier_contact_id
      INTO v_previous_supplier
    FROM public.supplier_documents
    WHERE id = NEW.supersedes_document_id;

    IF v_previous_supplier IS NULL THEN
      RAISE EXCEPTION 'Documento anterior não encontrado em supplier_documents.';
    END IF;

    IF v_previous_supplier <> NEW.supplier_contact_id THEN
      RAISE EXCEPTION 'Documento substituído precisa pertencer ao mesmo fornecedor.';
    END IF;

    IF NEW.supersedes_document_id = NEW.id THEN
      RAISE EXCEPTION 'Documento não pode substituir a si próprio.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_supplier_document
  ON public.supplier_documents;
CREATE TRIGGER trg_validate_supplier_document
  BEFORE INSERT OR UPDATE OF supplier_contact_id, supersedes_document_id
  ON public.supplier_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_supplier_document();

CREATE OR REPLACE FUNCTION public.validate_supplier_catalog_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_document_supplier uuid;
  v_presentation_product uuid;
  v_presentation_variant uuid;
BEGIN
  PERFORM public.assert_procurement_supplier_contact(
    NEW.supplier_contact_id,
    'supplier_catalog_items'
  );

  IF NEW.supplier_document_id IS NOT NULL THEN
    SELECT supplier_contact_id
      INTO v_document_supplier
    FROM public.supplier_documents
    WHERE id = NEW.supplier_document_id;

    IF v_document_supplier IS NULL THEN
      RAISE EXCEPTION 'Documento de origem não encontrado em supplier_documents.';
    END IF;

    IF v_document_supplier <> NEW.supplier_contact_id THEN
      RAISE EXCEPTION 'Item de catálogo e documento precisam pertencer ao mesmo fornecedor.';
    END IF;
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    PERFORM public.assert_physical_identity(
      NEW.product_id,
      NEW.variant_id,
      'supplier_catalog_items'
    );
  END IF;

  IF NEW.purchase_presentation_id IS NOT NULL THEN
    SELECT product_id, variant_id
      INTO v_presentation_product, v_presentation_variant
    FROM public.purchase_presentations
    WHERE id = NEW.purchase_presentation_id;

    IF v_presentation_product IS NULL THEN
      RAISE EXCEPTION 'Apresentação de compra não encontrada para supplier_catalog_items.';
    END IF;

    IF NEW.product_id IS NULL
       OR v_presentation_product <> NEW.product_id
       OR v_presentation_variant IS DISTINCT FROM NEW.variant_id THEN
      RAISE EXCEPTION 'Apresentação de compra não corresponde ao Produto/Variante relacionado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_supplier_catalog_item
  ON public.supplier_catalog_items;
CREATE TRIGGER trg_validate_supplier_catalog_item
  BEFORE INSERT OR UPDATE OF
    supplier_contact_id,
    supplier_document_id,
    product_id,
    variant_id,
    purchase_presentation_id
  ON public.supplier_catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_supplier_catalog_item();

-- ---------------------------------------------------------------------------
-- 6. updated_at.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_supplier_procurement_profiles_updated_at
  ON public.supplier_procurement_profiles;
CREATE TRIGGER trg_supplier_procurement_profiles_updated_at
  BEFORE UPDATE ON public.supplier_procurement_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_supply_groups_updated_at
  ON public.supply_groups;
CREATE TRIGGER trg_supply_groups_updated_at
  BEFORE UPDATE ON public.supply_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_supply_group_product_links_updated_at
  ON public.supply_group_product_links;
CREATE TRIGGER trg_supply_group_product_links_updated_at
  BEFORE UPDATE ON public.supply_group_product_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_supplier_documents_updated_at
  ON public.supplier_documents;
CREATE TRIGGER trg_supplier_documents_updated_at
  BEFORE UPDATE ON public.supplier_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_supplier_catalog_items_updated_at
  ON public.supplier_catalog_items;
CREATE TRIGGER trg_supplier_catalog_items_updated_at
  BEFORE UPDATE ON public.supplier_catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 7. RLS: same internal authenticated-user model already used by purchase docs.
-- No anonymous access.
-- ---------------------------------------------------------------------------

ALTER TABLE public.supplier_procurement_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_group_product_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users manage supplier procurement profiles"
  ON public.supplier_procurement_profiles;
CREATE POLICY "Authenticated users manage supplier procurement profiles"
  ON public.supplier_procurement_profiles
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage supply groups"
  ON public.supply_groups;
CREATE POLICY "Authenticated users manage supply groups"
  ON public.supply_groups
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage supply group product links"
  ON public.supply_group_product_links;
CREATE POLICY "Authenticated users manage supply group product links"
  ON public.supply_group_product_links
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage supplier documents"
  ON public.supplier_documents;
CREATE POLICY "Authenticated users manage supplier documents"
  ON public.supplier_documents
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage supplier catalog items"
  ON public.supplier_catalog_items;
CREATE POLICY "Authenticated users manage supplier catalog items"
  ON public.supplier_catalog_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON FUNCTION public.assert_procurement_supplier_contact(uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_procurement_supplier_contact(uuid,text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Documentation.
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.supplier_procurement_profiles IS
  'Procurement-only 1:1 extension of contacts. Does not replace the canonical contact or CRM funnel.';

COMMENT ON TABLE public.supply_groups IS
  'Purchasing comparison needs such as Leite Condensado or Chocolate Branco. Not a physical product identity and not automatic technical substitutability.';

COMMENT ON TABLE public.supply_group_product_links IS
  'Links canonical Product/Variant identities to a purchasing comparison group.';

COMMENT ON TABLE public.supplier_documents IS
  'Supplier/prospect documents that may exist before any purchase_order. Original file metadata and extraction state are preserved.';

COMMENT ON TABLE public.supplier_catalog_items IS
  'Pre-canonical supplier catalog opportunities. Receiving/importing a catalog item never creates a Product or Purchase automatically.';

COMMENT ON COLUMN public.supplier_catalog_items.product_id IS
  'Optional canonical Product link, created only after explicit operational relevance is confirmed.';

COMMENT ON COLUMN public.supplier_catalog_items.purchase_presentation_id IS
  'Optional existing operational purchase presentation; prospecting does not create presentations automatically.';
