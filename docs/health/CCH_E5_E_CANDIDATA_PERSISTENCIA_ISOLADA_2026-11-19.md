# CCH E5-E — candidata de persistência e governança em laboratório isolado

**Autoridade:** Camada Mestre (deliberações de 19/11/2026), Mapa CCH v5.4 FROZEN e Evolução do Motor V1.0 FROZEN. **PR #999 em draft, sem merge; Issue #966 aberta; F23 não iniciada.**

## 1. Escopo e bloqueios

A candidata SQL está em `supabase/candidates/health_cch_e5e_persistence_candidate.sql`, **fora** de `supabase/migrations`. A única execução permitida é PostgreSQL 17 descartável com identidades e políticas fictícias. Nenhuma mudança foi autorizada no banco real, em programas de Deividi/Rafaela, na interface, nos consentimentos reais ou na prescrição automática. Um CI verde não é homologação de segurança, clínica, jurídica ou produtiva.

## 2. Consentimento E5 — contrato vigente na candidata

A tabela M1 `health_consents` permanece append-only: os cinco tipos existentes são preservados e `e5_personalized_review` é aceito **somente na candidata**. A política INSERT é substituída, e não acrescentada por OR. O aceite E5 requer identidade autenticada do próprio atleta em `health_athletes.auth_user_id`, `actor_auth_user_id=auth.uid()`, `details.contract=cch-e5-consent-v1` e `details.explicit_action` como booleano JSON verdadeiro. Um proprietário de cadastro, treinador ou representante com privilégios de gestão não pode conceder E5 em nome do atleta; ausência de vínculo de login não autoriza E5. Horários são carimbados pelo servidor.

**Assinatura correta:** `health_cch_e5_has_explicit_consent(p_athlete_id uuid)` — **não** recebe versão arbitrária. O banco consulta exclusivamente a política com estado `active` no registro protegido `health_cch_e5_policy_registry`; só retorna verdadeiro quando a última decisão do atleta é `granted`, única, vinculada àquela versão e sem revogação/negação posterior ou empate. Sem política aprovada ativa, a leitura é negativa. `e5-lab-v1` e `e5-lab-v2` são identificadores **exclusivos dos testes**.

## 3. Governança documental da política ativa — proposta, não aprovação jurídica

A aprovação formal exige um **documento canônico integral**, identificável por versão, conteúdo e SHA-256 calculado a partir dos bytes UTF-8 com quebras de linha LF (`\n`), sem normalização silenciosa ou texto variável. O hash é um controle de **integridade**, não prova de legalidade nem de aprovação por pessoa autorizada.

Contrato de governança proposto:
- `policy_version` único e imutável, `policy_document` canônico legível, `policy_digest` SHA-256 verificável do conteúdo exato
- `approved_by_auth_user_id`, `approval_reference`, `approved_at` e `effective_at`, com aprovação e data de vigência rastreáveis
- `status` `active` ou `retired` com **no máximo uma** política ativa; a substituição deve ser operação de autoridade controlada, transacional e auditável
- nenhuma escrita de política concedida a `authenticated`; a existência do registro **não autoriza** quem pode criar ou ativar versões
- uma política retirada não pode ser selecionada por parâmetro do cliente; nova política exige nova decisão explícita do atleta

**Pendência de autoridade:** texto integral definitivo, aprovador legítimo, procedimento de ativação/retirada, verificabilidade externa do registro de aprovação, retenção e tratamento de menores ainda não foram homologados. O documento de proposta abaixo **não deve ser registrado como política ativa real**.

## 4. Recuperação pós-sessão e retificação — contrato M4

M4 usa `health_workout_events` com `event_type=note`, `source=user`, `contract=cch-e5-session-review-v1`, `explicit_confirmation=true`, recuperação `good|poor|unknown` e sintomas `none|pain|unknown`. Sessão: `completed` e `record_status=active`; ator: o próprio atleta autenticado. O banco atribui os horários de servidor, valida autoria, vínculo e payload; índice parcial impede duplicar evento raiz ou criar dois sucessores do mesmo predecessor.

**Não é mais correto dizer que existe uma única nota por sessão.** Há uma *raiz única* e uma cadeia de **retificações imutáveis** em eventos novos com `replaces_event_id` referenciando o evento imediatamente anterior. Eventos antigos permanecem para auditoria.

