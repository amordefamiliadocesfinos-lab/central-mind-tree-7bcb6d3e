# Núcleo 2.0 — F1/F2 | Engenharia concreta isolada, PR draft

**Data:** 19/11/2026 · **Autoridade:** Camada Mestre, autorização de desenvolvimento técnico ISOLADO nesta conversa.  
**Mapa soberano consultado integralmente:** `MAPA_MESTRE_NUCLEO_2_0_V1_3_AC01_CONHECIMENTO_ESPECIALISTAS_CONGELADO_2026-11-14.txt` (476 linhas, Biblioteca do projeto; especialmente Parte I itens 3, 5, 6, 9–10, 15–22, Parte II itens 23–30, Parte III 31–33). A fonte de Biblioteca **não é substituída nem copiada** para o GitHub.  
**Mapa complementar:** Continuidade Canônica V1.1, D1–D7 / F1–F2.  
**Estado:** implementação candidata e laboratório; **não aplicar, não fazer merge**. Nenhuma migration em `supabase/migrations`.

## 1. Por que a adição é material e compatível

As PRs #1000 (cardinalidade), #1002 (autorização em memória) e #1003 (RLS Postgres descartável) já provaram as invariantes; este trabalho aprofunda **somente** o que falta: constraints relacionais reais, compatibilidade da hierarquia M3, vínculo autenticado opcional, revogação/auditoria, concorrência e isolamento por contexto.

Confronto read-only com `information_schema.columns`, `pg_constraint`, `pg_policies` do Core do projeto Lovable `1720a410-34cd-4410-995c-8c92c7edf16b`:
- `nucleo_development_workstreams`: PK UUID, `code` UNIQUE, `kind=modulo|frente|subfrente`, `parent_id` FK RESTRICT, módulo sem pai; frente/subfrente com pai; `specialist` texto.
- `nucleo_specialist_contributions`: PK UUID, `lineage_id,version_no` UNIQUE, `module_id`/frente FKs RESTRICT, `specialist_role` texto; contribuição proposta não constitui mandato.
- `nucleo_specialist_mandate_records`: entidade separada, `specialist_auth_uid` opcional, decisão competente, sem converter vínculo em mandato.
- `app_admin_capabilities`: `nucleo_manage` separado, CHECK `provision_users|nucleo_manage`; não introduzir `read_context` nessa tabela como se fosse capacidade administrativa global.
- Policies SELECT das tabelas M3/M4/AC-01/FM exigem `nucleo_manage`, não modificado. O endpoint `nucleo-ac02-context-read` com F5 permanece intacto.

CA-09, CA-21 e CA-23–29 da V1.3 exigem identidade/RLS, autoria/auditoria, original preservado, distinção de papéis e transmissão de conhecimento sem concessão implícita. O V1.3 não autoriza implantar estas propostas; a autorização atual permite apenas laboratório.

## 2. Desenho mínimo candidato (nomes físicos ainda sujeitos a revisão)

SQL **somente de laboratório** em `scripts/nucleo-f1-f2-concrete-candidate.lab.sql`:

| Nova entidade do modelo | Finalidade | Limite |
|---|---|---|
| `specialties` | ID funcional estável, método geral por referência, estado/proveniência | Não copia conteúdo ou homologa o método |
| `instances` | Instância funcional e `auth_uid` opcional, vinculação de identidade explicitamente verificada | Chat e papel textual não geram Auth |
| `assignments` | N:N especialidade + instância + módulo/frente opcionais, papel, fonte, vigência e estado | FK M3; anti-duplicidade ativa; fechamento preserva história |
| `read_grants` + `grant_history` | `read_context` auditável, revogável e vinculado a `auth_uid` e assignment; eventos separados, com autor/decisão de revogação distintos dos da concessão | Não equivale a mandato, `nucleo_manage` ou escrita |
| `context_cards` | **Projeção saneada** de metadados com especialidade/módulo/frente | Não consulta tabelas documentais brutas; povoamento futuro exige escritor autorizado e prova da origem |

A candidata usa schemas `f12_lab` e `f12_core` sintéticos para ensaio. O esquema definitivo poderá usar outro nome/forma; não transformar esses nomes em decisão soberana.

Integridade: FKs para módulos/frentes, verificação invoker de ancestralidade da frente até o módulo (inclusive subfrente), `UNIQUE ... NULLS NOT DISTINCT` dos vínculos ativos e cartões, FK composta que impede usar o `auth_uid` de outra instância; contexto sem módulo NÃO é wildcard de leitura. Os métodos gerais e adaptações locais são apenas referências distintas. O writer não é criado; usuários `authenticated` só recebem SELECT sujeito a RLS sobre metadados permitidos; concessões de leitura nunca entregam DML nem corpo AC-01/FM/Drive.

