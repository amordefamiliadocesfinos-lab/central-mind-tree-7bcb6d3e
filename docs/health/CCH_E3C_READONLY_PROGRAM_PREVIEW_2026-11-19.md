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

## Continuidade E3/E4 — integridade da cronologia e identidade de sessões (23/11/2026)

**Achado de contraprova no código:** o avaliador puro E3 relatava datas inválidas/ausentes, mas a elegibilidade consultiva para revisão manual podia continuar positiva com sessões comparáveis restantes. Além disso, duplicatas do mesmo ID com valores divergentes eram silenciosamente resolvidas pela primeira ocorrência, tornando as métricas sensíveis à ordem recebida.

**Correção nesta PR:** datas ausentes/inválidas e identificadores duplicados contraditórios tornam o resultado `review_evidence`, sem recomendação de `continue_progression`; dados conflitantes para um ID são excluídos, e duplicatas idênticas são deduplicadas. Não altera a experiência `advanced` de ninguém. Permanece `draftOnly`, `manualPublicationRequired` e `generatesQueue:false`.

**Testes:** fixtures para cronologia incompleta, duplicatas conflitantes em duas ordens, duplicatas idênticas, histórico F21 anulado, agendas flexíveis e revisão sem publicação. Compatibilidade com UI E3-C existente; sem novos hooks, SQL, RLS, sessões reais, fila ou F23. **CI e homologação de navegador são estados distintos.**
