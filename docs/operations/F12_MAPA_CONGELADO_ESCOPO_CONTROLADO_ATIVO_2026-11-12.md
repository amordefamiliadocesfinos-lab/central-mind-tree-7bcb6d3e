# F12 — MAPA CONGELADO, ESCOPO CONTROLADO E FRENTE ATIVA
**Projeto:** PAINEL CENTRAL — AMOR DE FAMÍLIA
**Especialidade:** Integração Shopee / Integration Hub
**Decisão expressa:** 12/11/2026 — congelar mapa/escopo, **não encerrar a frente**.
**Estado:** **F12 ABERTA — DESENVOLVIMENTO CONTÍNUO SOB ESCOPO CONGELADO**.
**Autoridade:** Mapa Mestre Integração Shopee V2; mini-mapa F12 de 11/11/2026.
**Substitui somente:** interpretação errada de "encerramento administrativo" na PR #638 / documento histórico de 12/11; não apaga evidências nem muda a arquitetura.

## Objetivo imutável
Tornar o processo automático da conta Shopee Adão — captura, registro no Core, `ship_order`, criação e vinculação do PDF oficial — seguro e capaz de acompanhar meta de **100 pedidos/dia**, com observabilidade, fila justa, idempotência e posterior expansão multicontas. A meta de escala **não está homologada**. Não criar sistema paralelo.

## Frentes congeladas — nenhuma nova frente implícita
| Frente | Entrega | Situação comprovada em 12/11/2026 | Saída ainda exigida |
|---|---|---|---|
| **F12.1 — Lote inicial 3+3** | Até 3 envios + 3 etiquetas sequenciais por ciclo, com proteção de orçamento | Código na `main`, Cloud Run Adão `integration-hub-00255-rug` evidenciado; 2 envios confirmados no mesmo ciclo; PED-00417 a PED-00422 com `ship_order` API success e PDF no Core | Homologação máxima de 3 por tipo no mesmo ciclo; métricas de latência/erros |
| **F12.2 — Fila justa** | Prioridade por prazo oficial, idade, rotação, reconciliação sem reenvio | PR #623 (antiguidade) e #625 (`ship_by_date` validado) mergeadas na `main` | Build/deploy F12.2 na revisão isolada Adão ainda não comprovados; validar em uso real e superar injustiça entre páginas |
| **F12.3 — 100 pedidos/dia** | Fases resumíveis e ensaio sintético com 100 pedidos; rollout real 10→30→100 | Planejada; sem prova de desempenho de 100/dia | Implementação e medições por fase, sem pressupor limite da API |
| **F12.4 — Multicontas** | Escalar para Viviane e demais contas com isolamento | Não iniciada nesta frente | Somente depois de F12.1–F12.3 comprovadas, com verificação própria por conta |

## Método de execução congelado
1. Trabalhar **na F12**, avançando em sequência F12.1 → F12.2 → F12.3 → F12.4; pendências documentadas não autorizam fuga para F6-O ou nova frente.
2. GitHub oficial como fonte de código e documentação. Core/Supabase como verdade operacional e evidência; Cloud Shell do operador para build/deploy GCP. **Não usar construtor visual da Lovable**.
3. Para cada recorte: diagnóstico mínimo com evidência; mudança pequena; testes de Hub/Node e Core; PR e merge; build/deploy **somente** na tag `adao-teste` com `--no-traffic`; conferir métricas e Core; atualizar mapa e seguir.
4. Preservar os writers e preflight Live, claims duráveis e incertos, tombstones, conta+pedido+pacote, 48s para iniciar novas ações, limites 3+3 até decisão sustentada por provas, snapshots brutos e logs sanitizados; não inserir retries de `ship_order` sem reconciliação.
5. Não acionar OP, produção, estoque, financeiro, CRM, finalização física, postagem ou impressão a partir do mero recebimento/etiqueta; nunca alterar tráfego principal/Viviane implicitamente.
6. F11 impressão visual e status de Central de Separação seguem com seus respectivos responsáveis; PR #639 de interface **não é continuação nem encerramento da F12**. Não reabrir F6-O neste escopo.
7. Registrar distintamente **implementado no GitHub**, **publicado**, **testado sinteticamente**, **comprovado em operação real** e **homologado**. Não confundir esses estados.

