-- Núcleo 2.0 V1.3 AC-01 CA-23/24: registro de CONTRIBUIÇÕES POR REFERÊNCIA.
-- Extensão M1 do Núcleo existente; não constitui nova biblioteca, migração B,
-- upload privado, decisão soberana ou promoção de documento homologado.
-- Sem cópia de conteúdo: origem e checksum são metadados declarados.
CREATE TABLE IF NOT EXISTS public.nucleo_specialist_contributions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lineage_id uuid NOT NULL DEFAULT gen_random_uuid(),
 version_no integer NOT NULL DEFAULT 1 CHECK (version_no BETWEEN 1 AND 1000000),
 parent_revision_id uuid REFERENCES public.nucleo_specialist_contributions(id) ON DELETE RESTRICT,
 module_id uuid NOT NULL REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 workstream_id uuid REFERENCES public.nucleo_development_workstreams(id) ON DELETE RESTRICT,
 specialist_role text NOT NULL CHECK (char_length(btrim(specialist_role)) BETWEEN 3 AND 180),
 contribution_kind text NOT NULL CHECK (contribution_kind IN
   ('metodo','ecossistema','manual','procedimento','aprendizado','mapa','checkpoint','arquivo','outro')),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 180),
 source_kind text NOT NULL CHECK (source_kind IN ('google_drive','github','referencia_privada')),
 source_locator text NOT NULL CHECK (char_length(btrim(source_locator)) BETWEEN 8 AND 1500),
 source_reference_id uuid REFERENCES public.nucleo_source_references(id) ON DELETE RESTRICT,
 source_checksum_sha256 text CHECK (source_checksum_sha256 IS NULL OR source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
 note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
 authority_state text NOT NULL DEFAULT 'proposta' CHECK (authority_state IN ('proposta','em_evolucao')),
 request_id uuid NOT NULL UNIQUE,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 recorded_by_auth_uid uuid NOT NULL,
 UNIQUE (lineage_id,version_no)
);
CREATE INDEX IF NOT EXISTS nucleo_specialist_contributions_module_idx
 ON public.nucleo_specialist_contributions(module_id,recorded_at DESC);
CREATE INDEX IF NOT EXISTS nucleo_specialist_contributions_role_idx
 ON public.nucleo_specialist_contributions(module_id,specialist_role,recorded_at DESC);

-- Imutabilidade e parentesco são garantidos pelo banco, não só pelo formulário.
CREATE OR REPLACE FUNCTION public.nucleo_ac01_before_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent public.nucleo_specialist_contributions%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AC-01 requer sessão autenticada'; END IF;
 NEW.recorded_by_auth_uid := auth.uid();
 NEW.recorded_at := now();
 IF NOT EXISTS (SELECT 1 FROM public.nucleo_development_workstreams w
   WHERE w.id=NEW.module_id AND w.kind='modulo') THEN
   RAISE EXCEPTION 'AC-01 requer módulo M3 válido';
 END IF;
 IF NEW.workstream_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.nucleo_development_workstreams w
   LEFT JOIN public.nucleo_development_workstreams f ON f.id=w.parent_id
   WHERE w.id=NEW.workstream_id AND
    ((w.kind='frente' AND w.parent_id=NEW.module_id) OR
     (w.kind='subfrente' AND f.parent_id=NEW.module_id))
 ) THEN RAISE EXCEPTION 'AC-01 frente não pertence ao módulo'; END IF;
 IF NEW.source_reference_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.nucleo_source_references s
   WHERE s.id=NEW.source_reference_id
    AND s.provider=NEW.source_kind AND s.provider_file_id=NEW.source_locator
 ) THEN RAISE EXCEPTION 'AC-01 referência não coincide com metadados de origem'; END IF;
 IF NEW.parent_revision_id IS NULL THEN
   NEW.version_no:=1;
   NEW.authority_state:='proposta';
 ELSE
   SELECT * INTO parent FROM public.nucleo_specialist_contributions p
    WHERE p.id=NEW.parent_revision_id;
   IF NOT FOUND OR parent.module_id<>NEW.module_id OR
      parent.specialist_role<>NEW.specialist_role OR
      parent.contribution_kind<>NEW.contribution_kind THEN
      RAISE EXCEPTION 'AC-01 cadeia documental incompatível';
   END IF;
   NEW.lineage_id:=parent.lineage_id;
   NEW.version_no:=parent.version_no+1;
   NEW.authority_state:='em_evolucao';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER nucleo_ac01_insert_guard BEFORE INSERT
 ON public.nucleo_specialist_contributions FOR EACH ROW
 EXECUTE FUNCTION public.nucleo_ac01_before_insert();

ALTER TABLE public.nucleo_specialist_contributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nucleo_specialist_contributions FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.nucleo_specialist_contributions TO authenticated;
CREATE POLICY nucleo_ac01_read ON public.nucleo_specialist_contributions FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.app_admin_capabilities c WHERE
  c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
  AND c.active AND c.revoked_at IS NULL));
CREATE POLICY nucleo_ac01_insert ON public.nucleo_specialist_contributions FOR INSERT TO authenticated
 WITH CHECK (EXISTS (SELECT 1 FROM public.app_admin_capabilities c WHERE
  c.auth_user_id=(SELECT auth.uid()) AND c.capability='nucleo_manage'
  AND c.active AND c.revoked_at IS NULL));
-- Sem policies UPDATE/DELETE e sem grants para essas operações.
-- Homologação, revogação ou atualização de referência vigente exigem
-- outro ato competente, contrato e testes específicos posteriores.
