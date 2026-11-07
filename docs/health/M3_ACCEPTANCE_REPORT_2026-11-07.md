# M3 Acceptance Report — Programa / CCH

Data: 07/11/2026  
Branch: `feat/health-m3-program-cch-20261107`  
Base: `feat/health-m2-catalogs-20261107`

Migrations:
- `20261107155747_health_m3_program_cch`
- `20261107160110_health_m3_program_rpcs`

## Resultado executivo

**M3 HEALTH: PASS**

A M3 introduziu a estrutura planejada de programas CCH com versionamento, prioridades musculares, sessões, prescrição planejada e fila contínua, sem antecipar fatos de execução da M4 nem decisões dinâmicas da M5.

## Banco

Tabelas:
- `health_programs`;
- `health_program_versions`;
- `health_program_muscle_priorities`;
- `health_session_templates`;
- `health_session_template_exercises`;
- `health_cch_queue_entries`.

## Versionamento

Fluxo:
`programa → versão draft → prioridades/templates/exercícios → publicação → current_version → fila CCH`.

Regras:
- versões começam em `draft`;
- publicação é uma transição one-way para o cliente autenticado;
- estruturas filhas só podem ser modificadas enquanto a versão é draft;
- `current_version_id` só aceita versão publicada do mesmo programa/atleta;
- histórico publicado não é reescrito pelo frontend.

## Fila CCH

A fila armazena:
- posição contínua;
- template;
- versão;
- estado;
- origem;
- reason_codes;
- bloqueio/eligible_after quando aplicável.

Na M3 ela é estrutural. Estados de recuperação, interferência e recomendação entram posteriormente.

## RPCs atômicos

### health_m3_create_program_draft
Cria:
- programa;
- versão 1 draft.

### health_m3_publish_program_version
Executa em uma única transação:
- valida versão draft;
- exige ao menos uma sessão ativa;
- exige exercício em toda sessão ativa;
- publica versão;
- ativa programa;
- define current_version;
- semeia fila CCH em sequence_order;
- adiciona reason code `PROGRAM_VERSION_PUBLISHED`.

Segurança:
- SECURITY INVOKER;
- anon EXECUTE = false;
- public EXECUTE = false;
- authenticated EXECUTE = true;
- RLS permanece soberana.

## Testes estruturais

PASS:
- authenticated sem auth.uid não enxerga programas;
- um programa ativo por atleta;
- versão draft não pode ser current_version;
- versão publicada pode ser current_version;
- sequência duplicada de sessão bloqueada;
- posição duplicada de fila bloqueada;
- versão cruzando atleta bloqueada por FK;
- fila cruzando template de outro atleta bloqueada por FK;
- todos os dados sintéticos revertidos.

Persistência após testes:
- programs = 0;
- versions = 0;
- priorities = 0;
- templates = 0;
- template_exercises = 0;
- queue_entries = 0.

## Frontend

### Hook
`useHealthProgramM3`

Responsabilidades:
- carregar programa/versão;
- prioridades;
- templates;
- exercícios planejados;
- fila;
- criar programa;
- adicionar prioridade;
- adicionar sessão;
- adicionar exercício;
- publicar via RPC.

### Página
`/saude/treino`

Estados:
1. sem programa;
2. versão draft editável;
3. versão publicada bloqueada;
4. fila CCH visível.

## Validação técnica

- npm ci: PASS;
- ESLint M3: PASS, zero erros/avisos;
- npm run build: PASS.

## Mobile-first

Larguras:
- 320 px: PASS;
- 360 px: PASS;
- 375 px: PASS;
- 390 px: PASS;
- 412 px: PASS;
- 430 px: PASS.

Gates:
- zero overflow;
- nav Saúde sem regressão;
- controles >=44px;
- prioridades sem estouro;
- selects utilizáveis;
- criação de sessão funcional;
- bloco de exercício responsivo;
- inputs de prescrição utilizáveis;
- cards sem corte;
- publicar >=44px;
- fila ordenada;
- footer sem cobrir conteúdo;
- zero page errors Health.

Smoke 375px:
- Quadríceps prioridade 1;
- sessão A1 criada;
- Leg press 45° adicionado;
- prescrição 3–4 séries, 6–10 reps, RIR 2;
- publicação simulada;
- fila CCH com A1 posição 1;
- reason code `PROGRAM_VERSION_PUBLISHED`.

## Critérios M3-AC

| ID | Resultado |
|---|---|
| M3-AC-01 | PASS |
| M3-AC-02 | PASS |
| M3-AC-03 | PASS |
| M3-AC-04 | PASS |
| M3-AC-05 | PASS |
| M3-AC-06 | PASS |
| M3-AC-07 | PASS |
| M3-AC-08 | PASS |
| M3-AC-09 | PASS |
| M3-AC-10 | PASS |
| M3-AC-11 | PASS |
| M3-AC-12 | PASS |
| M3-AC-13 | PASS |
| M3-AC-14 | PASS |
| M3-AC-15 | PASS |
| M3-AC-16 | PASS |

## Fora da M3

- treino ao vivo;
- séries/carga/reps executadas;
- cronômetro/descanso real;
- substituição durante sessão;
- dor/evento safety durante treino;
- recovery engine;
- progressão;
- Decision Ledger completo;
- AI Coach.

## Gate de continuidade

**M3 aprovada para M4 — Live Workout.**

O merge permanece separado e depende da integração de M0/M1/M2.
