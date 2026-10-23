-- Operações lote: apresentações de compra unitárias, sem alteração do estoque.
-- Esses três produtos já possuem unidade física "un" e não têm apresentação de compra.
INSERT INTO public.purchase_presentations
(product_id,variant_id,name,purchase_unit_label,stock_unit_label,conversion_factor,is_approximate,is_active,notes)
SELECT p.id,NULL,'Unidade','unidade','un',1,false,true,
  'Compra por unidade física, sem conversão; mesmo produto existente'
FROM public.products p
WHERE p.id IN (
 'b4b3640d-f0e2-4266-9322-a846536e6219',
 'e4f0486b-a92e-412a-b38a-acf606967af9',
 '1bf18fc4-3287-4b90-91a8-77dfed74fecf'
)
AND p.deleted_at IS NULL AND p.unit='un'
AND NOT EXISTS(
 SELECT 1 FROM public.purchase_presentations pp
 WHERE pp.product_id=p.id AND pp.variant_id IS NULL
   AND pp.conversion_factor=1 AND pp.purchase_unit_label='unidade'
);