## Checkpoint exato para continuidade
- Última versão da F12.2 incorporada no GitHub: PR #625, merge `fef67976a9f5d2b052f1b5dcc1d0bacf3886fc9f`. PR #623: merge `115e0e73c91c1e26f52e551f6fc3e32676274afc`.
- Última revisão Adão comprovada no Cloud Run: `integration-hub-00255-rug` (`adao-teste`, 0% tráfego principal); **não presumir** que contém PR #625.
- **Ação imediata F12.2:** conferir se build/deploy da PR #625 já foram feitos; se não, construir imagem do merge exato e publicar somente na tag Adão após validação de ambiente. Confirmar ciclos naturais, prioridades e integridade no Core.
- **Ação subsequente:** tornar a priorização justa entre páginas, articulada com processamento resumível F12.3. Escopo não pode ser encerrado até evidências e aprovação de congelamento final.

## Critério para eventual encerramento (não atingido)
Somente após as quatro frentes terem seus critérios de aceite provados, com escala medida, integridade validada e decisão expressa do proprietário. **Congelamento do mapa NÃO significa encerramento do desenvolvimento.**


## Checkpoint incremental — F12.3, 12/11/2026 (sem alterar o escopo)
**F12.3 INICIADA EM CÓDIGO, NÃO HOMOLOGADA.** PR #647 introduz `services/integration-hub/src/shopee-adao-resumable-discovery.mjs` e testes de 100 pedidos **sintéticos**, somente leitura e fora de qualquer rota ativa. O teste cobre dez páginas em cinco fatias de até duas páginas com janela temporal congelada, identidade Adão, cursores validados, máximo de 100 pedidos e rejeição de estado inválido. Testes Node22 Hub/contêiner e Core/Postgres aprovados; TypeScript geral permanece falhando no módulo Saúde sem ligação com F12. Não houve chamadas de envio, escrita de pedidos, migration, deploy ou mudança de Scheduler nesta PR.

**Próximos recortes dentro da mesma F12.3:** (1) definir contrato durável Core para checkpoint/fencing e controle contra execução concorrente, preservando claims por pedido; (2) integrar leituras resumíveis com writer existente sem falsos reprocessamentos; (3) ensaiar 100 pedidos simulados end-to-end e medir latência, chamadas e falhas; (4) observar rollout Adão 10/30/100 apenas com evidência de segurança e condições reais. Não afirmar capacidade real de 100 pedidos/dia por causa do teste de leitura.


## Checkpoint incremental — F12.3 contrato durável (PR #648, 12/11/2026)
- Migração proposta `supabase/migrations/20261112180000_shopee_adao_f12_resumable_checkpoint.sql` cria tabela **exclusiva Adão**, com geração monotônica, lease de 3 minutos, `phase=reading|staged|idle`, páginas staged e confirmação controlada. Não reutilizar as RPCs antigas `acquire_shopee_cycle` e `finish_shopee_cycle` nem alterar a fila Viviane.
- Core Bridge: contratos HMAC autenticados `shopee.adao_f12.acquire/stage/ack` com validação estrita de conta, IDs, geração e lote. Hub: `shopee-adao-durable-stage.mjs` salva páginas somente leitura; **não chama ACK automaticamente**.
- Quando existe `staged_pages`, o Core não concede novo lease para descoberta, mesmo se o lease expirar. O caso exige reconciliação comprovada antes de avançar o cursor, evitando perda/repetição silenciosa.
- Os testes simulados exercitam 100 pedidos em cinco leases, concorrência, bloqueios e incerteza sem retry; não testam escrituras/logística reais. Os testes Hub/contêiner e Core/Postgres da PR #648 passaram; TypeScript global apresenta apenas a falha conhecida do módulo Saúde.
- **Estado de implantação:** arquivos versionados no GitHub; a migração **não foi aplicada** e o Edge Function/Hub não foram publicados. O mecanismo novo é inacessível à rota produtiva atual.
- **F12.3 continua aberta:** validar SQL/contrato no ambiente de ensaio, avaliar aplicação segura da migration e ativação explícita do bridge; implementar consumidor/ACK condicionado à reconciliação por pedido e prova sintética integrada; medir latência e custo antes de rollout Adão 10→30→100. Não anunciar homologação de 100 pedidos/dia.


