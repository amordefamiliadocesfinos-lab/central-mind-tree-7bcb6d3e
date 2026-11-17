#!/usr/bin/env bash
# Cloud Shell — build isolado do handoff OAuth Shopee. NUNCA promove producao.
set -euo pipefail
PROJECT=painel-central-integration-hub
REGION=southamerica-east1
SERVICE=integration-hub
OLD=integration-hub-00166-tvl
BRANCH=fix/shopee-oauth-multicontas-onboarding-20261117
REPO=amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e
ROOT="${HOME}/shopee-oauth-console-handoff"
STAGE="${1:-build}"
mkdir -p "$ROOT"
echo "=== ESTADO PRODUTIVO (SEM SEGREDOS) ==="
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json > "$ROOT/service-before.json"
python3 - "$ROOT/service-before.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
active=[(x.get('revisionName'),x.get('percent',0)) for x in d['status']['traffic'] if x.get('percent',0)>0]
assert active==[('integration-hub-00166-tvl',100)],'BLOQUEADO: revisao principal inesperada'
tags={x['tag']:x['revisionName'] for x in d['status']['traffic'] if x.get('tag')}
assert len(tags)==26,'BLOQUEADO: tags inesperadas'
assert tags['celivio-oauth-on-validacao']=='integration-hub-00166-tvl'
print('PRODUCAO 00166-tvl 100%; 26 TAGS')
PY
test "$(gcloud scheduler jobs describe shopee-adao-intake-v1 --project="$PROJECT" --location="$REGION" --format='value(state)')" = PAUSED || { echo "BLOQUEADO: Scheduler Adao nao pausado"; exit 1; }
echo "SCHEDULER ADAO PAUSED"
if [[ "$STAGE" == build ]]; then
  EXISTING="$HOME/painel-central-celivio-deploy"
  if [[ ! -e "$ROOT/source/.git" ]]; then
    test -d "$EXISTING/.git" || { echo "BLOQUEADO: clone autenticado anterior nao localizado em $EXISTING"; exit 1; }
    git -C "$EXISTING" fetch --quiet origin "$BRANCH"
    git -C "$EXISTING" worktree add --quiet --detach "$ROOT/source" "FETCH_HEAD"
  fi
  git -C "$ROOT/source" fetch --quiet origin "$BRANCH"
  git -C "$ROOT/source" checkout --quiet --detach "FETCH_HEAD"
  SHA="$(git -C "$ROOT/source" rev-parse HEAD)"
  SHORT="${SHA:0:12}"
  IMAGE="$REGION-docker.pkg.dev/$PROJECT/cloud-run-source-deploy/integration-hub:oauth-console-$SHORT"
  printf '%s\n' "$SHA" > "$ROOT/source-sha.txt"
  printf '%s\n' "$IMAGE" > "$ROOT/image.txt"
  cat > "$ROOT/source/cloudbuild.oauth-console.yaml" <<'YAML'
steps:
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-f', 'services/integration-hub/Dockerfile', '-t', '${_IMAGE}', '.']
  - name: gcr.io/cloud-builders/docker
    args: ['push', '${_IMAGE}']
images: ['${_IMAGE}']
YAML
  echo "SOURCE_SHA=$SHA"
  echo "IMAGE=$IMAGE"
  echo "=== BUILD ASSINCRONO — NAO FAZ DEPLOY ==="
  gcloud builds submit "$ROOT/source" --project="$PROJECT" \
    --config="$ROOT/source/cloudbuild.oauth-console.yaml" \
    --substitutions="_IMAGE=$IMAGE" --async
  echo "BUILD SOLICITADO. Guardados: $ROOT/source-sha.txt e image.txt"
elif [[ "$STAGE" == candidate ]]; then
  IMAGE="$(cat "$ROOT/image.txt")"
  echo "IMAGE CANDIDATA: $IMAGE"
  gcloud artifacts docker images describe "$IMAGE" --project="$PROJECT" --format='value(image_summary.digest)' >/dev/null
  echo "IMAGEM EXISTENTE NO ARTIFACT REGISTRY"
  echo "=== CRIAR REVISAO COM 0% DE TRAFEGO (SEM TAG PUBLICA) ==="
  gcloud run services update "$SERVICE" --project="$PROJECT" --region="$REGION" \
    --image="$IMAGE" --no-traffic --async
  echo "Atualizacao solicitada. Conferir revisao e flags antes de tag/promocao."
else
  echo "Uso: bash ${0} build|candidate" >&2
  exit 2
fi
