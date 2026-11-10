# F19 — PRODUCTION ACTIVATION BLOCKER — 2026-11-09

## Status

Gate B permanece **NÃO EXECUTADO**.

Nenhuma alteração de banco de produção foi realizada.

## Evidências

### Supabase connector

O conector disponível nesta conversa lista apenas:
- `gufyjtdgsdmowubdtdvo` — PAINEL AMOR DE FAMILIA — INACTIVE;
- `fmbarvtlfuvirwqpuydx` — painel-central-testes-mt — INACTIVE.

O projeto canônico de produção:
- `xkskyutmtlhivvpfxkjg`

não está disponível para o conector atual.

### GitHub Actions

Foi criado um workflow temporário, escopado exclusivamente para:
- production ref `xkskyutmtlhivvpfxkjg`;
- migration `20261110005023_health_f19_interactive_workout_timers.sql`.

A execução corrigida chegou ao job e encerrou com:

`F19_PRODUCTION_ACTIVATION_BLOCKED_NO_CREDENTIALS`

Todos os candidatos de:
- database URL;
- Supabase access token;
- database password

estavam vazios.

O workflow encerrou antes do preflight SQL e antes de qualquer DDL.

## Consequência

- F19 continua implementada em Git;
- migration continua versionada;
- Gate B continua pendente;
- Gate C/deploy não deve ser executado antes do backend F19;
- nenhum PASS operacional é inferido.

## Desbloqueio necessário

Uma das alternativas:

1. conectar o Supabase desta conversa à organização/conta que contém o projeto
   `xkskyutmtlhivvpfxkjg`;

ou

2. configurar credencial de produção no GitHub Actions, preferencialmente:
   - `SUPABASE_ACCESS_TOKEN` com acesso ao projeto canônico;
   - `SUPABASE_DB_PASSWORD` se exigido pela conexão remota.

Após o desbloqueio, aplicar somente:
`20261110005023_health_f19_interactive_workout_timers.sql`

e executar postcheck estrutural/autoridade antes do Gate C.
