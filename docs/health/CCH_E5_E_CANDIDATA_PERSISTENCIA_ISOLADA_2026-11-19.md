# CCH E5-E — Candidata de persistência: apenas PostgreSQL descartável

**Autoridade:** Deliberação Camada Mestre 19/11/2026; CCH v5.4 FROZEN e Evolução V1.0 FROZEN. **PR deve permanecer aberta sem merge.** Issue #966 aberta; F23 não aberta.

## Implantação estritamente bloqueada
A candidata está em `supabase/candidates/health_cch_e5e_persistence_candidate.sql` (**fora** de `supabase/migrations`) para evitar aplicação automática por processos que detectem novas migrations. Não usar em nenhum banco Lovable/Supabase real, não copiar para pasta migrations, não criar UI e não coletar aceites reais nesta fase. Runner de PostgreSQL 17 descartável com identidades fictícias fornece a única execução permitida.

## Contratos propostos
**M1:** amplia apenas CHECK `health_consents_consent_type_check` para aceitar `e5_personalized_review`, preservando cinco tipos existentes, tabela append-only e políticas de seleção. Substitui **a** política INSERT existente, sem adicionar política OR permissiva, e condiciona E5 à identidade `health_athletes.auth_user_id=auth.uid()`, ator autenticado e payload `details.contract=cch-e5-consent-v1` com `explicit_action=true`. Delegação do treinador não autoriza E5. Função invoker `health_cch_e5_has_explicit_consent(athlete,policy_version)` devolve verdadeiro só para decisão única `granted` mais recente na versão exigida, com recusa de empates conflitantes, denied, revoked ou ausência. **A política textual final, retenção, regras de representação e versão vigente ainda não foram revisadas; não oferecer isto a usuários reais.**

**M4:** reaproveita `health_workout_events`, restringe via trigger + substituição da política INSERT existente somente notas com `payload.contract=cch-e5-session-review-v1`. Exige atleta vinculado por auth uid, autoria explícita não nula, mesma sessão concluída, `record_status=active`, `source=user`, `explicit_confirmation=true`, e conjuntos estritos de recovery/symptoms. Index parcial único por atleta/sessão evita múltiplos registros de revisão E5; unique `(athlete_id,client_event_id)` já impede replay por ID. Regras comuns de M4 para outros eventos permanecem. Nota de revisão não significa diagnóstico ou progressão numérica automática.

## Testes de aceite isolados
Casos positivos: legado M1 continua aceito, consentimento explícito E5, consulta de decisão, evento M4 válido e evento legado. Negativos: treinador tentando consentir E5 mesmo com direitos de gestão, outro atleta, autor incorreto, ausência de aceite, versão antiga, denied, revoked, timestamp conflitante, sessão não concluída, evento de sistema, payload incompleto, nulidade, replay e duplicidade. Preserva 4 versões e fila sintética do fixture; migrations originais M3/F21/F22 não modificadas.

## Limites de evidência
O teste reproduz tabelas e políticas selecionadas das migrations soberanas usando fixture **estrutural**, não reconstrói integralmente o banco oficial ou permissões de compartilhamento. CI verde **não equivale** a revisão de efeitos persistentes, homologação em produção, validade jurídica de consentimento ou eficácia clínica. A PR aberta é somente material para revisão Camada Mestre. Nenhuma autorização implícita para merge, migração ou deploy.
