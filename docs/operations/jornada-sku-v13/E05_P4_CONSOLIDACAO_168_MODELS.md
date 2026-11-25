# Jornada SKU V1.3 — E05/P4 | Consolidação consultiva dos 168 Models

**Natureza:** projeção técnica derivada do Core, não nova Matriz Mestre. **Autoridade:** Plano Mestre V1.3, Matriz Única V40 e Dicionário E03.
**Escritas em Core, Hub, Shopee, estoque ou pedidos:** zero.

## Resultado técnico
- 4 contas: Adão, Viviane, Celivio/Neto, Priscila.
- 168 pares exatos de conta + Item ID + Model ID, cada um com um mapping ID oficial.
- 42 códigos AF comerciais distintos (21 T30-2 e 21 T40-2); cada código vinculado a quatro Models, um por conta.
- 42 mappings por conta e 24 casos físicos de T30-2 contendo Trufa 40 g de Amendoim, seis por conta.

A projeção JSON está em:
docs/operations/jornada-sku-v13/sku-v13-168-models-core-projection.json

Registra mapping_id real, channel_account_id, Item/Model, chave oficial, arquitetura, SKU canônico, quantidade, sabor, componentes físicos e flag de exceção. Esta é uma **projeção de leitura**. Todos os registros nela têm observed_sku nulo, observation_kind UNKNOWN e publication_allowed false. O Core ainda não recebeu as decisões comerciais em produção; os valores do export da Shopee são fotografias separadas.

## Conciliação com quatro arquivos de vendas da Shopee
A planilha auxiliar de conferência foi produzida a partir da Execucao_168 anterior e reconciliada linha a linha com a coluna F de SKU de variação, preço e estoque dos arquivos mass_update_sales_info, sem divergências nas 168 identidades.

| Estado observado na fotografia | Models |
|---|---:|
| AF já existente em Adão/Priscila | 84 |
| SKU vazio em Celivio | 42 |
| SKU vazio em Viviane | 14 |
| Legado VIV preenchido em Viviane | 28 |
| TOTAL | 168 |

Não copiar SKU de referência (coluna E) para variação com Seller SKU vazio (coluna F). Não tratar a fotografia como situação live da Shopee.

## Quarentena física dos 24 modelos
São seis Models por conta no T30-2: três Amendoim e três Mix, com componente de Trufa 40 g. A variante Amendoim 30 g existe no cadastro físico, mas estava inativa. A composição pode ser intencional/histórica. **Não mudar produto/variante/composição por inferência.**

| Classificação consultiva | Quantidade |
|---|---:|
| AF já existente sem ressalva física | 72 |
| Campo vazio sem ressalva física | 48 |
| VIV legado sem ressalva física | 24 |
| Exceção física BLOQUEADO_LOCAL (AF/vazio/VIV) | 24 |
| TOTAL | 168 |

Os 24 excepcionais subdividem-se em: 12 AF publicados na fotografia, 8 campos vazios e 4 VIV legados. Os valores já existentes não devem ser apagados; bloquear apenas modificações novas até decisão Produto Mestre/Mappings.

## Lotes, consultivos e não autorizados para upload

| Lote | Total | Exceções | Sem ressalva física |
|---|---:|---:|---:|
| L00 Adão/Priscila AF | 84 | 12 | 72 |
| L01 Celivio 30 Brigadeiro | 1 | 0 | 1 |
| L02 Celivio demais T30-2 | 20 | 6 | 14 |
| L03 Celivio T40-2 | 21 | 0 | 21 |
| L04 Viviane vazios | 14 | 2 | 12 |
| L05 Viviane VIV legado | 28 | 4 | 24 |
| TOTAL | 168 | 24 | 144 |

**Ação posterior:** Core/Hub primeiro, CI e homologação separada, registro comercial projetado com observação auditada; somente após consolidar: exportação Shopee recente, delta de Seller SKU por conta, lote piloto e conferência reexportada. Não preparar arquivos de upload a partir de exportação histórica.

## Limites preservados
- Não renomear SKU físico, Item/Model, mapping oficial, quantidade física, pedido ou estoque.
- Não confundir canonical_sku planejado com observed_sku de origem.
- Não renomear VIV sem contrato de histórico/alias e autorização própria.
- PR #1134 permanece rascunho; nenhuma migração, merge ou publicação é autorizada por esta revisão.
- O Integration Hub não passa a importar pedidos automaticamente por consequência dessa preparação.

**Status:** consolidação técnica E05/P4 feita em branch, sem produção.
