-- IA-07.1 — memória interpretativa do contato.
-- Esta tabela não é fonte de verdade para fatos operacionais do CRM.
CREATE TABLE public.crm_contact_live_context (
  contact_id uuid PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  summary text NULL,
  memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_event_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1)
);

ALTER TABLE public.crm_contact_live_context ENABLE ROW LEVEL SECURITY;

-- Mantém o padrão permissivo já aplicado às demais tabelas operacionais do CRM.
CREATE POLICY "Allow all on crm_contact_live_context"
  ON public.crm_contact_live_context
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_crm_contact_live_context_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_crm_contact_live_context_updated_at
  BEFORE UPDATE ON public.crm_contact_live_context
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_contact_live_context_updated_at();
