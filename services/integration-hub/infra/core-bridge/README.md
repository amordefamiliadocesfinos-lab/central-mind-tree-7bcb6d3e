# Core Bridge — F3-A

Código preparado para Hub → `integration-core-bridge` → Core canônico
`xkskyutmtlhivvpfxkjg`. F3-A não configura secrets nem faz deploy.
O único contrato é health read-only: `channel_accounts.select('id').limit(1)`.
Nenhum registro é retornado e nenhuma escrita é implementada.

## Autenticação HMAC v1

O Hub envia POST com os bytes UTF-8 exatos de `{"action":"health"}`.
O payload assinado é `v1\n<unix_seconds>\n<uuid>\n<sha256_hex_do_body>`;
a assinatura é HMAC-SHA256 em hexadecimal lowercase. Headers:
`Content-Type: application/json`, `X-Integration-Hub-Version`,
`X-Integration-Hub-Timestamp`, `X-Integration-Hub-Request-Id` e
`X-Integration-Hub-Signature`.

O Bridge exige `v1`, UUID válido, timestamp dentro de ±300 segundos, body de
até 1024 bytes e somente `action=health`. A assinatura é comparada em tempo
constante após validar seu formato. `verify_jwt=false` somente por esta
autenticação própria; chamadas sem HMAC recebem 401. Não há proxy, SQL/RPC
arbitrário, nonce persistente ou contrato de escrita. A janela permite replay
do health read-only; ações futuras de escrita precisam de idempotência própria.

| Ambiente | Configuração |
| --- | --- |
| Hub | `CORE_BRIDGE_URL=https://xkskyutmtlhivvpfxkjg.supabase.co/functions/v1/integration-core-bridge` |
| Hub | `CORE_BRIDGE_HMAC_SECRET`, futura referência Secret Manager `integration-hub-core-bridge-hmac-v1:latest` |
| Edge Function | `INTEGRATION_HUB_CORE_BRIDGE_HMAC_SECRET` |
| Somente Edge Function | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` nativos do backend |

O cliente aceita somente a URL canônica, faz uma tentativa, timeout de 5s e não
segue redirects. A leitura do Core tem timeout de 4s. Logs contêm somente
request_id, ação, versão, resultado, status e duração; nunca assinatura,
credenciais ou resposta bruta. O mesmo request_id permite correlação Hub/Bridge.

## Health e testes

`GET /health` permanece local e independente de configuração ou rede.
`GET /health/core` devolve somente `status`, `service`, `core_bridge`, com HTTP
200 ou 503. Ambos permanecem protegidos pelo IAM do Cloud Run na infraestrutura.
Outros métodos de `/health/core` recebem 405. Falhas internas são sanitizadas.

Na raiz do repositório: `(cd services/integration-hub && npm test)`.
Os testes Node exercitam o handler real do Bridge com Web Crypto e Core simulado,
sem carregar `index.ts`, service_role, secret real ou ambiente Supabase.
Se Deno estiver disponível, use `deno check supabase/functions/integration-core-bridge/index.ts`.

## Próxima etapa: F3-B

Partir da main mergeada. Pelo canal oficial Lovable Cloud, configurar o mesmo
segredo seguro no backend e no Secret Manager e deployar somente esta função.
Não publicar frontend. Conceder ao runtime Secret Accessor somente neste secret.
Atualizar o serviço Cloud Run existente preservando IAM privado, região, rede,
NAT/IP e recursos F2; adicionar apenas URL e referência ao secret acima.
Validar Bridge sem HMAC (401), `/health` IAM (200), `/health/core` IAM (200),
consulta read-only e correlação dos logs sem credenciais.

Rotação futura: configurar o mesmo novo segredo nos dois ambientes de forma
coordenada e redeployar o runtime. Esta versão aceita um segredo por vez;
planejar a troca para evitar indisponibilidade. Não gerar segredo na F3-A.
