# M4 Acceptance Report — Live Workout

Data: 07/11/2026  
Branch: `feat/health-m4-live-workout-20261107`  
PR: #478  
Base: `feat/health-m3-program-cch-20261107`  
Migration: `20261107161317_health_m4_live_workout`

## Resultado executivo

**M4 HEALTH: PASS**

A M4 introduziu a camada soberana de execução real do treino sem reescrever o planejamento publicado da M3.

## Separação de autoridade

- M3 = plano publicado;
- M4 = execução real;
- M5+ = interpretação/adaptação;
- fatos executados não reescrevem retroativamente a versão publicada.

## Banco

Tabelas:
- `health_workout_sessions`;
- `health_workout_exercises`;
- `health_workout_sets`;
- `health_workout_events`.

Fila M3:
- novo estado `in_progress`.

### Sessão
Registra:
- atleta;
- queue entry;
- versão;
- template;
- origem;
- status;
- início/fim;
- `start_client_event_id`.

Regras:
- uma sessão aberta por atleta;
- uma sessão aberta por queue entry;
- retry do mesmo start não duplica sessão.

### Exercício executado
Registra:
- exercício real;
- template original opcional;
- ordem;
- origem: template/manual/substitution;
- estado;
- referência ao exercício substituído;
- snapshot da prescrição planejada:
  - séries min/max;
  - reps min/max;
  - RIR alvo;
  - descanso.

### Série executada
Registra:
- número;
- tipo;
- carga;
- unidade;
- reps;
- RIR;
- descanso;
- client_event_id;
- timestamp.

### Eventos
`health_workout_events` é append-only para authenticated.

Tipos M4:
- session_started;
- session_paused;
- session_resumed;
- exercise_added;
- exercise_skipped;
- exercise_replaced;
- set_logged;
- set_updated;
- rest_recorded;
- session_completed;
- session_aborted;
- note.

## Idempotência

- sessão: `UNIQUE (athlete_id, start_client_event_id)`;
- séries: `UNIQUE (athlete_id, client_event_id)`;
- eventos: `UNIQUE (athlete_id, client_event_id)`.

Isso prepara retries/sincronização mobile sem duplicação de fatos.

## RPCs

Todos são `SECURITY INVOKER`:
- `health_m4_start_workout`;
- `health_m4_log_set`;
- `health_m4_update_set`;
- `health_m4_add_exercise`;
- `health_m4_skip_exercise`;
- `health_m4_replace_exercise`;
- `health_m4_complete_workout`.

Segurança:
- security_definer = false;
- anon EXECUTE = false;
- public EXECUTE = false;
- authenticated EXECUTE = true;
- RLS permanece autoridade final.

## Testes estruturais

PASS:
- RLS ativa nas 4 tabelas;
- authenticated sem auth.uid não enxerga sessões;
- anon sem SELECT;
- eventos sem UPDATE/DELETE para authenticated;
- segunda sessão aberta bloqueada;
- start_client_event_id duplicado bloqueado;
- client_event_id de série duplicado bloqueado;
- client_event_id de evento duplicado bloqueado;
- sessão completed sem ended_at bloqueada;
- estado in_progress aceito na fila;
- todos os dados sintéticos revertidos.

Observação:
a ferramenta de banco não permite simular JWT manualmente nesta fase; não houve tentativa de contornar essa proteção. A autorização cross-user continua apoiada nos helpers Health já provados na M0 e nas policies M4 que delegam a esses helpers.

## Frontend

### Rotas
- `/saude/treino` = execução ao vivo M4;
- `/saude/treino/programa` = construtor M3 preservado.

### Hook
`useHealthWorkoutM4`

Responsabilidades:
- próximo item da fila;
- sessão aberta;
- exercícios executados;
- séries;
- iniciar sessão;
- registrar/atualizar série;
- adicionar exercício;
- pular;
- substituir;
- concluir.

### Página Live Workout
Inclui:
- card do próximo treino;
- botão Iniciar;
- timer de sessão;
- prescrição planejada visível;
- carga;
- unidade;
- reps;
- RIR;
- descanso;
- histórico das séries;
- adicionar exercício;
- substituir;
- pular;
- concluir.

## Validação técnica

- npm ci: PASS;
- ESLint M4: PASS, zero erros/avisos;
- npm run build: PASS.

## Mobile-first

Larguras:
- 320 px: PASS;
- 360 px: PASS;
- 375 px: PASS;
- 390 px: PASS;
- 412 px: PASS;
- 430 px: PASS.

17 gates:
1. zero overflow;
2. nav Saúde sem regressão;
3. botão Programa >=44px;
4. card Próximo treino íntegro;
5. Iniciar treino >=44px/funcional;
6. header sticky + timer;
7. Leg press sem overflow;
8. inputs >=44px;
9. Registrar série funcional;
10. histórico da série correto;
11. Substituir/Pular;
12. Adicionar exercício;
13. Concluir >=44px/habilita após série;
14. conclusão remove sessão ativa;
15. footer não cobre conteúdo;
16. zero page errors Health;
17. zero requests REST health_* no harness.

## Smoke 375px

PASS:
- A1 Quadríceps;
- iniciar treino;
- Leg press 45°;
- 160 kg;
- 8 reps;
- RIR 2;
- descanso 120s;
- registrar série 1;
- adicionar Elevação lateral com halteres;
- substituir por Puxada alta;
- badge replaced;
- pular Puxada alta;
- badge skipped;
- concluir treino;
- retorno ao estado sem sessão ativa.

## Persistência após testes

- health_athletes = 0;
- health_programs = 0;
- health_program_versions = 0;
- health_cch_queue_entries = 0;
- health_workout_sessions = 0;
- health_workout_exercises = 0;
- health_workout_sets = 0;
- health_workout_events = 0.

## Advisors Supabase

Foi tentada leitura dos advisors de segurança/performance pelo conector Supabase usando o project ref conhecido.

Resultado:
- permission denied pelo conector;
- nenhum advisor foi marcado artificialmente como PASS.

A validação desta missão usa:
- RLS;
- grants;
- policies;
- constraints;
- funções SECURITY INVOKER;
- testes transacionais diretos via Lovable Cloud.

## Critérios M4-AC

| ID | Resultado |
|---|---|
| M4-AC-01 | PASS |
| M4-AC-02 | PASS |
| M4-AC-03 | PASS |
| M4-AC-04 | PASS |
| M4-AC-05 | PASS |
| M4-AC-06 | PASS |
| M4-AC-07 | PASS |
| M4-AC-08 | PASS |
| M4-AC-09 | PASS |
| M4-AC-10 | PASS |
| M4-AC-11 | PASS |
| M4-AC-12 | PASS |
| M4-AC-13 | PASS |
| M4-AC-14 | PASS |
| M4-AC-15 | PASS |
| M4-AC-16 | PASS |

## Fora da M4

- cálculo de recovery;
- Safety Gate avançado;
- prontidão;
- recomendação qual treino agora;
- progressão automática;
- equivalência dinâmica;
- Decision Ledger completo;
- biomecânica;
- AI Coach.

## Gate de continuidade

**M4 aprovada para M5 — Decision Engine / Recomendação.**

O merge do PR #478 permanece separado do aceite técnico e depende da integração de M0–M3.
