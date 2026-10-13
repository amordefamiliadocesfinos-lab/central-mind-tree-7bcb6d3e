# Validação somente leitura — CRM 5 F1-A (Inbox)

## Estado verificado agora (fatos)
- Navegador nativo do agente: disponível (Chromium local apontando para o preview oficial do projeto; sem serviço de terceiros).
- Preview respondendo: HTTP 200.
- Sessão autenticada: **NÃO injetada** (status `signed_out`). Hoje só é possível ver telas públicas/login.
- Código carregado no projeto: commit `49382f57…`, **diferente** do `941d926b…` informado. Não confirmei se contém a PR #205.
- Nenhum teste visual foi feito ainda.

## Bloqueios e menor ação humana
1. Sessão: você entra no preview do Lovable (já logado) e me envia nova mensagem — a sessão passa a ser injetada. Alternativa: autorizar que eu gere uma sessão para a sua própria conta (`--self`), sem criar usuário nem senha.
2. Versão: confirmar que o editor está sincronizado com a main em `941d926b`; caso contrário, o teste valida outra versão.

## Após aprovação (somente leitura)
- Abrir Inbox/CRM autenticado, capturar prints.
- Abrir em sequência Lurdes, Graciela, Armando, Felipe, Leonardo; troca rápida entre eles.
- Verificar: rótulo/ordem de prioridade exibidos, ausência de mistura de conversa/contexto entre contatos, erros no console.
- Não clicar em Resultado/Concluir/Adiar, não enviar mensagens, não editar nada.
- Relatório separando "visto na tela" de "apenas analisado no código".
