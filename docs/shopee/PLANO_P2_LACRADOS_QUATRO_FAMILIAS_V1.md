# P2 — Contrato único de embalagens originais (proposta técnica, sem migração)

> **ESTADO ATUAL — 05/11/2026 · MAPPINGS P3 PERSISTIDOS E QUARENTENADOS (Método Mestre V1.0 / Enxuto V2.2)**  
> Este quadro prevalece sobre checkpoints históricos mais abaixo. Não confundir código mergeado, SQL aplicado, mappings persistidos, preview e operação física.
>
> - **P1 — VERDADE: APROVADO** para as sete identidades oficiais Shopee Adão conhecidas (Italac ML1 4 Models, Italac ML2 1, Sorbato 1, Ácido 1). Ivoti segue **BLOQUEADO** para mapping por ausência de Item/Model oficial comprovado.
> - **P2 — PROTEÇÃO: APROVADO para quarentena P3**. Engenharia física candidata entregue na `main` pela PR #426 (`a70a38c9c6388b29623746812ddce8fa78f29645`), mas ainda **não implantada**. Guardas do HUB para sete Models são incondicionais no código; a **quarentena no próprio banco** foi implantada por SQL da [PR #428](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/428) (merge `45accf38eee996712c389f417fb095481f9d83be`), com triggers ativos em `order_items` e `orders` para pedidos Shopee Adão dessas quatro famílias. Teste real de tentativa de inserir Sorbato foi rejeitado, com rollback e sem alteração de pedidos.
> - **P3 — BANCO: APROVADO para os 7 mappings de identidade**. `BEGIN → INSERT 7 → COMMIT` no Lovable Cloud, com verificação independente posterior: **7 persistidos**, conta canônica correta, Item/Model oficiais, FK do Produto Mestre, multiplicadores 1185/2370/3555/4740/10665/1000/1000 g. Nenhum mapping Ivoti. Nenhum estoque ou pedido alterado. Não interpretar a quantidade em g como prova de pacotes originais.
> - **P4 — FUNCIONAMENTO: BLOQUEADO / não homologado**. A quarentena intencional impede usar os novos mappings para criar itens de pedidos Shopee Adão enquanto o roteamento físico ainda não está habilitado. Nenhum preview autenticado/digest produtivo ou E5 foi comprovado.
>
> **Fronteira de escopo:** mapeamento comercial concluído para sete identidades; ativação operacional de recipientes físicos continua fora desta entrega. A migration versionada em GitHub foi também executada diretamente no banco canônico e verificada, mas o histórico `supabase_migrations` não foi reconciliado por esta missão; conferir esse detalhe antes de executar novamente a mesma migration. Preservar histórico, outros canais, pedidos, estoque e os demais mappings. Nenhum inventário nesta missão.
>
**Projeto:** Painel Central / Shopee Adão · **Método:** Enxuto V2.2 · **Escopo:** Italac, Sorbato, Ácido Cítrico, Ivoti.

## Estado de origem (leitura LIVE, 04/11/2026)

| Família | Produto Mestre | Saldo legado em g (Fábrica) | Identidade comercial |
| --- | --- | ---: | --- |
| Italac | 0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b | 199975 | ML1: 3/6/9/12 embalagens 395 g; ML2: **caixa original** 27×395 g |
| Sorbato | 6f43ad65-74d5-4db9-b931-1ecd6d124987 | 1000 | pacote original 1 kg |
| Ácido | ef118d1c-e7c7-45e3-b796-3a9908840f3c | 3000 | pacote original 1 kg (cadastro comercial atual: «kg»; divergência pendente) |
| Ivoti | d913f0f2-4893-4985-9976-fcd9119a57b1 | 0 | balde original 9,8 kg |

Os saldos são registros do sistema; **não são prova de lacres**. Permanecem absolutamente inalterados. Não há inventário nem autorização para converter esses registros. O saldo Italac de 199975 g tampouco é múltiplo de 395 g.

## Artefato desta entrega

`services/integration-hub/src/sealed-four-families-p2-contract.mjs` é um **planner puro, sem integração com banco, API ou webhook**. Recebe snapshot *de teste* representando um futuro ledger fisicamente conferido e retorna uma proposta de transição; uma resposta `allowed: true` **não autoriza** execução em produção.

