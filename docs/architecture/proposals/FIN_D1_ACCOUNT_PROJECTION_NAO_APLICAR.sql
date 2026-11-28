-- D1 private candidate only. Never apply to official Cloud.
BEGIN;
-- Baseline is the existing account balance, NOT initial balance plus historical movements.
-- This avoids losing transfers and manual adjustments not represented in movements.
CREATE VIEW fin_settlement_private.account_comparison WITH (security_invoker=true) AS
WITH deltas AS (
 SELECT m.account_id,
 sum(CASE e.type WHEN 'receber' THEN m.effective_cash-m.legacy_cash WHEN 'pagar' THEN m.legacy_cash-m.effective_cash ELSE NULL END) AS signed_delta,
 count(*) FILTER (WHERE e.type IS NULL OR e.type NOT IN ('pagar','receber') OR e.lifecycle_status IS DISTINCT FROM 'active') AS invalid_count
 FROM fin_settlement_private.movement_comparison m
 LEFT JOIN public.financial_entries e ON e.id=m.entry_id
 WHERE m.revision_count>0
 GROUP BY m.account_id
)
SELECT a.id account_id,a.current_balance legacy_balance,
 CASE WHEN coalesce(d.invalid_count,0)=0 THEN coalesce(d.signed_delta,0) ELSE NULL END signed_delta,
 CASE WHEN coalesce(d.invalid_count,0)=0 THEN a.current_balance+coalesce(d.signed_delta,0) ELSE NULL END projected_balance,
 coalesce(d.invalid_count,0) invalid_count
FROM public.financial_accounts a LEFT JOIN deltas d ON d.account_id=a.id;
-- Period projection distinguishes signed cash movement from principal and account balance.
CREATE VIEW fin_settlement_private.cash_period_comparison WITH (security_invoker=true) AS
SELECT m.movement_date,m.account_id,e.type direction,
 sum(m.legacy_cash) legacy_cash,sum(m.effective_cash) effective_cash,
 sum(m.effective_cash-m.legacy_cash) cash_delta,count(*) movement_count,
 count(*) FILTER (WHERE m.explicit_principal IS NULL) unmapped_principal_count,
 count(*) FILTER (WHERE e.id IS NULL OR e.type NOT IN ('pagar','receber') OR e.lifecycle_status IS DISTINCT FROM 'active' OR m.account_id IS NULL) invalid_count
FROM fin_settlement_private.movement_comparison m LEFT JOIN public.financial_entries e ON e.id=m.entry_id
GROUP BY m.movement_date,m.account_id,e.type;
REVOKE ALL ON fin_settlement_private.account_comparison,fin_settlement_private.cash_period_comparison FROM PUBLIC,anon,authenticated,service_role;
-- Shadow only: baseline drift, orphan revisions and cross-writer mutation remain activation gates.
COMMIT;
