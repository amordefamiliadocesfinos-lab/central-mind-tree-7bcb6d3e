-- Núcleo 2.0 V1.3 AC-01: trilha de análise/solicitação/consolidação/encaminhamento.
-- Não cria decisão competente, homologação, vigência ou reescreve originais.
-- Cada evento é imutável. Eventuais decisões normativas são fora desta tabela.
CREATE TABLE public.nucleo_ac01_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES public.nucleo_specialist_contributions(id) ON DELETE RESTRICT,
  module_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
  event_kind text NOT NULL CHECK (event_kind IN
    ('comentario','solicitar_refinamento','minuta_consolidacao','encaminhar_decisao')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 12 AND 6000),
  request_id uuid NOT NULL UNIQUE,
  actor_auth_uid uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nucleo_ac01_review_events_contribution_idx
  ON public.nucleo_ac01_review_events(contribution_id, recorded_at, id);

CREATE FUNCTION public.nucleo_ac01_review_before_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $ac01$
DECLARE expected_module uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AC-01 review: sessão autenticada obrigatória'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.app_admin_capabilities c
  WHERE c.auth_user_id=auth.uid() AND c.capability='nucleo_manage'
   AND c.active AND c.revoked_at IS NULL
 ) THEN RAISE EXCEPTION 'AC-01 review: autorização nucleo_manage obrigatória'; END IF;
 SELECT module_id INTO expected_module FROM public.nucleo_specialist_contributions
 WHERE id=NEW.contribution_id;
 IF NOT FOUND OR expected_module IS DISTINCT FROM NEW.module_id THEN
   RAISE EXCEPTION 'AC-01 review: referência de outro módulo ou não visível';
 END IF;
 NEW.actor_auth_uid := auth.uid();
 NEW.recorded_at := now();
 RETURN NEW;
END;
$ac01$;

CREATE TRIGGER nucleo_ac01_review_insert_guard BEFORE INSERT
ON public.nucleo_ac01_review_events FOR EACH ROW
EXECUTE FUNCTION public.nucleo_ac01_review_before_insert();

ALTER TABLE public.nucleo_ac01_review_events ENABLE ROW LEVEL SECURITY;
-- Restringir privilégios EFETIVOS inclusive os recebidos por default grants do Core.
REVOKE ALL ON public.nucleo_ac01_review_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.nucleo_ac01_review_events TO authenticated;
CREATE POLICY nucleo_ac01_review_select ON public.nucleo_ac01_review_events FOR SELECT TO authenticated
USING (
 EXISTS (SELECT 1 FROM public.app_admin_capabilities c
 WHERE c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
  AND c.active AND c.revoked_at IS NULL)
);
CREATE POLICY nucleo_ac01_review_insert ON public.nucleo_ac01_review_events FOR INSERT TO authenticated
WITH CHECK (
 EXISTS (SELECT 1 FROM public.app_admin_capabilities c
 WHERE c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
  AND c.active AND c.revoked_at IS NULL)
);
-- Não há política/GRANT UPDATE ou DELETE, nem função que os execute.
-- 'encaminhar_decisao' representa solicitação/encaminhamento, NÃO decisão tomada.
