-- D1 candidate, NOT A DEPLOYABLE MIGRATION. Do not run on the official Cloud.
-- Additive private schema; no historical backfill, no active writer, no grants to API roles.
BEGIN;
CREATE SCHEMA fin_settlement_private;
REVOKE ALL ON SCHEMA fin_settlement_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE fin_settlement_private.settlements (
 request_id uuid PRIMARY KEY,
 movement_id uuid NOT NULL UNIQUE REFERENCES public.financial_movements(id) ON DELETE RESTRICT,
 entry_id uuid NOT NULL REFERENCES public.financial_entries(id) ON DELETE RESTRICT,
 account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
 direction text NOT NULL CHECK(direction IN ('pagar','receber')),
 principal numeric(20,2) NOT NULL CHECK(principal>0),
 interest numeric(20,2) NOT NULL CHECK(interest>=0),
 penalty numeric(20,2) NOT NULL CHECK(penalty>=0),
 discount numeric(20,2) NOT NULL CHECK(discount>=0),
 fee numeric(20,2) NOT NULL CHECK(fee>=0),
 marketplace_fee numeric(20,2) NOT NULL CHECK(marketplace_fee>=0),
 cash numeric(20,2) NOT NULL CHECK(cash>0),
 movement_date date NOT NULL,
 actor_id uuid NOT NULL,
 reason text NOT NULL CHECK(btrim(reason)<>''),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(discount<=principal+interest+penalty),
 CHECK(direction<>'pagar' OR marketplace_fee=0),
 CHECK(cash=principal+interest+penalty-discount+CASE WHEN direction='pagar' THEN fee ELSE -fee-marketplace_fee END)
);
CREATE TABLE fin_settlement_private.rectifications (
 request_id uuid PRIMARY KEY,
 movement_id uuid NOT NULL REFERENCES public.financial_movements(id) ON DELETE RESTRICT,
 previous_value numeric NOT NULL CHECK(previous_value>0),
 corrected_value numeric NOT NULL CHECK(corrected_value>0 AND corrected_value=round(corrected_value,2)),
 effective_date date NOT NULL,
 actor_id uuid NOT NULL,
 reason text NOT NULL CHECK(btrim(reason)<>''),
 evidence_ref text NOT NULL CHECK(btrim(evidence_ref)<>''),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(previous_value<>corrected_value)
);
CREATE INDEX ON fin_settlement_private.rectifications(movement_id);
ALTER TABLE fin_settlement_private.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_settlement_private.rectifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA fin_settlement_private FROM PUBLIC, anon, authenticated, service_role;
-- Private comparison projections: legacy movements are NOT presumed to prove principal.
CREATE VIEW fin_settlement_private.movement_comparison WITH (security_invoker=true) AS
 SELECT m.id movement_id,m.entry_id,m.account_id,m.movement_date,m.value legacy_cash,
 s.principal explicit_principal,
 m.value+coalesce(r.delta,0) effective_cash,
 s.request_id settlement_request_id,
 coalesce(r.revision_count,0) revision_count
 FROM public.financial_movements m
 LEFT JOIN fin_settlement_private.settlements s ON s.movement_id=m.id
 LEFT JOIN LATERAL (SELECT sum(corrected_value-previous_value) delta,count(*) revision_count
 FROM fin_settlement_private.rectifications WHERE movement_id=m.id) r ON true;
CREATE VIEW fin_settlement_private.obligation_comparison WITH (security_invoker=true) AS
 SELECT e.id entry_id,e.value original_value,e.value_paid legacy_paid,
 coalesce(sum(m.explicit_principal),0) explicit_principal,
 count(m.movement_id) FILTER (WHERE m.explicit_principal IS NULL) unmapped_movements,
 CASE WHEN count(m.movement_id) FILTER (WHERE m.explicit_principal IS NULL)=0 THEN e.value-coalesce(sum(m.explicit_principal),0) ELSE NULL END explicit_remaining_principal,
 coalesce(sum(m.effective_cash),0) effective_cash
 FROM public.financial_entries e LEFT JOIN fin_settlement_private.movement_comparison m ON m.entry_id=e.id GROUP BY e.id,e.value,e.value_paid;
REVOKE ALL ON ALL TABLES IN SCHEMA fin_settlement_private FROM PUBLIC, anon, authenticated, service_role;
-- No insert/update/delete API, triggers on legacy tables, or public views.
-- Activation requires atomic writer, exact decimal input validation (typmod rounds),
-- cross-row consistency, protected reconciliation, authority, immutable audit, consumer compatibility.
COMMIT;
