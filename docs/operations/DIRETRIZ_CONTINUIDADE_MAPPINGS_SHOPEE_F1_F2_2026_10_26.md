# PAINEL CENTRAL — Mappings Shopee — Continuidade F1/F2 sob reformulação comercial

**Data:** 2026-10-26  
**Estado:** proposta operacional aprovada pelo responsável do projeto; registro de continuidade para revisão e integração ao repositório canônico.  
**Escopo:** Especialista Mappings Shopee 1, interfaces com Arquitetura Comercial Shopee, Integração Shopee e Operações.

## Decisão

As frentes **F1 — Reconhecimento e Vinculação Oficial** e **F2 — Conversão Física e Validação** passam a ser tratadas como uma **função contínua**, não como campanha para homologar todos os mappings atualmente existentes.

1. **Mapping legado não é verdade presumida.** Parte dos registros foi criada para validar o processo. Preservar como patrimônio técnico e evidência; conferir antes do uso operacional.
2. **Anúncio atual não é oferta comercial futura congelada.** O especialista Arquitetura Comercial está reformulando anúncios; decisões comerciais aprovadas e anúncios efetivamente publicados orientarão a reconciliação.
3. **A identidade observada na Shopee é fato externo datado, não aprovação comercial.** Item ID/Model ID são evidência de identificação do anúncio/variação no momento da consulta.
4. **O cadastro físico interno é o vínculo operacional**, sujeito à validação em uso e às regras de Operações. Não usar anúncio, título, SH-code ou mapping experimental como substituto da composição física.
5. **Prioridade atual soberana:** pedido real → Painel → separação/etiqueta → finalização física → baixa única e correta do estoque. Não atrasar esse ciclo para completar catálogo geral.

## O que permanece pronto e reaproveitável

- Reconhecimento exato por `channel_account_id + external_item_id + external_model_id`, com fallback legado controlado e bloqueio em ambiguidade.
- Composição de um ou mais componentes físicos; preview sem escrita; Core Bridge; testes automatizados e diagnóstico privado autenticado.
- Piloto Porto Gel Viviane 1/2/3/4 kg: mappings persistidos, composições verificadas, teste autenticado no runtime relatado com `selected=4, recognized=4, blocked=0, written=0`. **Isso homologa o reconhecimento e a projeção técnica, não a entrada de pedido real.**
- Porto Gel 5 kg: **pendente** devido à retirada comercial-alvo ainda não reconciliada com o estado publicado; não criar mapping ou composição por suposição.
- Glucodry 1/2/4 kg: IDs observados e mappings legados identificados; controle físico em gramas sem variantes; **não promover automaticamente esses mappings a operacionais** antes da confirmação de seu contrato físico e necessidade de uso.

## Três classificações de acompanhamento (conceituais, NÃO campos implantados)

- **Experimental/histórico:** criado em desenvolvimento/validação; pode servir de referência, mas não implica aprovação operacional.
- **Operacional vigente:** identidade externa e composição física comprovadas para utilização no fluxo aplicável.
- **Em transição comercial:** anúncio ou variação sujeito a alteração, substituição ou retirada; preservar rastreabilidade histórica e validar novo vínculo antes do uso.

Não adicionar colunas, tabelas, flags ou filtros em produção apenas para representar essas classificações. Avaliar implementação somente mediante necessidade funcional observada, com os contratos e impacto nos leitores/escritores.

## Ciclo mínimo por mudança comercial

1. **Arquitetura Comercial:** comunica conta/anúncio afetado, decisão (manter/alterar/criar/retirar), oferta/apresentação aprovada e estado da publicação.
2. **Evidência externa:** verificar no dado Shopee atual Item ID, Model ID, variação e status da oferta; não inventar IDs nem deduzir identidade do título.
3. **Mappings:** confrontar com vínculo existente. Reutilizar, corrigir pontualmente, criar ou deixar pendente. Preservar histórico e impedir roteamento ambíguo.
4. **Operações:** envolver apenas quando houver dúvida física concreta sobre Produto Mestre, variante, quantidade ou evento de estoque.
5. **Validação:** preview autenticado sem escrita, teste de componentes e quantidade; só ativar escrita operacional através da Integração Shopee e dos gates vigentes.
6. **Uso e observação:** monitorar falhas reais e corrigir apenas o necessário.

## Contrato de repasse mínimo entre especialistas

- **Arquitetura Comercial → Mappings:** conta/loja, anúncio, mudança desejada, estrutura comercial aprovada, status de publicação e IDs efetivos quando já confirmados; indicação de apresentação física existente ou dúvida específica.
- **Mappings → Integração Shopee:** IDs oficiais escopados por conta, vínculo Produto/Variante/Componentes, status de validação e eventuais blockers. Integração responde por OAuth, Cloud Run, ciclo e criação de pedidos.
- **Mappings ↔ Operações:** somente validação física onde indispensável; Operações mantém soberania sobre separação e baixa de estoque.
- **Camada Mestre:** impactos sistêmicos, conflitos entre decisões e priorização transversal.