- Italac: caixa original intacta → 27 unidades intactas → 395 g abertos (etapas físicas independentes). Kits ML1 consomem unidades intactas; ML2 consome **caixa original**. É proibido recompor «caixa original» a partir de 27 unidades soltas.
- Sorbato/Ácido: pacote original → 1000 g abertos.
- Ivoti: balde original → 9800 g abertos.
- Rejeitar operação não prevista, quantidade fracionária/não inteira, falta de evidência física, saldo insuficiente, identidade/local divergente. Nunca deduzir embalagem fechada de `inventory.quantity`, preço, Seller Center ou título do anúncio.
- `verifiedSnapshot.source` é apenas um sinal **simulado** neste arquivo; não é autenticação, conferência física nem fonte confiável. **Nunca usar este planner como autorização de escrita**. Nenhum caminho produtivo o chama.

## Reuso obrigatório na engenharia posterior (sujeito à aprovação)

Consultar o código LIVE das funções `confirm_purchase_receipt_unguarded_01b` e `apply_order_stock_event` e as estruturas `maltodextrina_sealed_stock`, `maltodextrina_sealed_events`, `maltodextrina_move_sealed_internal`, além das equivalentes para Amendoim/Glucodry/Chocolate/Trufa. Reutilizar os princípios: FK localização, RLS/REVOKE, entradas autenticadas por papel, evento único idempotente, locks de transação, saldos inteiros não negativos, recibos/expedições atômicos e trilha de auditoria.

**Ponto de decisão arquitetural:** aproveitar os padrões da fundação existente, mas não copiar sem revisão, nem criar tabelas por produto antes de avaliar modelo canônico parametrizado e compatibilidade com operações já implantadas. Se um ledger unificado for adotado, ele deve distinguir identidade do recipiente original e unidade física, sem permitir `caixa ML2` ser suprida de unidades ML1.

### Portões de homologação (não executados)

1. Produto Mestre e Operações validam as identidades físicas, especialmente ML2 «original lacrado» e Ácido «pacote» versus cadastro `kg`.
2. Inventário físico futuro identifica por local as embalagens realmente intactas (não é pré-condição para projetar e testar código isolado, mas é pré-condição para afirmar quantidades reais ou migrá-las).
3. Banco/Integração definem controle canônico e revisão de funções/GRANTs/RLS, e preparam migration **não aplicada**, com rollback e testes PostgreSQL.
4. Ensaios transacionais em ambiente seguro: recebimento original, abertura, expedição, concorrência, repetição de `event_key`, falta de saldo, permissões, localização, saldo legado intacto e diferença ML1/ML2.
5. Autorização específica de migration, separada da autorização de COMMIT P3 de mappings. **P4 permanece postergada.**

## Fora do escopo desta entrega

Sem migration, deploy, tabela, RPC, processamento de pedidos, movimentação de estoque, ajuste de 199975/1000/3000/0 g, escrita de mapping, liberação das quarentenas P2 existentes ou validação P4. Não reabrir a Rodada 1 V16 já concluída (26/27).

## Checkpoint por diferença — 05/11/2026 (P2, sem escrita LIVE)

**Método aplicável:** Mestre V1.0 > Enxuto V2.2 congelado. Este registro atualiza apenas a evidência/pendência material das quatro famílias, sem nova matriz, taxonomia ou frente técnica. Fonte: leitura SQL **somente leitura** no Lovable Cloud PAINEL CENTRAL em 05/11/2026; CI GitHub PR #426; decisões físicas do responsável. Nenhuma fonte Shopee oficial nova foi consultada nesta rodada; não reabrir P1 já conciliado.

