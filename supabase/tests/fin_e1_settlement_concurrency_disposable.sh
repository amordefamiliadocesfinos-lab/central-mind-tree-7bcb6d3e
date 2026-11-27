#!/usr/bin/env bash
# Only on a fresh, disposable PostgreSQL service.
set -euo pipefail
[[ "${PGDATABASE:-}" == fin_e1_disposable ]] || { echo 'Disposable database required'; exit 1; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
psqlx() { psql -X -v ON_ERROR_STOP=1 "$@"; }
# Reuse the exact previously validated fixture, stopping before its test data.
awk '/^INSERT INTO obligation\(id,direction,original,reconciled\)/{found=1;exit} {print} END{if(!found)exit 1}' supabase/tests/fin_e1_settlement_transaction_disposable.sql > "$tmp/setup.sql"
echo 'COMMIT;' >> "$tmp/setup.sql"
psqlx -f "$tmp/setup.sql"
psqlx -c "INSERT INTO fin_e1_fixture.obligation(id,direction,original) VALUES (1,'receber',10000),(2,'pagar',10000),(3,'receber',10000),(4,'receber',10000); INSERT INTO fin_e1_fixture.account VALUES(1,100000);"
run_pair() {
 local label=$1 first=$2 second=$3 expected=$4
 # Hold A's transaction until B is observed waiting on a real PostgreSQL lock.
 # A waits on an advisory lock held by a separate gate session.
 local gate=928311
 local gate_ready="$tmp/gate-$label"
 local fifo="$tmp/fifo-$label"
 mkfifo "$fifo"
 (
   { printf "SELECT pg_advisory_lock(%s);\n" "$gate"; printf '\\! touch %s\n' "$gate_ready"; cat "$fifo"; } | PGAPPNAME="fin_gate_$label" psqlx -q
 ) >"$tmp/gate-$label.log" 2>&1 &
 local gp=$!
 for i in {1..100}; do [[ -f "$gate_ready" ]] && break; sleep .1; done
 [[ -f "$gate_ready" ]] || { kill "$gp" || true; return 1; }
 exec 9>"$fifo"
 PGAPPNAME="fin_a_$label" psqlx -q -c "BEGIN; $first; SELECT pg_advisory_xact_lock($gate); COMMIT;" >"$tmp/a-$label.log" 2>&1 &
 local ap=$!
 local seen=0
 for i in {1..100}; do
   if [[ $(psqlx -Atc "select count(*) from pg_stat_activity where application_name='fin_a_$label' and wait_event_type='Lock'") == 1 ]]; then seen=1; break; fi
   sleep .1
 done
 if [[ $seen != 1 ]]; then printf 'SELECT pg_advisory_unlock(%s);\n' "$gate" >&9; exec 9>&-; wait "$ap" || true; wait "$gp" || true; return 1; fi
 PGAPPNAME="fin_b_$label" psqlx -q -c "$second" >"$tmp/b-$label.log" 2>&1 &
 local bp=$!
 seen=0
 for i in {1..100}; do
   if [[ $(psqlx -Atc "select count(*) from pg_stat_activity where application_name='fin_b_$label' and wait_event_type='Lock'") == 1 ]]; then seen=1; break; fi
   sleep .1
 done
 printf 'SELECT pg_advisory_unlock(%s);\n' "$gate" >&9
 exec 9>&-
 wait "$gp"
 wait "$ap"
 local rc=0
 wait "$bp" || rc=$?
 cat "$tmp/a-$label.log" "$tmp/b-$label.log"
 [[ $seen == 1 ]] || { echo "No concurrent lock observed: $label"; return 1; }
 if [[ "$expected" == success ]]; then [[ $rc == 0 ]]; else [[ $rc != 0 ]] && grep -Fq "$expected" "$tmp/b-$label.log"; fi
 echo "PASS $label: observed concurrent lock and expected result"
}
call() { printf "SELECT fin_e1_fixture.settle('%s',%s,1,%s,0,0,0,0,0,'2026-11-27','concurrency');" "$1" "$2" "$3"; }
run_pair principal "$(call 00000000-0000-0000-0000-000000000001 1 7000)" "$(call 00000000-0000-0000-0000-000000000002 1 7000)" 'invalid components'
run_pair replay "$(call 00000000-0000-0000-0000-000000000003 2 4000)" "$(call 00000000-0000-0000-0000-000000000003 2 4000)" success
run_pair collision "$(call 00000000-0000-0000-0000-000000000004 3 2000)" "$(call 00000000-0000-0000-0000-000000000004 3 3000)" 'request collision'
run_pair account "$(call 00000000-0000-0000-0000-000000000005 3 1000)" "$(call 00000000-0000-0000-0000-000000000006 4 5000)" success
psqlx <<'SQL'
DO $$
BEGIN
 IF (SELECT count(*) FROM fin_e1_fixture.settlement)<>5 OR (SELECT count(*) FROM fin_e1_fixture.movement)<>5 OR (SELECT balance FROM fin_e1_fixture.account WHERE id=1)<>111000 OR (SELECT array_agg(principal_paid ORDER BY id) FROM fin_e1_fixture.obligation)<>ARRAY[7000,4000,3000,5000]::bigint[] THEN RAISE EXCEPTION 'Concurrent final state mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM fin_e1_fixture.obligation o WHERE o.cash_paid<>(SELECT coalesce(sum(s.cash),0) FROM fin_e1_fixture.settlement s WHERE s.obligation_id=o.id)) THEN RAISE EXCEPTION 'Cash mismatch'; END IF;
 RAISE NOTICE 'PASS concurrent final state';
END $$;
DROP SCHEMA fin_e1_fixture CASCADE;
SQL
