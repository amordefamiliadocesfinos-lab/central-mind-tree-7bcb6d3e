-- Two mixed commercial tray options for ALFAJOR ARTESANAL 60G DOCE DE LEITE.
-- A mixed presentation uses the Branco variant solely as a selection anchor, as required by catalog identity guards; CRM splits to both physical variants.
INSERT INTO public.commercial_presentations
(product_id, variant_id, name, commercial_unit_label, conversion_factor, is_active, notes)
SELECT '62cf9f63-be04-4261-ad11-569028dd1125'::uuid, 'd89e1dba-ca80-4136-b9f3-225fb80b6dfb'::uuid, v.name,
       'bandeja', 18, true,
       'Composição comercial fixa: ' || v.mix || '. CRM desdobra em variantes físicas na venda.'
FROM (VALUES
 ('Bandeja 18 — 9BRANCO + 9PRETO', '9 Chocolate Branco + 9 Chocolate Meio Amargo'),
 ('Bandeja 18 — 6BRANCO + 12PRETO', '6 Chocolate Branco + 12 Chocolate Meio Amargo')
) AS v(name,mix)
WHERE NOT EXISTS (
 SELECT 1 FROM public.commercial_presentations cp
 WHERE cp.product_id='62cf9f63-be04-4261-ad11-569028dd1125'::uuid
 AND cp.variant_id='d89e1dba-ca80-4136-b9f3-225fb80b6dfb'::uuid AND cp.name=v.name
);