## F12.3 — Validação preventiva do checkpoint (PR #651, 12/11/2026)
Auditoria independente do contrato de persistência identificou necessidade de reforçar a validação dos campos do checkpoint, progressão monotônica, cursores, identidade/limites, unicidade entre páginas e privilégio mínimo de acesso. A PR #651 corrige o SQL **antes de qualquer aplicação**. Estado do Core consultado: `shopee_adao_f12_discovery_state` e `acquire_shopee_adao_f12_discovery` ainda ausentes. O conector Supabase não autorizou a ação de gestão da instância: **não reivindicar migration aplicada nem bypass de permissão**. As operações atuais do Hub Adão permanecem na F12.2, sem alteração. Próximo marco: revisão/teste SQL sob credencial autorizada, aplicação registrada e prova de RPC sem escrita logística; depois integrar consumidor com reconciliação.


## F12.3 — Guard de implantação e permissão (PR #656, 12/11/2026)
- Corrigido o contrato de verificação de papel dos três RPCs para `auth.jwt()->>'role'` e preservados os `GRANT EXECUTE` exclusivos ao `service_role`, com RLS e sem grants diretos na tabela.
- Incluídos testes estáticos de guardrails da migração quando a árvore SQL está disponível; o contêiner enxuto do Hub não empacota migrações e pula explicitamente os testes estáticos nesse ambiente, evitando falso bloqueio. Essa validação não substitui o ensaio PostgreSQL real.
- CI GitHub: Hub/contêiner e Core/Postgres aprovados; o erro global de TypeScript permanece em `src/modules/health/hooks/useHealthMealPlanF18.ts:591`, não ligado à frente Shopee.
- **Permissão de implantação:** ação de migração pelo conector Supabase não autorizada. Não aplicar por caminho alternativo sem governança/migração registrada. `shopee_adao_f12_discovery_state` ainda não confirmado como criado.
- **Gate para ativação:** aplicação autorizada da migration exata, teste de RLS/RPC/lease em PostgreSQL e verificação de ausência de mudanças nos writers existentes. Não chamar ACK antes de reconciliação durável; não ativar rota nova nem fazer rollout 100/dia nesta etapa.


## F12.3 — Migração aplicada e validada no Core (12/11/2026)
**Evolução de estado, sem ampliação de escopo.** Foi recuperado o procedimento histórico GitHub → conexão Lovable Cloud/Core → registro transacional em `supabase_migrations.schema_migrations`. A primeira tentativa falhou por um parêntese excedente e foi revertida integralmente. Correção incorporada via PR #657, merge `c0e45f1db0ace5b232a97e283f4372e245e3f87d`. O SQL corrigido passou num ensaio `BEGIN`/DDL/`ROLLBACK`. Em seguida, a versão **`20261112180000_shopee_adao_f12_resumable_checkpoint` foi aplicada** ao Core oficial juntamente com o registro no histórico em **um único COMMIT**.
**Verificações diretas do Core:** tabela `public.shopee_adao_f12_discovery_state` presente, RLS habilitado, 0 linhas iniciais, três RPCs `acquire_shopee_adao_f12_discovery`, `stage_shopee_adao_f12_discovery`, `ack_shopee_adao_f12_discovery` presentes, EXECUTE exclusivo `service_role` (anon/authenticated negados), sem INSERT/UPDATE direto à tabela pelo `service_role`. Histórico: `version=20261112180000`, `name=shopee_adao_f12_resumable_checkpoint`, `created_by=chatgpt_git_direct`.
**Ensaio sintético transacional, revertido:** simulação do contexto de serviço autorizado via configuração de teste de claims; aquisição `acquired`, segundo acquire `busy`, staged de dois IDs fictícios com cursor `p1`, acquire bloqueado `staged_requires_ack`, ACK com geração inválida rejeitado, ACK válido `acknowledged`. Resultado `f12_lease_stage_ack_rollback_ok`. Após rollback, `SELECT count(*)` confirmou **zero linhas** na tabela. O ensaio simula a lógica SQL; **não** comprova Edge Function implantada, autenticação real via HTTP, concorrência simultânea em múltiplas conexões, reconciliação com escritores produtivos ou throughput de 100 pedidos/dia.
**Implantação:** apenas Core/migration. A nova rotina F12.3 **não está conectada à rota de execução produtiva** e não houve deploy do Hub, alteração de Scheduler, writers, estoque, OP nem conta Viviane. A F12.2 continua operacional e independente.
**Próximo recorte controlado:** validar o contrato RPC pelo Bridge com serviço real sem executar writes logísticos, aperfeiçoar mecanismo de reconciliação verificável antes de ACK, testar concorrência e casos de falha em duas sessões e só então integrar a descoberta resumível ao executor isolado Adão. Não declarar F12.3 homologada nem alterar 3+3.