A leitura consultiva E5-E deve selecionar **somente a última ponta válida** dessa cadeia. Sem raiz, com ciclos, ramificações, elos externos, autores diferentes, payloads inválidos, estado de sessão inelegível ou consentimento E5 não vigente, deverá falhar fechada: retornar nenhuma revisão autorizada, nunca presumir recuperação boa. Leituras diretas do M4 e integrações E5-B/E5-D não são ativadas por esse contrato; uma integração futura precisa homologar as interfaces.

## 5. Proposta única de texto informado de consentimento E5 (ainda não aprovada)

**Título provisório:** Consentimento para revisão individualizada de treinamento — CCH E5

> **Para que servirá:** Ao aceitar, você autoriza o CCH a utilizar seus registros de treino e evolução, incluindo exercícios, séries, cargas, repetições, esforço percebido, histórico de sessões, equipamentos declarados e informações de recuperação ou sintomas que você informar, para preparar análises e sugestões individualizadas de treinamento, que ainda dependerão de revisão humana.
>
> **Quais dados:** O CCH utilizará apenas os dados relacionados a essa finalidade e vinculados ao seu perfil autorizado. Informações não registradas serão tratadas como desconhecidas. Relatos de dor e sintomas não representam diagnóstico.
>
> **Quem poderá acessar:** Você e os profissionais ou operadores que tiverem acesso legítimo, específico e controlado no Painel Central conforme as permissões aprovadas. O acesso de um treinador ao seu programa não autoriza o treinador a conceder este consentimento por você.
>
> **Sua escolha:** Você pode negar agora e continuar utilizando as funções de treinamento disponíveis que não dependam dessa revisão E5. O não consentimento impede novas análises personalizadas que dependam da autorização, sem limitar automaticamente sua classificação esportiva ou os treinos já publicados.
>
> **Revogação:** Você poderá retirar a autorização. A revogação deve interromper novas utilizações dependentes do consentimento E5; ela não altera retroativamente os treinos publicados. Os registros históricos e as evidências de decisão poderão ser mantidos ou eliminados conforme a política de retenção e as obrigações aplicáveis, ainda sujeitas a aprovação.
>
> **Limites:** A autorização não é diagnóstico, promessa de hipertrofia, garantia de resultados, permissão para progressão automática, alteração de cargas/volumes nem publicação automática de programas.
>
> **Representação:** O fluxo inicial é destinado exclusivamente ao atleta apto a consentir diretamente. O consentimento em nome de menores ou representantes depende de política específica ainda não habilitada.

**Texto estritamente propositivo.** Não atribuir versão produtiva, data de vigência ou prazo de retenção antes das decisões da Camada Mestre e da revisão de privacidade.

## 6. Retenção e revogação — proposta pendente

Separar registros operacionais de treino, declarações de recuperação, trilha de consentimento e trilha de acesso. Propor, para cada categoria: finalidade, base autorizadora, responsáveis, retenção mínima/máxima, acesso, anonimização/eliminação, restrições legais e tratamento de revogação. **Não fixar prazo arbitrário.** A revogação impede novas operações dependentes de E5, enquanto o histórico anterior deve ficar sob controle de acesso, minimização e decisões de retenção explicitamente aprovadas. Um documento aprovado deverá explicar o canal operacional de revogação antes de liberar a interface.

## 7. Testes e limites

Os testes usam fixture **estrutural** com funções de autorização M0 reproduzidas e delegação `health_athlete_access`; não são execução integral sequencial de todas as migrations oficiais ou prova do RLS produtivo. Exercitam concessão, negativa, revogação, versões, atleta sem `auth_user_id`, treinador delegado, horários do servidor, ausência de JWT, sessão elegível, rejeições de duplicidade e cadeia de retificações. O job isolado M3/F22 valida regressão sintética; o fluxo integral F21 não foi homologado.

A prova consultiva foi exercitada no PostgreSQL 17 descartável: a função `health_cch_e5_current_session_review(athlete_id,session_id)` seleciona apenas a ponta da cadeia linear quando existe autorização vigente. Testes negativos comprovam revogação, acesso cruzado, sessão com `record_status=voided` e evento órfão/inconsistente (injetado exclusivamente pela fixture administradora). Sem autorização E5 vigente, a revisão retorna zero registros; não se infere recuperação. Nenhum dado sintético demonstra eficácia ou dose ótima.

