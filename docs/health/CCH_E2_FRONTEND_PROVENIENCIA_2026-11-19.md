# CCH E2 — identidade verificável da interface publicada (read-only)

**Autoridade:** CCH V1.0 FROZEN, mapa soberano v5.4. **Issue:** #973.

## Problema encontrado pelo Work

O programa autenticado mostrava apenas `v2 · published` (versão de prescrição), sem permitir verificar **qual commit do frontend estava realmente servido**. Status `ready` do código GitHub e deploy solicitado `pending` não comprovam a implantação.

## Implementação

Na interface do Programa, abaixo da versão de prescrição, aparece `Código servido: <12 caracteres>` com o SHA completo em `data-cch-build-commit` e `data-testid="cch-e2-build-revision"`. A constante é inserida **no build** a partir de `CCH_SOURCE_COMMIT`, `GITHUB_SHA` ou `git rev-parse HEAD`. Quando não há commit verificável, aparece `revisão indisponível` e `data-cch-build-commit="unknown"`. Não inferir um SHA pelo nome do projeto, screenshot, versão do programa ou branch do GitHub.

O identificador não contém dados pessoais ou segredos e não habilita operações de escrita. Ele descreve a compilação servida, **não** prova banco, sessão, conclusão de deploy, comportamento clínico ou revisão de draft.

## Contraprova Work (somente leitura)

1. Recarregar `https://central-mind-tree.lovable.app/saude/treino/programa`, ignorando cache quando possível.
2. Autenticar-se normalmente e ler `Código servido`, ou inspecionar `[data-testid="cch-e2-build-revision"]` no DOM, se disponível.
3. Comparar o valor completo com o commit presente no GitHub e verificar que a UI corresponde ao período esperado.
4. Se ausente ou `unknown`, registrar **implantação não comprovada** e não inventar correspondência.
5. Confirmar `published` e seus bloqueios sem criar draft; a jornada de rascunho permanece provada no laboratório descartável, não no deploy autenticado oficial.
6. Anexar captura e registrar resultado na #973.

**Limites:** CI da PR #974 executou componente React real com hooks de laboratório, não uma implantação independente com Supabase Auth. Não abrir E3/F23 ou homologar a interface oficial sem evidência correspondente.
