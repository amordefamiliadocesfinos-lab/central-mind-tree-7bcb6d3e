# CCH E3-C — painel consultivo M3/M4/F21 no Programa existente

CCH v5.4 / V1.0 FROZEN, autorização explícita do proprietário para destravar desenvolvimento. PRs #979 (puro) e #981 (adaptador somente SELECT) são a base.

## Escopo executado
- Adiciona a seção `E3 · Continuidade flexível — estudo consultivo` à tela **existente** `/saude/treino/programa`, sem nova navegação, catálogo ou fila.
- Fonte real: hook SELECT de M3/M4/F21 com RLS da sessão Lovable Cloud; não grava nenhum dado.
- Compara etiquetas de estímulos previstos e observados, sessões comparáveis, séries conhecidas, condições de dor e recuperação, período real e incertezas.
- Bloqueia a classificação `eligible_for_manual_review` quando não há draft proposto, mesmo que a qualidade do histórico seja boa.
- Nunca impõe semanas fixas, datas-limite, contagem universal ou progressão numérica automática.
- Sinaliza truncamento de API e ausência de séries/etiquetas, sem apresentar zero como evidência de ausência de treino.

## Prova
CI de modelo puro, lint, build, regressão React isolada com hook E3 de fixture. A prova real autenticada Work ainda é necessária **para marcar a UI publicada como homologada**, inclusive E2 fingerprint de PR #978.

**Não alterar** programas, treino M4, histórico F21, gate F22, políticas RLS ou recursos F23. E3-C não gera novos ciclos nem alterações.
