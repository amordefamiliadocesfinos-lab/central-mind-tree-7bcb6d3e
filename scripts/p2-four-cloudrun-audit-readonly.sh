#!/usr/bin/env bash
# Operacoes 9 / P2: read-only inspection of the exact Cloud Run runtime.
# Requires an already authenticated gcloud principal with Run Viewer.
# Does not deploy, change IAM, print secrets, or call write routes.
set -euo pipefail
PROJECT="${PROJECT:?Set PROJECT to the existing Google Cloud project ID}"
REGION="${REGION:-southamerica-east1}"
SERVICE="${SERVICE:-integration-hub}"
command -v gcloud >/dev/null || { echo "gcloud not available" >&2; exit 2; }
echo "=== Cloud Run service: project=${PROJECT} region=${REGION} service=${SERVICE} ==="
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format="yaml(metadata.name,status.url,status.latestReadyRevisionName,status.traffic,spec.template.spec.containers.image,spec.template.spec.serviceAccountName)"
REV="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.latestReadyRevisionName)')"
test -n "$REV" || { echo "No latest ready revision" >&2; exit 3; }
echo "=== Active revision (configuration only, no secrets) ==="
gcloud run revisions describe "$REV" --project="$PROJECT" --region="$REGION" \
  --format="yaml(metadata.name,status.imageDigest,status.conditions,status.containerStatuses.imageDigest)"
echo "=== IAM bindings for invoke permission (no tokens) ==="
gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format="json(bindings.role,bindings.members)"
echo "=== Runtime health, IAM authenticated ==="
URL="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.url)')"
TOKEN="$(gcloud auth print-identity-token --audiences="$URL")"
curl --fail --silent --show-error --max-time 20 -H "Authorization: Bearer ${TOKEN}" "${URL}/health"
echo
echo "NO WRITES PERFORMED. Compare active revision/digest to the approved deployment provenance."
