# F22 — MATURIDADE DE TREINO + CALIBRAÇÃO ADAPTATIVA — ARQUITETURA V1

## 1. health_training_profiles

Uma linha por atleta:
- training_level;
- overall_baseline_confidence;
- technical_proficiency;
- rir_proficiency;
- volume_tolerance_confidence;
- recovery_confidence;
- notes.

Escalas de confiança 0–1.

## 2. health_exercise_calibration_profiles

Uma linha por atleta/exercício:
- familiarity_level;
- exposure_count;
- load_confidence;
- rep_response_confidence;
- rir_confidence;
- status;
- last_exposure_at.

Calibração acontece por exercício e por parâmetro.

## 3. Fase x calibração

A fase continua em health_goal_phases / parameter_set.phase.
Calibração passa para:
- health_training_profiles;
- health_exercise_calibration_profiles;
- parameter_set.baseline_state apenas como metadado auxiliar.

## 4. Publication Gate

health_m3_publish_program_version deve rejeitar exercício não opcional com prescrição incompleta.

Também deve rejeitar:
- sets_min < 1;
- sets_max < sets_min;
- reps_min < 1;
- reps_max < reps_min;
- RIR fora de 0–6;
- descanso <= 0.

## 5. Programas atuais

### Deividi
- training_level=advanced;
- fase real: build / hipertrofia;
- remover calibration como phase do parameter_set.

### Rafaela
- training_level=advanced;
- fase real: build / hipertrofia;
- baseline CCH em construção, sem reduzir prescrição;
- duas passagens produtivas:
  - A1/B1/C1/D1 = orientação tensão;
  - A2/B2/C2/D2 = orientação volume.

## 6. Compatibilidade

Sessões já iniciadas são fatos históricos e não são reescritas.
Templates corrigidos afetam apenas novas sessões iniciadas depois da correção.