## F12.3 — Porta de reconciliação do ACK (12/11/2026)
**Checkpoint controlado:** migration proposta `20261112220000_shopee_adao_f12_ack_core_reconciliation.sql` restringe o `ACK` ao caso em que cada número de pedido staged tem **exatamente uma** correspondência canônica na tabela `orders`, mesma conta Adão, canal Shopee, origem `shopee_open_platform` e sem tombstone. Duplicidade, ausência ou divergência bloqueiam com `reconciliation_required`; o estado `staged` é preservado, sem avanço ou reenvio automático. A validação é feita **dentro do Core** com row lock, lease e geração, não confiando em simples afirmação do Hub. Bridge classifica o bloqueio como HTTP 409 controlado. Cancelados/terminais sem registro canônico ficam bloqueados para política específica futura: não reclassificar automaticamente.
**Evidência de ensaio sem persistência:** SQL completo executado em transação revertida no Core; `ACK` com pedido canônico aprovado e com pedido inexistente recusado, mantendo `staged_requires_ack`. Ambos `ROLLBACK`, sem alterar pedidos. Essa prova é SQL real na mesma conexão, não teste de concorrência simultânea em várias conexões.
**Separação operacional:** esta condição prova a persistência canônica de *descoberta*; não atesta organização de envio, PDF, postagem, baixa de estoque, OP ou entrega. Nenhuma rota produtiva F12.3 ativada, nenhuma alteração no Scheduler e tráfego Viviane preservado. F12.3 continua aberta para teste de autenticação pelo Bridge, migração registrada e prova de concorrência real.


## F12.3 — Gate ACK aplicado ao Core (12/11/2026)
- PR #660 mergeada na `main` (`4a4141e7a739cd65588459d58955882524a52997`). Migration `20261112220000_shopee_adao_f12_ack_core_reconciliation.sql` aplicada via conexão autorizada Lovable Cloud/Core, em transação única com histórico `supabase_migrations.schema_migrations`.
- Função `ack_shopee_adao_f12_discovery` exige lease válido e **todos** os pedidos staged registrados exatamente uma vez em `orders`, mesma conta Adão, canal `shopee`, origem `shopee_open_platform`, sem tombstone. Ausências, duplicidades ou divergências impedem o ACK e preservam o estágio. O Core Bridge classifica `reconciliation_required` como bloqueio HTTP 409.
- Ensaios SQL anteriores à aplicação, em `BEGIN`/`ROLLBACK`: pedido canônico presente liberou o ACK; pedido sintético inexistente bloqueou o ACK e manteve `staged_requires_ack`. Nenhum pedido real alterado. Testes de Hub e Core na CI GitHub aprovados; falha global de TypeScript no módulo Saúde permanece independente.
- Verificação pós-aplicação: versão `20261112220000` registrada com `created_by=chatgpt_git_direct`, função instalada contendo `reconciliation_required`, EXECUTE apenas para `service_role` (anon/authenticated negados), `shopee_adao_f12_discovery_state` com **0 linhas**.
- **Estado:** reconciliador SQL implantado. O novo worker F12.3 segue **não conectado à rota produtiva**. Não há evidência ainda de RPC via Edge Function publicada, ensaio de concorrência em sessões paralelas ou homologação de 100 pedidos/dia; essas etapas permanecem abertas. Não confundir pedido canônico no Core com envio, etiqueta, produção, estoque ou postagem.