**Limite de integridade ainda a avaliar:** se a árvore M3 for reparentada após vinculação, o vínculo pode perder aderência à hierarquia; a migração candidata definitiva deve incluir proteção de reparenting ou contrato de reconciliação de alterações da M3, conforme revisão do schema e do writer original. A existência de índices/trigger no laboratório não demonstra todo o comportamento sob concorrência produtiva.

## 3. Matriz de acesso

| Papel/situação | Cartões consultivos | Tabela documental bruta | Writer/vigência/mandato |
|---|---|---|---|
| Proprietário com `nucleo_manage` ativo | Compatível no ensaio | Governado por RLS existente (não alterada) | Somente fluxos anteriores expressamente autorizados |
| Especialista `auth_uid` e `read_context` vigente e escopo coincidente | Apenas módulo, especialidade e frente autorizados | Não | Não |
| Especialidade diferente ou módulo alheio | Não | Não | Não |
| Vínculo expirado/encerrado, grant revogado, anônimo ou sem Auth | Não | Não | Não |
| Usuário autenticado sem concessão | Não | Não | Não |

**Atenção:** `SET ROLE authenticated` + `request.jwt.claim.sub` no laboratório reproduzem RLS, não autenticam JWT Supabase real. Um endpoint futuro deverá confirmar `getUser`, sessão válida, conexão ao Core como chamador, escopo e limite de corpo. Não criar bypass, `SECURITY DEFINER`, `service_role` exposta nem política genérica `USING(true)`.

## 4. Testes e herança das PRs anteriores

Na CI, serviço `postgres:16` descartável executa:
- candidato físico (`...candidate.lab.sql`);
- testes positivos/negativos (`...candidate.test.sql`): três especialistas sintéticos, uma especialidade em NUC e CRM, versões dos métodos por referência, cross-front, duplicação, identidade emprestada, nenhum Auth, expirado/revogado, administrador preservado, zero SELECT bruto, ausência de INSERT por leitor, imutabilidade, revogação com identidade/decisão próprias e log auditável;
- duas transações simultâneas (`...concurrency.cjs`) tentando criar o mesmo vínculo: exatamente um vencedor + uma rejeição por unicidade.

Esses ensaios **não repetem** os modelos genéricos #1000/#1002/#1003; acrescentam prova de constraints e fluxo concreto. Resultados de CI são registrados na PR, não como homologação real do Núcleo.

## 5. Riscos residuais e portões de implantação

**Riscos que exigem engenharia/revisão adicional:** elegibilidade do escritor de grants e identidade decisora; não confiar em `granting_actor_ref` fornecido pelo usuário; comportamento da sessão Auth revogada; fonte e revisão humana do cartão saneado; encerramento transacional/histórico de assignments; invariantes da árvore M3 após reparenting; RLS combinada com policies atuais e grants na Data API; concorrência multiusuário e eventual migração de dados legados sem fonte.

**Plano de implantação eventual (NÃO EXECUTAR NESTA AUTORIZAÇÃO):**
1. Revisão humana do diff, origem soberana, desenho físico, writers auditáveis e forma de identidade da especialidade e das instâncias. Confirmar portas CA-09, CA-21, CA-23–29 e separação de mandato.
2. Preparar migration PRODUTIVA própria depois de autorização separada, com backup/snapshot do schema, policies e concessões, checksum, base limpa e rollback de pré-uso.
3. Teste em clone de staging fiel ao Core, sem dados/credenciais sensíveis, com roles/claims/gateway e cenários negativos; manter `nucleo_manage` inalterado.
4. Solicitar **segunda autorização específica** antes de deploy/migration/grant. Aplicar aditivamente e validar readback independente, nenhuma alteração em AC-01 v1 `proposta`, FM e mandatos.
5. Publicar leitor de escopo restrito apenas depois do contrato e RLS aprovados; testar com identidade real autorizada e outra sem vínculo já existente, sem criar contas para teste.
6. **Rollback antes de uso:** se novas tabelas estiverem comprovadamente vazias e sem consumidores, reverter somente objetos adicionados em ordem de dependência, com autorização e readback. **Rollback após uso:** desabilitar leitura por feature flag/revogar grants específicos pelo escritor auditável; preservar tabelas, histórico e eventos; jamais DROP nem perda de conhecimento. Backup e restauração requerem portão próprio.

