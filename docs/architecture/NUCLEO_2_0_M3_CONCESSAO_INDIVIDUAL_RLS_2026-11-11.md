# Núcleo 2.0 — M3 | Concessão individual autorizada e validação RLS

**Data:** 11/11/2026  
**Autoridade:** autorização individual explícita do proprietário nesta conversa, após identificação da conta administrativa no Core.  
**Escopo:** `nucleo_manage` individual para homologação da M3, sem importar ou publicar documentos.

## Concessão
- Conta administrativa ativa e vinculada ao Supabase Auth, com e-mail confirmado e sem bloqueio, identificada no Core.
- Capacidade `nucleo_manage`: **uma concessão ativa**, somente à identidade explicitamente autorizada (identificador de auditoria abreviado `...d801ca8c`).
- `granted_by_auth_user_id` registra a identidade do proprietário que autorizou expressamente a ação, executada pelo assistente como operador delegado.
- `provision_users`: concessão preexistente preservada, **uma ativa**.
- Nenhuma outra conta recebeu `nucleo_manage`. A capacidade não foi associada automaticamente a papel textual.
- Cadastro realizado no Core mediante transação com conferências prévias de identidade, condição da conta, ausência da capacidade, preservação de `provision_users` e contagens M2/M3.

## Ensaios RLS após a concessão
Foram executadas consultas **somente de leitura**, em transações com `SET LOCAL ROLE authenticated` e `request.jwt.claim.sub`:
- Claim do administrador autorizado: **7 frentes, 8 eventos históricos, 3 referências Drive e 1 capacidade própria ativa visíveis**.
- Claim sintética distinta, sem concessão: **0 frentes, 0 eventos, 0 referências e 0 capacidades próprias visíveis**.
- As transações de ensaio terminaram com `ROLLBACK` (não houve alteração dos dados pelo teste).
- Pós-verificação: uma concessão `nucleo_manage` e uma `provision_users`; 7 frentes, 8 eventos, 3 referências; 0 documentos e 0 lotes importados.

**Limite:** a simulação fiel de claim/role em SQL verifica RLS no Core, mas **não é teste E2E de navegador**. O acesso pelo frontend, edição de ficha, histórico correspondente e efeito da revogação sobre sessão real não foram testados neste ato.

## Próximo teste funcional, sem extrapolação
1. Acessar `https://central-mind-tree.lovable.app/nucleo` na sessão da conta autorizada; atualizar a página.
2. Abrir **Desenvolvimento** no cabeçalho e verificar 7 registros na árvore/Kanban e 8 eventos históricos de criação/ajuste.
3. Conferir na **Biblioteca** as 3 referências Drive; acessar conteúdo original somente sob permissão já existente do Drive.
4. Realizar pequena edição reversível de acompanhamento explicitamente escolhida pelo operador, conferir histórico novo e reverter por nova atualização — **não apagar histórico nem alterar o escopo original**.
5. Após registrar evidência positiva, decidir manter ou revogar a capacidade de homologação de forma expressa e auditável. A revogação não deve ser presumida nem executada sem alinhar com o proprietário.

## Preservação
- Backup privado com 82 páginas de uma origem permanece intacto.
- Nenhum `nucleo_documents`, `nucleo_import_batches` ou `nucleo_document_revisions` importado.
- Base Drive V1.2 segue privada e não homologada.
- Concessão `nucleo_manage` não altera permissões dos demais módulos.

**Estado:** concessão individual e RLS positiva/negativa no Core **confirmadas**; homologação visual e de atualização na sessão real **pendente**.
