# P2 — Contrato único de embalagens originais (proposta técnica, sem migração)

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

## Engenharia transacional mínima — auditoria LIVE e proposta de revisão (04/11/2026)

**Natureza:** proposta para revisão; NÃO implementada. A PR de documentação não autoriza migration, COMMIT de mappings, deploy, escrituras de estoque, pedidos ou alteração de anúncios. Método Mestre V1.0 e Enxuto V2.2 permanecem congelados. P3 bloqueada; P4 postergada.

### Evidência do ambiente efetivamente consultado

- Fonte: projeto Lovable **PAINEL CENTRAL** `1720a410-34cd-4410-995c-8c92c7edf16b`, Cloud PostgreSQL 17.6. Consultas somente leitura aos catálogos `pg_proc`, `pg_class`, `pg_constraint`, `pg_policies` e às apresentações de produto. Sem executar funções de escrita.
- Estruturas efetivamente presentes: `maltodextrina_sealed_stock/events`, `amendoim_sealed_stock/events`, `glucodry_sealed_stock/events`, `chocolate_sealed_stock/events` e `trufa_pack_sealed_stock/events`, todas com RLS habilitada; também `inventory`, `inventory_movements` e `storage_locations`. **Não foi localizado ledger lacrado para as quatro famílias novas.** Não existe comprovação de um ledger universal pronto.
- `confirm_purchase_receipt(p_receipt_id)` é wrapper `SECURITY DEFINER` com verificação de papel; chama `confirm_purchase_receipt_unguarded_01b`. O helper unguarded não é executável diretamente por `anon` ou `authenticated` na inspeção atual. `apply_order_stock_event(p_order_id,p_event)` também é `SECURITY DEFINER` e executável por `service_role`, não pelos dois papéis anteriores. Helpers lacrados consultados usam a mesma fronteira. Auditoria de contexto do chamador/serviço permanece necessária.
- Atualmente, as duas funções possuem ramos especiais para famílias anteriores, mas **não** para Italac/Sorbato/Ácido/Ivoti. Os caminhos genéricos em `inventory` podem receber ou consumir gramas dessas famílias. A mudança deve impedir fallback genérico de **apresentações originais** somente depois de instalar as proteções e o ledger correto, em ordem transacional segura; não reclassificar histórico automaticamente.
- Os registros de `inventory` da Fábrica lidos mantêm valores legados: Italac 199975 g; Sorbato 1000 g; Ácido 3000 g; Ivoti 0 g. Isso não fornece contagens físicas de embalagens intactas. **Não converter esses valores em saldos lacrados.**
- Controles LIVE observados nos legados: PK/FK localização; `event_key` único; `CHECK` não negativo; políticas de SELECT para `authenticated`; helpers internos sem EXECUTE para `anon` e `authenticated`; uso de `FOR UPDATE` e locks transacionais nas funções consultadas. A existência de controles não prova testes de concorrência/rollback das novas famílias.

### Apresentações LIVE e decisão física

| Produto | Venda — ID e fator | Compra — ID e fator | Estado da confirmação |
| --- | --- | --- | --- |
| Italac ML2 | `b1bdfd2f-0278-4273-9e19-2544c8a3d758` caixa ×10665 g | `1a72b347-97ba-414a-9ef9-783c2d175ea3` caixa ×10665 g | Usuário: **caixa original de fabricante** com 27×395 g; não remontável |
| Italac ML1 | `008d57c4-63b6-4c30-80fd-161ca368fd66` unidade ×395 g | sem apresentação de compra individual localizada | ML1 utiliza unidades intactas; recebimento avulso requer decisão física própria |
| Sorbato | `684d4a55-5d3a-4c18-be47-818a1a3bc074` pacote ×1000 g | `c9d1d89d-366a-42c0-b691-f56bad36af7f` pacote ×1000 g | Usuário: recebe/vende embalagem original 1 kg |
| Ácido | `f093c456-f757-4efe-b575-8177b8b1d607` **kg** ×1000 g | `1c7268cd-fcd9-4d98-aa14-65f76ef72a0b` pacote ×1000 g | Usuário: recebe/vende pacote original de 1 kg; divergência do rótulo comercial ainda precisa de decisão de Produto Mestre antes de qualquer alteração |
| Ivoti | `40809f6d-687c-493b-ac4d-67a602cceba0` balde ×9800 g | `fcd94ec6-1fc6-4bab-bc6f-8436279ca737` balde ×9800 g | Usuário: recebe/vende balde original 9,8 kg |

