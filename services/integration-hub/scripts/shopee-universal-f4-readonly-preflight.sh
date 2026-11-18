#!/usr/bin/env bash
# SHOPEE-OAUTH-MULTICONTAS F4 — READ-ONLY PREFLIGHT.
# Queries metadata ONLY. No secrets, tokens, deploy, merge, scheduler updates or writes to GCP.
set -Eeuo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
PROJECT="painel-central-integration-hub"
REGION="southamerica-east1"
SERVICE="integration-hub"
SCHEDULER="shopee-adao-intake-v1"
EXPECTED_PRODUCTION_REVISION="integration-hub-00167-hm8"
EXPECTED_ROLLBACK_REVISION="integration-hub-00166-tvl"
EXPECTED_CANDIDATE="integration-hub-oauth-celivio-73b264c9"

if ! command -v gcloud >/dev/null; then echo 'BLOCKED: gcloud unavailable'; exit 2; fi
active="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' 2>/dev/null || true)"
if [[ -z "$active" ]]; then echo 'BLOCKED: no active gcloud account'; exit 2; fi
echo "ACTIVE ACCOUNT: configured (address withheld)"
echo "PROJECT: $PROJECT / REGION: $REGION"
echo

echo '== CLOUD RUN SERVICE AND TRAFFIC (READ-ONLY) =='
if ! gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION"   --format='json(metadata.name,status.traffic,status.latestReadyRevisionName)'   | python3 -c '
import json,sys
x=json.load(sys.stdin)
print("service:",x.get("metadata",{}).get("name","unknown"))
print("latest_ready_revision:",x.get("status",{}).get("latestReadyRevisionName","unknown"))
for t in x.get("status",{}).get("traffic",[]):
 print("TRAFFIC:",t.get("revisionName", "(tag-only)"),str(t.get("percent",0))+"%", "tag="+str(t.get("tag","")))
'; then
  echo 'BLOCKED: Cloud Run service details unavailable'; exit 3
fi
echo
echo '== THREE TARGET REVISIONS (READ-ONLY) =='
for rev in "$EXPECTED_PRODUCTION_REVISION" "$EXPECTED_ROLLBACK_REVISION" "$EXPECTED_CANDIDATE"; do
  echo "revision: $rev"
  gcloud run revisions describe "$rev" --project="$PROJECT" --region="$REGION"     --format='json(metadata.name,status.conditions)'     | python3 -c '
import json,sys
x=json.load(sys.stdin)
print("exists:",bool(x.get("metadata",{}).get("name")))
for c in x.get("status",{}).get("conditions",[]):
 if c.get("type")=="Ready":print("ready:",c.get("status"),"reason:",c.get("reason",""))
' || echo 'NOT VERIFIED: revision missing or inaccessible'
done

echo
echo '== API GATEWAY METADATA (READ-ONLY) =='
# The list/describe operations prove which API config is attached, NOT which routes it contains.
if ! gcloud api-gateway gateways list --project="$PROJECT" --location="$REGION"   --format='table(name,apiConfig,defaultHostname)' 2>/dev/null; then
  echo 'NOT VERIFIED: Gateway list inaccessible or regional placement differs'
fi
echo 'Gateway route /shopee/live/oauth/universal/start remains UNVERIFIED until the published OpenAPI is inspected.'
echo 'Do not infer route exposure from a candidate revision or test result.'

echo
echo '== CLOUD SCHEDULER (READ-ONLY) =='
if ! gcloud scheduler jobs describe "$SCHEDULER" --project="$PROJECT" --location="$REGION"   --format='value(state)' 2>/dev/null; then
  echo 'NOT VERIFIED: Scheduler state inaccessible or job in different region'
fi

echo
echo '== GATES =='
echo 'NO CHANGES PERFORMED. Production baseline must be verified against current traffic before any future action.'
echo 'NO HOMOLOGATION: Gateway OpenAPI, flags, secrets, core migrations and real Shopee consent unverified.'
