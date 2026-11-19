# CCH E2 — correção da contraprova de proveniência sem `.git`

## Falha observada pelo Work
Na interface oficial autenticada, `Código servido: revisão indisponível` e `data-cch-build-commit=unknown`. O build Lovable Cloud pode receber arquivos sem `.git` e sem `GITHUB_SHA`/`CCH_SOURCE_COMMIT`. Assim, o helper Vite anterior não tinha como determinar o SHA. O Work comprovou diagnóstico E2, estado `v2 · published`, nível Avançado e histórico consultivo; **não** comprovou a revisão exata do código nem o editor no draft.

## Correção
O SHA Git continua honestamente `unknown` quando a compilação não recebe identidade de commit. Como evidência adicional independente de metadados Git, o build calcula um SHA-256 **de conteúdo dos sete arquivos-fonte especificados** na configuração Vite: Vite, programa React, proveniência, preflight, seleção de máquina, propostas E2 e hook M3. O resultado completo aparece em `data-cch-source-fingerprint`, e o prefixo na tela `Conteúdo CCH`.

**A impressão digital não é commit, não comprova o pacote inteiro da aplicação nem prova a homologação de drafts ou o estado de deployment.** Ela permite comparar exatamente os arquivos CCH selecionados entre o código compilado e o checkout GitHub da referência. Se faltarem arquivos, o campo retorna `unknown`.

O workflow imprime `CCH_E2_SOURCE_FINGERPRINT_SHA256=<64 hex>` calculado independentemente, para comparação Work. A string deve coincidir com o **valor integral do DOM**, não apenas o prefixo exibido.

## Contraprova Work (leitura)
1. Recarregar https://central-mind-tree.lovable.app/saude/treino/programa em sessão autenticada.
2. Inspecionar `[data-testid="cch-e2-source-fingerprint"]`, copiar o atributo `data-cch-source-fingerprint` (64 hex), ou registrar `unknown`.
3. Comparar com `CCH_E2_SOURCE_FINGERPRINT_SHA256` do workflow da PR. Conferir `Código servido` em paralelo; não declarar commit se `unknown`.
4. Revisar diagnóstico E2, proteção da versão `published`, nível Avançado; não criar draft nem alterar dados reais.
5. Reportar divergência e não declarar homologação integral E2/F22 sem isolamento autenticado apropriado.

**Autoridades congeladas:** v5.4 e V1.0 FROZEN; sem E3/F23; sem Lovable builder; somente GitHub para código, Supabase no Lovable Cloud para banco oficial e Work para navegação.