## 8. Evidência final da contraprova consultiva

**Run [#44629626992](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/44629626992): dois jobs concluídos com sucesso**, `e5-persistent-isolated` e `e2-f22-baseline`. O último teste de alteração funcional inclui validação do hash canônico, leitura da ponta válida, rejeição com consentimento revogado, sessão anulada e cadeia órfã. As injeções forenses são estritamente do banco sintético; as notas reais permanecem bloqueadas. **O SQL leitor em si não foi integrado à aplicação nem publicado.** A revisão de privacidade e os prazos continuam sem deliberação.

**Limitação adicional:** a função consultiva controla seu próprio resultado, mas a existência de permissões gerais de SELECT sobre o histórico M4 precisa ser avaliada na revisão de governança de acesso. Não afirmar sigilo absoluto de notas antigas apenas pelo filtro do leitor E5.

## 9. Critério para próxima deliberação

Camada Mestre deverá deliberar sobre: (i) redação integral e política de privacidade, (ii) retenção e critérios de eliminação, (iii) autoridade para aprovar/ativar políticas e sua prova documental, (iv) papéis de menores e representantes, (v) efeito persistente e migração integral em banco descartável antes de cogitar produção. **NÃO MERGEAR PR #999; NÃO DEPLOYAR; NÃO COLETAR DADOS REAIS; F23 NÃO ABERTA.**


## 10. Fronteira de segurança E5 — leitura M4 e captura (despacho Camada Mestre)

**Fonte soberana verificada:** `supabase/migrations/20261107161317_health_m4_live_workout.sql` concede `SELECT` sobre `health_workout_events` por `health_can_read_athlete(athlete_id)`. Essa expressão isoladamente também permite que um treinador delegado leia eventos contendo recuperação/sintomas. O leitor específico E5 não é suficiente enquanto a tabela original permanecer consultável.

**Menor proteção candidata (não implantada):** substituir somente a política existente `health_workout_events_select` na candidata SQL. Eventos comuns M4 continuam obedecendo `health_can_read_athlete`, preservando os leitores históricos. Para `event_type=note` e `payload.contract=cch-e5-session-review-v1`, leitura direta exige adicionalmente `auth.uid()` igual ao `auth_user_id` do atleta ativo **e** `health_cch_e5_has_explicit_consent(athlete_id)` positivo. Treinador/proprietário delegado não visualiza notas E5; atleta sem consentimento vigente, ou após revogação, tampouco as visualiza via API de leitura comum. Auditoria histórica sujeita a política própria de retenção e acesso excepcional ainda não aprovada. Conceder acesso ao atleta para revisão dos próprios dados antigos após revogação é questão de governança de direitos do titular e não foi implementado implicitamente.

**Três atos juridicamente e tecnicamente distintos:**
1. **Registro da declaração:** uma nota M4 E5 é uma declaração autorrelatada, não um resultado clínico. A captura inicial ou a correção exigem identidade do próprio atleta, sessão `completed/active`, autoria não nula, confirmação expressa, payload validado no banco **e** consentimento específico E5 vigente. Sem ele, não gravar E5. Isso é uma proposta de restrição de coleta, não coleta ativada.
2. **Consentimento da análise:** concessão/negação/revogação E5 são registros M1 append-only, versionados pela política ativa. Um consentimento genérico M1 não autoriza uso E5.
3. **Utilização para sugerir treino:** mesmo com declaração e consentimento, a personalização fica sob os gates E5-A/B: qualidade e repetição de evidências, recuperação/sintomas, objetivo, revisão humana e impossibilidade de prescrição/publicação automática. A captura autorizada **não equivale** a permissão de aumentar carga ou volume.

**Prova incremental:** [CI #44631374685](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/44631374685) terminou com `e5-persistent-isolated` e `e2-f22-baseline` aprovados. Testou bloqueio de nota E5 sem consentimento, possibilidade de nova nota após concessão explícita, impossibilidade de leitura direta por treinador delegado, ocultação de E5 após revogação em leitura comum/consultiva e preservação do evento M4 normal para treinador e atleta.

**Limite de compatibilidade:** alterações de RLS em tabela compartilhada podem afetar RPCs e leitores específicos além do fixture estrutural. As funções oficiais M4 são `SECURITY INVOKER`; a revisão dos seus fluxos e a aplicação sequencial de todas as migrations M0/M1/M3/M4/F21/F22 no PostgreSQL descartável continuam necessárias antes de propor integração produtiva. Nenhuma aprovação de acesso histórico E5, privacy policy ou migração foi inferida.


## 11. Parecer único — Contraprova integrada da cadeia oficial (Camada Mestre, 19/11/2026)

**Evidência executada:** [GitHub Actions #44635804600](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/44635804600), código testado `782bb596e90e72b6bb4df50a272b7a7bf4bcc7e1`. Os três jobs `official-migration-chain`, `e5-persistent-isolated` e `e2-f22-baseline` encerraram `completed/success`. O log da cadeia oficial contém `CCH_E5E_OFFICIAL_CHAIN_PASS`.

### 11.1 Sequência realmente executada — 13 migrations oficiais, dependências e candidata

PostgreSQL 17 efêmero foi inicializado com **bootstrap mínimo de serviços Auth/Storage sintéticos** (`supabase/tests/health_cch_e5e_official_bootstrap.sql`). Em seguida foram aplicados, em ordem, os **arquivos originais do repositório**:
1. `20261107144000_health_m0_foundation.sql` (identidades/permissões)
2. `20261107151317_health_m1_profile_goals.sql` (consentimento)
3. `20261107153621_health_m2_catalogs.sql` e `20261107153848_health_m2_declared_equipment_catalog_fk.sql`
4. `20261107155747_health_m3_program_cch.sql` e `20261107160110_health_m3_program_rpcs.sql`
5. `20261107161317_health_m4_live_workout.sql`
6. `20261110005023_health_f19_interactive_workout_timers.sql`
7. `20261111020500_health_m4_end_workout_anytime.sql`
8. `20261111165531_health_f20_multimodal_daily_sessions.sql`
9. `20261111171704_health_f21_training_history_management.sql` e `20261111175335_health_f21_void_workout_requeues_cch.sql`
10. `20261112175528_health_f22_adaptive_training_maturity.sql` (**ressalva sintética abaixo**)

**Somente depois** foi aplicada a candidata `supabase/candidates/health_cch_e5e_persistence_candidate.sql` e executada a nova fixture `health_cch_e5e_official_contract.sql`.

**Ressalva obrigatória:** a migration F22 original contém *DML histórico com identificadores reais fixos*, além de `SELECT health_f22_assert_program_version_structure` sobre uma versão histórica. Não é possível aplicar esses dados literalmente em um banco exclusivamente sintético. Por isso, **somente na cópia efêmera** `/tmp/f22-synthetic-only.sql` os dois UUIDs de atletas e o UUID da versão historicamente afirmada foram remapeados para UUIDs sintéticos; uma versão publicada sintética com template e exercício completos foi preparada previamente. Assim, **o código de DDL, triggers, RPCs, RLS e o próprio assert F22 foram realmente executados**, sem migrar dados/IDs reais e sem modificar o arquivo oficial no GitHub. **Não equivale a execução byte a byte idêntica da F22 produtiva**. Os demais doze arquivos listados foram executados diretamente do conteúdo original. Não foi montado o ecossistema Supabase completo nem todas as migrations não pertinentes da aplicação.

### 11.2 Matriz de permissões demonstrada no PostgreSQL original + E5 candidata

| Contexto sintético | Eventos M4 comuns | SELECT bruto de nota E5 | INSERT de nota E5 | Concessão M1-E5 | Leitor E5 individual |
|---|---|---|---|---|---|
| Atleta A, consentimento E5 vigente | permitido | permitido | permitido se sessão elegível e declaração válida | permitido com ação específica | permitido para sessão válida e cadeia íntegra |
| Atleta A após `revoked` | permitido | **bloqueado** | **bloqueado** | pode tomar nova decisão explícita | **bloqueado** |
| Proprietário do cadastro A, login distinto do atleta | permitido | **bloqueado** | **bloqueado** | **bloqueado** | **bloqueado** |
| Treinador A com delegação M0 de leitura/escrita/gestão | permitido | **bloqueado** | **bloqueado** | **bloqueado** | **bloqueado** |
| Atleta B consultando A | **bloqueado** | **bloqueado** | **bloqueado** | **bloqueado** | **bloqueado** |
| Identidade ausente/sem vínculo | sem autorização | **bloqueado** | **bloqueado** | **bloqueado** | **bloqueado** |

Não inferir que todas as rotas de API/HTTP tenham sido testadas. A leitura comum após revogação é preservada; o direito de acesso do titular às notas históricas E5 por outro canal depende da política de privacidade e retenção.

### 11.3 Regressões realmente comprovadas

- **Schemas/constraints/triggers/grants/RLS:** criação da cadeia oficial e da candidata completa; RLS ativo em `health_consents`, `health_workout_events` e registro protegido; unicidade das políticas SELECT/INSERT de M4 (sem OR permissivo); triggers de nota/consentimento habilitados; ausência de `UPDATE/DELETE` autenticados sobre eventos/consentimentos e de escrita no registro de política.
- **M3/F22:** chamada real a `health_m3_publish_program_version(uuid)` sob identidade do atleta B, com draft de origem sintética e estrutura de template completa; conferidos status `published`, `current_version_id` e exatamente uma entrada na fila. Atleta A não consegue ler a fila de B. O baseline independente E2/M3/F22 permaneceu aprovado.
- **M4/F21:** chamada real ao RPC `health_f21_void_workout_session` sobre sessão concluída de A, após revogação; estado `record_status=voided`, evento comum `session_voided` preservado e notas E5 ocultadas da consulta ordinária. Eventos comuns `session_completed` continuaram legíveis a identidades com autorização M0.
- **Isolamento E5:** RLS de SELECT/INSERT verificados com atleta, proprietário distinto, treinador delegado e outro atleta; `revoked` bloqueia consulta bruta E5, leitor consultivo e nova captura; retificações são imutáveis, com cadeia verificada e resposta `unknown` preservada.
- **RPC/view alternativos:** auditoria de metadados não identificou uma view pública referindo `health_workout_events`. Funções F19 com `SECURITY DEFINER` realmente existem e fazem leituras para idempotência de eventos M4. Elas **não foram ocultadas**: foi aplicado bloqueio de CI para novas funções `SECURITY DEFINER` não revisadas que referenciem eventos; um teste de execução do RPC `health_f19_pause_workout` a partir de outro atleta confirmou recusa. As funções F19 conhecidas retornam IDs de temporizadores/séries, não payload arbitrário E5. A matriz de chamadas de todos os RPCs/HTTP endpoints **não é exaustiva**; permanece risco residual sujeito à revisão final de segurança.

### 11.4 Decisão técnica e riscos residuais

**Parecer:** compatibilidade persistente **APROVADA NO LABORATÓRIO ISOLADO**, com a ressalva explícita de bootstrap Auth/Storage simulado e da substituição limitada do DML histórico F22. A menor alteração candidata mantém a política M4 comum e acrescenta exigências específicas a notas E5. Não foi criado motor/fila paralela, nem autopublicação, nem consulta ou modificação de atletas reais.

**Portões não satisfeitos para produção:**
- Política textual E5 e revisão de privacidade; base autorizadora para registro versus análise, tratamento dos dados após revogação
- Categorias, prazos e procedimentos de retenção, eliminação e direito de acesso ao histórico
- Identidade/competência da autoridade que aprova/ativa políticas e regras de ativação, substituição e retirada auditáveis
- Menores e representantes: bloqueados até contrato próprio
- Revisão completa das permissões Supabase reais, endpoints HTTP/serviços e efeitos de `SECURITY DEFINER` F19, além dos demais RPCs legados
- Homologação com ambiente Supabase integral descartável (não apenas substituto Auth/Storage) e plano reversível de migration produtiva; qualquer execução/merge depende de **nova autorização expressa da Camada Mestre**

**Recomendação:** manter a PR #999 em `draft`, sem merge, com a candidata em `supabase/candidates/`; encaminhar à Camada Mestre somente os portões acima. Issue #966 aberta, F23 não iniciada.
