# Administração de usuários e permissões — base técnica em revisão

## Objetivo

Permitir que o administrador escolha explicitamente os módulos a que cada usuário terá acesso,
sem modificar a lógica de autorização do domínio Saúde/CCH nem criar usuários via SQL em auth.users.

## Entregue neste branch (NÃO ATIVO)

- `app_module_access`: tabela com chave (auth_user_id, module_key), RLS habilitada e
  sem privilégios para clientes comuns; não representa permissão real até os módulos
  verificarem autorização no servidor.
- `admin-user-access`: Edge Function com Auth JWT verificado e allowlist de UIDs
  configurada em segredo `ADMIN_ACCESS_BOOTSTRAP_UIDS`. Permite leitura do cadastro;
  comandos de convite e gravação ficam bloqueados, por padrão, através do segredo
  `ACCESS_ADMIN_ENROLLMENT_ENABLED`. Não usar função/role de app_users como
  autorização administrativa, pois há políticas históricas a auditar.
- `AdminUserAccess`: interface proposta de escolha explícita dos módulos e envio de
  convite pelo mecanismo oficial Auth, sem registrar senhas. A página ainda NÃO está
  conectada às rotas nem à navegação.

## BLOQUEIOS ANTES DE LIBERAR EM PRODUÇÃO

1. Revisar e corrigir RLS de **todos** os domínios empresariais que serão negados ao
   usuário Saúde. Ocultar páginas, botões ou menu não é controle de leitura do banco:
   tabelas existentes como `tasks`, `monthly_goals` e `ai_insights` possuem políticas
   amplas que não respeitam permissões individuais de módulo.
2. Definir e homologar o bootstrap de administradores por identidade Auth, em segredo
   de runtime (não via role editável no cliente); impedir elevação de privilégio.
3. Adaptar ProtectedRoute, AuthContext e a navegação global para usuário com acesso
   exclusivamente `saude`; proibir acesso a rotas genéricas. Confirmar que API,
   storage, realtime, RPC e Edge Functions também exigem autorização correta.
4. Tornar alterações de grants **atômicas** (RPC transacional restrita) para não
   perder permissões na falha de escrita; adicionar log de auditoria sem dados sensíveis.
5. Revisar fluxo de convite: reconciliação de falha parcial Auth/app_users/health,
   usuário existente não duplicado, ownership e RLS do atleta, convite expirado,
   aceitação de e-mail e perfil restrito após primeiro acesso. Conexão de atleta
   deve ser feita por ID verificado, não pela similaridade de nomes isolada.
6. Criar testes de segurança negativos executados com sessões reais: Rafaela só
   Saúde; dados privados de outros atletas negados; CRM/Financeiro/Operações/Storage
   negados, inclusive chamadas REST diretas; admin gerencia sem assumir acesso a
   histórico de Saúde não delegado; revogação e troca de sessão efetivas.
7. Verificar migrations, pipelines e Edge Functions no projeto oficial;
   revisar permissões de storage e regras existentes de produção.
8. Somente após tudo acima, ligar rota e interface administrativa, publicar função,
   aplicar migration autorizada, configurar allowlist e habilitar a flag de ações.

## Handoff Rafaela

O cadastro `app_users` e `health_athletes` existentes devem ser vinculados,
nunca recriados. Preservar programa CCH Rafaela v1, fila e histórico. O convite
seguro por e-mail evita armazenar ou reutilizar a senha temporária mencionada
em conversa. Nenhuma operação foi executada contra Auth ou banco nesta PR.

## Limites de evidência

PR de preparação: NÃO é login funcional, NÃO é RLS homologada, NÃO é autorização
para importar ou liberar usuários externos. Testes de CI e inspeção independente
devem ser feitos antes de merge. Este texto não altera contratos soberanos.
