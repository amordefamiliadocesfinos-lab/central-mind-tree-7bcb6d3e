# CCH E5-C — Leitura RLS isolada e condições de captura

**Base:** Mapas soberanos CCH v5.4 FROZEN e evolução V1.0 FROZEN. F23 não aberta.

## Contraprova E5-C
Pipeline GitHub Actions sobe PostgreSQL 17 descartável; reaproveita identidades sintéticas autenticadas do laboratório E2 e cria **somente no banco temporário** tabelas mínimas para simular o formato dos registros de M3/M4, equipamento V8, recuperação e consentimentos M1. As políticas **SELECT** reproduzem a expressão de leitura `health_can_read_athlete(athlete_id)` das migrations M1/M4/V8; a função `health_can_read_athlete` deste **fixture** restringe-se à propriedade individual, não replica delegação/compartilhamento real. O CI testa A não visualizar B, B não visualizar A, contexto anônimo sem leitura, join que não vaza outro atleta e ausência de grants de escrita no escopo de extração.

**Limite de prova:** testa apenas isolamento por **identidades simuladas** e permissões representativas no PostgreSQL descartável; não prova RLS de produção, nem todas as políticas reais, nem autenticação HTTP. Não permite gravar ou consultar dado pessoal real.

## Descoberta de bloqueio estrutural
Na migration soberana `20261107151317_health_m1_profile_goals.sql`, `health_consents.consent_type` possui um CHECK com apenas: `health_data_processing`, `private_media_storage`, `media_analysis`, `coach_sharing` e `notifications`. O contrato E5-B espera decisão específica `e5_personalized_review`, **não aceita atualmente pelo esquema real M1**. O teste reproduz o CHECK vigente e confirma que essa decisão seria recusada. Portanto **não é correto** afirmar que já existe caminho persistente de consentimento individual E5. Não alterar schema para contornar: requer decisão da Camada Mestre e contrato/versionamento de migração separada, autorização de coleta e política RLS próprios.

## Caminhos existentes versus pendentes
- **Equipamento:** V8 possui fluxo de confirmação por `health_cch_confirm_workout_equipment` antes das séries, dentro de sessão ativa e identidade do exercício; depende de escolha explícita na execução. O mesmo rótulo em sessões diferentes fornece proveniência declarada, não identidade física verificada entre aparelhos.
- **Séries e versões:** M4/F21 salvam exercício, kg/lb, repetições, RIR, origem da versão e anulações; E5-B não deve usar dados de outras versões.
- **Recuperação:** check-in M1/F04 tem data e métricas ordinais, **não tem vínculo direto com sessão**. O contrato E5-B exige avaliação explicitamente revisada por sessão; não inferir dor/recuperação pela proximidade temporal e não implantar tabela nova aqui.
- **Objetivo:** cadastro de hipertrofia ativo não substitui escolha atual na revisão E2/E3.
- **Consentimento:** o registro genérico `health_data_processing` não é consentimento E5; o novo tipo pretendido é **incompatível com o CHECK atual**. Não pedir ao atleta aceite que não possa ser persistido de modo auditável.

## Conclusão de maturidade
E5-C é apenas prova técnica de **escopo de leitura em fixture**. E5 personalizada real permanece bloqueada por máquina confirmada, recuperação, evidência repetida por versão e consentimento específico indisponível no esquema atual. Sem novas migrations, UI, dados reais ou autopublicação.
