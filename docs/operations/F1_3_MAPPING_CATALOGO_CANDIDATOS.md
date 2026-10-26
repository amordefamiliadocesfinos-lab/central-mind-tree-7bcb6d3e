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

## Repasse comercial V2 — Lote 2 (26/10/2026)

A base documental foi ampliada de 17 para **49 registros históricos**, sem homologação individual:
- Trufa 30g: 6 Item IDs, **sem Model IDs**. Ofertas A1/A2/A3/A4 e anúncios legados. Mix não tem estoque próprio; Amendoim 30g deve apontar para o SKU físico homologado da Trufa 40g Amendoim, sujeito à confirmação de Operações.
- Trufa 40g: 8 Item IDs, **sem Model IDs**. Ofertas A1/A2/A3/A4 e legados. Mix não tem estoque próprio; Amendoim usa produto da linha 40g com peso técnico documental de 34g.
- Biscoito para Alfajor: 18 combinações Item+Model documentadas: BA1 (1–8 pacotes Tradicional/Chocolate, proposta de 22 biscoitos garantidos por pacote) e BA3 (caixa original fechada 8kg, aproximadamente 880 unidades, **sem garantia de contagem exata**).
- BA2: anúncio a criar, portanto **sem** Item ID ou Model ID; não recebe mapping.
- Pó para Sorvete: sem adaptador canônico específico; não criar IDs por interpretação de código SH.

Todas as contas oficiais/Shop IDs, apresentações comerciais internas e identidades físicas efetivas desses itens permanecem sem homologação de vínculo. Na Trufa, Model ID ausente significa **desconhecido** e nunca deve ser tratado como modelo 0.

O catálogo estruturado acumulado permanece em `services/integration-hub/catalog/shopee-mapping-historical-evidence-f1-3.json`. Seus registros são **evidências**, não configurações executáveis. Não importar em produção.
