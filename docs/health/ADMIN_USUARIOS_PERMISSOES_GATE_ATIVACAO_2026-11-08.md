# PR #498 — evolução da gestão de acesso por módulo

**Status:** código preparado em branch, sem migration aplicada e sem publicação. A criação de contas está bloqueada por padrão no servidor até passar pela prova de isolamento.

## Implementado nesta evolução

1. Tabela `app_user_module_grants` vinculando `auth.users.id` aos módulos autorizados.
2. RPC `admin_replace_user_module_grants`: substituição do conjunto de módulos em uma transação com histórico em `app_user_module_grant_audit`; somente `service_role` possui EXECUTE.
3. A função `updateAdminUserModules` exige sessão válida e capability `provision_users`, e valida identidade/estado do cadastro.
4. A página existente `/admin/usuarios` abre uma seleção de módulos em cada login já vinculado.
5. Removido fallback de identificação por nome no cadastro operacional; impedir ID selecionado inexistente e vínculo de atleta incompatível.
6. `provisionPanelUser` exige `PANEL_SCOPED_USERS_RLS_READY=true` no **servidor**. Sem essa condição, falha fechada e não cria conta.

## O que os grants significam agora

São **registro administrativo da intenção de acesso**. Não alteram automaticamente todas as RLS legadas, rotas, API, RPC, Storage ou realtime.

**Não habilitar `PANEL_SCOPED_USERS_RLS_READY` até entregar efetivamente os guardas abaixo.**

## Gate de segurança obrigatório antes de ativação

- Autorização de rotas: login exclusivamente Saúde não carrega componentes globais de CRM, financeiro, operações, search, notificações e assistente empresarial; navegação e deep links restritos.
- Autorização real no banco: auditar 219 tabelas `public` (estado observado em 08/11/2026); 2 tabelas sem RLS; 297 policies existentes, incluindo permissões amplas. Não modificar esses contratos por scripts genéricos sem plano de retrocompatibilidade.
- Negação de API direta: REST, RPC, Edge Functions, Storage e realtime não podem expor dados de domínio negado para token Saúde-only.
- Identidade: perfil `app_users` e atleta existentes da Rafaela não duplicados; associação confirmada por IDs inequívocos. Nenhuma função textual dá poderes automaticamente.
- Segurança dos usuários atuais: nenhum administrador/colaborador atual pode perder acesso de forma inesperada; compatibilidade e testes de papéis legados.
- Transições: alterar ou revogar acessos deve ter efeitos comprovados após refresh de sessão; registrar auditoria de concessão/revogação; impedir admin mudar próprios direitos ou privilégios da administração por esta UI.
- Homologação: casos negativos testados com usuário externo autenticado e com token direto; comparar com administrador e outros atletas, com registros reais e sem divulgar informação sensível.

## Aplicação e deploy

GitHub atualmente controla código e migrations como artefatos. Não há pipeline comprovado de aplicação de migrations no Core. Aplicar ambos os SQLs somente após revisar ambiente, sequência e efeitos. Executar workflow Admin Users Validation, conferir TypeScript, bundle e testes de isolamento independentes. Merge não equivale a deploy. Não usar Lovable Builder.

## Resultado esperado

Administrador vê usuário, escolhe Saúde / CCH e quaisquer outros módulos, confirma e consegue revogar. Um login restrito vê e consulta somente aquilo que foi autorizado. Só então executar missão Rafaela no Painel; preservar CCH Rafaela v1, fila e histórico.


## Continuidade executada em 08/11 — evidência complementar