## Regras de segurança e preservação

- Pedido ≠ OP; criação do pedido ≠ baixa do estoque.
- Não apagar vínculos ou identidades necessários à interpretação de pedidos históricos.
- Não assumir que alterar anúncio preserva Item ID/Model ID.
- Não reaproveitar mapping de outra conta.
- Não converter decisão comercial ainda não publicada em mapping oficial ativo.
- Não refazer produtos, variantes, composições ou motores já existentes sem evidência funcional.
- **Marcos distintos:** código, PR/merge, migração, deploy, gates, preview e pedido real; um não substitui outro.

## Critério prático de prioridade

**Faixa A:** bloqueio concreto no ciclo de pedido real e separação. Resolver imediatamente e validar.  
**Faixa B:** anúncio cuja reformulação foi aprovada e publicada. Reconciliar identificação e composição, com preview.  
**Faixa C:** mapping legado ou catálogo ainda não reformulado, sem impacto operacional. Preservar e aguardar gatilho, sem campanha de migração em massa.

## Continuidade imediata

1. Não ampliar Glucodry por inércia; manter evidências e vínculos legados em observação.
2. Manter Porto Gel 5 kg pendente, sem inventar composição nem afirmar remoção efetiva.
3. Receber os primeiros repasses da Arquitetura Comercial conforme cada anúncio mudar.
4. Apoiar, quando necessário, a Integração Shopee no reconhecimento de pedidos reais e bloqueios específicos.
5. Rever este método após evidências de uso real; evitar auditorias repetidas e documentação paralela concorrente.

**Fontes de diretriz consultadas:** `DIRETRIZ_PRIORIDADE_CICLO_FUNCIONAL_SHOPEE_PAINEL_CENTRAL_2026-10-20_V1_0`; `ARQUITETURA_MESTRE_SHOPEE_PAINEL_CENTRAL_V1_0_CONGELADA`; `DIRETRIZ_GOVERNANCA_GITHUB_LOVABLE_SUPABASE_CODEX_PAINEL_CENTRAL_V1.0`. Este registro complementa as diretrizes, sem substituí-las.

## Checkpoint de transferência — Catálogo Operacional 2 → Sucessor 3 (04/11/2026)

