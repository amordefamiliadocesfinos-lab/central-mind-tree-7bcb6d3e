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


## 12. Consolidação final de segurança e governança

### 12.1 Rotas alternativas e alcance da revisão

| Rota | Conferência | Prova pendente |
|---|---|---|
| RPCs F19 de temporização | Os seis RPCs públicos de ação usam `SECURITY DEFINER` com `search_path` vazio, exigem identidade e verificam autorização de escrita do atleta associado à sessão ou intervalo. O replay em M4 usa eventos de temporizador ou série e retorna identificadores operacionais. O trigger de encerramento tem assinatura de trigger e seus privilégios públicos são revogados. | Estender a matriz HTTP aos seis RPCs, incluindo vínculo cruzado de sessão/intervalo e replay de eventos comuns antes e após revogação E5. A recusa cross-athlete de `pause_workout` já está coberta no PostgreSQL. |
| Views e Data API | O teste de catálogo existente não encontrou view pública diretamente referenciando `health_workout_events`. A candidata substitui as políticas SELECT/INSERT M4, mantém o fluxo comum e condiciona o recorte E5 ao titular e ao consentimento ativo. | Enumerar schemas expostos, views e RPCs indiretos, grants efetivos e catálogo PostgREST. Verificar a superfície HTTP real de leitura, inserção e respostas agregadas com tokens Auth sintéticos de cada papel. |
| Edge Functions e permissões elevadas | O manifesto versionado não declara função E5 específica. Isso é inventário de configuração do repositório, sem certificação do inventário implantado ou de funções legadas com clientes privilegiados. O teste ordinário de RLS não prova o comportamento de uma função executada com `service_role`. | Inventariar funções com leitura direta ou indireta de M4/E5 e rotas com identidade de serviço. Para cada rota aplicável, confirmar validação do titular, projeção mínima e ausência de dados em resposta ou logs. Segregar a chave de infraestrutura do runner dos clientes usados no teste. |
| Storage | A candidata não cria bucket nem grava mídia. O bootstrap anterior demonstra dependências SQL e usa Storage simulado. | Subir Storage real no laboratório, confirmar seus grants e políticas aplicáveis e verificar que o fluxo E5 não grava objetos, não devolve caminhos privados e não expõe dados por rotas preexistentes de mídia. |

A revisão estática não comprovou vazamento nem justificou alteração na candidata. O inventário de serviços efetivamente implantados e a prova ponta a ponta permanecem abertos. A execução PostgreSQL anterior já demonstrou revogação, isolamento, eventos comuns M4 e regressões F21/F22, com a ressalva F22 da seção 11. Não se repete essa prova apenas para produzir nova evidência.

### 12.2 Contraprova Supabase integral descartável — execução pendente

1. Fixar o SHA da candidata e as versões do stack Supabase e registrar a lista de schemas expostos. Executar em runner descartável com Docker e Supabase CLI, com portas locais, projeto efêmero, segredos exclusivos de teste e sem referência ao projeto oficial. Usar Auth, Storage e PostgREST reais do stack; não aplicar o bootstrap que simula estes serviços.
2. Reutilizar a cadeia verificada na seção 11 em uma cópia efêmera. Preservar o remapeamento sintético documentado para o DML histórico F22. Aplicar a candidata somente após a cadeia base e manter o arquivo em `supabase/candidates/`.
3. Criar somente identidades Auth descartáveis e fixtures para titular A, titular B, titular do cadastro distinto, treinador delegado e usuário sem vínculo. Criar o consentimento de teste pela identidade do titular. Obter sessões pelo Auth da instância isolada. Acessos como anônimo ou autenticado devem passar pelo PostgREST; chaves de serviço ficam restritas ao bootstrap e à execução interna de Edge Functions aplicáveis.
4. Comparar a matriz da seção 11 com as respostas HTTP sem preservar corpos sensíveis, JWTs ou chaves nos logs. Confirmar eventos comuns M4 antes e depois da revogação, ausência de conteúdo E5 nas vias ordinárias do titular após revogação e bloqueio para os demais perfis. Conferir rotas F19, views, funções Edge aplicáveis e ausência de escrita Storage pelo fluxo E5. Reusar os asserts F21/F22 e registrar somente deltas ou resultados que confirmem paridade no transporte real.
5. Preservar como evidência SHA, inventário de rotas, papel sintético, resultado sanitizado, diferença do catálogo e teardown. O ambiente desta revisão não tinha Docker, Supabase CLI nem cliente PostgreSQL disponíveis. O stack integral é um ensaio **preparado, não executado**.

