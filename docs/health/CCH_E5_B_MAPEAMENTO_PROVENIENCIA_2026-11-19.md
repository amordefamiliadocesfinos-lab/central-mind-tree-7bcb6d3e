# CCH E5-B — Proveniência consultiva sem escrita

**Autoridade:** Mapa Soberano CCH v5.4 FROZEN e Evolução do Motor V1.0 FROZEN; acompanhamento Issue #966. F23 **não aberta**.

## Proveniência real do esquema (auditoria agregada de 19/11/2026, somente leitura)
- M3/F21: `health_program_versions`, `health_workout_sessions` (`program_version_id`, `status`, `record_status`).
- M4/F19: `health_workout_exercises`, `health_workout_sets` (`workout_exercise_id`, `session_id`, `load_value`, `load_unit`, `reps`, `rir`, `set_type`, `status`).
- V8: `health_cch_workout_equipment` (`athlete_id`, `session_id`, `workout_exercise_id`, `exercise_id`, `equipment_label`, `confirmed_at`). **Não há UUID da máquina nesta tabela**; não inventar `equipmentId`. O adaptador usa chave de *comparação por rótulo explicitamente confirmado na execução*, exercício e unidade. Isso **não prova identidade física independente**.
- F04/F13: `health_recovery_checkins` (`observed_on`, `metric_code`, `value_ordinal`, `status`) e `health_sleep_recovery_rolling_states`. **Não existe FK de sessão na tabela de check-in**. Não converter ordinal em `good/poor` nem ligar por dia sem contrato validado. E5-B aceita somente revisão explícita, específica da sessão, via `sessionReviews` (entrada futura; inexistente nos check-ins auditados); ausência permanece `unknown`.
- M1: `health_consents` (`athlete_id`, `consent_type`, `decision`, `policy_version`, `occurred_at`). Não transformar `health_data_processing` ou `coach_sharing` em consentimento E5. Exigir decisão vigente `e5_personalized_review` explícita, sem conflitos; **esse tipo não foi observado na auditoria real**. Não escrever consentimento por código.
- Objetivo: `health_goals` ativo `hypertrophy` no banco é contexto, **não** substitui escolha atual no fluxo de revisão.

## Contrato E5-B
`mapE5Provenance` recebe exclusivamente linhas já selecionadas por fonte autorizada, não executa SQL. Filtra atleta, versão de origem, sessão `completed/active`, exercício único por sessão, confirmação exata da execução e todas as séries de trabalho completas, com mesma unidade e mesma carga. Não calcula média entre cargas diferentes. Consolida de forma conservadora o mínimo de repetições e RIR para comparabilidade descritiva. Não extrapola outros exercícios, máquinas, versões ou atletas.

O adaptador alimenta o **gate E5-A existente** (`assessE5Evidence`) e registra lacunas rastreáveis; não cria motor/score paralelo. Usa dados sintéticos somente nos testes. Não há consultas reais a partir deste código, UI, migração, escrita, draft, publicação, prescrição automática ou afirmações clínicas.

## Maturidade e próximo gate
- **E5-B implementado e testado em CI** quando aprovada a PR; não homologado para personalização individual.
- Auditoria oficial 19/11: 0 confirmações V8, 0 check-ins de recuperação ativos e ausência de consentimento explícito E5 para Deividi e Rafaela; portanto o gate individual permanece **bloqueado**.
- Consulta RLS sob identidade autenticada precisa ser demonstrada separadamente antes de qualquer integração remota futura; a leitura administrativa agregada não comprova RLS.
- Evidência individual futura requer escolha atual, consentimento adequado, dados de recuperação interpretáveis e comparações repetidas da mesma origem. Mesmo com gate descritivo favorável, não há autorização para cálculo de kg ou mudança de volume.