| Portão | Estado canônico | Diferença objetiva / limite |
| --- | --- | --- |
| P1 VERDADE | APROVADO no recorte físico declarado | Italac ML2 = caixa original 27×395 g; ML1 = unidades intactas; Sorbato/Ácido pacote original 1 kg; Ivoti balde original 9,8 kg. Essa declaração não é contagem real de lacres. Identidades Shopee/Item/Model não foram reconsultadas, logo nenhum E5 reivindicado. |
| P2 PROTEÇÃO | APROVADO apenas como **proposta isolada testada**; implantação BLOQUEADA | CI do PostgreSQL sintético validou transições, papel direto negado, rollback, concorrência, pedido misto e regras LIVE selecionadas de identidade física. PR #426 é draft e propostas SQL continuam fora de migrations. Não há serviço ativo nem prova completa do esquema LIVE. |
| P3 BANCO | BLOQUEADO | Falta inventário físico assinado por localização, política de legado, integração revisada do caminho real de separação, regressão completa e autorização de escrita própria do portão. Não inferir embalagem a partir de gramas. |
| P4 FUNCIONAMENTO | NÃO APLICÁVEL nesta missão | Sem preview autenticado do projetor sobre amostra real íntegra e sem execução de pedido físico real; não declarar E5. |

**Achado de integração obrigatório e suficiente para este escopo:** existe `public.finalize_order_separation(p_order_id)` (wrapper operacional com controle de papel) → `public.finalize_order_separation_unguarded_01b` → `public.apply_order_stock_event(p_order_id,'shipped')`. O helper faz esse evento **antes** de atualizar `order_separation.separation_status='finalized'`, em uma única transação. A própria `order_separation` preserva `finalized_at/finalized_by`. Consequência: as propostas de P2 devem respeitar **esse fluxo existente**, sem criar finalização paralela ou exigir `finalized` antes do próprio evento. A string candidata `physical_shipment:<id>` **não é evidência autenticada** da separação e não pode substituir validação de ator/fato físico. O caminho `external_shipped`, quando aplicável, demanda uma prova correspondente do fluxo existente; não presumir que tenha usado `finalize_order_separation`.

**Integridade LIVE conferida no recorte:** `inventory` usa `UNIQUE NULLS NOT DISTINCT(product_id,variant_id,location)`; triggers `assert_operational_physical_identity` e `assert_variant_matches_product` protegem `inventory` e `inventory_movements`; `purchase_receipts` tem guarda de confirmação e bloqueio de reversão após confirmado. O teste descartável da PR #426 espelha somente controles selecionados, não o esquema integral. Resultado da CI mais recente aprovada na inspeção: https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/42036521708.

**Uma próxima ação (gatilho real):** Operações fornecer um snapshot físico por local e comprovar qual evento de separação/expedição representa o fato físico nas quatro famílias. Depois disso, reabrir **apenas P3** para confrontar o adapter com `finalize_order_separation` e `external_shipped`, ensaiar regressão estritamente afetada e submeter autorização separada para migration. Não expandir para famílias antigas não afetadas, outros módulos, Shopee, OP, estoque legado, P4 ou E5.

**Sem escrita no banco, merge, deploy, alteração Shopee, mappings ou estoque.** Método congelado inalterado.

### Diferença LIVE de localização e inventário — 05/11/2026

Consulta `SELECT` realizada no Cloud ativo do projeto PAINEL CENTRAL, **sem escrita**. Escopo estrito: Italac, Sorbato, Ácido Cítrico, Ivoti.

| Produto | `inventory.location` | `inventory.location_id` | `inventory.quantity` | Inferência permitida |
| --- | --- | --- | ---: | --- |
| Italac | Fábrica | `b1ef7322-86f9-4cf4-9d52-39ba32911ef6` | 199975 g | Apenas saldo legado; caixas e unidades intactas não comprovadas |
| Sorbato | Fábrica | **NULL** | 1000 g | Apenas saldo legado; pacotes originais não comprovados |
| Ácido Cítrico | Fábrica | **NULL** | 3000 g | Apenas saldo legado; pacotes originais não comprovados |
| Ivoti | Fábrica | `b1ef7322-86f9-4cf4-9d52-39ba32911ef6` | 0 g | Ausência de gramas registradas não prova ausência de balde físico |

A localização Fábrica está ativa; CD01 e CD02 também estão ativas; C3 está inativa. Nenhum dos quatro produtos possui ledger de recipientes lacrados no LIVE. A leitura não é conferência física e não autoriza distribuição de saldo por locais. **Bloqueio pontual P3:** Sorbato e Ácido exigem conciliação explícita entre texto `Fábrica` e FK `location_id` antes de qualquer roteiro de abertura/recebimento/cutover, sem preencher `location_id` automaticamente e sem converter os saldos em pacotes.

