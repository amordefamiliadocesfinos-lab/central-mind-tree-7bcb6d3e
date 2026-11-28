-- Export the actual disposable SQL projection, preserving decimal precision as text.
SELECT coalesce(json_agg(row_to_json(r) ORDER BY r.entry_id),'[]'::json)
FROM (SELECT entry_id, original_value::text, legacy_paid::text, explicit_principal::text,
 unmapped_movements::text, explicit_remaining_principal::text, effective_cash::text
 FROM fin_settlement_private.obligation_comparison) r;