### 12.3 Atendimento ao titular após revogação — proposta de governança

A revogação interrompe captura, uso adaptativo e leitura E5 pelo canal operacional da candidata. O canal independente proposto é um atendimento restrito pelo responsável de privacidade designado. Após verificar identidade e titularidade do cadastro, o atendimento delimita o pedido e verifica quais dados ainda existem sob regra de retenção aprovada. Fornece somente o histórico do titular em meio autenticado, sem acesso de treinador ou reativação do consentimento. Uma correção aceita gera registro vinculado ao original, com motivo, autoridade, data e decisão de eliminação ou retenção aplicável. O atendimento deve registrar a decisão e seu resultado com metadados mínimos, sem copiar notas de recuperação para logs gerais. Dados eliminados não são reconstituídos para atendimento. Este caminho é procedimento proposto, sem endpoint, privilégio ou ativação produtiva nesta PR.

| Categoria | Finalidade e minimização propostas | Regra de retenção e eliminação a aprovar |
|---|---|---|
| Resposta estruturada E5, incluindo recuperação e sintomas quando declarados | Apoiar revisão pós-sessão explicitamente autorizada. Coletar só campos necessários, com opção de não responder e sem anexos ou texto clínico livre no piloto. | Interromper uso após revogação. Deliberar sobre retenção excepcional, finalidade, acesso restrito, eliminação, backups e verificação de execução. |
| Notas históricas e retificações E5 | Atender acesso e correção solicitados pelo titular e preservar a rastreabilidade no limite aprovado. | Deliberar sobre descarte, cadeia de correções e tratamento de registros que precisem ser conservados. |
| Consentimento, revogação e trilha de política | Comprovar decisão, versão, autoridade e momento. Manter metadados mínimos, sem payload sensível. | Validar fundamento e prazo específicos com jurídico e privacidade, incluindo descarte e exceções documentadas. |
| Eventos comuns M4/F21/F22 | Preservar andamento, histórico e fila de treino sob suas finalidades próprias. | Permanecem sujeitos à política própria. Revisar fronteira de classificação antes de incluir qualquer campo E5 em evento comum. |

**Texto proposto para revisão jurídica e de privacidade.** “Se eu escolher participar, o Painel Central poderá usar as respostas de recuperação que eu decidir fornecer para apoiar a revisão do meu treino. A participação é opcional. Posso deixar respostas em branco e retirar minha autorização pelo canal informado na política. Após a retirada, o uso pelo fluxo E5 é interrompido. Posso solicitar acesso ou correção dos meus dados pelo mesmo canal.” Antes de qualquer ativação, preencher identidade e contato do controlador, canal, categorias, finalidade exata, duração, destinatários e consequências confirmadas. Referência para revisão: Lei nº 13.709/2018, especialmente arts. 8, 11 e 15–18, no [texto oficial consolidado](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).

**Autoridade e trilha propostas.** Jurídico e privacidade revisam a minuta. A Camada Mestre, com a autoridade competente do controlador formalmente identificada, delibera sobre aprovação, ativação, substituição ou retirada. O registro de política deve vincular decisão, responsável, data, versão, documento canônico imutável e SHA-256 dos seus bytes. Uma substituição ou retirada exige nova decisão rastreável. Menores e representantes permanecem fora do fluxo inicial até aprovação específica. Não há aprovação jurídica, prazo ou canal publicado neste despacho.

**Portão para deliberação.** A PR #999 permanece em revisão, a Issue #966 aberta e F23 não iniciada. Submeter integração e eventual implantação a uma única deliberação da Camada Mestre após a contraprova integral e o fechamento das decisões de privacidade. A deliberação deve registrar separadamente as permissões de integração e de uso real.

### 12.4 Evidência nova — inventário automatizado de caminhos alternativos (19/11/2026)

