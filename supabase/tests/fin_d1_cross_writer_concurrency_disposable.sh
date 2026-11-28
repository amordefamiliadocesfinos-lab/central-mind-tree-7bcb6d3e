#!/usr/bin/env bash
# D1 candidate only, after the existing disposable fixtures.
set -euo pipefail
[[ "${PGDATABASE:-}" == fin_d1_disposable ]] || exit 1
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
psqlx() { psql -X -v ON_ERROR_STOP=1 "$@"; }
run_pair() {
 local label=$1 first=$2 second=$3 expected=$4
 # Hold A's transaction until B is observed waiting on a real PostgreSQL lock.
 # A waits on an advisory lock held by a separate gate session.
 local gate=928312
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

psqlx -c "DROP TRIGGER fixture_fail ON fin_settlement_private.settlements;"
eid=00000000-0000-0000-0000-000000000002
aid=00000000-0000-0000-0000-000000000004
actor=00000000-0000-0000-0000-000000000088
mid=$(psqlx -Atc "select id from public.financial_movements where entry_id='$eid'")
[[ "$mid" =~ ^[0-9a-f-]{36}$ ]]
settle() { printf "SELECT fin_settlement_private.record_settlement('%s','%s','%s',%s,0,0,0,0,0,'2026-11-27','%s','cross fixture');" "$1" "$eid" "$aid" "$2" "$actor"; }
rectify() { printf "SELECT fin_settlement_private.record_rectification('%s','%s',%s,%s,'2026-11-27','%s','cross fixture','synthetic');" "$1" "$mid" "$2" "$3" "$actor"; }
k1=00000000-0000-0000-0000-000000000091
k2=00000000-0000-0000-0000-000000000092
k3=00000000-0000-0000-0000-000000000093
k4=00000000-0000-0000-0000-000000000094
k5=00000000-0000-0000-0000-000000000095
k6=00000000-0000-0000-0000-000000000096
run_pair shared_key "$(settle "$k1" 20)" "$(rectify "$k1" 92 93)" 'request collision'
run_pair same_entry "$(rectify "$k2" 92 94)" "$(settle "$k3" 30)" success
run_pair stale_revision "$(rectify "$k4" 94 95)" "$(rectify "$k5" 94 96)" 'stale effective value'
run_pair reverse_key "$(rectify "$k6" 95 96)" "$(settle "$k6" 10)" 'request collision'
psqlx <<'SQL'
DO $$
DECLARE r record;
BEGIN
 SELECT * INTO STRICT r FROM fin_settlement_private.obligation_comparison WHERE entry_id='00000000-0000-0000-0000-000000000002';
 IF r.explicit_principal<>150 OR r.explicit_remaining_principal<>50 OR r.legacy_paid<>140 OR r.effective_cash<>146 THEN RAISE EXCEPTION 'cross obligation mismatch: %',row_to_json(r); END IF;
 IF (SELECT count(*) FROM public.financial_movements WHERE entry_id=r.entry_id)<>3 THEN RAISE EXCEPTION 'movement count mismatch'; END IF;
 SELECT * INTO STRICT r FROM fin_settlement_private.account_comparison WHERE account_id='00000000-0000-0000-0000-000000000004';
 IF r.legacy_balance<>330 OR r.signed_delta<>11 OR r.projected_balance<>341 THEN RAISE EXCEPTION 'cross account mismatch: %',row_to_json(r); END IF;
 RAISE NOTICE 'PASS D1 cross-writer final state';
END $$;
SQL
