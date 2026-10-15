-- Apresentacao comercial canonica: forma de venda pertence ao Produto Mestre.
-- Variante fisica somente e exigida para apresentacao simples.
ALTER TABLE public.commercial_presentations
 ADD COLUMN IF NOT EXISTS composition_mode text NOT NULL DEFAULT 'single';
ALTER TABLE public.commercial_presentations
 ADD CONSTRAINT commercial_presentation_mode_check CHECK (composition_mode IN ('single','composite'));
CREATE TABLE IF NOT EXISTS public.commercial_presentation_components (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 presentation_id uuid NOT NULL REFERENCES public.commercial_presentations(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES public.products(id),
 variant_id uuid NOT NULL REFERENCES public.product_variants(id),
 quantity numeric NOT NULL CHECK (quantity>0),
 UNIQUE(presentation_id,product_id,variant_id)
);
ALTER TABLE public.commercial_presentation_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY commercial_presentation_components_read ON public.commercial_presentation_components FOR SELECT TO authenticated USING(true);
CREATE OR REPLACE FUNCTION public.assert_commercial_presentation_physical_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_mode text;
BEGIN
 SELECT variation_mode INTO v_mode FROM public.products WHERE id=NEW.product_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Produto nao encontrado.'; END IF;
 IF NEW.composition_mode='composite' THEN
   IF NEW.variant_id IS NOT NULL THEN RAISE EXCEPTION 'Apresentacao composta pertence ao Produto Mestre, nao a variante.'; END IF;
 ELSE
   IF v_mode='variacoes_fisicas' AND NEW.variant_id IS NULL THEN RAISE EXCEPTION 'Apresentacao simples exige variante fisica.'; END IF;
   IF v_mode<>'variacoes_fisicas' AND NEW.variant_id IS NOT NULL THEN RAISE EXCEPTION 'Produto simples nao aceita variante.'; END IF;
 END IF;
 IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM public.product_variants v WHERE v.id=NEW.variant_id AND v.product_id=NEW.product_id
 ) THEN RAISE EXCEPTION 'Variante nao pertence ao produto.'; END IF;
 RETURN NEW;
END $$;
-- Converter cadastro legado de mistos: retirar a variante ficticia de ancoragem.
UPDATE public.commercial_presentations SET composition_mode='composite',variant_id=NULL
WHERE product_id='62cf9f63-be04-4261-ad11-569028dd1125'
AND name IN ('Bandeja 18 — 9BRANCO + 9PRETO','Bandeja 18 — 6BRANCO + 12PRETO');
INSERT INTO public.commercial_presentation_components(presentation_id,product_id,variant_id,quantity)
SELECT cp.id,cp.product_id,v.variant_id,v.qty FROM public.commercial_presentations cp
CROSS JOIN LATERAL (
 VALUES
 ('d89e1dba-ca80-4136-b9f3-225fb80b6dfb'::uuid,
 CASE WHEN cp.name='Bandeja 18 — 9BRANCO + 9PRETO' THEN 9::numeric ELSE 6::numeric END),
 ('e4d756c8-f324-4ac0-b9ff-6adae24f5310'::uuid,
 CASE WHEN cp.name='Bandeja 18 — 9BRANCO + 9PRETO' THEN 9::numeric ELSE 12::numeric END)
) v(variant_id,qty)
WHERE cp.product_id='62cf9f63-be04-4261-ad11-569028dd1125'
AND cp.composition_mode='composite'
AND cp.name IN ('Bandeja 18 — 9BRANCO + 9PRETO','Bandeja 18 — 6BRANCO + 12PRETO')
ON CONFLICT(presentation_id,product_id,variant_id) DO UPDATE SET quantity=EXCLUDED.quantity;
