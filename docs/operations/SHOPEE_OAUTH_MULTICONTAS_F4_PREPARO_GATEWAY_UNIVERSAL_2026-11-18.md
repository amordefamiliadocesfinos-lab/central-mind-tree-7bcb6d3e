# F4 — Preparação isolada do Gateway OpenAPI Universal

**Projeto:** Painel Central / Shopee OAuth Multicontas  
**Data:** 18/11/2026  
**Natureza:** somente leitura de GCP e criação local de *candidata documental*, sem publicação ou alterações de infraestrutura.

## Fonte efetivamente confirmada pelo proprietário via Cloud Shell

- Gateway: `integration-hub-oauth` (ACTIVE).
- API Config vinculada: `oauth-celivio-20261116-v1` (OpenAPI: 1 documento).
- Host oficial: `integration-hub-oauth-bh4c23q1.ue.gateway.dev`.
- Rotas existentes: Viviane, Adão, Celivio e callback.
- Rota universal: `/shopee/live/oauth/universal/start` **AUSENTE**.
- Cloud Run `integration-hub-00167-hm8` 100% tráfego; `integration-hub-00166-tvl` Ready; revisão Celivio `integration-hub-oauth-celivio-73b264c9` retirada de atividade.
- Scheduler Adão: PAUSED.

Esses são resultados da auditoria apresentada pelo proprietário, **não uma nova leitura autenticada realizada por esta PR**.

## Implementação preparada

Ferramenta `prepare-universal-gateway-route.py`:
- Recebe **somente** cópia do OpenAPI publicado; exige quatro rotas legadas únicas e GET.
- Clona o contrato GET/Backend da rota Adão, trocando **apenas o path** por `/shopee/live/oauth/universal/start` e o `operationId` por `shopeeUniversalOAuthStart`.
- Valida que o restante do documento, callback, segurança, backends, identity provider e rotas legadas ficou *byte-for-byte* igual.
- Bloqueia rotas duplicadas, métodos incompatíveis e endereços específicos de outra loja.
- Não sobrescreve arquivo; não executa `gcloud`.

Ferramenta `export-active-shopee-gateway-candidate.py`:
- Consulta `gcloud api-gateway gateways list` e `api-configs describe --view=FULL` em leitura.
- Falha se config anexada mudar, se Gateway não estiver ativo ou se o OpenAPI estiver ausente/ambíguo.
- Decodifica o OpenAPI *localmente*, prepara candidato em diretório novo com permissões restritas e exibe somente hashes e resumo.
- Não imprime o conteúdo completo do documento, tokens, segredos ou variáveis; não implanta.

**CI:** `shopee-oauth-universal-gateway-prep.yml`, testes de preservação, recusa de rota duplicada, backend específico, mudança de config e payload inválido. Os testes usam OpenAPI **sintético**, não o publicado.

## Como executar no Cloud Shell autenticado — PREPARAÇÃO LOCAL

Requer cópia autenticada da branch desta PR em diretório de trabalho do Cloud Shell; nenhum dos scripts assume que o repositório já está presente. A partir da raiz do checkout:

```bash
python3 services/integration-hub/scripts/export-active-shopee-gateway-candidate.py \
  --output-dir "$HOME/shopee-oauth-gateway-preflight-20261118"
```

O comando **não** roda `gcloud api-gateway api-configs create`, `gateways update`, `gcloud run deploy` nem modifica tráfego.

O arquivo candidato é apenas material para a conferência técnica do contrato, não evidência de que o Gateway aceitou/publicou o OpenAPI. Verificar o diff isolado entre arquivo original e candidato localmente, não colar o YAML completo no chat.

## Gates preservados

1. Verificar se a configuração publicada ainda é a identificada acima.
2. Revisar diferença mínima real e regras `x-google-backend`, `path_translation`, `jwt_audience`, autenticação/headers do backend e compatibilidade do host.
3. Não publicar a nova API Config até candidata Cloud Run integrada F3-A..F3-D + reconciliação #911 estar preparada e aprovada, com flags universais desligadas.
4. Não mudar Gateway, tráfego ou Scheduler nem autorizar consentimento Shopee real sem gates específicos.
5. Preservar a configuração `oauth-celivio-20261116-v1` para rollback.

**Estado:** preparação e CI de código concluídos; delta sobre documento real do Gateway, deploy e homologação real ainda PENDENTES.
