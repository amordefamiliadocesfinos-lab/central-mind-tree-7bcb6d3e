# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v4.2 — FROZEN  
**Data:** 09/11/2026  
**Status:** VIGENTE · FROZEN  
**Substitui:** v4.1 FROZEN  
**Base:** `main@5b785e244368aa8e09005d12ee0f4359cc8fa3e8`

## 1. Estado consolidado

- M0→M9: homologados;
- F10→F16: implementados em Git;
- testes/ativações pendentes permanecem explícitos;
- produção/deploy não são inferidos a partir de merge.

## 2. Escopo vigente

1. F10 — Dashboard Integrado
2. F11 — Motor Integrado CCH
3. F12 — Jornada real completa
4. F13 — Evolução contínua por dados reais
5. F14 — Replanejamento Assistido
6. F15 — Relatórios Longitudinais
7. F16 — Lembretes e Rotina
8. **F17 — Analytics Visual e Histórico**

Nenhuma F18 está aprovada.

## 3. F17 — Analytics Visual e Histórico

### Missão

Entregar gráficos e histórico visual usando dados soberanos já existentes.

### Domínios v1

#### Treino
- sessões concluídas por dia;
- séries concluídas;
- repetições;
- volume registrado em kg quando carga e repetições existirem.

#### Alimentação
- energia observada por dia;
- proteína observada por dia;
- status de completude do diário.

#### Corpo
- peso;
- cintura;
- gordura corporal;
- apenas avaliações ativas.

#### Recuperação
- duração de sono;
- recuperação física;
- prontidão;
- fadiga.

### Janelas v1

- 30 dias;
- 90 dias;
- 180 dias.

### Autoridade

F17 é somente leitura.

Não cria score global.
Não converte ausência em zero.
Não compara escalas incompatíveis.
Não converte lb/bodyweight em kg silenciosamente.
Não infere causalidade.

## 4. Dados soberanos

F17 reutiliza:

- M4 `health_workout_*`;
- M5 `health_food_log_days`, `health_meal_logs`, `health_meal_items`;
- M8 `health_body_assessments`, `health_body_measurements`;
- M9 `health_sleep_periods`, `health_recovery_checkins`.

Nenhuma tabela F17 é necessária na v1.

## 5. Gates

Gate A: permitido conforme autorização atual.

Gate B: n/a para F17 v1 sem migration.

Gate C: separado.

## 6. Próxima frente

A frente aberta é:

**F17 — Analytics Visual e Histórico.**

F18 não deve ser criada sem novo achado/requisito e nova versão formal do mapa.
