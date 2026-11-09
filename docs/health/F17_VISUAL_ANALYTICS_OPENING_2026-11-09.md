# F17 — ANALYTICS VISUAL E HISTÓRICO — OPENING

**Data:** 09/11/2026  
**Status:** ARQUITETURA ABERTA  
**Mapa:** CCH v4.2 FROZEN

## Missão

Adicionar gráficos históricos reais ao CCH usando somente dados soberanos já existentes.

## Problema

O CCH já possui:
- dashboards;
- estados;
- relatórios;
- históricos factuais.

Mas o módulo Saúde ainda não possui visualização temporal em gráficos.

## V1

Domínios:
- treino;
- alimentação;
- evolução corporal;
- recuperação.

Janelas:
- 30 dias;
- 90 dias;
- 180 dias.

## Sem nova persistência

F17 v1 não cria tabela nem migration.

Ela consulta dados sob RLS e deriva séries apenas na memória da interface.

## Fora do escopo

- score global;
- previsão;
- causalidade;
- diagnóstico;
- alertas;
- autoajuste;
- benchmark entre atletas;
- ranking;
- integração externa.
