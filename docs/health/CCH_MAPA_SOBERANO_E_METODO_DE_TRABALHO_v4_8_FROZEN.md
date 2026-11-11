# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v4.8 — FROZEN
**Data:** 11/11/2026
**Status:** VIGENTE · FROZEN
**Substitui:** v4.7 FROZEN

## 1. Estado soberano

- M0→M9: fundação;
- F10→F19: implementados;
- **F20 — Treinos Multimodais e Múltiplas Sessões Diárias: ABERTA**.

## 2. Achado objetivo

O banco atual de musculação:
- permite várias sessões concluídas no mesmo dia;
- não possui unicidade por data;
- limita apenas a uma sessão de musculação aberta por atleta;
- inicia sessões programadas pela fila CCH;
- modela execução com séries, carga, reps, RIR e descanso.

Não existe atualmente tabela própria para corrida/cardio/Pilates/dança/yoga/mobilidade/esportes.

## 3. F20 — missão

Permitir que o atleta registre várias sessões no mesmo dia, de modalidades diferentes,
sem forçar modalidades não-musculação ao modelo de séries/reps/carga.

## 4. Modalidades v1

- corrida;
- caminhada;
- ciclismo;
- natação;
- remo;
- elíptico;
- escada/stair;
- cardio genérico;
- Pilates;
- yoga;
- mobilidade;
- dança/ritmos;
- trilha;
- esporte;
- artes marciais;
- outra atividade.

O catálogo deve ser extensível.

## 5. Métricas

Campos opcionais conforme a modalidade:
- duração;
- distância;
- ritmo/pace;
- velocidade média;
- calorias;
- frequência cardíaca média/máxima;
- RPE;
- cadência;
- ganho de elevação;
- passos;
- observações.

Corridas e atividades intervaladas podem registrar segmentos/voltas.

## 6. Múltiplas sessões

Não existe limite de uma sessão por dia.

Exemplos válidos:
- musculação de manhã + corrida à noite;
- corrida + Pilates;
- duas corridas no mesmo dia;
- musculação + caminhada + mobilidade;
- dois treinos de musculação concluídos no mesmo dia, seguindo a fila CCH.

Cada sessão preserva sua identidade e horário.

## 7. Sessões simultâneas

F20 v1 privilegia sessões sequenciais.
A interface não deve incentivar cronômetros concorrentes entre modalidades.

## 8. História diária

A experiência de treino deve oferecer uma linha do tempo do dia com:
- musculação;
- atividades multimodais;
- horários;
- duração;
- status;
- métricas principais.

## 9. F21

F21 não está aberta.
