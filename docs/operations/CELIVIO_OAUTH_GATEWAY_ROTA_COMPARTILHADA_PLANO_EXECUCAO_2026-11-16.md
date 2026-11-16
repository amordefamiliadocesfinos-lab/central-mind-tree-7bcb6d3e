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
