-- Marca comercial persistente: não é derivada do funil e não reclassifica históricos.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS commercial_opt_out boolean NOT NULL DEFAULT false;
