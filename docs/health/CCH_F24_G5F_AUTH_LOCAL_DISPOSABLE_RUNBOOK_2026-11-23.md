# CCH F24 — G5-F/B | Contraprova local Auth/RLS/F19 descartável

**Autoridade:** Camada Mestre, Issue #966, comentário 7117794539. **Data:** 23/11/2026.
**Objetivo:** rodar uma vez GoTrue Auth, PostgREST e PostgreSQL reais, todos locais e efêmeros, com duas contas fictícias e execução dos RPC F19 originais.

## Limites rígidos
- Criação somente no runner GitHub Actions por pasta `/tmp/cch-g5f-auth-XXXXXX` e ID `cch-g5f-<GITHUB_RUN_ID>`; não usa o `supabase/config.toml` do projeto nem links remotos. Credenciais local-only geradas pela CLI não entram no repositório, artefatos ou console.
- Docker local via Supabase CLI **fixada em 3.1.0**, sem autenticar no dashboard. O comando `supabase stop --no-backup --workdir ...` é invocado no trap de saída mesmo com erro; a própria VM é efêmera.
- `scripts/health-cch-f24-g5f-local/fixture.sql`: esquema M4 **reduzido**, somente para testes, autenticação real usando `auth.uid()`, política RLS por atleta e helper de autorização com vínculo Auth A/B. **Não é paridade da migração M0→M4 hospedada.**
- `extract-rpcs.mjs`: extrai sem modificações os seis corpos SQL das funções da migração oficial `20261110005023_health_f19_interactive_workout_timers.sql`. Não chama migração de produção e não envia DDL para nenhum banco remoto.
- `verify-auth.mjs`: cria A/B na API Auth local via admin apenas dentro do runner, faz logins reais por senha com dois JWTs, confirma A↔B/anon/metadata e RPCs, disputa duas requisições de Auth A sobre o mesmo descanso, avança 3/3→4/3→5/3 com RPCs F19 verdadeiros, pausa/retomada, reexecução idempotente, plano prescrito permanece 3 e sexta série não é iniciada.
- O arquivo de evidência `g5f-auth-local.json` registra só modo, host local, ID do run e nomes dos controles, sem JWTs, email, ID de usuário, senha, chaves ou DSN.

## Matriz (não atribuir sucesso sem ler os Actions)
| Controle | Exigência | Estado de execução |
|---|---|---|
| G5F-A | Despacho local com teardown | AUTORIZADO |
| G5F-B1 | GoTrue A/B realmente autenticados, JWTs legítimos | CI A EXECUTAR |
| G5F-B2 | PostgREST RLS: A só A, B só B, anon nenhum, metadata falsa sem bypass | CI A EXECUTAR |
| G5F-B3 | RPC F19 SECURITY DEFINER respeita Auth e atleta; B/anon rejeitados | CI A EXECUTAR |
| G5F-B4 | Sessões do mesmo atleta: idempotência e disputa de fim de descanso | CI A EXECUTAR |
| G5F-B5 | 3→4→5, pausa/retorno, sem sexta e prescrição inalterada | CI A EXECUTAR |
| G5F-B6 | UI F19 responsiva e cliques isolados | G5-E PR #1033: 7/7; **não acoplada à Auth desta CI** |
| G5F-B7 | Teardown e ausência de acesso oficial | CI A EXECUTAR |
| G5F-C | Homologação hospedada separada | NÃO AUTORIZADO |

**Alcance epistemológico:** a CI de Auth local valida autenticação real e RPCs com um esquema isolado reduzido. A prova UI de G5-E renderizou o componente real com controlador sintético, mas ainda não representa UI conectada diretamente à Auth local. **Não declarar G5 global concluída** com esses dois ensaios. Se o ambiente local iniciar corretamente, registrar readback, notas e lacunas na Issue #966; se falhar, diagnóstico honesto e correção dentro do escopo do runner.

## Fontes
- Supabase CLI changelog 04/11/2026: https://supabase.com/changelog/supabase-cli-v3
- Supabase desenvolvimento local: https://supabase.com/docs/guides/local-development
- Supabase CLI: https://supabase.com/docs/reference/cli/introduction

**Proibido:** Lovable builder, hosted project, deploy, usuários reais, migrations hospedadas, dados de Deividi/Rafaela, alterações de M3, mapa FROZEN, E5, F23 e P3/P5/P6 produtivos.