Estas são **declarações de apresentação comercial**, não contagem física, não evidência de lacres no estoque atual nem autorização para inicializar ledger.

### Delta técnico mínimo para missão posterior

1. **Modelo físico:** preferir avaliar um ledger parametrizado por `product_id + storage_location_id + physical_state` e seu journal de eventos, em vez de mais quatro pares de tabelas; decidir somente após confronto com chaves, leitores, dashboards, eventos e migrations já implantados. Estados mínimos: Italac `originalBoxes27`, `intactUnits395`, `openGrams`; outras famílias `originalPackages1kg/originalBuckets98` e `openGrams`. Os gramas existentes continuam como ledger legado até reconciliação aprovada; não duplicá-los automaticamente em `openGrams`.
2. **Recebimento:** aproveitar wrapper autorizado de `confirm_purchase_receipt` e o helper, mas vincular por IDs exatos da apresentação de compra, produto e local ativo. Para apresentação original aprovada e quantidade inteira, creditar somente recipientes intactos; **não creditar simultaneamente `inventory.quantity` em gramas**. Preservar atomicidade da confirmação de recibo, chave idempotente `purchase_receipt:<receipt>:<item>:<local>` e retorno compatível.
3. **Abertura:** entrada específica com ator autorizado, localização e evidência física persistente; dentro de **uma única transação** debitar recipiente e creditar estado destino, conservando massa. Italac: caixa → 27 unidades intactas; unidade →395 g abertos. Outros: pacote/balde →1000/9800 g. `event_key` único, bloqueio de saldo, transação atômica, bloqueios de linha e ordenação estável; não aceitar chamada direta privilegiada sem checagem de ator.
4. **Expedição:** ampliar `apply_order_stock_event` por **IDs de apresentação comercial exatos**, impedindo que ML2 seja atendida por 27 unidades ML1 ou gramas; ML1 somente unidades intactas; Sorbato/Ácido/Ivoti somente recipientes originais. Manter `confirmed`/`cancelled` sem baixa, `shipped`/`external_shipped` sujeitos a evento físico e idempotência. **Excluir as linhas atendidas por ledger lacrado do laço genérico `inventory`**; ausência de saldo lacrado deve bloquear/abrir incidente coerente, nunca fallback para gramas.
5. **Segurança:** revisar `SECURITY DEFINER`, contexto do ator, `search_path`, grants, RLS (incluindo política de leitura) e wrappers; auxiliares sem EXECUTE público. Não ampliar direitos de `anon`/`authenticated`; distinguir chamadas `service_role` autorizadas de ações do usuário sem papel.
6. **Transição sem surpresa:** manter proteções e quarentenas #416/#418; ativar rotas **somente após**: schema testado, funções testadas, plano de rollout seguro, autorização de migration e conciliação física por local assinada por Operações. Não remover proteções existentes nem liberar P3/P4 automaticamente.

### Portões e testes exigidos, sem execução nesta etapa

- **Banco / simulação SQL em ambiente isolado:** confirmação de recibo (inclusive duplicata), abertura, expedição de cada apresentação, falha entre débito/crédito, falta de saldo, local inativo, ID de produto ou apresentação trocado, payload diferente com `event_key` igual, operações concorrentes e rollback. Separar testes de contraexemplo ML2 (27 unidades sem caixa não podem expedir caixa) e Ácido (`kg` não permite gramas soltas).
- **Preservação:** nenhum pedido em estado confirmado/cancelado baixa estoque; nenhum recibo/saída duplica gramas e recipientes; bloqueio de apresentação lacrada não autoriza fallback; histórico e saldos legados são idênticos antes/depois de ensaios revertidos.
- **Autorização:** testar em papéis reais (sem papel, operacional permitido, service role) e conferir RPCs com `pg_get_functiondef`, `pg_get_function_identity_arguments`, políticas, grants, owners, triggers e dependências antes de aprovar implementação.
- **Operações:** inventariar recipiente original/intacto/aberto por local com prova; decidir tratamento do saldo pré-existente sem inferir lacres. Produto Mestre resolve rótulo comercial Ácido `kg` versus apresentação original.
- **Gate de aprovação:** revisão técnica da proposta → missão específica para código/migration **não aplicada** → testes SQL isolados + CI → aprovação de Operações/Produto Mestre e autorização de migration distinta da autorização de COMMIT P3. **Sem homologação funcional P4 nesta fase.**

**Resultado desta seção:** delta de engenharia especificado e pronto para revisão; nenhum SQL mutante executado, nenhuma alteração de funções, inventário, mappings, pedidos, OP ou deploy.
