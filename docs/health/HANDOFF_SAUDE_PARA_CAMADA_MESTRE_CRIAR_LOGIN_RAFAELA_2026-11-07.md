# HANDOFF — SAÚDE/CCH → CAMADA MESTRE DO PAINEL CENTRAL

Data: 07/11/2026  
Origem: Especialista Saúde/CCH  
Destino: Camada Mestre — Painel Central  
Natureza: operação de identidade/autenticação transversal com finalidade específica do módulo Saúde

## 1. Solicitação

Criar o login da atleta **Rafaela Campos** no próprio **Painel Central**, usando o fluxo oficial de autenticação do sistema e a infraestrutura já adotada pelo projeto.

E-mail confirmado pelo administrador:
`camposrafaela942@gmail.com`

A senha temporária foi fornecida e autorizada explicitamente pelo administrador na conversa operacional.

**Regra de segurança:** a senha NÃO deve ser escrita neste documento, em commit, issue, migration, log, tabela de aplicação ou qualquer outro artefato persistente. Deve ser recebida apenas por contexto seguro de execução e enviada diretamente ao mecanismo Auth.

## 2. Finalidade

A conta existe exclusivamente para permitir que Rafaela acesse o **módulo Saúde/CCH** com identidade própria.

Fluxo esperado:

`login Rafaela → health_athletes Rafaela Campos → CCH Rafaela → fila CCH → treino ao vivo`

Não criar novo perfil Saúde se o existente puder ser vinculado.

## 3. Patrimônio já existente a preservar

### Cadastro operacional
Existe cadastro:
- nome: **RAFAELA CAMPOS**
- e-mail: `camposrafaela942@gmail.com`
- `auth_user_id`: atualmente nulo.

### Perfil Saúde
Existe atleta:
- `display_name = Rafaela Campos`
- status ativo
- atualmente sem login próprio vinculado
- acesso supervisionado do administrador preservado.

### Programa Saúde
Programa já existente e publicado:
- **CCH Rafaela — v1**
- fase: calibração inicial
- objetivo: hipertrofia com prioridade em inferiores e costas
- sequência:
  `A1 → B1 → C1 → D1 → A2 → B2 → C2 → D2`

O histórico/programa/fila NÃO devem ser recriados.

## 4. Operação solicitada à Camada Mestre

Executar em sequência:

1. verificar se `camposrafaela942@gmail.com` já existe em `auth.users`;
2. se não existir, criar usuário pelo fluxo oficial de Supabase Auth utilizado pelo Painel Central;
3. usar a senha temporária já fornecida pelo administrador em contexto seguro;
4. definir nome/metadata apenas descritiva: **Rafaela Campos**;
5. não usar `user_metadata` para autorização;
6. obter o novo `auth_user_id`;
7. vincular `app_users.auth_user_id` ao cadastro **RAFAELA CAMPOS** existente;
8. vincular `health_athletes.auth_user_id` ao perfil **Rafaela Campos** existente;
9. preservar `health_athlete_access` atual;
10. não recriar programa, versão, fila, treino ou histórico;
11. validar login;
12. validar que Rafaela enxerga somente os dados autorizados dela no Saúde;
13. validar que o administrador mantém acesso supervisionado.

## 5. Restrições

- NÃO usar construtor visual da Lovable.
- NÃO inserir manualmente linha em `auth.users`.
- NÃO persistir senha temporária.
- NÃO criar perfil Saúde duplicado.
- NÃO criar `app_users` duplicado.
- NÃO alterar o programa CCH publicado.
- NÃO alterar dados do atleta Deividi.
- NÃO ampliar permissões globais da Rafaela além do necessário para o escopo autorizado.
- NÃO usar role operacional como substituto para autorização Saúde.

## 6. Critérios de aceite

PASS somente se:

- conta Auth criada ou localizada;
- e-mail exato confirmado;
- `app_users.auth_user_id` aponta para a conta correta;
- `health_athletes.auth_user_id` aponta para a mesma conta;
- perfil Saúde não foi duplicado;
- programa **CCH Rafaela — v1** continua intacto;
- fila CCH existente continua intacta;
- login da Rafaela funciona;
- /saude/treino resolve o perfil da Rafaela;
- RLS impede acesso aos dados do Deividi;
- acesso supervisionado do administrador continua válido;
- nenhuma senha foi persistida ou exposta em artefato.

## 7. Resultado esperado

Ao final, Rafaela deve poder entrar no Painel Central com o e-mail confirmado e acessar diretamente o módulo Saúde, mantendo seu perfil e programa existentes.

A Camada Mestre deve devolver:
- `auth_user_id` criado/localizado;
- confirmação dos dois vínculos;
- resultado do teste de login;
- resultado do teste de isolamento RLS;
- PASS/FAIL da operação.
