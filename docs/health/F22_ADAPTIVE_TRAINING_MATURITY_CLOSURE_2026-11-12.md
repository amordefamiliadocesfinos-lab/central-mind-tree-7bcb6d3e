# F22 — MATURIDADE DE TREINO + CALIBRAÇÃO ADAPTATIVA — CLOSURE

**Data:** 12/11/2026
**Status:** OPERACIONAL
**Base funcional:** `main@cf2fdb3ad60c50978ee9614e3adcac2901e04290`

## Problema resolvido

O sistema deixou de confundir:
- nível real do praticante;
- confiança do CCH nos dados;
- fase produtiva do treinamento.

Calibração não reduz automaticamente o treino.

## Perfil soberano

### Deividi
- training_level: advanced;
- training_level_source: owner_confirmed;
- phase: build;
- baseline_state: partial;
- calibration_policy: non_limiting;
- objetivo/fase ativos de hipertrofia ligados ao programa.

### Rafaela
- training_level: advanced;
- training_level_source: owner_confirmed;
- phase: build;
- baseline_state: collecting;
- calibration_policy: non_limiting;
- fase: Bloco inicial de hipertrofia;
- prioridade: inferiores e costas.

## Confiança por exercício

Nova tabela:
`health_exercise_calibration_profiles`

Registra:
- sessões de exposição;
- séries concluídas;
- observações de carga;
- observações de RIR;
- confiança de carga;
- confiança de resposta em reps;
- confiança de RIR;
- última exposição.

A confiança descreve a evidência interna do CCH e não a capacidade do atleta.

## Publication Gate

A publicação de programa agora bloqueia exercício obrigatório sem:
- séries mínimas/máximas;
- reps mínimas/máximas;
- RIR;
- descanso.

Também bloqueia faixas inválidas.

Exercícios obrigatórios de versões já publicadas ficam protegidos contra regressão para prescrição incompleta.

## Rafaela — programa corrigido

As duas passagens deixam de ser "calibração 1/2" e viram:

Primeira passagem:
- A1 Quadríceps — tensão;
- B1 Costas — tensão;
- C1 Posterior — tensão;
- D1 Glúteos — tensão.

Segunda passagem:
- A2 Quadríceps — volume;
- B2 Costas — volume;
- C2 Posterior — volume;
- D2 Glúteos — volume.

Todos os exercícios obrigatórios futuros possuem prescrição completa.

## Preservação histórica

O C1 já iniciado antes da F22 não foi reescrito.
Seu snapshot histórico permanece como foi iniciado.

Sessões futuras copiam os templates corrigidos.

## Banco

Migration:
`20261112175528_health_f22_adaptive_training_maturity.sql`

Postcheck:
- 2 perfis de treinamento criados;
- Deividi advanced;
- Rafaela advanced;
- phase=build em ambos;
- 0 exercícios obrigatórios incompletos na versão publicada da Rafaela;
- 24 perfis de exercício observados para Deividi;
- 12 perfis de exercício observados para Rafaela no momento da ativação;
- Publication Gate function: OK;
- Publication Gate trigger: OK;
- proteção de template publicado: OK;
- migration history: OK.

## Frontend

A tela Programa agora mostra:
- nível real;
- fase;
- estado do baseline;
- confiança dos dados;
- calibração não limitante;
- evidência interna por exercício;
- readiness para publicação.

## Regra central

**Calibrar o sistema ao atleta, nunca rebaixar o atleta para caber na calibração do sistema.**