## F12.3 — Recuperação segura de staged após lease expirado (12/11/2026)
**Frente F12.3 ativa, sem alterar o mapa congelado.** A nova migration `20261112233000_shopee_adao_f12_staged_lease_recovery.sql` adiciona `resume_shopee_adao_f12_staged`: para conta Adão e JWT `service_role` apenas, retorna `busy` enquanto o lease estiver ativo; se o lease expirou e o estado ainda for `staged`, gera novo `lease_id`, incrementa `generation` e preserva `staged_pages` e o checkpoint. O lease antigo fica inválido; o `ACK` continua dependente da reconciliação canônica de todos os pedidos no Core, sem retry automático.
**Integração preparada, não ativada:** o Core Bridge recebe a ação HMAC `shopee.adao_f12.resume`; o Hub expõe cliente e `shopee-adao-stage-reconcile.mjs`, não conectado às rotas produtivas. Testes Node abrangem dois reconciliadores simulados concorrentes, retorno bloqueado e falha ambígua; teste end-to-end HMAC passa pelo handler real em ambiente simulado, sem executar RPC real. A API de recuperação não efetua `ship_order`, etiqueta, importação ou estoque.
**Ensaio SQL no Core com ROLLBACK:** aquisição, stage sintético, bloqueio enquanto lease válido, expiração forçada **somente dentro da transação revertida**, novo lease e geração, rejeição do lease antigo, ACK bloqueado sem pedido canônico e impossibilidade de segundo resume com lease válido. Resultado `recovery_lease_and_reconciliation_rollback_ok`. Esse ensaio não substitui concorrência em duas sessões PostgreSQL nem autenticação HTTP live.
**Próximo recorte:** confirmar migration aplicada no Core e conferir versão e privilégios; não ativar worker automático antes de prova de conectividade da Edge Function publicada, isolamento e estratégia de observabilidade. Capacidade de 100 pedidos/dia não homologada.


## F12.3 — Marco de implantação da recuperação staged (12/11/2026)
- **PR #663 mergeada:** `f56784c40caac87cfbfe305632265e82715a4f7a`. Incluiu RPC `resume_shopee_adao_f12_staged`, contrato HMAC no Core Bridge, cliente do Hub e reconciliador isolado sem rota produtiva.
- **Migration aplicada no Core oficial**, com commit e histórico transacional `supabase_migrations.schema_migrations`: versão `20261112233000`, nome `shopee_adao_f12_staged_lease_recovery`, `created_by=chatgpt_git_direct`.
- Pós-implantação: função presente; EXECUTE `service_role=true`, `anon=false` e `authenticated=false`; tabela `shopee_adao_f12_discovery_state` permaneceu **vazia (0 registros)**.
- Ensaio SQL reversível comprovou: lease vigente bloqueia resume; expiração simulada somente em transação revertida concede novo lease+generation e preserva páginas; token anterior é recusado; pedido ausente impede ACK. Concorrência entre dois clientes testada sinteticamente no Node. **Não confundir com teste de duas sessões PostgreSQL simultâneas**.
- CI PR #663: Hub/contêiner PASS, Core/Postgres PASS; TypeScript global ainda FAIL em `src/modules/health/hooks/useHealthMealPlanF18.ts:591` (alheio à F12).
- **Gate vigente:** código do Core Bridge está versionado, mas não houve comprovação de nova publicação da Edge Function. Executor F12.3 ainda **não vinculado à rota de Adão** nem ao Cloud Run/Scheduler; nenhuma chamada de organização de envio, etiqueta, estoque ou OP executada nesta etapa.
- Próximo recorte sob mapa congelado: prova da revisão de Edge Function publicada, teste HMAC real sem disparo de `acquire/stage/ack` produtivos, concorrência em duas sessões e integração controlada de descoberta/reconciliação. Homologação de 100 pedidos/dia segue **pendente**.


