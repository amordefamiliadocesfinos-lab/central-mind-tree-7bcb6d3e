# M9 — RLS / GRANTS / CROSS-ATHLETE MATRIX v1

**Status:** DESENHO DE SEGURANÇA FECHADO — NÃO APLICADO

## 1. Padrão soberano

M9 reutiliza:
- `public.health_can_read_athlete(uuid)`;
- `public.health_can_write_athlete(uuid)`;
- `health-private`.

Toda tabela M9 no schema `public` terá RLS habilitado.

Regra:
`TO authenticated` é apenas autenticação. Toda policy por atleta também exige autorização pelo `athlete_id`.

## 2. Matriz

| Objeto | anon | authenticated SELECT | authenticated DML direto | Escrita oficial |
|---|---|---|---|---|
| health_sleep_periods | none | health_can_read_athlete | none | RPC |
| health_recovery_checkins | none | health_can_read_athlete | none | RPC |
| health_sleep_device_observations | none | health_can_read_athlete | none | RPC |
| health_sleep_recovery_rolling_states | none | health_can_read_athlete | none | refresh RPC |
| health_clinical_documents | none | health_can_read_athlete | none | RPC após Storage |
| health_clinical_document_extractions | none | health_can_read_athlete | none | RPC |
| health_lab_reports | none | health_can_read_athlete | none | RPC |
| health_biomarker_results | none | health_can_read_athlete | none | RPC |
| health_biomarker_longitudinal_states | none | health_can_read_athlete | none | refresh RPC |
| health_vital_observations | none | health_can_read_athlete | none | RPC |
| health_biomarker_catalog | none | allow authenticated | none | migration/admin |
| health_biomarker_aliases | none | prefer no frontend grant | none | migration/admin |

## 3. Policy pattern por atleta

SELECT:

`USING (public.health_can_read_athlete(athlete_id))`

Não criar INSERT/UPDATE/DELETE policies para facts M9 v1, pois o contrato é RPC-only.

Derived states também não recebem DML direto do frontend.

## 4. Funções

Toda RPC M9 que escreve:
- valida `auth.uid() is not null`;
- valida `public.health_can_write_athlete(p_athlete_id)`;
- em operações por id, resolve athlete_id no banco e valida esse atleta;
- usa `SECURITY DEFINER` somente quando o bypass é necessário;
- usa `SET search_path = ''`;
- qualifica `public.*`, `auth.*` e outros schemas explicitamente;
- revoga EXECUTE de `PUBLIC`, `anon` e `authenticated` antes do grant final;
- concede somente a `authenticated`.

Funções read-only que não precisam bypass devem preferir SECURITY INVOKER.

## 5. Storage

Nenhuma nova policy de Storage é necessária no desenho v1 se a policy M0 continuar vigente.

Path:
`<athlete_uuid>/clinical/...`

M9B deve validar no metadado:
- prefixo do athlete;
- ausência de `..`;
- MIME permitido pela UI.

Upload/delete real acontece pela Storage API.

## 6. Cross-athlete negative matrix

Para cada fact/estado:
- atleta A lê A: allow;
- owner/coach autorizado lê A: allow conforme matriz M0;
- atleta B lê A: deny/0 rows;
- atleta B chama RPC de A: exception/deny;
- usuário sem can_write mas com can_read chama write RPC: deny;
- anon SELECT: deny;
- anon RPC: deny;
- id de fato de A passado com athlete B: deny;
- document de A não pode ser ligado a lab_report de B;
- extraction de A não confirma resultados para B;
- sleep supersession de A não pode apontar para fato de B.

## 7. Grants validation

Pós-migration TESTES MT deve consultar:
- `information_schema.role_table_grants`;
- `information_schema.routine_privileges`;
- `pg_policies`;
- `pg_class.relrowsecurity`.

Expectativa:
- anon = zero privilégios M9;
- authenticated = SELECT mínimo;
- EXECUTE somente nas RPCs públicas necessárias;
- catálogos sem write frontend;
- nenhuma policy permissiva que ignore athlete_id.

## 8. Índices de segurança/performance

Toda coluna usada diretamente em policy/filtro de autorização deve ser indexada com `athlete_id` liderando o índice relevante.

Não criar policies recursivas entre tabelas M9.

## 9. Advisors

Após qualquer DDL real:
- security advisors;
- performance advisors;
- corrigir findings novos atribuíveis à M9 antes do Gate A/B.

## 10. Gate de segurança

M9 não pode sair do TESTES MT enquanto qualquer cross-athlete negative test falhar.
