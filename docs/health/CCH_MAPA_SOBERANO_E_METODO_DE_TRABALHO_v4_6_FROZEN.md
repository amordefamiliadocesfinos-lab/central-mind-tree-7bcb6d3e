# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v4.6 — FROZEN
**Data:** 09/11/2026
**Status:** VIGENTE · FROZEN
**Substitui:** v4.5 FROZEN
**Base:** `main@b1971141802fbe56bb9522f54d3683e8bd659b26`

## 1. Estado soberano

- M0→M9: fundação homologada;
- F10→F18: implementados em Git;
- **F19 — Cronômetro Interativo de Treino e Descanso: ABERTA**;
- testes operacionais permanecem adiados;
- produção/deploy não são inferidos de merge.

## 2. F19 — escopo v1

1. cronômetro principal do treino com pausa/retomada;
2. tempo ativo excluindo pausas;
3. cronômetro de execução por série/exercício;
4. descanso iniciado automaticamente após conclusão da série;
5. meta visual de descanso baseada em `planned_rest_seconds`;
6. contador de descanso continua após a meta;
7. aviso de retorno quando a meta é atingida;
8. toque "Voltar ao exercício" registra descanso real;
9. fluxo rápido por cliques;
10. atualização automática da interface após cada ação;
11. persistência para sobreviver a reload/retorno à página.

## 3. Regra factual

- prescrição de descanso = alvo;
- descanso medido = fato;
- tempo de execução medido = fato;
- pausa da sessão = fato;
- ausência de carga/reps/RIR não pode virar zero nem valor prescrito.

## 4. F20

F20 não está aberta.

## 5. Gates

Migration F19 exigirá Gate B.
Deploy exigirá Gate C.
Nenhum teste não executado pode ser tratado como PASS.
