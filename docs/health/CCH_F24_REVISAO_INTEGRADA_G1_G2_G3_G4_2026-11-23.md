# F24 — Contraprova integrada de engenharia G1/G2 · 23/11/2026

**Estado:** relatório técnico de revisão, sem autorização de merge ou implantação. Camada Mestre ratificou G1 e G2 para engenharia e CI em branch na PR #1022; mapa CCH v5.4 FROZEN e mapa Evolução V1.0 FROZEN intocados.

## 1. Fontes revisadas
- **#1022:** escopo aprovado e gates G1–G5; documento V0.2 em draft, não integrado.
- **#1025:** P0/P1, escolha explícita da série extra, helper puro e teste; 9/9 checks históricos aprovados. Ainda sem teste autenticado de corrida entre abas, transição sob recarga e todos estados F19.
- **#1027:** P2/P4, histórico do mesmo exercício/rótulo confirmado e simplificação de texto F19; 9/9 checks históricos aprovados ANTES de ajuste de terminologia. Revalidar novo HEAD após mudança.
- **#1028:** P3 apenas contrato e protótipo editorial sem URLs/Storage; 9/9 checks no head da PR. Sem direito ou mídia real aprovado.
- **#1029:** P5/P6 apenas especificação consultiva em draft. Sem motor de IA ou persistência de decisão.
- **#1031 (esta PR):** snapshot experimental composto de G1+G2. Não substituir PRs de origem, não fazer merge.

## 2. Achados de integração
| ID | Severidade | Achado | Tratamento / portão |
|---|---|---|---|
| F24-R01 | ALTA | #1025 e #1027 modificam a mesma `HealthWorkoutInteractiveTimerF19.tsx`; CI individual não cobre o comportamento combinado. | Combinação isolada nesta branch e workflow conjunto de contratos P1/P2, TS, lint, build. Ainda requer ensaio funcional de jornada. |
| F24-R02 | ALTA | V8 confirma `equipment_label` de texto livre. Igualdade de rótulos em sessões distintas **não certifica identidade física** de máquinas. | #1027 atualizada para rotular a evidência “mesmo rótulo” (não “mesmo aparelho”); não derivar prescrição numérica da correspondência. Identidade canônica exige contrato próprio antes do uso de carga assistida. |
| F24-R03 | MÉDIA | Seleção da série extra é estado UI local; recarga, abas simultâneas e duplo toque podem criar rotas de execução além da prova lógica de eligibilidade. | G1 inclui guarda local e RPCs existentes; validar em ambiente isolado a transição 3/3→4/3→5/3, pausa/reabertura, limite 100, competição de ações/abas e idempotência. CI unitária não prova RLS/concorrência real. |
| F24-R04 | MÉDIA | Janela consultiva de histórico limitada a 100 sessões; ausência de match pode significar limite, dados não equivalentes ou falta de registro. | Não declarar ausência histórica global; falhar sem número em leitura truncada/erro e verificar fonte efetiva antes de UX homologada. |
| F24-R05 | MÉDIA | P3 é seletor protótipo, não execução de mídia real. O GIF não é pausável de modo nativo como vídeo. | Contrato documental de `prefers-reduced-motion`, fallback estático e direitos/Storage/RLS aguardando portão G3 específico. |
| F24-R06 | ALTA | Dicas P5 e periodização P6 foram especificadas, não implementadas; o escopo aprovado não concede E5 nem autopublicação. | Conservar E2/E3/M3/F22, revisão humana e gate G4 posterior. Nenhuma conexão com dados reais nesta fase. |

## 3. Prova composta e limites
A branch #1031 foi derivada do HEAD de G1, complementada pelos componentes de leitura G2 e compôs manualmente o componente F19 compartilhado. O workflow `health-cch-f24-g1-g2-integration.yml` executa as duas suítes de testes, TypeScript, ESLint e build sobre o mesmo código. Esta contraprova é **estática** e só poderá ser declarada aprovada se o run específico terminar `success`. Mesmo então, não equivale a revisão visual mobile 320–430 px, navegação acessível, recarga em sessão real, prova concorrente de RPC, implantação nem revisão clínica.

## 4. Ordem de decisão da Camada Mestre
1. Revisar #1022 como documento governamental, aprovação de escopo ≠ autorização de deploy.
2. Exigir prova conjunta de #1025 + #1027 (esta branch G1+G2), correção de problemas relevantes e portão de merge por PR específica. **Não dar merge na #1031**, que é prévia descartável.
3. Manter #1028 G3 sem persistência até novo despacho sobre licenças, mídia, Storage e RLS.
4. Manter #1029 G4 exclusivamente documental até autorização de engenharia de P5/P6.
5. Executar G5 com prova de revisão servida/fingerprint e UX autenticada quando autorizado; não afirmar disponibilidade aos atletas com base em CI.

## 5. Não regressão
Nenhuma migration, SQL, RLS, upload, bucket, alteração dos programas ou dados reais de Deividi/Rafaela, publicação M3/F22, E5 real, F23 ou edição de mapas FROZEN foi autorizada ou executada nesta contraprova.