**Fato operacional existente:** `operational_incidents` inclui três incidentes abertos de `material_shortage` do Ivoti associados a `production_fact_consumption` (24 resolvidos). Não inferir disso saldo disponível, quantidade de baldes nem proposta de correção no escopo Mappings. Apenas preservar a pendência para Operações se afetar a conciliação física do Ivoti.

**Portão único a executar fora do sistema:** responsável de Operações contar e atestar por localização os recipientes **originais fechados**, as unidades **intactas** Italac e eventual material **aberto**. Distinguir a evidência física dos saldos legados. Até esse atestado, P3 segue bloqueado, P4 postergado e não há autorização de merge/migration/cutover. Não criar nova frente nem pesquisar outras famílias.

## Prioridade executiva — 05/11/2026: concluir engenharia antes do inventário

**Decisão expressa do responsável:** a contagem física e a regularização/conciliação dos saldos atuais serão realizadas **logo após** a conclusão da engenharia P2. Portanto, não bloquear conclusão do código, revisão, testes, merge da proposta de código inerte ou preparação da implantação por ausência de inventário. Não investigar ou corrigir nesta missão os saldos históricos, inclusive `location_id` nulo de Sorbato/Ácido; essa divergência é entregue para o inventário posterior.

**Distinção indispensável:** inventário não é pré-condição para **encerrar a engenharia**; continua obrigatório antes de **inicializar saldos físicos ou habilitar movimentação operacional da nova estrutura**. Concluir não significa inventar disponibilidade, emitir COMMIT de mappings, aplicar SQL em produção ou liberar P4.

**Rota enxuta de encerramento:** (1) validar scripts candidatos e integração nas duas RPCs canônicas com CI descartável e regressões de recibo/separação; (2) fechar revisão de segurança/atomicidade, sem nova investigação abrangente; (3) entregar PR pronta tecnicamente para revisão/merge seguro, deixando qualquer ativação operacional bloqueada; (4) executar inventário logo após; (5) obter autorização separada para migration/cutover e movimentações. As etapas 4–5 não impedem classificar a engenharia como concluída.

**Não reabrir a frente de levantamento de saldos nesta etapa.** A última leitura LIVE foi apenas informativa, não autoriza inferir número de embalagens.

## Fechamento da revisão técnica isolada — 05/11/2026

**Situação:** engenharia candidata e regressões isoladas para P2 concluídas **no escopo de preparação**, sem ativação produtiva, sem inventário antecipado e sem reabertura de famílias anteriores. A PR #426 continua como draft de revisão, com SQL apenas em `supabase/proposals`.

**Evidência nova:** o helper LIVE `finalize_order_separation_unguarded_01b` foi reproduzido em fixture descartável e exercitado com a proposta P2 de `apply_order_stock_event`. O teste comprovou finalização de pedido misto (Sorbato original + item não P2), registro conjunto do estado finalizado/baixa, replay sem dupla baixa e rejeição de pedido cancelado, além das outras regressões sintéticas de P2, isolamento, triggers, papéis e concorrência. CI: https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/42041070770.

**Decisão de encerramento:** não criar fluxo paralelo de separação, outro ledger por família, nova frente de saldos ou novos procedimentos de Shopee. A engenharia pode ser considerada *preparada e testada isoladamente*. Isso **não equivale à homologação de produção**.

**Controles que permanecem obrigatórios para a ativação posterior, não para concluir a engenharia:** inventário e saldos iniciais conferidos após o trabalho; revisão da evidência física autenticada e dos privilégios no ponto de entrada real; teste no esquema de homologação completo com regressão dos legados afetados; autorização separada de migration/cutover. Os parâmetros textuais `physical_shipment` e `purchase_receipt_confirmed` da proposta NÃO autenticam um fato físico e NÃO devem ser usados como critério único para ativar operações. P3 produtivo bloqueado, P4 postergado. Não fazer merge/deploy automático.