**Decisões reservadas à Camada Mestre:** se e quando autorizar schema/writer/RLS produtivos; eventual identidade estável oficial de especialidade; quem pode conceder/revogar `read_context`; política de históricos, auditoria e retenção; UAT autorizada com usuários reais. Nenhuma decisão técnica substitui homologação de método ou sucessão F6/F7.

**Estado:** candidato isolado em PR **draft**, sem merge, sem migration, sem novas contas, grants, mandatos, docs privados ou alterações NUC-M0..M5. Entrega B preservada.

## 6. Despacho de revisão de segurança — complemento da Camada Mestre (19/11/2026)

**Autorização recebida:** revisão e correção da candidata F1/F2 SOMENTE em draft e PostgreSQL descartável. A aprovação do desenho isolado anterior não autoriza merge ou produto. Esta seção é o relatório de segurança **do mesmo documento técnico**, não um novo mapa.

### 6.1 Riscos corrigidos e contraprovas

| Risco anterior | Mitigação candidata implementada | Prova no laboratório |
|---|---|---|
| Mudança posterior da hierarquia M3 mantém um vínculo apontando para outra árvore | Trigger invoker `m3_reparent_reference_guard` rejeita mudança de `parent_id/kind` de qualquer nó com referências próprias ou **descendentes**; inserções de vínculos fazem lock `FOR SHARE` também nos ancestrais | Reparent de M4 e de frente-pai com subfrente vinculada **negado**; frente sem referências pode mudar de pai |
| Concessão feita por ator que inventou um texto de decisão | `approved_decisions` é mantida fora do alcance DML do executor. Papel separado `f12_grant_executor NOLOGIN`, policy RLS por `auth.uid()` validado no laboratório, decisão única por grant, escopo de assignment e validade | Inserção sem decisão correspondente ou por executor divergente **negada**; ato aprovado emitido pelo executor sintético designado |
| Perda de histórico ou reuso de aprovação para dar novos direitos | Um grant revogado não é reativável, `decision_ref` tem índice `UNIQUE`, `grant_history` é append-only aos papéis clientes, vínculo encerrado permanece consultável à autoridade | Replay da decisão **negado**, revogação produz segundo evento, vínculo vencido encerrado + novo vínculo/grant/decisão preservam os registros anteriores |
| Continuidade de leitura após expiração/retirada | RLS exige vínculo e grant contemporaneamente ativos/vigentes e não revogados; política escritora rejeita conceder em vínculo já expirado | Revogação na própria sessão bloqueia nova leitura; vencido/revogado sem reemissão não lê; reemissão nova e individual devolve apenas o contexto aprovado |
| Cartão consultivo fabricado a partir de texto privado/sem origem | `approved_card_sources` contém somente metadados saneados, escopo, origem, aprovação e label revisado; `context_cards.public_source_ref` possui FK `ON DELETE RESTRICT` e trigger compara **integralmente** escopo, label e fonte; a fonte aprovada é imutável | Cartão sem fonte, com label divergente ou tentativa de atualizar/apagar fonte **bloqueados** |
| Contrato de acesso bruto M3 não refletido no primeiro laboratório | Clone fiel ao aspecto de autorização material: `authenticated` recebe `SELECT` na tabela M3, mas a policy `m3_existing_owner_read` só libera `nucleo_manage` ativo e próprio, como no Core | Administrador sintético enxerga M3 e cartões; especialista `read_context` vê só seus cartões, **zero linhas M3 brutas**; `anon` não recebe GRANT |

O cenário de concorrência mantém **uma única gravação vencedora**, com a outra rejeitada por índice único. Todos os dados são sintéticos; a simulação de `auth.uid()` por GUC **não autentica um JWT real**.

### 6.2 Contrato mínimo do escritor competente (não implantado)