**Execução realmente realizada:** [GitHub Actions #44648275208](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/44648275208) — os quatro jobs (`official-migration-chain`, `e5-persistent-isolated`, `e2-f22-baseline`, **`e5-alternative-route-audit`**) concluíram com sucesso. **Nova prova distinta da sequência PostgreSQL:** `supabase/tests/health_cch_e5e_route_audit.mjs` percorreu 1.341 arquivos de código e migrations no checkout do PR e exportou um inventário JSON em [artifact #14589318627](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/44648275208/artifacts/14589318627). O arquivo foi registrado como evidência, sem dados de atletas ou credenciais.

O inventário localizou referências literais M4/E5 em oito arquivos relevantes: migrations M4, F19, M4 conclusão, F21 e patch F21; tipos Supabase gerados; contratos de captura E5-D e adaptador de proveniência E5. A análise diferenciou a declaração gerada `src/integrations/supabase/types.ts` de uma consulta de dados em execução. Não identificou leitores diretos M4 em outros arquivos de frontend/Edge Functions nem função SQL `SECURITY DEFINER` *desconhecida* que referencie a tabela e ultrapasse o conjunto F19 previamente analisado. **Zero violações detectadas pelos critérios estáticos.**

**Limite:** descoberta por identificadores literais e extração textual de funções não exclui SQL construído dinamicamente, aliases/joins indiretos, funções de outras schemas, dependências implantadas fora do repositório, `service_role`, respostas HTTP, autenticação real do Supabase ou exposição em logs. O conjunto F19 constitui **exceção conhecida, não homologação funcional completa**. O teste não substitui o ensaio com Auth/PostgREST/Storage reais em stack integral descartável descrito no item 12.2, que **permanece não executado**. Nenhuma nova permissão, política, migration ou rota produtiva foi habilitada por esta auditoria.

**Próximo portão material:** contraprova HTTP com tokens sintéticos e stack Supabase integral isolado; decisão da Camada Mestre quanto à política final, retenção, direitos do titular e autoridade. PR #999 draft sem merge, Issue #966 aberta, F23 bloqueada.


### 12.5 Contraprova HTTP em Supabase integral descartável — realizada em 23/11/2026

**Evidência nova:** [GitHub Actions #45188567320](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/45188567320), commit funcional `856f009cd9452128882f39b437858c477d38f4fe`, **5/5 jobs `completed/success`**, incluindo `e5-full-supabase-disposable`. O marcador de êxito específico é `CCH_E5E_REAL_AUTH_POSTGREST_STORAGE_HTTP_PASS`; a inicialização registra `CCH_E5E_FULLSTACK_SMOKE_PASS`.

**Ambiente:** runner GitHub Ubuntu efêmero, Supabase CLI fixada em `2.122.0`, projeto local `cch-e5e-isolated-lab`, Docker e `supabase start` em diretório temporário. Auth, PostgREST/Data API e Storage foram de fato iniciados, com endpoints locais respondendo HTTP 200. Não houve `supabase link`, projeto remoto, variáveis de credencial produtiva, migrations em produção, keys reais ou deploy. Segredos do stack foram mantidos em arquivo temporário com permissão 0600 e não publicados nos logs; o `trap` executa `supabase stop --no-backup` e descarta o diretório.

**Schemas e dados:** foi aplicada a sequência de 13 migrations oficiais relevantes M0/M1/M2/M3/M4/F19/F20/F21/F22 no banco local do stack, seguida **somente ali** da candidata E5-E. A F22 tem DML/asserções com UUIDs históricos: as três referências foram remapeadas unicamente na cópia em memória e usadas com atletas/versão de treino inteiramente sintéticos. Uma função auxiliar global `public.update_updated_at_column`, existente como dependência fora das migrations Health, foi criada no bootstrap descartável para compatibilidade com a M1; não se alteraram as migrations do repositório. Quatro identidades foram criadas pela **API Auth real** (atleta A, atleta B, treinador e proprietário distinto); JWTs reais do stack local foram obtidos pelo fluxo de senha e utilizados em todas as requisições da Data API. Credenciais/IDs temporários não são persistidos em artefato ou relatório.

**Matriz de respostas HTTP verificada:**

| Situação exercitada na API real local | Resultado comprovado |
|---|---|
| Auth /auth/v1/health, /rest/v1/, /storage/v1/status | HTTP 200 |
| Auth: criação + login dos quatro usuários sintéticos | HTTP 200 |
| INSERT de nota E5 sem consentimento | HTTP 403; negado |
| INSERT de evento comum M4 sem E5 | HTTP 201; preservado |
| Tentativa de treinador, proprietário e atleta B concederem E5 a A | HTTP 400; negadas |
| Atleta A concede consentimento específico da versão sintética vigente | HTTP 201 |
| Atleta A registra nota E5 após concessão | HTTP 201 |
| SELECT de M4: atleta A, treinador, proprietário, atleta B | HTTP 200, com contagem conferida: só A viu nota E5, treinador/proprietário viram evento comum, B não viu A |
| POST RPC `health_cch_e5_current_session_review` com JWT de A | HTTP 200, retorno de revisão autorizada |
| Atleta A revoga consentimento | HTTP 201; nova decisão histórica |
| SELECT M4 e RPC após revogação | HTTP 200, sem nota E5 nem revisão consultiva; evento comum permaneceu |
| Nova tentativa de captura E5 após revogação | HTTP 403; negada |
| RPC F19 `health_f19_pause_workout` por atleta B usando sessão de A | HTTP 400; negada |
| Leitura anônima de eventos M4 | HTTP 401; negada |
| Storage real: enumeração de buckets via identidade administrativa **local** | HTTP 200; nenhum objeto E5 criado (verificação SQL) |

**Alcance correto:** esta execução comprova tráfego HTTP real com tokens Auth sintéticos, RLS/PostgREST e Storage local, somando-se à contraprova anterior de grants, triggers, F21 e F22 em PostgreSQL descartável. Não comprova segurança do Supabase produtivo, todos os RPCs F19, todas as Edge Functions, todos os endpoints de Storage, policies externas ao conjunto de migrations, logs de serviços externos ou fluxos clínicos. A chave `service_role` foi utilizada **apenas no provisionamento de usuários fictícios e na enumeração administrativa do Storage local**, nunca para simular acesso de treinador ou atleta; as provas de RLS foram feitas com JWTs das respectivas identidades. A candidata SQL continua fora de `supabase/migrations`.

**Conclusão desta frente:** o portão técnico previamente pendente de **Auth + PostgREST + Storage reais em Supabase integral descartável, com testes HTTP de consentimento/revogação, RLS e RPC F19 negativo**, está **satisfeito no escopo testado**. **Não** significa autorização de merge, migração ou coleta real. A Camada Mestre continua responsável pelas decisões sobre texto e versão oficiais do consentimento, base e revisão de privacidade, retenção e eliminação, direitos do titular após revogação, autoridade aprovadora/ativadora e menores/representação. Uma revisão de impacto de segurança e plano reversível ainda antecede qualquer liberação produtiva. PR #999 deve continuar **draft, sem merge**; Issue #966 **aberta**; F23 **não iniciada**.


## 13. Pacote único de decisão G1–G5 — transição da engenharia isolada para governança (23/11/2026)

**Origem da autorização:** despacho Camada Mestre de 23/11/2026. Este capítulo é a **única consolidação decisória** sobre o contrato E5-E; não substitui as evidências de laboratório das seções 7–12, não cria política vigente, não promove a candidata SQL e não concede ao Especialista Saúde/CCH competência jurídica, de tratamento de dados ou de produção. A PR #999 continua **draft sem merge**; a Issue #966 permanece aberta. O portão de engenharia experimental está **encerrado/aprovado dentro do escopo testado**; não reproduzir seus testes sem mudança material.

### G1 — Minuta única de consentimento informado para análise individualizada (proposta, não homologada)

**Nome proposto para apresentação ao titular:** Autorização opcional para análise individualizada de treinamento — CCH E5.  
**Identificador funcional técnico aprovado:** `e5_personalized_review`; **nenhuma versão produtiva foi definida**.  
**Forma pretendida:** texto acessível, integral, datado, exibido antes da escolha; opções independentes "Aceitar" e "Não aceitar"; registro com vínculo ao atleta, usuário autenticado, versão canônica aprovada, data/hora de servidor e ação afirmativa. Treinador/proprietário delegado não substitui decisão pessoal; menores e representação ficam bloqueados.

> **Por que pedimos sua autorização?** O CCH pode examinar, de maneira opcional, seus registros de treinamento e recuperação para preparar análises e sugestões individualizadas de treino, que serão avaliadas por uma pessoa autorizada antes de qualquer mudança em seu programa.
>
> **Quais informações serão utilizadas?** Exercícios, sessões, séries, cargas, repetições, esforço registrado, objetivo informado, equipamentos confirmados, evolução física documentada e os relatos de recuperação ou sintomas que você registrar especificamente para essa finalidade. Não serão inventadas informações ausentes nem interpretados sintomas como diagnóstico médico. Dados fora dessa finalidade não estão abrangidos por esta autorização.
>
> **O que o CCH poderá fazer?** Consultar registros pertinentes, comparar sessões quando houver evidência suficiente, produzir uma análise consultiva e preparar uma proposta de ajuste de treino para revisão humana. **Esta autorização não permite aumento automático de carga ou volume, diagnóstico, publicação automática, garantia de resultados ou liberação de calibração sem as demais condições do programa.**
>
> **Quem poderá acessar?** Você e os responsáveis estritamente autorizados para cumprir a finalidade, observadas as permissões e as regras de privacidade aprovadas. Acesso comum a um programa por um treinador não confere direito automático de ler seus relatos E5 de recuperação ou sintomas nem de consentir por você. Os papéis autorizados, canais e exceções de auditoria deverão ser informados de forma definitiva antes do uso.
>
> **A escolha é sua.** Você pode não aceitar. A recusa não deve impedir as funcionalidades de treino que não dependam da análise E5, nem rebaixar sua classificação esportiva. Sem autorização válida não haverá novas coletas ou análises dependentes de E5.
>
> **E se mudar de ideia?** Você poderá retirar sua autorização por um procedimento autenticado que deverá ser disponibilizado antes do lançamento. A revogação bloqueia novas coletas e novas utilizações dependentes de E5. O histórico já produzido e o registro das suas decisões serão tratados segundo a política de retenção e as obrigações aplicáveis; não serão automaticamente apagados ou reativados sem avaliação apropriada. Deve existir uma via separada, autenticada e auditável, para consultar e solicitar correção ou eliminação dos seus próprios dados nos limites legalmente aplicáveis, **sem reacender a análise E5**.
>
> **Proteção de menores:** esta primeira versão não oferece consentimento por representante nem fluxo para menores. Esses casos dependem de regras específicas aprovadas.

**Requisitos antes da homologação da minuta:** revisão jurídica e de privacidade sobre finalidade, fundamento e necessidade dos dados, transparência sobre destinatários, segurança e compartilhamento, mecanismos de revogação/direitos do titular, retenção e eliminação, canal de contato, redação acessível e prova de exibição da versão correta. Uma caixa previamente marcada, consentimento M1 genérico, silêncio ou ato de treinador **não** satisfazem E5. A minuta não serve como aviso jurídico definitivo nem demonstra adequação à LGPD por si só.

### G2 — Matriz de retenção, correção e direitos do titular (proposta condicionada)

**Regra para prazos:** nenhum prazo numérico foi aprovado. A proposta é vincular cada prazo a finalidade, necessidade, obrigação aplicável e evento de início da contagem; o prazo final, suas hipóteses de extensão e a justificativa documental deverão ser aprovados pela autoridade de privacidade antes de qualquer ativação. `A definir` é uma pendência explícita, **não retenção infinita ou apagamento imediato**.

| Categoria | Finalidade/necessidade proposta | Fundamento/condição a homologar | Regra temporal proposta / prazo | Acesso, correção e eliminação | Após `denied` ou `revoked` |
|---|---|---|---|---|---|
| Eventos M4 comuns de treino, séries e histórico | Histórico operacional de treino, integridade de programa e auditoria de execução | Fundamento operacional e política de privacidade M4/M3, independentes da análise E5, a confirmar | Enquanto necessários à operação e ao período de histórico legitimamente aprovado; **prazo final a definir** | Acesso do titular e dos papéis M4 autorizados; corrigir por evento auditável onde o modelo exigir; eliminação/anonymização sujeita a dependências de integridade | Preservar funcionalidades M4 independentes; não usar esses eventos para nova análise E5 |
| Declarações sensíveis E5 de recuperação e sintomas (M4 `note`) | Preparação consultiva individualizada, com retificações e rastreabilidade | Consentimento E5 específico e versão vigente; eventual conservação residual requer análise separada e não se presume | Coleta e análise somente durante autorização válida; retenção histórica restrita **a definir** por finalidade, dever de prova e direitos do titular | Consulta do próprio titular por canal autenticado **separado do gate de análise**; retificação imutável; ocultação a treinador delegado; avaliar eliminação/anonymização tecnicamente viável | **Interromper de imediato novas coletas/análises E5**; bloquear a leitura ordinária E5; preservar apenas histórico legitimamente justificável e liberar canal de direitos sujeito a autoridade |
| Decisões M1 de consentimento, negativa, revogação e versão | Prova de escolha, precedência, direitos e conformidade | Necessidade de demonstrar ações e obrigações aplicáveis; parecer jurídico requerido | Histórico append-only pelo período de evidência **a definir**; nunca apagar automaticamente só porque houve revogação | Acesso controlado ao titular e auditoria autorizada; ajustes por novo registro, não alteração invisível do histórico; eliminação após prazo e deveres definidos | `revoked` passa a ser a última decisão efetiva; registro histórico não reautoriza E5 |
| Documento canônico, SHA-256, aprovação e substituição de políticas | Comprovar conteúdo exibido, vigência, aprovação e versão aplicável | Governança interna, prova de integridade e obrigações de transparência, a aprovar | Preservar pelo ciclo de vigência e período de rastreabilidade correspondente, **prazo a definir** | Escrita somente por autoridade/rotina segregada; registros de substituição auditáveis e imutáveis; nenhuma alteração silenciosa do conteúdo | Política `retired` não pode validar novos aceites; histórico retido conforme tabela de rastreabilidade |
| Trilhas de acesso, autenticação e atos de operadores | Investigação de uso indevido, incidentes e responsabilização | Política de segurança e minimização de dados, a homologar | Retenção limitada por criticidade e necessidade de auditoria, **prazo a definir** | Acesso restrito a equipe de segurança e responsável designado; evitar conteúdo clínico/sintomas em logs; descarte seguro | Registrar bloqueios e direitos sem reutilizar os dados E5 para personalização |
| Fotos, métricas corporais e outros dados de M1/M3 eventualmente correlacionados | Finalidades próprias de evolução e eventual E5 somente se cobertos pelo aviso e autorização específicos | Fundamentação e consentimentos próprios por categoria; não inferir cobertura pelo E5 | Política independente por categoria, **prazo a definir** | Trilha de compartilhamento, exportação, retificação/eliminação conforme capacidade técnica e requisitos legais | Revogação E5 bloqueia **seu uso para E5**, não determina automaticamente eliminação de todos os dados de outros módulos |

**Fluxo proposto para direitos:** identificar titular por autenticação forte → registrar tipo/escopo da solicitação → conferir legitimidade e restrições → oferecer leitura/exportação do histórico próprio por canal com permissão separada de `health_cch_e5_has_explicit_consent` → auditar cada consulta → corrigir com evento vinculado, ou eliminar/anonimizar segundo decisão documentada → comunicar conclusão ou impossibilidade fundamentada. Nunca reativar consentimento para satisfazer pedido de acesso. **Esse canal ainda não está implementado**; a política E5 candidata atual bloqueia SELECT comum após revogação.

**Decisões explícitas reservadas:** prazo por categoria, marco inicial de contagem, eventual suspensão por litígio ou obrigação legal, responsabilidade por atendimento, retenção de backups, prazo de resposta, formato de exportação, restrições de retificação e prova de eliminação. Nenhuma dessas definições é tratada como aprovada.

### G3 — Autoridade e ciclo de vida da política ativa

**Objeto técnico candidato:** `health_cch_e5_policy_registry` com `policy_version`, `policy_document`, `policy_digest`, `approved_by_auth_user_id`, `approval_reference`, `approved_at`, `effective_at`, `status` (`active`/`retired`) e índice de no máximo uma versão ativa. Integridade do digest: SHA-256 hexadecimal calculado pelo PostgreSQL sobre os bytes UTF-8 **exatos** do documento canônico. Um digest correto prova correspondência de conteúdo, **não** autoridade ou validade jurídica.

**Procedimento proposto, nunca executado em produção:**

1. **Redação e revisão:** responsável técnico entrega minuta e catálogo de dados; privacidade/jurídico avaliam aviso, base, retenção, acesso, menores e canal de revogação. Registrar parecer e eventuais ressalvas.
2. **Designação da autoridade:** proprietário designa explicitamente quem pode aprovar e quem pode ativar, inclusive segregação de funções e substitutos. O especialista Saúde/CCH não recebe esses poderes por executar testes.
3. **Documento canônico imutável:** fechar texto aprovado e bytes UTF-8 LF, identificar versão não fictícia **após aprovação**, calcular SHA-256 reproduzível e anexar cópia e prova de aprovação em repositório documental com acesso controlado. Validar hash no registro de ativação.
4. **Aprovação e entrada em vigor:** uma autoridade aprova o conteúdo; operador designado prepara ativação futura com `approved_by`, referência verificável, datas e motivo. Só uma versão pode ficar `active`; mudança tem de ser **transação indivisível** (aposentar anterior, ativar nova), com log, autor e horário de servidor; sem promover registros fictícios do laboratório.
5. **Impacto sobre consentimentos anteriores:** nova versão invalida uso E5 baseado em consentimento anterior até nova ação explícita do próprio atleta. Falha de versão ou ausência de versão ativa significa E5 bloqueada.
6. **Retirada e incidentes:** autoridade pode retirar a política, registrar motivo, bloquear novos consentimentos e análises, manter prova da versão anterior e conduzir comunicação/atendimento. Não remover registros necessários à auditoria sem análise de retenção.
7. **Auditoria e reconciliação:** validar periodicamente unicidade de versão ativa, consistência digest/documento, identidade da autoridade, datas, logs de ativação e ausência de privilégios `authenticated` para criar/ativar política.

**Risco residual de contrato:** a candidata armazena metadados e restringe grants do papel `authenticated`, mas **não implementa um fluxo autorizado de aprovação/ativação**, trilha externa imutável, atestado de aprovação jurídica nem separação de tarefas entre perfis administrativos. Isso é **portão G3**, não autorização tácita para usar o usuário `postgres` ou `service_role` como aprovador. Definir responsável nominal apenas por deliberação superior.

### G4 — Menores e representantes: primeira versão fechada

A E5 inicial permanece restrita ao atleta autenticado capaz de consentir diretamente, vinculado a `health_athletes.auth_user_id`. **Não habilitar** atleta sem vínculo de autenticação, representante, tutor, técnico ou proprietário distinto como substituto da vontade. Nenhuma inferência de consentimento a partir de permissões `guardian`, `coach`, `owner` ou de dados de idade.

Qualquer futura ampliação requer projeto e aprovação próprios, com verificação documental de representação válida, melhor interesse e proteção de menores, transparência adaptada, segregação de acesso, duração/revogação de poderes, fluxos de direitos e testes RLS específicos. **Não criar exceção no SQL candidato E5-E nesta fase.**

### G5 — Riscos residuais, implantação futura e reversão (plano não executável)

**Evidências técnicas já aprovadas, não repetir sem mudança material:** PostgreSQL descartável com migrations relevantes e candidata E5-E; RLS, consentimento/revogação, leitura e retificação M4; regressões M3/F21/F22; auditoria estática de rotas; contraprova HTTP com Auth/PostgREST/Storage reais em Supabase descartável. O run conclusivo de stack HTTP é [#45188567320](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/45188567320), 5/5 jobs aprovados. Os IDs históricos F22 foram remapeados apenas no laboratório e `update_updated_at_column` foi provisionada como dependência compartilhada local.

**Ameaças residuais antes de qualquer go-live:**

| Superfície | Evidência existente | Ação/decisão ainda necessária |
|---|---|---|
| RPCs F19 `SECURITY DEFINER` e fluxos indiretos | Uma chamada cruzada F19 bloqueada via HTTP; funções conhecidas inventariadas | Revisão final de cada caminho elevado, resposta, idempotência e permissões reais sem expor E5; ampliar testes somente se houver risco novo |
| Supabase produtivo (Auth, Data API, Storage, Edge, grants, schemas expostos e `service_role`) | Supabase **local** com JWT e RLS comprovados, não ambiente de produção | Inventário oficial de configuração produtiva e alterações entre ambientes, com auditoria de papéis, logs e integrações privilegiadas; não acessar produção com escrita |
| Retificação M4 e acesso histórico após revogação | Cadeia append-only validada; leitura consultiva exigindo consentimento e sessão ativa | Aprovar canal distinto de direitos do titular, leitura histórica auditável, retenção e prova de acesso sem reativação E5 |
| Contrato de versão/política | Documento e hash verificáveis no laboratório, sem escrita por `authenticated` | Aprovar texto final, autoridade, vigência, substituição atômica, trilha de aprovação, revogação e mecanismos de emergência |
| Compatibilidade do ecossistema | M3/M4/F21/F22 preservados nos testes relevantes; versão fictícia F22 remapeada | Revisão de migrações de produção e inventário de diferenças reais, backups, dependências, deploy/revert e observabilidade |
| Segurança/privacidade de dados sensíveis | Atleta/treinador/proprietário e revogação testados | Parecer jurídico e de privacidade, direitos, minimização, retenção e avaliação de incidentes |

**Plano futuro sujeito a autorização expressa:**

- **Fase 0 — decisão:** receber G1–G4 aprovados formalmente e parecer de segurança G5, com condições e responsáveis definidos. Sem aprovações, permanecer em `blocked`.
- **Fase 1 — prontidão técnica:** revisão do diff da PR #999, schema real, pré-requisitos, sequenciamento de migrations, grants, triggers, funções, RLS, uso de `SECURITY DEFINER`, backup/snapshot testável e critérios de rollback. Preservar SQL em `supabase/candidates` até autorização para promover.
- **Fase 2 — simulação controlada:** ensaiar em banco/stack descartável o **pacote exato que futuramente se pretenderia implantar**, incluindo migrações de governança aprovadas, transição de versão, exceções de dados históricos e restauração. Redefinir testes apenas se o pacote mudar.
- **Fase 3 — autorização separada:** Camada Mestre decide **merge**, promoção/versionamento de migration, responsáveis por deploy, janela e critérios de interrupção. A aprovação do laboratório E5-E não substitui essa decisão.
- **Fase 4 — eventual implantação:** se e somente se autorizada, executar migration em etapas controladas, verificar invariantes/grants/policies/constraints e **manter captura E5 desativada** até validação posterior e política aprovada. Nenhuma publicação ou ajuste automático de programas.
- **Fase 5 — pós-implantação/rollback:** avaliar logs e métricas de acesso, autorização por identidade, revogação, integridade histórica e compatibilidade M4/F21/F22; em falha, **desativar o caminho E5 e bloquear a finalidade** imediatamente. Reverter políticas/funções e estruturas apenas segundo um plano de migração de reversão testado e autorizado, preservando registros append-only e trilhas legais. **Não presumir que um `DROP TABLE`, exclusão de eventos ou downgrade em produção seja seguro ou reversível**.

**Decisões formais a solicitar à Camada Mestre (não tomadas aqui):** aprovar G1 texto/privacidade, G2 regras e prazos por categoria/direitos do titular, G3 nomeação de autoridade e ativação, G4 eventual política separada para menores (caso desejada), G5 risco residual/estratégia de implantação e autorização distinta de merge e produção.

### Resultado do despacho de 23/11/2026

**Pacote G1–G5 preparado para deliberação superior, com minuta e matriz propostas, e evidências técnicas previamente aprovadas preservadas.** Não há versão de política vigente, prazo aprovado, responsável designado, aceite de atletas, migração ou comando produtivo nesta entrega. **A etapa de laboratório está encerrada; PR #999 segue draft/sem merge; Issue #966 aberta; F23 não iniciada.**