- O administrador agora pode selecionar módulos tanto na **criação do acesso** quanto na edição posterior de uma conta restrita.
- `app_users.access_model` separa contas `legacy` de `scoped`: o default conserva colaboradores existentes; somente novos vínculos provisionados são inscritos como `scoped`. O trigger proposto impede um cliente comum de converter `scoped` em `legacy` ou estabelecer `auth_user_id`.
- `AuthContext` consulta o modelo de acesso; uma conta sem cadastro ativo deixa de carregar o shell empresarial.
- Para contas `scoped`, a UI monta um shell mínimo sem pesquisa global, notificações de negócio, barra empresarial nem CRM. **Somente /saude/** está efetivamente habilitado até a homologação dos demais domínios.
- Testes unitários negativos verificam bloqueio das rotas de CRM, Financeiro, Administração e Produção. São testes de UI, **não** comprovam RLS ou API.
- O servidor rejeita provisionamento enquanto `PANEL_SCOPED_USERS_RLS_READY` não estiver habilitado em ambiente seguro após inspeção real. A mera presença do catálogo de permissões não é prova de acesso efetivo.
- O vínculo por nome foi removido e seleção de atleta não ocorre automaticamente por coincidência de texto; usuário administrador deve conferir ID do cadastro e ID do atleta. Fluxo da Rafaela continua pendente.

### Risco verificável no Core atual

Consulta somente leitura identificou 219 tabelas `public`, duas sem RLS (`product_batch_recipe_items`, `product_batch_recipes`) e numerosas políticas abrangentes de dados comerciais. Entre os exemplos: `contacts`, `financial_accounts`, `financial_movements`, `ai_insights` e `ai_actions`. Sem analisar também privilégios de tabela, views, RPCs, endpoints, bucket policies e autenticação real, é **proibido afirmar** que um login Saúde-only não conseguiria lê-los diretamente. A possibilidade de leitura com a chave anônima precisa ser investigada separadamente; esconder rotas não resolve esse risco.

### Estado de governança

A branch pode estar divergente da main por merge de frentes paralelas. Reconciliar antes do merge. Não implantar migrations ou ativar variável de ambiente por conta desta documentação. Com CI verde, a frente ainda será **parcial** até a prova negativa de isolamento e autorização transversal para alterar RLS empresarial.

Para cada módulo adicional selecionável pelo administrador, distinguir: (a) registrado no catálogo, (b) roteável com UI, (c) efetivamente protegido em banco e serviços. Liberar somente depois de demonstrar **(c)**.


## Auditoria objetiva adicional do Core — 08/11/2026

Consulta de catálogo via leitura ao Supabase oficial (sem modificar dados ou aplicação) encontrou:
- 219 tabelas `public`;
- 208 tabelas com privilégio SQL `SELECT` para `authenticated`;
- 113 tabelas com privilégio SQL `SELECT` para `anon`;
- 2 tabelas com RLS desligada;
- **72 tabelas distintas** cujas políticas `SELECT/ALL` `USING true` são destinadas a `public` ou `anon` e que possuem `SELECT` para `anon`. Exemplos de nomes de tabela: `contacts`, `financial_accounts`, `financial_movements`, `ai_insights`, `ai_actions`, `tasks`.

Essa combinação de privilégio + política ampla indica **possibilidade de consulta anônima** para esses objetos quando estão expostos na Data API. Uma verificação real da Data API, schemas expostos, views e funções ainda é necessária para confirmação de exposição e alcance. O número 72 **não representa 72 acessos testados**.

**Bloqueio elevado:** Uma conta com Auth restrito pode fazer chamadas anônimas usando chave pública. Portanto, acrescentar políticas RLS exclusivamente `TO authenticated` não corrige o isolamento. Antes de ativar login externo é necessário revisar/revogar permissões anônimas onde inadequadas, reforçar RLS com regras de negócio para os módulos e comprovar regressão dos consumidores existentes. Não aplicar mudanças em lote sem inventário de dependências e prova de compatibilidade.

A proteção adicional de `app_users` criada nesta PR é apenas uma etapa do controle por identidade, não resolve permissões de todas as outras tabelas. Toda gravação de migrations continua não autorizada até homologação de segurança e processo de deploy.


## Gate operacional de liberação (atualizado em 08/11/2026)

**Confirmado por consulta somente leitura no Core xkskyutmtlhivvpfxkjg:**
- 219 tabelas no schema `public`, das quais 2 sem RLS.
- 113 com privilégio SQL SELECT de `anon`, 208 de `authenticated`.
- 72 tabelas candidatas a leitura anônima por combinação de GRANT SELECT e política `USING true` para `public/anon`; **não equivalem a 72 vazamentos comprovados**.
- 24 funções `SECURITY DEFINER` em `public` com EXECUTE SQL para `anon`, **17 dessas retornam trigger**, portanto não representam 24 endpoints RPC diretamente invocáveis.
- `health-private`, `order-documents`, `shopee-labels` são buckets privados; `app-user-avatars`, `contact-avatars`, `delivery-proof`, `media` estão marcados públicos. O caráter público do bucket não basta para avaliar confidencialidade de todo seu conteúdo.
- `app_user_module_grants` e `app_user_module_grant_audit` não existem no Core: migration ainda pendente.

**Ação registrada na PR:** `scripts/security/admin_users_core_exposure_audit_20261108.sql` contém queries reproduzíveis de verificação, exclusivamente leitura.

**A ordem segura, sem alterar usuários atuais:**
1. Verificar dependências anônimas reais (aplicação, integrações, endpoints, bots, dados legitimamente públicos).
2. Propor revogação de grants anônimos somente para tabelas com classificações empresariais, acompanhada de testes positivos e negativos no ambiente controlado; separar publicidades deliberadas.
3. Revisar funções invocáveis (excluir triggers) e Edge Functions que usem service role; garantir Auth + autorização por recurso.
4. Verificar Storage e URLs públicas (revogar acesso público quando o conteúdo não for público, após plano de compatibilidade).
5. Aplicar e homologar migrations de catálogo de permissões, SEM habilitar `PANEL_SCOPED_USERS_RLS_READY`.
6. Testar via Data API com token anônimo real, token Saúde-only de ensaio e contas legadas com autorização, incluindo revogação, refresh da sessão e outro atleta.
7. Apenas quando todas as verificações passarem, habilitar feature flag **no ambiente correto**, realizar cadastro pelo Painel, vincular Rafaela via IDs existentes e registrar resultados PASS/FAIL.

**Proibição:** não usar o projeto Supabase legado `gufyjtdgsdmowubdtdvo` nem `fmbarvtlfuvirwqpuydx` para supor resultado do Core oficial. O conector Supabase acessível para projetos independentes lista somente esses projetos antigos; a auditoria aqui foi feita na conexão somente leitura do Lovable Cloud Core.
