# CCH E5-D — Contratos propostos de consentimento M1 e recuperação contextual M4

**Estado:** desenho técnico testável, **não ativado**. Autoridade: CCH v5.4 FROZEN + Evolução Motor V1.0 FROZEN. F23 não aberta.

## Origem soberana inspecionada
- `supabase/migrations/20261107151317_health_m1_profile_goals.sql`: `health_consents` é append-only, `consent_type` somente cinco modalidades M1; `decision` granted/denied/revoked; RLS INSERT usa `health_can_manage_athlete_access` e `actor_auth_user_id=auth.uid()`, SELECT usa `health_can_read_athlete`. **O tipo específico E5 não cabe no CHECK**. Não usar `health_data_processing` nem `details` genérico para burlar isso.
- `supabase/migrations/20261107161317_health_m4_live_workout.sql`: `health_workout_events` já tem vínculo obrigatório sessão/atleta, evento `note`, `source='user'`, `payload jsonb`, `created_by_auth_user_id`, unicidade `(athlete_id,client_event_id)`, políticas RLS existentes. É **candidato de persistência** de uma confirmação *explicitamente* vinculada à sessão; ainda requer revisão de permissões e do fluxo de gravação antes de ativar.
- M9 `health_recovery_checkins`: métricas ordinais com data, mas sem FK de sessão. Essas observações não podem virar `good/poor` apenas por proximidade de data ou escala numérica.

## Contrato proposto (sem escrita)
`e5CaptureContracts.ts` especifica:
1. **Consentimento E5**: proposta de ampliar *em migration futura e separada* a enumeração do CHECK da tabela M1 para `e5_personalized_review`, preservando append-only, decisões explícitas, políticas por atleta, ator e versionamento. Antes da mudança, `currentSchemaAccepts=false` e `writeAuthorized=false`. Uma decisão de governança deve determinar o texto de informação/consentimento e o acesso apropriado, inclusive em casos de atleta menor de idade ou representação, antes de qualquer interface.
2. **Recuperação por sessão**: proposta de nota M4 com `event_type='note'`, `source='user'` e payload `{contract:'cch-e5-session-review-v1',explicit_confirmation:true,recovery:'good|poor|unknown',symptoms:'none|pain|unknown'}`. O extrator só aceita nota de autor autenticado previamente autorizado, mesma sessão/atleta, sessão `completed` e `record_status='active'`, timestamp válido e contrato explícito. Isso **não significa** que um evento com payload arbitrário tenha autorização automática: o futuro endpoint/RPC deverá controlar e auditar campos e identidade; a função pura não é controle de acesso.
3. **Meta de implementação futura:** confirmar objetivo atual na jornada já existente, consentimento persistível, recuperação autorrelatada e equipamento identificado no momento da execução V8. Não construir tabela, fila, motor ou catálogo paralelo. Respeitar `F22` como gate para qualquer publicação de draft.

## Critérios de próxima autorização
- Camada Mestre define política de consentimento E5 e versão textual, atores permitidos e revogação, preservando acesso do atleta.
- Contrato de alteração do CHECK M1, RLS real e integridade de decisões, testados em PostgreSQL descartável **antes** de migration na produção.
- Revisão da forma autorizada de gravar uma nota M4 depois da sessão, com actor/ownership/anti-replay/idempotência e contraditórios; testar no banco isolado e interface isolada. Não presumir que as políticas atuais permitam gravar nota depois da conclusão.
- Só habilitar interface depois de provas e autorização. Em caso de evidência insuficiente, E5-A/B continuam bloqueando personalização.
- E5-D é **desenvolvimento contratual e testes sintéticos**, não implementação de coleta real, consentimento real, diagnóstico, eficácia ou homologação clínica.

**Proteções:** nenhuma migration, SQL operacional, nova UI, consulta a Deividi/Rafaela, publicação, alteração de carga/volume ou F23 nesta entrega.
