-- Shared disposable Raw fixture extensions only; NOT migration DDL.
ALTER TABLE public.marketplace_raw_snapshots ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ADD COLUMN payload_hash text, ADD COLUMN observed_at timestamptz, ADD COLUMN created_at timestamptz DEFAULT now();
CREATE UNIQUE INDEX d11_fixture_raw_idempotency ON public.marketplace_raw_snapshots
 (source,environment,channel_account_id,external_entity_type,external_entity_id,endpoint,payload_hash);
