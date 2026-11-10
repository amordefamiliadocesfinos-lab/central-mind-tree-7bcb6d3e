# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v4.7 — FROZEN
**Data:** 09/11/2026
**Status:** VIGENTE · FROZEN
**Substitui:** v4.6 FROZEN
**Base:** `main@11acdad59e9a674c0d1e24c378473d8dae85072a`

## 1. Estado soberano

- M0→M9: fundação homologada;
- F10→F19: implementados em Git;
- testes operacionais permanecem adiados;
- produção/deploy não são inferidos de merge.

## 2. F19 — Cronômetro Interativo

Status de desenvolvimento:
- cronômetro da sessão: ✅
- pausa/retomada: ✅
- execução por série: ✅
- descanso automático: ✅
- descanso extra contínuo: ✅
- aviso de retorno: ✅
- work_seconds: ✅
- rest_seconds factual: ✅
- fluxo click-first: ✅
- persistência sem localStorage: ✅
- RLS/RPC authority: ✅

Estado operacional:
- Gate B: ⛔ pendente;
- Gate C: ⛔ pendente;
- testes: ⏳ adiados;
- homologação real: ⏳ pendente.

## 3. Regra soberana de execução

Planejamento e execução continuam separados.

- séries/reps/RIR/descanso planejados = prescrição;
- carga/reps/RIR/tempo medidos = execução real;
- desconhecido permanece desconhecido;
- cronômetro nunca preenche desempenho que o usuário não informou.

## 4. UX soberana F19

Fluxo principal:
**Iniciar série → Concluir série → Descanso → Voltar ao exercício**

O descanso:
- avisa ao atingir a meta;
- não para sozinho;
- continua acumulando;
- fecha quando o usuário toca.

## 5. F20

**F20 NÃO ESTÁ ABERTA.**

Nova macrofrente exige requisito novo ou achado objetivo.

## 6. Gates

F19 depende de Gate B para ativar a migration.
Visibilidade no Programa Saúde depende de Gate C/deploy.
Nenhum teste não executado pode ser tratado como PASS.

## 7. Diretriz final

**F10→F19 implementados em Git.**

**F18 e F19 ainda podem depender de migrations/deploy pendentes conforme seus fechamentos.**

**Produção não foi alterada por esta frente.**