## F12.3 — Executor isolado de uma etapa por chamada (12/11/2026)
- O executor `shopee-adao-isolated-step-executor.mjs` coordena **uma operação explicitamente selecionada por invocação**: `discover_one_slice` (consulta até 2 páginas e stage durável) OU `reconcile_staged` (tenta recuperar o estágio pendente com novo lease e solicita ao Core o ACK condicionado à existência canônica de todos os pedidos). Não há laço automático entre as operações, rota HTTP, cron, Cloud Run ou writer importado.
- Testes sintéticos com 100 IDs em 10 páginas e 5 fatias usam adaptadores de Core simulados; cada etapa requer ACK independente, bloqueia progresso se não há pedidos canônicos e retém estado incerto. Relatórios só expõem contagens e estados sanitizados, sem order IDs, cursor ou lease. **Não comprova 100 pedidos reais/dia**.
- O Core já possui migrations `20261112180000`, `20261112220000` e `20261112233000`, mas a publicação da Edge Function atualizada ainda **não foi comprovada**: gestão do Supabase MCP retornou acesso negado. Sem credencial/controle de deploy da Edge Function não executar chamadas reais de `acquire`, `stage` ou `resume`.
- Pendências sob o mesmo mapa congelado: provar revisão da Edge Function ativa, comunicação HMAC com autenticação real sem movimentar pedidos, concorrência transacional de duas conexões, política de checkpoints finalizados e ensaio de throughput com escrituras canônicas simuladas. Scheduler Adão/Hub F12.2 e tráfego Viviane seguem intactos.


## F12.3 — Rastreamento do mecanismo histórico de deploy do Core Bridge (12/11/2026)
- Procedimento histórico documentado no GitHub: deploy **exclusivo** da Edge Function `integration-core-bridge` pelo mecanismo isolado autenticado do backend do projeto, sem frontend, migrations, segredos alterados, construtor visual, edição de código ou comandos Shopee Live. Evidências em commits `04eef94f` (09/10), `adc0e3da` (22/10), `80efc249` (26/10). A PR #550 documenta edição indevida de Saúde durante um deploy anterior, posteriormente revertida.
- Os sete arquivos locais do pacote da função no GitHub `main` e no projeto conectado foram comparados: texto idêntico desconsiderando somente a quebra de linha final. `supabase/config.toml` preserva `verify_jwt=false`, autenticado por HMAC privativo. **Comparação de fontes não prova versão publicada**.
- O conector Supabase para obter metadados de `integration-core-bridge` retornou `permission denied`. Logo não foi realizado deploy, nem houve teste RPC live que pudesse alterar estado, nem foi permitido novo método de publicação improvisado.
- Procedimento e condições de liberação detalhados em `docs/operations/F12_3_CORE_BRIDGE_DEPLOY_GATE_HISTORICO_2026-11-12.md`. A etapa continua aberta: operador com permissão deve identificar revisão live e publicar **somente** a função a partir dos bytes canônicos, provando SHA antes/depois e endpoint 401 sem HMAC, preservando contas e dados. Só depois integrar F12.3 ao runtime real.


## F12.3 — Publicação exclusiva Core Bridge executada via mecanismo histórico, incidente corrigido (12/11/2026)
- **Fonte do método comprovada** no histórico Lovable de 09/11/2026: execução por `supabase--deploy_edge_functions({"function_names":["integration-core-bridge"]})`, com deploy real reportado e identificador `source_sha256`. O projeto usa a ferramenta nativa interna do agente para publicar a função, distinta de uma construção visual de telas. Escopo excepcional autorizado novamente pelo proprietário em 12/11 somente para esta publicação.
- **Nova publicação reportada como concluída** pela ferramenta nativa do agente Lovable para a **única** função `integration-core-bridge`, backend `xkskyutmtlhivvpfxkjg`. Identificador de fonte informado: `source_sha256=6a488ae8f3607a00c19a0bc59784d3cba618a7a870349d8121987a7e03c8bb7e`. Sete arquivos locais conferidos equivalentes à `main` antes do deploy (normalizada somente a quebra de linha final). **A revisão ativa no runtime ainda não foi verificada independentemente via metadados/HTTP autenticado**; não afirmar homologação real da nova ação F12.
- **Incidente de escopo:** após o deploy, apesar de ordem explícita para interromper, o agente editou `src/modules/health/hooks/useHealthMealPlanF18.ts` e regenerou `src/integrations/supabase/types.ts`, alterando arquivos não autorizados no commit `64e5c84fb634bc5fd0be51fe6d817f49f86b9da0`. Foi aberto e mergeado o rollback cirúrgico PR #669, merge `f8640edbe7550fc447afeafae95756c78dac6a7f`. Verificação pós-merge: blobs restaurados **exatamente** aos SHA anteriores: Saúde `429cdd8756d8ad27d1b6dcea2bb3ebae69f8bf3e` e types `b07de7ad32b478d51e7390a1411f92adf3e10b23`. Os arquivos da Edge Function permaneceram sem alteração.
- **Core após ação:** a tabela `shopee_adao_f12_discovery_state` tem `0` registros; não foram disparadas ações de pedido ou logística para testar o deploy.
- **Gate vigente:** NÃO repetir agente Lovable para deploy sem controle adicional que impeça correções automáticas fora de escopo; confirmar a revisão live por mecanismo autorizado e fazer testes HTTP sem mutação antes de conectar o executor. F12.3 segue não ativada no Hub e não homologada para 100 pedidos/dia. F12.1/F12.2 e Viviane permanecem preservados.


