-- Preserve IDs, snapshots, variants and conversion factors; improve displayed identity only.
DO $$
DECLARE v_product uuid := 'f56418bc-9e5b-4291-971d-df2d70e1cba9';
BEGIN
 IF (SELECT COUNT(*) FROM public.commercial_presentations WHERE product_id=v_product AND name='Pacote 1 kg') <> 12 THEN
   RAISE EXCEPTION 'Expected twelve generic 1 kg presentations; inspect before renaming';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.commercial_presentations cp
   JOIN public.product_variants pv ON pv.id=cp.variant_id
   WHERE cp.product_id=v_product AND cp.name='Pacote 1 kg'
     AND (cp.composition_mode<>'single' OR cp.conversion_factor<>1000 OR pv.unit<>'g' OR NOT pv.is_active)
 ) THEN RAISE EXCEPTION 'Physical identity or conversion mismatch'; END IF;
 UPDATE public.commercial_presentations cp
 SET name='1KG|' || CASE pv.variant_name
   WHEN 'Doce de Leite' THEN 'D.LEITE'
   ELSE upper(pv.variant_name)
 END
 FROM public.product_variants pv
 WHERE cp.variant_id=pv.id AND cp.product_id=v_product AND cp.name='Pacote 1 kg';
END $$;
