#!/usr/bin/env bash
# F12.3: two independent PostgreSQL sessions with ROLLBACK on both.
# A directly authorized connection URL must be set locally, never shared in chat.
set -euo pipefail
umask 077

if [[ "$#" -ne 1 || "$1" != "--two-session-rollback" ]]; then
  echo "Usage: F12_PG_CONNECTION_URI=<private> bash $0 --two-session-rollback"
  exit 2
fi
if [[ -z "${F12_PG_CONNECTION_URI:-}" ]]; then
  echo '{"ok":false,"code":"postgres_connection_not_configured"}'
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo '{"ok":false,"code":"psql_not_installed"}'
  exit 2
fi
work="$(mktemp -d)"
first_pid=''
cleanup() {
  if [[ -n "$first_pid" ]]; then
    wait "$first_pid" >/dev/null 2>&1 || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT INT TERM

count="$(psql "$F12_PG_CONNECTION_URI" -X -qAt -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM public.shopee_adao_f12_discovery_state" | tr -d '[:space:]')" || {
  echo '{"ok":false,"code":"preflight_unavailable"}'
  exit 1
}
if [[ "$count" != "0" ]]; then
  echo '{"ok":false,"code":"existing_checkpoint_no_test"}'
  exit 1
fi

cat > "$work/first.sql" <<'SQL'
\set VERBOSITY verbose
BEGIN;
SET LOCAL request.jwt.claims='{"role":"service_role"}';
SELECT CASE WHEN (
  public.acquire_shopee_adao_f12_discovery('b4027369-5abf-4ac1-ab24-862334fae892'::uuid)->>'status'
)='acquired' THEN 'PRIMARY_ACQUIRED' ELSE 'PRIMARY_FAILED' END;
SELECT pg_sleep(8);
ROLLBACK;
SQL

cat > "$work/second.sql" <<'SQL'
\set VERBOSITY verbose
BEGIN;
SET LOCAL request.jwt.claims='{"role":"service_role"}';
SET LOCAL lock_timeout='1100ms';
SELECT public.acquire_shopee_adao_f12_discovery(
  'b4027369-5abf-4ac1-ab24-862334fae892'::uuid
)->>'status';
ROLLBACK;
SQL

psql "$F12_PG_CONNECTION_URI" -X -qAt -v ON_ERROR_STOP=1 \
  -f "$work/first.sql" > "$work/first.log" 2>&1 &
first_pid=$!

ready=0
for _ in {1..40}; do
  if grep -q '^PRIMARY_ACQUIRED$' "$work/first.log"; then ready=1; break; fi
  if grep -q 'PRIMARY_FAILED\|ERROR:' "$work/first.log"; then break; fi
  if ! kill -0 "$first_pid" 2>/dev/null; then break; fi
  sleep .1
done
if [[ "$ready" != "1" ]]; then
  echo '{"ok":false,"code":"primary_did_not_acquire"}'
  exit 1
fi

# A second live connection cannot acquire the uncommitted primary lease.
set +e
psql "$F12_PG_CONNECTION_URI" -X -qAt -v ON_ERROR_STOP=1 \
  -f "$work/second.sql" > "$work/second.log" 2>&1
secondary_exit=$?
set -e
if [[ "$secondary_exit" -eq 0 ]] || ! grep -q '55P03' "$work/second.log"; then
  echo '{"ok":false,"code":"concurrent_fence_not_proven"}'
  exit 1
fi

wait "$first_pid" || {
  first_pid=''
  echo '{"ok":false,"code":"primary_rollback_failed"}'
  exit 1
}
first_pid=''
if grep -q 'ERROR:\|PRIMARY_FAILED' "$work/first.log"; then
  echo '{"ok":false,"code":"primary_unexpected_error"}'
  exit 1
fi
remaining="$(psql "$F12_PG_CONNECTION_URI" -X -qAt -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM public.shopee_adao_f12_discovery_state" | tr -d '[:space:]')" || {
  echo '{"ok":false,"code":"postflight_unavailable"}'
  exit 1
}
if [[ "$remaining" != "0" ]]; then
  echo '{"ok":false,"code":"unexpected_persistent_checkpoint"}'
  exit 1
fi
echo '{"ok":true,"code":"f12_two_backend_row_lock_verified","primary":"rollback","secondary":"55P03_lock_timeout","remaining_checkpoints":0}'
