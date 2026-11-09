# CCH — DECISÃO DE GOVERNANÇA v4.4 — ABERTURA F18

**Data:** 09/11/2026
**Status:** APROVADA POR REQUISITO NOVO EXPLÍCITO DO USUÁRIO
**Base:** `main@8ebaf98644df7dde1175d3083f706d00d34c3243`

## Achado objetivo

O módulo Alimentação já possui:
- plano nutricional por atleta;
- versões do plano;
- metas de energia/proteína/carboidrato/gordura/fibra no banco;
- receitas;
- diário alimentar;
- estado M6;
- decisão M7.

Lacuna confirmada:
- não existe entidade de **refeição prescrita**;
- não existe **item planejado por refeição**;
- não existe **alternativa/substituição estruturada**;
- a UI expõe somente energia/proteína, apesar do banco já suportar macros adicionais.

## Nova frente

### F18 — Plano Alimentar Individual

Missão:
permitir prescrição alimentar versionada por atleta, separando claramente planejamento de execução real.

## Escopo v1

- padrões de dia (padrão/treino/descanso/custom);
- refeições planejadas;
- itens planejados;
- alternativas/substituições;
- energia, proteína, carboidratos, gorduras e fibras;
- integração com alimentos e receitas existentes;
- UI Dieta com organização por Plano / Refeições / Receitas / Diário / Evolução.

## Autoridade

F18 não altera automaticamente:
- diário alimentar;
- peso;
- treino;
- objetivo;
- decisões M6/M7.

Prescrição e execução permanecem fontes distintas.

## Gates

- Gate A: autorizado.
- Gate B: necessário para nova migration; não autorizado automaticamente.
- Gate C: separado.
- testes permanecem adiados por autorização vigente.
