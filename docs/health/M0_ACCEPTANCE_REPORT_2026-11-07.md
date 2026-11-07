# M0 Acceptance Report — Saúde / CCH

Data: 07/11/2026  
Branch: `feat/health-m0-foundation-20261107`  
PR: #474  
Supabase/Lovable Cloud: projeto `1720a410-34cd-4410-995c-8c92c7edf16b`  
Migration: `20261107144000_health_m0_foundation`

## Resultado executivo

**M0 HEALTH: PASS**

A fundação do domínio Saúde/CCH foi implementada e validada em branch isolada, com fundação de dados aplicada no Lovable Cloud, RLS específica, Storage privado, onboarding, guard de autorização, shell mobile-first e entrada global no Painel Central.

O PASS é do **escopo Health/M0**. Dois débitos preexistentes da plataforma foram registrados como não bloqueadores desta missão:
1. lint global histórico do Painel;
2. touch targets de 29px no GlobalFooterBar.

Nenhum dos dois foi introduzido pela branch Health.

## Evidências principais

### Git / isolamento
- branch isolada criada a partir da main soberana;
- PR #474 aberto;
- nenhuma escrita direta na main;
- alterações Health separadas e auditáveis.

### Banco / migration
- `health_athletes` criada;
- `health_athlete_access` criada;
- RLS habilitada em ambas;
- migration aplicada via Lovable Cloud;
- ledger `supabase_migrations.schema_migrations` reconciliado;
- rollback manual versionado;
- bucket `health-private` criado como privado.

### Segurança
- autorização por `auth.users.id` + relações explícitas;
- `app_users` não é autoridade universal de Health;
- helpers Health sem EXECUTE para anon/PUBLIC;
- usuário B não consegue ler/escrever/administrar atleta A;
- atleta supervisionado sem login suportado;
- delegação revogável suportada;
- buckets públicos legados não são reutilizados para mídia corporal.

### Onboarding
Fluxo:
`sessão autenticada → lookup health_athlete → onboarding se ausente → criação do próprio perfil → acesso ao módulo`.

Teste transacional:
- criação própria: PASS;
- duplicação do mesmo `auth_user_id`: bloqueada;
- cross-user: 0 registros;
- rollback dos dados sintéticos: concluído.

Persistência após testes:
- `health_athletes = 0`;
- `health_athlete_access = 0`.

Nenhum dado pessoal real foi criado durante a validação.

### Frontend
Rotas:
- `/saude`;
- `/saude/hoje`;
- `/saude/treino`;
- `/saude/alimentacao`;
- `/saude/evolucao`;
- `/saude/perfil`;
- `/saude/recuperacao`;
- `/saude/biblioteca`.

Navegação interna:
- Hoje;
- Treino;
- Dieta/Alimentação;
- Evolução;
- Perfil.

### Navegação global
- item Saúde adicionado ao GlobalFooterBar;
- Saúde permanece no overflow móvel, sem substituir os cinco itens primários;
- ao entrar em qualquer `/saude/*`, o botão overflow representa Saúde como seção ativa;
- `/academia` permanece separado.

## Validação técnica

### Dependências
- `npm ci`: PASS.

### Build
- `npm run build`: PASS.

### TypeScript
- workflows existentes da branch: PASS.

### Lint Health
- `src/modules/health/**`: PASS;
- `src/App.tsx`: PASS;
- alterações Health em navegação global: sem erros introduzidos.

### Débito de lint preexistente
O lint do arquivo completo `GlobalFooterBar.tsx` ainda acusa:
- 1 `no-explicit-any` em código antigo de Web Audio;
- 3 avisos `react-hooks/exhaustive-deps`.

Esses trechos existiam antes da branch Health e não foram modificados pela integração Saúde.

## Mobile-First Gate

Larguras testadas:
- 320 px: PASS;
- 360 px: PASS;
- 375 px: PASS;
- 390 px: PASS;
- 412 px: PASS;
- 430 px: PASS.

Critérios Health:
- zero overflow horizontal: PASS;
- 5 itens internos: PASS;
- labels sem truncamento problemático: PASS;
- sem artefato literal `\n`: PASS;
- nav interna >=44px: PASS (56px);
- botão onboarding >=44px: PASS;
- input onboarding >=44px: PASS;
- safe-area top implementada: PASS;
- folga inferior Health >= footer real: PASS;
- zero erros do módulo Health: PASS.

## Débito mobile preexistente do Painel

Os botões do GlobalFooterBar medem aproximadamente 29px de altura e usam o padrão preexistente `no-touch-min`.

Também foi observado comportamento de wrap do footer em larguras menores, já presente antes da inclusão de Saúde.

A branch Health:
- não aumentou a altura do footer;
- não alterou os cinco itens primários;
- não introduziu o wrap;
- manteve o botão Saúde funcional/clicável no overflow.

**Classificação:** dívida de plataforma / UX global, não bloqueadora da M0 Health. Deve ser tratada em missão própria do shell global do Painel Central.

## Critérios M0-AC

| ID | Critério | Resultado |
|---|---|---|
| M0-AC-01 | Repo/branch/deploy identificados | PASS |
| M0-AC-02 | Supabase oficial e migration path identificados | PASS |
| M0-AC-03 | Athlete/access fechado | PASS |
| M0-AC-04 | RLS cross-user validada | PASS |
| M0-AC-05 | Storage sensível privado | PASS |
| M0-AC-06 | `/saude/*` sem quebrar `/academia` | PASS |
| M0-AC-07 | Mobile 320–430 px | PASS |
| M0-AC-08 | Primeiro fluxo de onboarding executável | PASS |
| M0-AC-09 | Idempotência estrutural prevista | PASS |
| M0-AC-10 | Decision/algorithm contracts presentes | PASS |
| M0-AC-11 | Sem exposição Health em buckets públicos | PASS |
| M0-AC-12 | Build/TypeScript e lint Health | PASS |
| M0-AC-13 | Evidências documentadas | PASS |

## Golden / Red-Team executados nesta M0

- cross-user read denial: PASS;
- cross-user write denial: PASS;
- cross-user manage denial: PASS;
- duplicação de atleta próprio: bloqueada;
- bucket privado: PASS;
- onboarding sem dado real: PASS;
- mobile 320–430 px: PASS;
- navegação Saúde em subrotas: PASS;
- regressão de build: PASS.

## Itens deliberadamente fora da M0

Não são bloqueadores deste relatório:
- treino funcional completo;
- catálogo de exercícios;
- Motor CCH completo;
- nutrição funcional;
- corpo/fotos reais;
- AI Coach;
- integração completa com Calendário/Rotina;
- análise de vídeo N2/N3;
- multi-coach completo.

## Gate de continuidade

**M0 Health aprovada para continuidade para M1.**

A próxima missão pode iniciar Perfil/Objetivos/Locais/Equipamentos/Consentimentos sobre esta fundação.

O merge do PR na `main` continua sendo uma ação separada do aceite técnico e deve ocorrer pelo fluxo normal do Painel Central.