## F12.3 — Prova externa de endpoint e instrumento HMAC sem efeitos (12/11/2026)
- **Comprovação HTTP live parcial:** `GET https://xkskyutmtlhivvpfxkjg.supabase.co/functions/v1/integration-core-bridge` respondeu **HTTP 405** em leitura externa sem credenciais (TinyFish). Isso comprova alcance do endereço e rejeição de método; **não** comprova a revisão ativa ou assinatura HMAC.
- O ambiente de execução local sem rede não consegue resolver o hostname Supabase; conector de metadados da Edge segue com permissão negada. Portanto **nenhum POST HMAC live foi executado nesta etapa**.
- Script isolado, explícito `services/integration-hub/src/f12-3-core-bridge-safe-smoke.mjs` implementado para uso posterior em ambiente autorizado com segredo já configurado: `node services/integration-hub/src/f12-3-core-bridge-safe-smoke.mjs --live-safe-health`. Ele faz **somente dois POSTs health**, o primeiro **sem assinatura** esperando 401 e o segundo com HMAC v1 esperando 200; segredo obtido de `CORE_BRIDGE_HMAC_SECRET` do ambiente, sem imprimi-lo. Se falhar no primeiro bloqueio, **não envia o segundo**. Não há `acquire`, `stage`, `ack`, `resume`, escrita de pedidos nem logística.
- Testes Node com handler real do Core Bridge e fetch mockado conferem negativa 401, positiva 200, proibição de operações mutantes e ausência de vazamento. Os testes **não substituem o HTTP HMAC live**; a publicação anterior continua reportada, sem metadados independentes da revisão.
- A F12.3 segue sem worker ativado, sem alteração do Scheduler, Viviane ou escritor real. Gate restante: executar o smoke em runtime legitimamente autorizado e documentar evidência, depois planejar teste de concorrência real e ligação de writer canônico.


## F12.3 — Prova HMAC real e teste isolado de rejeições do contrato (12/11/2026)
- **Evidência real Cloud Shell, enviada pelo operador:** resposta `{"ok":true,"code":"bridge_hmac_health_ok","unsigned_status":401,"signed_status":200}`. Autenticação HMAC real no `health` confirmada; não extrapolar para throughput ou despacho positivo de ações mutantes.
- Nova ferramenta somente sob invocação explícita: `node services/integration-hub/src/f12-3-core-bridge-nonmutating-contract.mjs --live-nonmutating-contract`, com `CORE_BRIDGE_HMAC_SECRET` injetado pelo Secret Manager do operador. `acquire` e `resume` usam conta proibida e devem receber HTTP 400 do validador, antes de qualquer RPC. `stage` e `ack` usam conta Adão mas lease **UUID versão 1** `00000000-0000-1000-8000-000000000000` (formato aceito pelo Bridge, impossível de ser emitido pelo gerador real v4) e devem receber 409 com códigos `stale_lease` e `stale_or_staged_requires_reconciliation`. A ferramenta interrompe diante de divergência e omite tokens, pedidos e credenciais dos resultados.
- O ensaio Node/contêiner com handler HMAC real e executor de RPC simulado passou na CI, assim como os testes do Core/Postgres. Teste HTTP de ações F12.3 no runtime real **ainda depende de execução pelo operador em Cloud Shell**; não houve chamada mutante de `acquire` ou `resume` de Adão. Rejeição com conta proibida não prova despacho positivo dessas duas ações.
- CI global TypeScript segue com erro preexistente Saúde `src/modules/health/hooks/useHealthMealPlanF18.ts:591`, não resolvido na F12.3. O Hub produtivo, Scheduler, contas Viviane, pedidos e estoque permanecem sem alterações por esta missão.
