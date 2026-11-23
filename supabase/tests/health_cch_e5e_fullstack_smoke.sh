#!/usr/bin/env bash
set -euo pipefail
# Do not pass any real Supabase credentials to this job.
test -z "${SUPABASE_ACCESS_TOKEN:-}"
test -z "${SUPABASE_DB_URL:-}"
test -z "${SUPABASE_PROJECT_REF:-}"
test -z "${SUPABASE_SERVICE_ROLE_KEY:-}"
WORKSPACE="$(mktemp -d /tmp/cch-e5e-fullstack-XXXXXXXX)"
export E5_STACK_WORKSPACE="$WORKSPACE"
trap 'cd "$WORKSPACE" && supabase stop --no-backup >/dev/null 2>&1 || true; rm -rf "$WORKSPACE"' EXIT
cd "$WORKSPACE"
supabase --version
supabase init --yes >/dev/null
# The only project identifier is local and synthetic.
sed -i 's/^project_id = .*/project_id = "cch-e5e-isolated-lab"/' supabase/config.toml
# Strictly local Docker startup; no remote project is linked or configured.
supabase start >/tmp/cch-e5e-stack-start.log 2>&1 || {
  tail -n 90 /tmp/cch-e5e-stack-start.log | sed -E 's/(service_role|anon_key|secret|jwt)[^ ]*/[REDACTED]/Ig';
  exit 1;
}
# Do not output supabase status credentials or generated secrets.
supabase status -o env > "$WORKSPACE/status.private"
chmod 600 "$WORKSPACE/status.private"
python3 - <<'PY'
import os
from pathlib import Path
from urllib.request import Request, urlopen
values={}
for line in Path(os.environ["E5_STACK_WORKSPACE"]+"/status.private").read_text().splitlines():
    if "=" in line:
        k,v=line.split("=",1)
        values[k]=v.strip().strip('"')
url=values.get("API_URL")
assert url and url.startswith("http://127.0.0.1:"), "Expected loopback-only API URL"
for endpoint in ["/auth/v1/health", "/rest/v1/", "/storage/v1/status"]:
    try:
        with urlopen(Request(url+endpoint), timeout=10) as response:
            code=response.status
    except Exception as exc:
        code=getattr(exc,"code",0)
    assert code in (200, 401, 403, 404), f"Endpoint {endpoint} unavailable: {code}"
    print(f"E5_FULLSTACK_SERVICE {endpoint} HTTP={code}")
print("CCH_E5E_FULLSTACK_SMOKE_PASS")
PY

# Full HTTP contract uses real local Auth JWTs and actual PostgREST RLS.
python3 "$GITHUB_WORKSPACE/supabase/tests/health_cch_e5e_fullstack_http.py"
