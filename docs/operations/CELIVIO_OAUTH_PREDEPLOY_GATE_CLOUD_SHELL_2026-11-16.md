# Celivio/Neto — pré-implantação OAuth e gate Cloud Run (16/11/2026)
**Escopo:** executar inspeção GCP sem efeito antes de qualquer build/deploy; Celivio=Neto Company, usuário netojacobus504, channel_account_id d26c7a30-aa4a-4441-8012-600d70453689, shop_id de referência 1357031949 (URL de anúncio confirmada pelo proprietário). Validar shop_id no próprio callback e get_shop_info. Não envolver mappings.

## Evidência GitHub
- PR #869 incorporou o suporte a `/shopee/live/oauth/celivio/start` em main; estado `celivio.*` se associa à conta Celivio e rejeita shop IDs inconsistentes.
- Flag `SHOPEE_LIVE_CELIVIO_OAUTH_ENABLED` OFF por padrão; `SHOPEE_LIVE_CELIVIO_SHOP_ID` sem valor default; não afirmar que runtime atual possui este código.
- CI Hub Node 22 + Docker e Core/Postgres sucesso no run 43924790337; job TypeScript global failure; não declarar CI integral verde.

## Gate 1 — coleta GCP somente leitura
No Cloud Shell autenticado na conta correta, executar:
```bash
set -euo pipefail
PROJECT="painel-central-integration-hub"
REGION="southamerica-east1"
SERVICE="integration-hub"
gcloud config set project "$PROJECT"
echo "=== SERVIÇO (TRÁFEGO, REVISÕES E TAGS) ==="
gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" \
  --format='yaml(status.traffic,status.latestReadyRevisionName,spec.template.metadata.name)'
echo "=== JOBS (STATUS/DESTINO SEM SEGREDOS) ==="
for JOB in shopee-adao-intake-v1 shopee-live-intake-v1; do
  gcloud scheduler jobs describe "$JOB" --location="$REGION" --project="$PROJECT" \
    --format='yaml(name,state,schedule,timeZone,httpTarget.uri)'
done
echo "=== REVISÕES EXISTENTES ==="
gcloud run revisions list --service="$SERVICE" --region="$REGION" --project="$PROJECT" \
  --format='table(metadata.name,status.conditions[0].status,metadata.creationTimestamp)'
```
Não imprimir `env`, segredos, OAuth tokens, cookie, service-account keys ou IDs de clientes. Se job Adão não estiver PAUSED, **não** modificá-lo tacitamente: interromper e reportar divergência.

## Gate 2 — build sem ativação, somente após Gate 1 conferido
- Fonte GitHub main atual, hash de commit comprovado, `services/integration-hub/Dockerfile`, contexto raiz.
- Criar imagem versionada, sem substituir tag existente. Build é operação cobrada no GCP; avaliar custo e não executar sem conferência do gate.
- **Não implantar apenas com `--no-traffic`:** uma tag pode ser chamada diretamente. Nova tag específica `celivio-oauth-validacao` deverá ficar sem Scheduler e com todas as flags de writers/ship_order/etiqueta OFF, preservando base de variáveis/segredos existentes. Verificar IAM, URL OAuth redirecionada para o callback oficial e flag Celivio OFF. Separar build, deploy, health, auditoria de env e autorização.

## Gate 3 — conexão posterior
Somente após deploy isolado comprovado, autenticação do operador e decisão explícita: configurar `SHOPEE_LIVE_CELIVIO_SHOP_ID=1357031949`, ativar **apenas** `SHOPEE_LIVE_CELIVIO_OAUTH_ENABLED=true` na revisão correta, com revisão de tráfego e redirecionamento OAuth. Executar no navegador do proprietário, validando retorno da Shopee, shop_id e get_shop_info, Core OAuth e primeiro Raw em leitura. Evitar dois callbacks competidores e nunca utilizar tag Adão ou Viviane para este teste.

## Preservação
Scheduler Adão PAUSED por decisão de custo; Viviane intacta; nenhum cron, worker, writer, intake, shipping, etiqueta ou mapping de Celivio antes de suas autorizações e provas próprias. Responsabilidade de mappings pertence ao especialista. Este documento não executa GCP.
