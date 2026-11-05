#!/usr/bin/env bash
# Ephemeral PostgreSQL 17 CI ONLY, uses synthetic disposable fixture.
set -euo pipefail
test "${PGDATABASE:-}" = p2_disposable
test "$(psql -X -v ON_ERROR_STOP=1 -Atqc 'SELECT current_database()')" = p2_disposable
psql -X -v ON_ERROR_STOP=1 -Atqc "SELECT CASE WHEN to_regclass('public.p2_disposable_test_marker') IS NULL THEN 'BLOCK' ELSE 'ALLOW' END" | grep -F ALLOW >/dev/null
LOC='b1ef7322-86f9-4cf4-9d52-39ba32911ef6'
BUY='c9d1d89d-366a-42c0-b691-f56bad36af7f'
SALE='684d4a55-5d3a-4c18-be47-818a1a3bc074'
PRODUCT='6f43ad65-74d5-4db9-b931-1ecd6d124987'
EVENT="p2-ci-receipt-${GITHUB_RUN_ID:-local}"
# A single original package is present; two competing dispatches each request one.
psql -X -v ON_ERROR_STOP=1 -Atqc "SELECT public.p2_four_apply_internal('sorbato','receipt',1,'$LOC','$EVENT','purchase_receipt',gen_random_uuid(),'CI SYNTHETIC RECEIPT','$BUY');" >/dev/null
p1="p2-ci-dispatch-a-${GITHUB_RUN_ID:-local}"
p2="p2-ci-dispatch-b-${GITHUB_RUN_ID:-local}"
set +e
psql -X -v ON_ERROR_STOP=1 -Atqc "SELECT public.p2_four_apply_internal('sorbato','dispatch_original_package',1,'$LOC','$p1','order_stock_event',gen_random_uuid(),'CI SYNTHETIC DISPATCH A','$SALE');" >/tmp/p2-a.log 2>&1 &
pid1=$!
psql -X -v ON_ERROR_STOP=1 -Atqc "SELECT public.p2_four_apply_internal('sorbato','dispatch_original_package',1,'$LOC','$p2','order_stock_event',gen_random_uuid(),'CI SYNTHETIC DISPATCH B','$SALE');" >/tmp/p2-b.log 2>&1 &
pid2=$!
wait "$pid1"; s1=$?
wait "$pid2"; s2=$?
set -e
if ! { [ "$s1" = 0 ] && [ "$s2" != 0 ]; } && ! { [ "$s1" != 0 ] && [ "$s2" = 0 ]; }; then
 echo "Expected exactly one successful dispatch; results $s1/$s2"
 cat /tmp/p2-a.log /tmp/p2-b.log
 exit 1
fi
if [ "$s1" != 0 ]; then grep -F 'p2_insufficient_original_state' /tmp/p2-a.log >/dev/null; fi
if [ "$s2" != 0 ]; then grep -F 'p2_insufficient_original_state' /tmp/p2-b.log >/dev/null; fi
test "$(psql -X -v ON_ERROR_STOP=1 -Atqc "SELECT units FROM public.p2_four_sealed_stock WHERE product_id='$PRODUCT' AND storage_location_id='$LOC' AND physical_state='originalPackages1kg'")" = 0
test "$(psql -X -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM public.p2_four_sealed_events WHERE product_id='$PRODUCT' AND operation='dispatch'")" = 1
test "$(psql -X -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM public.inventory_movements")" = 0
echo 'P2_CONCURRENT_DISPATCH_ONE_SUCCESS_ONE_BLOCKED'
