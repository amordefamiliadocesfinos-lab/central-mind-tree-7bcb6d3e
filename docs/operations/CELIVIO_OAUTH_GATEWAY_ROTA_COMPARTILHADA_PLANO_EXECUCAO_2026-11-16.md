# Integração Shopee — Celivio/Neto — evolução segura do Gateway OAuth (16/11/2026)
**Natureza:** implementação GitHub + teste offline + gate operacional de publicação, sem iniciar OAuth ou alterar o Gateway produtivo neste commit. Subordinado ao mapa F12 congelado, Ecossistema Celivio e Método Mappings V2.2. Mappings pertencem a outro especialista.

## Evidências reais trazidas pelo operador
- Hub principal: `integration-hub-00257-fus` recebe 100% do tráfego, tag `v36-adao-guard`; serviço Cloud Run `integration-hub`, projeto `painel-central-integration-hub`, região `southamerica-east1`.
- Adão Scheduler `shopee-adao-intake-v1`: `PAUSED`; não reativar.
- Celivio: conta interna `d26c7a30-aa4a-4441-8012-600d70453689`, username `netojacobus504`, loja Neto Company, `shop_id=1357031949` extraída do anúncio da loja e confirmada pelo proprietário. A própria Shopee deverá ainda confirmar identidade no retorno OAuth.
- Revisão isolada `integration-hub-00261-pay`, tag `celivio-oauth-validacao`, imagem `celivio-oauth-bba01b4d400c` no checkpoint: saúde via proxy autenticado GET /health → HTTP 200; GET /shopee/live/oauth/celivio/start → HTTP 503 com flag OFF; 0% do tráfego principal.
- Gateway `integration-hub-oauth`, hostname `integration-hub-oauth-bh4c23q1.ue.gateway.dev`, API config `oauth-f6q3b-6a1a4b33` ACTIVE, global. OpenAPI atualmente oferece `/shopee/live/oauth/start`, `/shopee/live/oauth/adao/start` e `/shopee/live/oauth/callback`; falta `/shopee/live/oauth/celivio/start`.
- Backend global OpenAPI `https://integration-hub-899273223001.southamerica-east1.run.app` e mesmo `jwt_audience`: é o serviço principal, não a tag Celivio. Isso explica o risco de cookie `__Host-pc_shopee_live_state` se o início ocorrer no subdomínio da tag e o callback ocorrer no hostname do Gateway.

## Solução preservadora — reutilizar o mesmo Gateway e o mesmo backend
**Não criar outro callback, outro Gateway ou segundo domínio.** Adicionar apenas uma rota GET pública de início Celivio à configuração OpenAPI que já possui início de Adão/Viviane e callback comum. O handler existente no GitHub tem `/shopee/live/oauth/celivio/start` com state `celivio.*`, conta canônica fixa e flag OFF por padrão. O backend do Gateway permanece apontando ao Cloud Run principal; para servir Celivio esse código precisará estar na revisão **que recebe o tráfego do endereço principal**, não apenas na tag isolada.

### Código entregue no repositório
- `services/integration-hub/scripts/prepare-celivio-gateway-route.py`: recebe YAML **extraído da configuração atualmente ACTIVE** e duplica somente a rota GET de início Adão para Celivio, com operationId único, sem modificar callback, Viviane, Adão, autenticação, endereço de backend ou audiência. **Falha fechada** se o contrato esperado não estiver presente ou houver Celivio duplicado.
- `services/integration-hub/scripts/test-prepare-celivio-gateway-route.py`: testes offline do contrato de patch e preservação.
- `services/integration-hub/tests/shopee-live-oauth.test.mjs`: cobertura de start e callback das três contas, na mesma URL de retorno, isolamento por state/loja e bloqueio de shop ID trocada.

