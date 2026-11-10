# F19 — PRODUCTION ACTIVATION — LOVABLE CLOUD — 2026-11-09

## Status

**BLOQUEIO ANTERIOR RESOLVIDO.**

O diagnóstico anterior via conector Supabase estava correto apenas para aquele conector:
ele não enxergava o banco canônico porque o Painel Central usa **Lovable Cloud Database
com stack Supabase**.

O caminho operacional correto é o projeto Lovable:

- projeto: `PAINEL CENTRAL`
- project id: `1720a410-34cd-4410-995c-8c92c7edf16b`
- database: enabled
- stack: `supabase`

## Gate B — concluído

Migration aplicada diretamente pelo Lovable Cloud Database:

`20261110005023_health_f19_interactive_workout_timers.sql`

Preflight antes da aplicação:
- M4 baseline presente;
- F19 totalmente ausente;
- nenhum estado parcial.

Postcheck:
- `F19_SCHEMA_PASS`
- `F19_RLS_PASS`
- `F19_AUTHORITY_PASS`

Histórico de migrations alinhado:
- version: `20261110005023`
- name: `health_f19_interactive_workout_timers`
- created_by: `chatgpt_lovable_cloud`

## Gate C — publicação disparada

Deploy solicitado pelo mecanismo de publicação do Lovable, sem uso do construtor/agent.

- deployment id: `d4e19626-f6e8-4bcf-a47d-528e0fb83c22`
- URL: `https://central-mind-tree.lovable.app`
- commit sincronizado no projeto: `6e51b2b35e8a36a198ba4da59ef14d6c9935907d`
- projeto reportado como published/ready após o disparo.

A API de deploy retornou inicialmente `pending`; não inferir homologação funcional
de usuário apenas a partir da publicação.

## Regra operacional corrigida

Para este projeto:

- Git/GitHub continua sendo a fonte de código;
- migrations continuam versionadas em Git;
- banco de produção é acessado pelo **Lovable Cloud Database**;
- não usar o Lovable Builder/agent para autoria;
- a função de database/deploy do Lovable pode ser usada como infraestrutura operacional,
  preservando Git como fonte soberana.

## Testes

Nenhum teste funcional adicional foi executado nesta ativação, conforme política vigente.
Os postchecks foram estruturais/de autoridade.
