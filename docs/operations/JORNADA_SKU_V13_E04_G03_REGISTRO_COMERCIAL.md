# Jornada SKU V1.3 — E04/G03: registro comercial auditável

Status: **PR de rascunho, SEM migração produtiva, SEM merge ou deploy.**
Autoridade: aprovação técnica G03 do proprietário em 25/11/2026.
Referência: Plano Mestre SKU V1.3 — Core/Hub primeiro; Shopee por último.

## Por que existe uma tabela filha

A identidade física do produto e a identidade de publicação já pertencem às tabelas
\`products\`, \`product_variants\`, \`marketplace_product_mappings\` e
\`marketplace_product_mapping_items\`. O código comercial da oferta não deve
sobrescrever esses campos nem trocar \`external_item_key\`.
A tabela \`marketplace_seller_sku_state\` é 1:1 por \`mapping_id\` e seu histórico
\`marketplace_seller_sku_events\` é append-only. Não há nova Matriz Mestre.

## Duas verdades, não uma sincronização presumida

- \`canonical_sku\`: intenção de comercialização aprovada, independente de publicação.
- \`observation_kind=UNKNOWN\`: ainda não há evidência; \`observed_sku=NULL\`.
- \`observation_kind=BLANK\`: origem consultada e SKU vazio confirmado, com fonte/data.
- \`observation_kind=VALUE\`: valor realmente observado, com fonte/data.
- \`PUBLICADO_CONFERIDO\`: exige observação VALUE igual ao canônico e prova.
- \`VIV-\` continua registrado como observado quando for o caso; nunca copiar automaticamente o AF para o observado.
- \`PRONTO_PARA_PUBLICAR\` e \`PUBLICADO_A_CONFERIR\` exigem referência de evidência.

## Escrita segura e controle

O cliente autenticado tem SELECT apenas sob RLS de administrador ativo.
**Não há INSERT/UPDATE/DELETE direto** das novas tabelas para o navegador.
Um RPC \`public.record_marketplace_seller_sku_state\`, declarado
SECURITY INVOKER, delega a escritor privado \`sku_private.record_seller_sku_state\`
com validação explícita de \`auth.uid()\`, papel ativo, \`mapping_id\`,
revision esperada, evidência, semântica e idempotência por UUID do evento.

O escritor só aceita mapping Shopee com conta + Item/Model oficiais.
Para os quatro Items T30-2 e quatro T40-2 conhecidos, a arquitetura declarada
deve corresponder à família da publicação, impedindo falsos rótulos que
desativariam o bloqueio físico. Qualquer componente físico de T40 no T30-2
obriga \`BLOQUEADO_LOCAL\`, sem alterar a variante inativa de Amendoim T30.
O evento é gravado na mesma transação e não admite UPDATE/DELETE.

Exemplo de **formato**, não comando para executar na base oficial:
\`\`\`json
{
  "p_event_id": "<UUID novo por decisão>",
  "p_mapping_id": "980cb680-5296-4342-b83d-4e09584a3fe0",
  "p_expected_revision": 0,
  "p_payload": {
    "offer_family": "T30-2",
    "offer_architecture": "T30-2",
    "canonical_sku": "AF-TRF30-KT-030-BRG",
    "canonical_decision_source": "Matriz Unica ratificada",
    "observation_kind": "UNKNOWN",
    "reconciliation_status": "PREPARADO_NO_CORE",
    "event_kind": "DECISAO"
  }
}
\`\`\`
Este exemplo não implica que o canônico foi publicado na Shopee.

## Compatibilidade com Hub e Core

- \`src/hooks/useShopeeSellerSkuRegistry.ts\`: leitura consultiva opcional,
  **desabilitada por padrão**; nenhuma tela antiga muda de comportamento.
- Testes em \`services/integration-hub/tests/shopee-seller-sku-v13-offline.test.mjs\`:
  Item/Model reconhecido não muda com SKU vazio, VIV, AF ou texto divergente.
  Item/Model desconhecido e conta trocada não herdam o vínculo de outro mapping.
- \`app.mjs\` e demais rotas de operação do Hub **não foram alterados**.
- Integração automática de pedidos, emissão de etiquetas, estoque e logística
  permanecem fora do escopo e desativados onde já eram desativados.

## Prova técnica e próximos gates

A workflow \`.github/workflows/sku-v13-g03-disposable.yml\` provisiona
PostgreSQL 17 temporário, aplica a migração apenas na fixture, testa RLS,
idempotência, revision, imutabilidade e bloqueio físico. Outra job executa
testes offline do Hub. A workflow existente de Integration Hub executa
regressão adicional e TypeScript.

**G03 concluível apenas após CI verde e revisão da PR.**
Merge, migração no Lovable Cloud, deploy, registro dos 42 códigos, exportação
para Shopee e upload em massa são **gates separados**, não autorizados por esta PR.
