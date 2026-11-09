# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v4.5 — FROZEN
**Data:** 09/11/2026
**Status:** VIGENTE · FROZEN
**Substitui:** v4.4 FROZEN
**Base:** `main@0c8737d386ab30a8f8fad14c5bee1947a54f72fc`

## 1. Estado soberano

- M0→M9: fundação homologada;
- F10→F18: implementados em Git;
- testes operacionais permanecem adiados;
- produção/deploy não são inferidos de merge.

## 2. F18 — Plano Alimentar Individual

Status de desenvolvimento:
- arquitetura: ✅
- schema em migration: ✅
- hook/UI: ✅
- RLS/imutabilidade: ✅
- macros completos: ✅
- refeições/itens/alternativas: ✅

Estado operacional:
- Gate B: ⛔ pendente;
- Gate C: ⛔ pendente;
- testes: ⏳ adiados;
- homologação real: ⏳ pendente.

## 3. Regra soberana da alimentação

Prescrição alimentar e execução real são fontes distintas.

- F18 = o que foi planejado;
- M5 diário = o que foi realmente consumido;
- M6 = estado observado;
- M7 = decisão nutricional.

Nenhuma camada pode transformar prescrição em fato consumido automaticamente.

## 4. Dieta específica de Deividi

O sistema agora suporta tecnicamente um plano individual do atleta Deividi.

A definição dos valores concretos da versão 1 deve usar dados atuais do atleta e decisão humana explícita.

Não inferir:
- peso atual;
- altura;
- objetivo atual;
- gasto energético;
- metas de kcal/macros;
- horários/preferências/restrições

quando esses dados não estiverem confirmados.

## 5. F19

**F19 NÃO ESTÁ ABERTA.**

Nova macrofrente exige requisito novo ou achado objetivo.

## 6. Trabalho permitido

Sem nova macrofase:
- hardening;
- UX;
- acessibilidade;
- performance;
- segurança;
- documentação;
- preparação de Gate B/C;
- preenchimento humano de plano individual;
- homologação quando autorizada.

## 7. Diretriz final

**F10→F18 implementados em Git.**

**F18 ainda não está operacional em produção sem Gate B + Gate C.**

**Nenhum teste não executado pode ser tratado como PASS.**
