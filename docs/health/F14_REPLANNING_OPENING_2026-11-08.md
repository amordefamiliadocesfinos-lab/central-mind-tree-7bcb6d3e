# F14 — REPLANEJAMENTO ASSISTIDO — OPENING

**Data:** 08/11/2026  
**Status:** ARQUITETURA ABERTA  
**Mapa:** CCH v4.0 FROZEN

## Missão

Fechar o ciclo do CCH após a F13:

dados → estados → decisões → revisão longitudinal → **replanejamento humano**.

A F14 não é um motor autônomo de prescrição. Ela é uma camada de workflow, rastreabilidade e revisão.

## Entrada principal

A entrada soberana da F14 é uma revisão F13 existente:

- `health_longitudinal_review_runs`;
- outcome humano atual de `health_longitudinal_review_outcomes`.

## Saída

Um caso de replanejamento contendo:

- atleta;
- revisão F13 de origem;
- outcome de origem;
- domínios em revisão;
- snapshot/evidência congelada;
- itens de revisão;
- decisão humana por item;
- notas;
- estado do caso;
- histórico auditável.

## Regra central

A F14 **não altera diretamente**:

- `health_goals`;
- `health_goal_phases`;
- programa/versão de treino;
- prescrições;
- plano nutricional;
- registros corporais;
- recuperação;
- exames/biomarcadores.

Mudanças reais continuam sendo feitas no especialista dono do domínio.

## Estados do caso

- `open`
- `in_review`
- `completed`
- `voided`

## Estados dos itens

- `pending`
- `keep_current`
- `revise`
- `defer`
- `not_applicable`

## Domínios v1

- goal
- training
- nutrition
- body
- recovery

## Fora do escopo

- ajuste automático de treino;
- ajuste automático de dieta;
- alteração automática de metas;
- diagnóstico;
- causalidade automática;
- recomendação terapêutica;
- IA como autoridade final;
- disparar mudança no especialista por RPC F14.
