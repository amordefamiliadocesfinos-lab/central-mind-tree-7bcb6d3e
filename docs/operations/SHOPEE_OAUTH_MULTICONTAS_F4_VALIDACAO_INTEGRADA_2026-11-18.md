# SHOPEE-OAUTH-MULTICONTAS-01 — F4 RELATÓRIO DE VALIDAÇÃO INTEGRADA

**Data:** 2026-11-18  
**Projeto:** Painel Central — Amor de Família  
**Natureza:** evidência de testes de código em branch isolada; **não é homologação real, aprovação de merge ou deploy**.  
**Head validado:** `77052e8594efde0490e983a2569923fcfda93835` antes deste relatório, PR #931 (draft), base PR #930 (draft).  
**GitHub Actions:** https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/44313755944

## 1. Resultado reproduzido no GitHub

**PASS — 3 jobs** no run `44313755944`:

| Job | Evidência | Limite |
|---|---|---|
| `full-synthetic-flow` | Teste do caminho start → estado → callback → identidade de loja → persistência cifrada; suite de regressão legada e universal, refresh antigo e multicontas | Shopee e Core simulados no teste Node; não é consentimento real |
| `edge-contracts` | `deno check` das Edge Functions de autorização e Core Bridge; testes Node da política por conta | Não comprova função implantada nem credenciais produtivas |
| `integrated-postgres` | Migrações F3-A → F3-D aplicadas em PostgreSQL 17 descartável, com teste de compare-and-swap, aprovação e revogação | Não comprova as mesmas migrations aplicadas no Core produtivo |

Rejeições sintéticas cobertas: reuso do estado, uso repetido de ticket, shop incompatível, aprovação revogada, callback universal desligado, refresh com token anterior obsoleto e incompatibilidade de identidade.

## 2. Arquitetura examinada

- **Identidade do operador:** Edge Function valida JWT do Supabase no servidor e grant `auth_user_id + channel_account_id`, com resposta deny-by-default.
- **Handoff:** ticket opaco, hash único, 90 segundos, consumido na RPC do Core; grant e conta são revalidados.
- **State universal:** vínculo persistido de operador, conta, Partner ID e Shop ID **pré-aprovado por governança**, com consumo único.
- **Callback:** recupera destino exclusivamente pelo state consumido; compara loja autenticada e tokens, e preserva criptografia.
- **Refresh:** por conta, sem endpoint público ou agendamento novo; SQL CAS protege contra atualização com token obsoleto.
- **Compatibilidade:** PR #930 reintroduziu os comportamentos de Celivio e Adão da PR #911 e separação de falhas de callback.

## 3. Pendências para homologação real — NÃO SUPRIMIR

### G1 — Encadeamento e base final de integração

A cadeia está em PRs draft independentes e encadeadas: `#922 → #924 → #928 → #929 → #930 → #931`. A PR #911 contém a revisão candidata operacional de Celivio e **não está mergeada**. A reconciliação no código e a suíte passam, porém ainda não substituem revisão completa do diff/base final após integrar #911 e a arquitetura universal na mesma história de branch. Não fazer merge automático.

### G2 — API Gateway e caminho de retorno

O código conhece `/shopee/live/oauth/universal/start`, mas **não existe evidência aqui de que o OpenAPI publicado no Gateway já o encaminhe**. O script existente `services/integration-hub/scripts/prepare-celivio-gateway-route.py` prepara **Celivio**, não o caminho universal. Antes de habilitar o fluxo, inspecionar **a configuração publicada** e preparar um delta mínimo preservando callback oficial, demais rotas e backends.

Acesso real, redirecionamento de cookies e comportamento de Gateway/Cloud Run não foram testados nesta F4.

### G3 — Autorização, aprovações e segredos

Novas tabelas `shopee_oauth_account_grants`, `shopee_oauth_handoffs`, `shopee_oauth_shop_authorizations` e bindings são **deny-by-default**, sem seeds produtivos. Falta fluxo administrativo auditado para emitir/revogar grants e aprovações (não fazer INSERT manual sem governança). Confirmar os valores de env, acesso aos segredos, origem do Painel, status do service account e política de logs/URL de tickets em ambiente alvo.

### G4 — Flags independentes e proteção de operações

`SHOPEE_OAUTH_UNIVERSAL_START_ENABLED` e `SHOPEE_OAUTH_UNIVERSAL_CALLBACK_ENABLED` permanecem desligadas por padrão. Não ativar com PRs em draft nem antes de testar callback em candidata isolada. Não habilitar refresh automatizado, scheduler, intake, logística, preços, estoque, etiquetas ou qualquer outra automação.

### G5 — Evidência de loja real e persistência

Para Celivio/Neto, somente concluir após OAuth de consentimento real, `get_shop_info` confirmando `shop_id=1357031949`, registro cifrado de tokens na conta Core `d26c7a30-aa4a-4441-8012-600d70453689`, e prova de que Adão/Viviane ficaram intactos. A F4 **não realizou** esses passos.

### G6 — Operação e rollback

Antes de qualquer promoção: checar revisão Cloud Run produtiva, 100% tráfego, rollback disponível, tags, envs/secrets, gateway config e estado do Scheduler; registrar baseline e procedimento de retorno. Não assumir que baseline anterior continua vigente sem consulta no momento da janela.

## 4. Decisão técnica

**F4 — validação de integração de código: APROVADA nos três jobs.**  
**Homologação funcional em Gateway/Cloud Run/Shopee real: PENDENTE.**  
**Liberação para produção/merge: NÃO AUTORIZADA.**

**Próxima fase recomendada:** preparar pacote de preflight e matriz de homologação em modo somente leitura; verificar configuração publicada do Gateway/Cloud Run na janela autorizada; aplicar plano de integração sequencial e teste real somente após autorização explícita.
