-- Shared D11 schema candidate for disposable CI only; NOT a production migration.
CREATE TABLE public.shopee_cycle_policy_revisions (
  channel_account_id uuid NOT NULL REFERENCES public.channel_accounts(id),
  revision integer NOT NULL CHECK(revision > 0),
  environment text NOT NULL CHECK(environment = 'live'),
  shop_id bigint NOT NULL CHECK(shop_id > 0),
  partner_id bigint NOT NULL CHECK(partner_id = 2047685),
  enabled boolean NOT NULL DEFAULT false,
  paused boolean NOT NULL DEFAULT true,
  capabilities jsonb NOT NULL DEFAULT '{"discover":false,"intake":false,"ship":false,"label":false,"refresh":false}'::jsonb,
  page_size integer NOT NULL DEFAULT 5 CHECK(page_size BETWEEN 1 AND 5),
  max_actions_per_cycle integer NOT NULL DEFAULT 1 CHECK(max_actions_per_cycle BETWEEN 1 AND 3),
  work_budget_ms integer NOT NULL DEFAULT 48000 CHECK(work_budget_ms BETWEEN 1 AND 48000),
  history_cutoff bigint NOT NULL CHECK(history_cutoff > 0),
  fiscal_mode text,
  shipping_mode text,
  document_type text,
  authorized_by uuid,
  authorized_at timestamptz,
  expires_at timestamptz,
  evidence_ref text,
  shipping_evidence_ref text,
  PRIMARY KEY(channel_account_id,revision),
  CHECK (jsonb_typeof(capabilities)='object'
    AND capabilities ?& ARRAY['discover','intake','ship','label','refresh']
    AND capabilities - ARRAY['discover','intake','ship','label','refresh'] = '{}'::jsonb
    AND jsonb_typeof(capabilities->'discover')='boolean'
    AND jsonb_typeof(capabilities->'intake')='boolean'
    AND jsonb_typeof(capabilities->'ship')='boolean'
    AND jsonb_typeof(capabilities->'label')='boolean'
    AND jsonb_typeof(capabilities->'refresh')='boolean'),
  CHECK ((capabilities->'intake')<>'true'::jsonb OR (capabilities->'discover')='true'::jsonb),
  CHECK ((capabilities->'ship')<>'true'::jsonb OR (capabilities->'intake')='true'::jsonb),
  CHECK ((capabilities->'label')<>'true'::jsonb OR (capabilities->'intake')='true'::jsonb),
  CHECK ((capabilities->'refresh')<>'true'::jsonb OR (capabilities->'discover')='true'::jsonb),
  CHECK (NOT enabled OR (authorized_by IS NOT NULL AND authorized_at IS NOT NULL
    AND expires_at IS NOT NULL AND expires_at>authorized_at
    AND evidence_ref IS NOT NULL AND length(btrim(evidence_ref)) BETWEEN 1 AND 300)),
  CHECK ((capabilities->'ship')<>'true'::jsonb OR (fiscal_mode IS NOT NULL
    AND fiscal_mode IN ('cpf_no_invoice_step','pj_shopee_issuer')
    AND shipping_mode IS NOT NULL AND shipping_mode='simple_dropoff'
    AND shipping_evidence_ref IS NOT NULL AND length(btrim(shipping_evidence_ref)) BETWEEN 1 AND 300)),
  CHECK ((capabilities->'label')<>'true'::jsonb OR
    (document_type IS NOT NULL AND document_type='NORMAL_AIR_WAYBILL'))
);

ALTER TABLE public.shopee_cycle_policy_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopee_cycle_policy_revisions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.shopee_cycle_policy_revisions TO service_role;

