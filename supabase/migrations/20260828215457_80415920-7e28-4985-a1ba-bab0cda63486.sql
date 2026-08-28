ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS commercial_opt_out boolean NOT NULL DEFAULT false;