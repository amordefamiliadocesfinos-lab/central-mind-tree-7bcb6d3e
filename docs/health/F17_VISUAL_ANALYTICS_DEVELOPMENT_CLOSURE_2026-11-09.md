# F17 — ANALYTICS VISUAL E HISTÓRICO — DEVELOPMENT CLOSURE

**Data:** 09/11/2026  
**Status:** IMPLEMENTADA EM GIT · TESTES/DEPLOY ADIADOS

## Arquitetura

- PR #524
- merge: `3c08f7d39391610bbd43568191ee7318ac8261c5`

## Implementação

- PR #525
- merge: `a7380e872baf0b9e82ff749955d160b37cd96af0`

## Entregas

- `useHealthAnalyticsF17`;
- `/saude/analytics`;
- janelas 30/90/180 dias;
- treino:
  - sessões;
  - séries;
  - repetições;
  - volume kg;
- alimentação:
  - energia;
  - proteína;
  - completude;
- corpo:
  - peso;
  - cintura;
  - gordura corporal;
- recuperação:
  - sono;
  - recuperação;
  - prontidão;
  - fadiga;
- navegação Health;
- CTA no painel Hoje;
- gaps reais preservados;
- leitura parcial por domínio.

## Autoridade

F17:
- não possui migration;
- não possui RPC;
- não escreve em banco;
- não cria score;
- não diagnostica;
- não infere causalidade;
- não altera plano.

## Estado

- arquitetura: ✅
- código: ✅
- auditoria estática de read-only: ✅
- testes: ⏳ adiados
- Gate B: n/a
- Gate C/deploy: ⏳
- homologação visual/real: ⏳