### Etapa A — somente leitura, exportação local e validação
Executar no Cloud Shell, a partir de `~/painel-central-celivio-deploy`, **depois de atualizar o código por procedimento Git já autorizado**:
```bash
set -euo pipefail
PROJECT=painel-central-integration-hub
API=integration-hub-oauth
CONFIG=oauth-f6q3b-6a1a4b33
mkdir -p /tmp/celivio-gateway
gcloud api-gateway api-configs describe "$CONFIG" --api="$API" \
  --project="$PROJECT" --view=FULL --format=json > /tmp/celivio-gateway/config-metadata.json
python3 - <<'PY'
import base64, json, pathlib
d=json.loads(pathlib.Path('/tmp/celivio-gateway/config-metadata.json').read_text())
docs=d.get('openapiDocuments') or []
if len(docs)!=1 or not docs[0].get('document',{}).get('contents'):
    raise SystemExit('BLOQUEADO: esperado exatamente um documento OpenAPI completo')
raw=docs[0]['document']['contents']
text=base64.urlsafe_b64decode(raw+'='*(-len(raw)%4)).decode('utf-8')
pathlib.Path('/tmp/celivio-gateway/current.yaml').write_text(text)
print('OpenAPI atual recuperada (arquivo local, sem alterar Gateway)')
PY
python3 services/integration-hub/scripts/test-prepare-celivio-gateway-route.py
python3 services/integration-hub/scripts/prepare-celivio-gateway-route.py \
  --source /tmp/celivio-gateway/current.yaml \
  --output /tmp/celivio-gateway/celivio-proposta.yaml
diff -u /tmp/celivio-gateway/current.yaml /tmp/celivio-gateway/celivio-proposta.yaml || test "$?" -eq 1
```
**PARE NESTA ETAPA** se faltar a definição, se o patch bloquear ou se o diff mostrar algo além da rota GET Celivio; não alterar Gateway ou política IAM para contornar. Não publicar os arquivos brutos se contiverem elementos de configuração sensíveis; reportar somente o delta de rota e resultados dos testes.

### Etapa B — publicação Cloud Run principal (NÃO AUTOMÁTICA)
1. Confirmar que a imagem versionada de main contém as alterações com três rotas e CI dos testes pertinentes aprovada, identificar digest imutável. Conferir também se há outros commits de módulos terceiros após o build; não promover código desconhecido.
2. Planejar atualização da **revisão principal** com a nova imagem, mantendo os envs secretos existentes, `SHOPEE_LIVE_CELIVIO_SHOP_ID=1357031949` e `SHOPEE_LIVE_CELIVIO_OAUTH_ENABLED=false`, sem tocar nos Schedulers/rotas de Adão ou Viviane. **É uma operação produtiva compartilhada e requer aprovação explícita do proprietário depois do preflight**, mesmo se a implementação Celivio estiver OFF.
3. Verificar os três endpoints via caminhos permitidos na revisão isolada, sem OAuth Live. **Não usar `--no-traffic` como prova de ausência de invocação por URL de tag.**
4. Após publicação principal deliberada e validação de saúde, o backend do Gateway continua com o mesmo URL principal e encontra a rota Celivio internamente, ainda bloqueada pela flag OFF.

### Etapa C — publicação de nova configuração Gateway (NÃO AUTOMÁTICA)
1. Gateway configs são imutáveis: criar **novo ID versionado**, usando o YAML preparado e conferido; manter API, backend global, `jwt_audience`, securityDefinitions, todos os outros paths e demais campos literalmente iguais à configuração antiga.
2. Conferir a nova config `ACTIVE` **antes** de apontar o Gateway para ela. O update é mudança produtiva: exige autorização independente depois do diff.
3. Fazer troca controlada de config e verificar as três rotas: start Viviane/Adão preservados e start Celivio → 503 enquanto OFF; callback continua no mesmo domínio. Com flag OFF não haverá criação de token Celivio.
4. Ter rollback preparado para o config ID antigo `oauth-f6q3b-6a1a4b33`, **sem deletá-lo**. Nunca criar rota que aponta callback à tag Celivio apenas.

