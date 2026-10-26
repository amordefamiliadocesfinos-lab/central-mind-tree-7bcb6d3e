# F1.3 Catálogo de candidatos

Status: não operacional. Não alimentar produção.

## Campos obrigatórios
Conta oficial; Item ID; Model ID (inclusive 0); apresentação comercial aprovada; componentes físicos e quantidades; fontes de evidência; validação de Arquitetura Comercial e Operações.

## Primeira família: Porto Gel
Candidato em estudo: apresentação 2 kg composta por duas embalagens físicas de 1 kg. Identificadores externos e vínculo de conta devem ser confirmados nas evidências da integração e homologados pela Arquitetura Comercial.

## Fluxo
Capturar identidade oficial -> vincular apresentação homologada -> expandir componentes -> pré-visualizar pedido -> homologar -> ativar com versionamento.

## Regras
Sem título como identidade autoritativa; sem baixa de estoque na criação do pedido; sem escrever em mappings produtivos sem homologação; qualquer ambiguidade bloqueia a entrada.

## Repasse comercial Lote 1 — 26/10/2026

Fonte: REPASSE_ARQUITETURA_COMERCIAL_PARA_MAPPINGS_SHOPEE_F1_3_V1. Registro estruturado em `services/integration-hub/catalog/shopee-mapping-historical-evidence-f1-3.json`.

Foram incorporadas 17 fotografias históricas, todas sem homologação operacional: Porto Gel 6 (5 provisórias/1 divergente); Glucose 5 (provisórias); Alfajor 60g 6 (4 provisórias/2 divergentes).

### Pendências que condicionam o vínculo
1. Confirmar Shop ID e vínculo à conta interna para cada Item ID/Model ID. O apelido comercial observado do Alfajor não equivale automaticamente a uma conta interna.
2. Comprovar a permanência dos IDs e das variações no Seller Center/Open Platform atual.
3. Confirmar IDs de apresentação interna e composição física com Operações 9.
4. Separar os itens legados divergentes: Porto Gel 5kg e Alfajor 108/144. Não remover anúncios automaticamente.
5. Solicitar ao Comercial Lote 2 (Pó para Sorvete, Trufas e Biscoitos) sem bloquear o Lote 1.

### Distinção entre evidência e catálogo operacional
O arquivo de evidências admite conta/apresentação/composição nulas. O schema `mapping-candidate.schema.json` exige identidade física completa e permanece reservado para candidatos totalmente preenchidos; nenhuma linha de evidência histórica pode ser promovida sem aprovação documentada.

### Evidência operacional distinta
Foi observado em snapshot real da conta Viviane o Porto Gel 2kg com Item ID 23399466897 / Model ID 209190015957. Esse par **não é igual** ao Porto Gel 2kg histórico 58211561353 / 199622481700. São linhas de evidência distintas, possivelmente anúncios/contas diferentes; a correspondência comercial não pode ser presumida.
