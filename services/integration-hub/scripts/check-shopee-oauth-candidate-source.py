#!/usr/bin/env python3
"""F4-CAND: fail-closed static preflight for a candidate *source checkout*.

No network, no cloud access, no deployment, no modifications. This is a source
inventory and gating test, NOT proof of runtime environment or production.
"""
from pathlib import Path
import argparse
import re
import sys

REQUIRED = [
    "services/integration-hub/src/shopee-oauth-universal-start.mjs",
    "services/integration-hub/src/shopee-live-oauth.mjs",
    "services/integration-hub/src/shopee-oauth-refresh-for-account.mjs",
    "supabase/functions/shopee-oauth-connect-eligibility/index.ts",
    "supabase/functions/integration-core-bridge/index.ts",
    "supabase/functions/integration-core-bridge/handler.mjs",
    "supabase/migrations/20261118150000_shopee_oauth_account_grants_f3a.sql",
    "supabase/migrations/20261118153000_shopee_oauth_handoff_f3b.sql",
    "supabase/migrations/20261118160000_shopee_universal_oauth_state_binding_f3c.sql",
    "supabase/migrations/20261118170000_shopee_oauth_multicontas_refresh_cas_f3d.sql",
    "services/integration-hub/scripts/prepare-universal-gateway-route.py",
    "docs/operations/SHOPEE_OAUTH_MULTICONTAS_F4_GW_MINI_MAPA_FECHAMENTO_2026-11-18.md",
]
def check(root):
    errors=[]
    contents={}
    for rel in REQUIRED:
        path=root/rel
        if not path.is_file():
            errors.append("required source missing: "+rel)
            continue
        contents[rel]=path.read_text(encoding="utf-8")
    start=contents.get("services/integration-hub/src/shopee-oauth-universal-start.mjs","")
    callback=contents.get("services/integration-hub/src/shopee-live-oauth.mjs","")
    elig=contents.get("supabase/functions/shopee-oauth-connect-eligibility/index.ts","")
    app=(root/"services/integration-hub/src/app.mjs").read_text(encoding="utf-8") if (root/"services/integration-hub/src/app.mjs").is_file() else ""
    checks={
        "start gated exactly by true": "getEnv('SHOPEE_OAUTH_UNIVERSAL_START_ENABLED') !== 'true'" in start,
        "callback gated exactly by true": "getEnv('SHOPEE_OAUTH_UNIVERSAL_CALLBACK_ENABLED') !== 'true'" in callback,
        "universal start is explicit": "'/shopee/live/oauth/universal/start'" in start,
        "signed handoff ticket": "ticket_hash" in start and "consumeHandoff" in start,
        "canonical state to callback": "resolveUniversalState" in callback and "isUniversal" in callback,
        "eligibility checks server JWT": "core.auth.getUser" in elig,
        "eligibility uses account grant": "shopee_oauth_account_grants" in elig,
        "router dispatches universal first": app.find("handleUniversalShopeeStart(request)") >= 0 and app.find("handleUniversalShopeeStart(request)") < app.find("handleShopeeLive(request)"),
        "refresh has approved context": "readLiveShopeeOauthRefreshContext" in contents.get("services/integration-hub/src/shopee-oauth-refresh-for-account.mjs",""),
        "refresh enforces CAS": "expected_refresh_token_ciphertext" in contents.get("services/integration-hub/src/shopee-oauth-refresh-for-account.mjs",""),
        "SQL refresh has approval table": "shopee_oauth_shop_authorizations" in contents.get("supabase/migrations/20261118170000_shopee_oauth_multicontas_refresh_cas_f3d.sql",""),
    }
    for name,passed in checks.items():
        if not passed:
            errors.append("check failed: "+name)
    return errors,checks

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo",type=Path,default=Path(__file__).resolve().parents[3])
    args=parser.parse_args()
    errors,checks=check(args.repo.resolve())
    print("SOURCE CHECKS:",len(checks),"passed:",sum(checks.values()))
    print("REQUIRED FILES:",len(REQUIRED))
    if errors:
        for error in errors: print("BLOCKED:",error)
        return 1
    print("PASS: candidate code source inventory and default-off route checks")
    print("UNVERIFIED: live Gateway, active Cloud Run revision, secrets, Core migrations, grants, OAuth consent")
    print("NO CHANGES: source-only check")
    return 0

if __name__=="__main__":
    sys.exit(main())
