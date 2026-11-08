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