### Etapa D — autorização Celivio (posterior e separada)
**Apenas depois de B+C comprovados, revisão de permissão de callback e consentimento do operador:** habilitar flag para Celivio com shop ID esperado na revisão principal e iniciar em `https://integration-hub-oauth-bh4c23q1.ue.gateway.dev/shopee/live/oauth/celivio/start`, voltando ao callback **desse mesmo hostname**. OAuth é processo com efeito: cria state, usa code/token, snapshots e vínculo no Core. Conferir shop ID retornada, prova `get_shop_info`, isolamento Celivio. Não ativar ingestão automática, labels, `ship_order`, mappings ou Scheduler Celivio neste estágio. Não reativar Adão.

## Estado da missão neste commit
Somente preparação e testes de código. Nenhuma API config nova, alteração no Gateway, revisão principal, flag de Celivio, OAuth Live ou pedidos foi executada por este documento.


## Etapa B — preflight de promoção do backend principal autorizado para preparação (16/11/2026)
**Autorização do proprietário:** preparar a promoção sem transferir o tráfego atual, alterar variáveis produtivas, autorizar OAuth ou modificar o Gateway. A promoção efetiva será uma operação posterior, com evidência e decisão expressa.

### Evidência já comprovada pelo operador no Cloud Shell
- Código oficial revisado `6d09394a77d6` (PR #896).
- Imagem construída `southamerica-east1-docker.pkg.dev/painel-central-integration-hub/cloud-run-source-deploy/integration-hub:celivio-gateway-6d09394a77d6`; digest registrado na saída Cloud Build; usar digest verificado, não uma tag mutável, na operação futura.
- Revisão candidata `integration-hub-00262-vuy`, tag `celivio-gateway-validacao`, 0% do tráfego principal; proxy autenticado testado: GET `/health` → HTTP 200; GET `/shopee/live/oauth/celivio/start` → HTTP 503 com flag OFF.
- Principal `integration-hub-00257-fus` com 100%; `shopee-adao-intake-v1` PAUSED. Gateway API config `oauth-f6q3b-6a1a4b33` permanece ACTIVE; proposta local `/tmp/celivio-gateway/celivio-proposta.yaml` gerada com 11 linhas adicionadas e nenhuma removida; 4 testes Python e 33 OAuth Node aprovados.
- CI global de PR #896 com `hub-node22-and-container` e `core-and-cycle-postgres` SUCCESS; `logistics-typescript` FAILURE decorrente de diagnósticos nos módulos Núcleo e Saúde, sem erro registrado nos arquivos da Integração. Não declarar CI geral verde.

**Correção de evidência:** captura Cloud Shell posterior confirmou a candidata `integration-hub-00262-vuy` (não `00262-yvl`), com tag `celivio-gateway-validacao`, tráfego 0%; a revisão principal permaneceu `00257-fus`, 100%. Preferir a leitura dinâmica do nome pela tag em consultas futuras.

### Comando de conferência SOMENTE LEITURA — executar no Cloud Shell
Não revelar nomes de secret versions, tokens, valores de env ou dados privados. O script abaixo imprime apenas inventário de *nomes* de variáveis, mudanças por categoria (sem valores) e campos operacionais não sensíveis:

```bash
set -euo pipefail
PROJECT=painel-central-integration-hub
REGION=southamerica-east1
SERVICE=integration-hub
MAIN=integration-hub-00257-fus
CANDIDATE=integration-hub-00262-vuy
mkdir -p /tmp/celivio-promotion

gcloud run revisions describe "$MAIN" --project="$PROJECT" --region="$REGION" \
  --format=json > /tmp/celivio-promotion/main.json
gcloud run revisions describe "$CANDIDATE" --project="$PROJECT" --region="$REGION" \
  --format=json > /tmp/celivio-promotion/candidate.json
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format=json > /tmp/celivio-promotion/service.json
STATE="$(gcloud scheduler jobs describe shopee-adao-intake-v1 \
  --project="$PROJECT" --location="$REGION" --format='value(state)')"
test "$STATE" = PAUSED || { echo "BLOQUEADO: Adão não está PAUSED"; exit 1; }

python3 - <<'PY'
import json,pathlib
root=pathlib.Path('/tmp/celivio-promotion')
m=json.loads((root/'main.json').read_text())
c=json.loads((root/'candidate.json').read_text())
s=json.loads((root/'service.json').read_text())
traffic=s.get('status',{}).get('traffic') or []
primary=[x for x in traffic if x.get('percent',0)>0]
if len(primary)!=1 or primary[0].get('percent')!=100 or primary[0].get('revisionName')!='integration-hub-00257-fus':
    raise SystemExit('BLOQUEADO: revisão principal não corresponde ao checkpoint')
tag=[x for x in traffic if x.get('tag')=='celivio-gateway-validacao']
if len(tag)!=1 or tag[0].get('revisionName')!='integration-hub-00262-vuy' or tag[0].get('percent',0)!=0:
    raise SystemExit('BLOQUEADO: tag de validação divergente')
def container(x):
    containers=x.get('spec',{}).get('containers') or []
    if len(containers)!=1: raise SystemExit('BLOQUEADO: esperado 1 contêiner')
    return containers[0]
def env(x):
    return {e['name']:e for e in container(x).get('env',[])}
a,b=env(m),env(c)
print('MAIN: integration-hub-00257-fus | 100%')
print('CANDIDATE: integration-hub-00262-vuy | 0%')
print('NOMES_ENV_ADICIONADOS:', ', '.join(sorted(set(b)-set(a))) or 'nenhum')
print('NOMES_ENV_REMOVIDOS:', ', '.join(sorted(set(a)-set(b))) or 'nenhum')
print('NOMES_ENV_COM_CONFIG_DIFERENTE:', ', '.join(sorted(k for k in set(a)&set(b) if a[k]!=b[k])) or 'nenhum')
for key in ('SHOPEE_LIVE_CELIVIO_OAUTH_ENABLED','SHOPEE_LIVE_CELIVIO_SHOP_ID'):
    entry=b.get(key,{})
    value=entry.get('value')
    if key.endswith('_ENABLED') and value!='false': raise SystemExit('BLOQUEADO: flag Celivio não está OFF')
    if key.endswith('_SHOP_ID') and value!='1357031949': raise SystemExit('BLOQUEADO: shop_id não corresponde à referência')
print('CELIVIO: shop_id esperado e OAuth OFF')
for key in ('serviceAccountName','timeoutSeconds','containerConcurrency'):
    print(key, 'IGUAL' if m.get('spec',{}).get(key)==c.get('spec',{}).get(key) else 'DIFERENTE')
for key in ('ports','resources'):
    print(key,'IGUAL' if container(m).get(key)==container(c).get(key) else 'DIFERENTE')
print('IMAGENS_DISTINTAS:',container(m).get('image')!=container(c).get('image'))
print('PRE-FLIGHT SOMENTE LEITURA CONCLUIDO')
PY
```

### Interpretação do preflight
- Nomes de variáveis adicionadas exclusivamente Celivio, flags OFF e mesmo serviço/conta de execução são esperados, mas **qualquer diferença além do escopo esperado exige explicação antes da promoção**; não presumir automaticamente segurança pelo HTTP 200/503.
- O código da revisão candidata incorpora mudanças de main posteriores à produção; exige confronto de versão e risco de regressão de processos existentes, mesmo com flags OFF.
- O backup de referência é a **revisão produtiva** `integration-hub-00257-fus`, não apenas a tag ou a imagem de Celivio. Registrar a situação atual de 100% para futura reversão do tráfego se necessária.
- Não executar `gcloud run services update-traffic`, `gcloud run deploy`, `gcloud api-gateway gateways update`, nem alterar IAM, env ou Scheduler enquanto esse preflight está em preparação. A transferência do tráfego e o Gateway demandam gates posteriores separados.