- **Marco confirmado:** contrato P2 isolado de simulação das transições físicas de Italac 395 g, Sorbato 1 kg, Ácido Cítrico 1 kg e Ivoti 9,8 kg, mesclado pela [PR #423](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/423), SHA `b17ef492031f60743bff35f2ee5b503fa40de502`; CI 3/3 aprovado. Evidência: relatório técnico de 04/11/2026.
- **Alcance:** contrato puro de simulação e testes isolados aprovados, sem integração com API/webhook/banco, sem deploy Cloud Run e sem homologação da transição física real. P2 contratual não equivale à integração P2 completa.
- **Pendências:** integração transacional, decisão de schema/RPCs, migration não aplicada, testes de autorização, RLS, idempotência, concorrência e rollback, e homologação física por Operações/Produto Mestre; **P3 bloqueada e P4 postergada**. Não declarar E4/E5.
- **Preservações:** nenhum saldo, mapping, pedido ou OP alterado nesta missão; não inferir estoque lacrado de saldo agregado nem antecipar migration, COMMIT ou ajuste de estoque. Proteções #416/#418 preservadas.
- **Métodos vigentes:** Método Mestre do Laboratório V1.0 (superior) e Método Enxuto Especialista Mappings Shopee V2.2 (congelado); não modificar estes métodos nem criar registro paralelo.
- **Próxima ação do Sucessor 3:** recuperar o estado atual e coordenar com Operações/Produto Mestre a confirmação das caixas Italac/ML2 originais, apresentação cadastrada do Ácido Cítrico e ledger físico autorizado por local; preparar decisões e transições físicas para eventual missão posterior especificamente autorizada, sem movimentar estoque.

**Natureza:** checkpoint datado de transferência, sem revogar o histórico anterior nem alterar autoridades.


## Encerramento da fase técnica por pares oficiais — 05/11/2026

**Esta atualização prevalece sobre estados históricos anteriores deste documento (inclusive a P2 apenas proposta em 04/11).** Não altera o Método Mestre V1.0 nem o Método Enxuto V2.2, e **não equivale a E4/E5 ou confirmação das ofertas hoje publicadas**. Por decisão do responsável, o acompanhamento de uso real será fase posterior.

### Integração comum — concluída

- PRs #430–#433: engenharia física P2 das quatro famílias instalada no Lovable Cloud; proteções de separação, abertura, recebimento e integridade mantidas. Estoques de recipientes somente por fato real; nenhuma inicialização sintética.
- PR #434: projeção das sete identidades Italac/Sorbato/Ácido; PR #437: escritor canônico com snapshot comercial corrigido e aplicado no LIVE; PR #440: Hub com COMMIT individual exigindo pedido exato, lote automático P2 bloqueado. Codex confirmou revisão Cloud Run `integration-hub-p4-7429d7e1097d`, SHA `7429d7e1097d631aa03e301fb7555783aadb9908`, digest `sha256:7f86d2665cea4e51f4c736124721f758377a888d99839d16972562ac0a9b235e`, saúde HTTP 200 autenticada, 710 testes aprovados e 100% tráfego.
- PR #449: corrigiu o Core Bridge para carregar catálogo e componentes completos por páginas, evitando truncamento e falha em 200 mappings; merge `dd90362cb9b06004c2d0ab59eea5bead8f64d2c7`, CI `42099582654` SUCCESS. A Edge Function `integration-core-bridge` foi implantada separadamente no Lovable Cloud, com fonte idêntica ao merge. Teste **real autenticado SOMENTE LEITURA** `shopee.order_intake_batch.read`: HTTP 200, 371 mappings Adão e 524 componentes; nenhum pedido criado. Proteção HMAC manteve resposta HTTP 401 sem assinatura. Não foi fornecido ID de revisão da função.

### Matriz única de validação técnica

Diagnóstico #445 executado em ambiente Lovable sem alterações de código/banco: leitura SELECT do catálogo completo e **preview sintético Q=1 para cada par Item ID/Model ID oficial**, com títulos e variações extraídos dos próprios cadastros; guardas físicos ativos e expansão por módulos oficiais `shopee-mapping-preview.mjs` / `shopee-order-projection-preview.mjs`. A simulação não usa anúncios externos atuais.

| Conta | Mappings existentes | Pares oficiais | Reconhecidos no teste sintético | Projeção pronta | Blockers |
|---|---:|---:|---:|---:|---:|
| Adão | 371 | 364 | **364** | **364** | **0** |
| Viviane | 16 | 4 | **4** (Porto Gel) | **4** | **0** |
| Priscila | 7 | 0 | Não aplicável | Não aplicável | Identidade oficial ausente |
| Celivio | 3 | 0 | Não aplicável | Não aplicável | Identidade oficial ausente |
| **Total** | **397** | **368** | **368** | **368** | **0 entre os pares oficiais** |

Detalhe Adão (quantidade de pares oficiais por família): Du Porto 161; Trufa 40 g 34; Trufa 30 g 26; Biscoito Alfajor 24; Chocolate Base 24; Alfajor 60 g 21; Embalagem Trufa 16; Chocoim 15; Amendoim 6; Glucodry 5; Glucose de Milho 5; Italac 5; Maltodextrina 5; Porto Gel 5; demais famílias/embalagens/Sorbato/Ácido 13. Todos passaram no teste sintético Q=1 sem bloqueio de identidade/projeção. SQL independente encontrou **zero pares oficiais duplicados por conta**, e os produtos/variantes referenciados estão ativos e com unidade cadastrada. No teste Adão, 208 identidades físicas em gramas, 154 em unidades e 2 em caixas.

### Limites, exclusões e gatilhos

- **29 mappings sem Item ID/Model ID oficial**: Adão 7, Viviane 12, Priscila 7, Celivio 3. Preservar como legados ou candidatos; não promovê-los a reconhecimento oficial sem evidência de publicação e identidade correta. Um vínculo Priscila `SH-003-011|5 kg` não possui produto nem componentes e não faz parte do catálogo técnico aprovado.
- **Fora do lote técnico atual:** Ivoti 9,8 kg sem par oficial demonstrado, Porto Gel 5 kg divergente, Alfajor 108/144 histórico e BA2 não identificado/publicado. O fato de não possuir evidência oficial **não comprova despublicação**. Abrir nova frente apenas após repasse comercial com conta, Item ID, Model ID e composição autorizada.
- **P4 limitado ao nível técnico provado:** cadastro, integridade de componentes, testes sintéticos, funções de banco, Edge Function e Hub implantados conforme evidência. Nenhuma prova adicional de pedido real é exigida para encerrar **esta fase**, mas continua necessária para alegar uso real, E4/E5 completo, contabilização física ou fluxo de expedição.
- **Limites operacionais continuam:** pedido ≠ OP; criação de pedido não baixa estoque; disparo de expedição só mediante fato físico autorizado; controle de lacrados por localização; `external_shipped` P2 bloqueado sem prova apropriada; manter guardas e IAM.
- **Governança:** aplicações SQL diretas no Lovable Cloud exigem reconciliação com migrations CLI antes de reaplicações futuras; não reaplicar propostas `UNAPPLIED` por inércia. A PR documental #402 foi encerrada sem merge por conter estado antigo.
- **Resultado:** **FASE TÉCNICA DOS MAPPINGS OFICIAIS TRABALHADOS ENCERRADA**, sem declarar toda a base histórica nem o uso real como homologados. A continuidade por uso real só inicia quando houver pedido efetivo e acompanhamento operacional, em frente distinta.
