# Diagnóstico nucleo-knowledge-read (somente leitura)

## Evidências
- Checkout local = main `911b80ba2873a8d80e486d988a8c5ea1a6fe0580`, sem alterações locais em `supabase/functions`.
- Fonte local já tem a PR #1026: `index.ts` consulta `nucleo_specialist_contributions` (linha 230) e importa `_shared/nucleo/ac02-assumption-export.ts`, que contém a seção literal "## 6A. Revisões AC-01 e conferência de pendências".
- Configuração no repositório: `verify_jwt = true`.
- Logs da função: "No logs found".

## O que não dá para verificar
- Revisão, digest, data, origem e empacotamento da dependência no deploy ativo: **INDETERMINADO**. Não há ferramenta nativa de leitura de metadados do deploy.
- Último deploy registrado nesta conversa: commit `b034d61f` (anterior à PR #1026). Isso combinado com a contraprova Work sem a seção 6A é **compatível com versão defasada**, mas não é prova do runtime.

## Ação mínima segura (exige nova autorização; não executada)
1. Reconfirmar checkout = `911b80ba`.
2. Implantar SOMENTE `nucleo-knowledge-read` pelo executor nativo (empacota `_shared` automaticamente), `verify_jwt=true`.
3. Validar POST sem token = 401 e repetir a contraprova Work autenticada procurando a seção 6A.
