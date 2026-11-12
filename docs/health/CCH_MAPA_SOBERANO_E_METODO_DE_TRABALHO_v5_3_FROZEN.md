# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v5.3 — FROZEN
**Data:** 12/11/2026
**Status:** VIGENTE · FROZEN
**Substitui:** v5.2 FROZEN

## Estado

- M0→M9: fundação;
- F10→F21: implementados;
- **F22 — Maturidade de Treino + Calibração Adaptativa: ABERTA**.

## Problema corrigido

O sistema não pode confundir:
1. nível real do praticante;
2. confiança que o CCH possui nos dados;
3. fase fisiológica/programática.

Um atleta avançado pode ter baseline CCH incompleto sem ser tratado como iniciante.

## Regras F22

### Maturidade
Nível do praticante é soberano e independente:
- beginner;
- intermediate;
- advanced.

### Confiança
O CCH mantém confiança separada:
- overall baseline;
- volume tolerance;
- recovery;
- RIR literacy;
- técnica;
- familiaridade por exercício.

### Calibração
Calibração é coleta/ajuste de confiança.
Não reduz automaticamente:
- volume;
- intensidade;
- frequência;
- complexidade do programa.

### Fase de treino
Fase representa o objetivo real:
- build;
- specialization;
- strength;
- maintenance;
- deload;
- return;
- custom.

Nunca usar `calibration` como substituto automático da fase produtiva.

### Publication Gate
Nenhum exercício obrigatório de template publicado pode ter nulos em:
- planned_sets_min;
- planned_sets_max;
- reps_min;
- reps_max;
- rir_target;
- rest_seconds.

## Estado inicial dos atletas

- Deividi: advanced.
- Rafaela: advanced.

## F23
F23 não está aberta.
