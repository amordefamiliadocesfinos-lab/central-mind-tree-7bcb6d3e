-- Fitas adesivas: apresentação de compra 1 rolo físico = 1 un no estoque.
-- Sem reclassificação de estoque nem alterações de produtos históricos.
INSERT INTO public.purchase_presentations
 (product_id,variant_id,name,purchase_unit_label,stock_unit_label,conversion_factor,is_approximate,is_active,notes)
SELECT p.id,NULL,'Rolo unitário','rolo','un',1,false,true,
       'Recebimento em rolos físicos individuais: 1 rolo = 1 unidade de estoque'
FROM public.products p
WHERE p.id IN ('0278fc5e-59db-4d73-860b-13c91ae78b53',
               'f58c1c71-bcd6-4105-b642-59bd989783e8')
AND p.is_active IS TRUE AND p.deleted_at IS NULL AND p.unit='un'
AND NOT EXISTS (SELECT 1 FROM public.purchase_presentations pp
  WHERE pp.product_id=p.id AND pp.variant_id IS NULL AND pp.is_active
    AND pp.purchase_unit_label='rolo' AND pp.conversion_factor=1);