1. **Origem da decisão:** a Camada Mestre define a autoridade competente por escopo. Um fluxo separado, autenticado e auditável registra a decisão previamente verificada em `approved_decisions` (tipo `grant_read_context` ou `revoke_read_context`, assignment alvo, grant alvo quando revogação, executor autorizado, origem e prazo). Um mero campo textual inserido pelo executor **não cria competência**. Somente o agente específico de decisões pode criar/aprovar esse registro, jamais um usuário `authenticated` comum nem o papel executor.
2. **Executor:** uma identidade individual comprovada pelo serviço deve ser comparada com a decisão e com a ação concreta; o papel físico `f12_grant_executor` é `NOLOGIN`, sem membership para `authenticated`. O serviço futuro não deve confiar em `request.jwt.claim.sub` enviado por cliente como texto SQL; deve validar JWT via Auth `getUser` e sessão atual, operar em caminho de escrita exclusivamente competente e registrar quem autorizou e quem executou. O laboratório simula somente a decisão e a RLS.
3. **Grant:** no máximo um grant não revogado por assignment; decisão de concessão consumível **uma única vez**. Grant é exclusivamente `read_context` e não pode transbordar para `nucleo_manage`, `write`, atos documentais, mandato ou sessão. A referência do método/autoridade de AC-01 continua independente.
4. **Revogação:** operação idempotente a definir no serviço; requer decisão válida e explicitamente vinculada ao grant. `revoked_at`, identidade do revogador e decisão de revogação são distintos dos campos de concessão; trigger impede desfazer ou alterar histórico. Repetição pós-revogação não ganha permissão.
5. **Reemissão:** vínculo vencido/encerrado é **fechado** (não substituído). Nova concessão requer decisão e, se necessário, assignment **novos** com IDs próprios; o histórico antigo permanece. O executor não altera a data de início nem a identidade do ato anterior.
6. **Escrita e trilha:** privilégios de INSERT/UPDATE restritos à operação do grant, sem acesso a writer genérico; evento auditável é gerado por trigger invoker na mesma transação. Logs administrativos devem vincular requerente, decisor, executor, alvo, origem/versão e request ID idempotente, a serem especificados no portão de implantação. **Nenhum executor real, API ou conta foi criado nesta PR.**

### 6.3 Produção dos cartões, compatibilidade e contrato futuro de sessão

A produção dos cartões deve ser um fluxo **fonte autorizada → metadados minimizados → revisão de proveniência, classificação e escopo → aprovação por ator competente → cartão consultivo referenciado**. A proposta contém somente referência original, label aprovado, tipo, módulo, frente e especialidade. Não copiar corpo de AC-01/FM, textos do Drive privado, evidências M4 brutas, segredos ou identidade de terceiros. Nova versão ou revogação de uma fonte exige decisão e transição segura dos cartões; a implementação produtiva do curador **não está neste escopo**.

**Compatibilidade comprovada:** a assinatura M3 (UUID, `kind`, `parent_id`), política de leitura `nucleo_manage`, e as guardas existentes foram confrontadas por metadados do Core. O Core real possui triggers `nucleo_m3_workstream_before`, `nucleo_m3_workstream_history` e `nucleo_m3_workstream_no_delete`; o guard candidato **não os substitui**, devendo ser reconciliado antes de qualquer implantação. As tabelas AC-01, FM, M4, M5, registros de mandato, a função `nucleo-ac02-context-read` e o frontend **não foram editados**. O guard de reparenting deve ser homologado juntamente com o contrato de edição M3, inclusive lock order e deadlock em staging fiel.

**Contrato mínimo de UAT JWT real (pendente de portão posterior):** validar credencial individual com `getUser(token)`, sessão ativa e revogação em cada operação sensível; negar acesso sem token (HTTP 401); negar identidade autenticada sem `read_context` vigente (HTTP 403), inclusive cross-module/cross-specialty/cross-front; permitir 200 somente para ator previamente autorizado em escopo coincidente; reconsultar após revogação/vencimento e esperar 403; não executar consultas privilegiadas em nome de ator sintético; preservar acesso do proprietário por `nucleo_manage` e confirmar que nenhum usuário de leitura recebe DML. Capturar status/corpo saneado e SHA/deploy independentemente. **401 sem JWT não substitui 403 de usuário autenticado sem grant.**

### 6.4 Riscos residuais e recomendação

**Pendências materiais de produção:** escrituração autenticamente competente da decisão (assinatura, auditoria, segregação de decisor/executor e idempotência); autenticidade de JWT e revogação de sessão Auth; curadoria e eventual revogação/versões de fontes de cartões; integração concreta com triggers M3 sob edição concorrente; migração/reversão em staging fiel e direitos reais do Data API; planejamento de transferência caso a tabela aprovada já tenha consumidores. Sem prova real de atores distintos nem autorização sucessória.

**Parecer técnico:** o **desenho isolado está apto a ser submetido à próxima deliberação de integração**, condicionado à CI da revisão final. Isto **não significa aptidão para merge/deploy/DDL produtivo**. Antes de executar migração devem existir portão humano distinto, writer auditável verificado, revisão e readback de Auth/RLS reais e plano de rollback por estado de uso. A PR #1004 permanece **DRAFT**, sem merge, sem grants reais, sem F6/F7 e sem Entrega B.
