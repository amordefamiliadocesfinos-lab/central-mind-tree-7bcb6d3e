# Núcleo 2.0 — M4 | Homologação das quatro PRs e CI representativos

**Data:** 12/11/2026  
**Autoridade:** solicitação explícita do proprietário para concluir a etapa de homologação e agrupamento.  
**Fonte de verdade do desenvolvimento:** GitHub oficial e Core Supabase; Mapa Mestre Núcleo 2.0 V1.0.

## Entregas verificadas

1. PRs **#637, #640, #641 e #643** conferidas diretamente no GitHub como mescladas, com SHA de merge; inseridas como `verificado` para a frente `NUC-M4` mediante transação separada, guardas de idempotência e verificação após COMMIT. Total após esta etapa: 38 evidências.
2. PR [#645](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/645) integrou `scripts/nucleo-m4-group-ci-review.cjs`, testes e inclusão do agrupamento no workflow read-only.
3. GitHub Actions [#43249875381](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43249875381) **SUCCESS**, com arquivo `nucleo-m4-ci-consolidated.json` no artefato #13958033313, SHA-256 `8df7fd5319a296922be4bdae9cdaa0ae48459075b9a38b5ad54dfb6adf10225b`. Arquivo baixado e conferido: **101 execuções de CI bem-sucedidas agrupadas em oito workflows**, todos os IDs preservados.
4. O workflow não recebeu nem consultou credenciais do Core: sua indicação `known_in_core=0` corresponde a um **baseline vazio intencional**, não significa ausência real no banco.

## Oito famílias de CI — resultado da execução real

| Família técnica | Execuções no manifesto | ID representativo |
|---|---:|---|
| M0 — Backup legado | 22 | 43108918918 |
| M1 — SQL RLS isolado | 8 | 43094938708 |
| M1 — Preflight offline | 1 | 43083391358 |
| M2 — Drive refs RLS | 21 | 43108919040 |
| M3 — Central Visual RLS | 20 | 43112579083 |
| M3 — Auditoria no-op e layout | 9 | 43112579171 |
| M4 — Contrato técnico | 16 | 43249437773 |
| M4 — Refresh GitHub read-only | 4 | 43246388291 |
| **Total** | **101** | **8 famílias** |

A execução mais recente de uma família não substitui todas as execuções originais. Os IDs históricos estão integralmente preservados no arquivo de agrupamento. Cada família deve manter suas evidências de origem; a Central Visual não precisa cadastrar todas as 101 execuções para comprovar a existência dos testes.

## Conciliação seletiva realizada

As famílias M3 e M4 já tinham evidências de CI equivalentes vinculadas; para evitar inflar o catálogo, não foram acrescentadas execuções repetidas dessas famílias. Foram escolhidas apenas **quatro fontes novas** representativas de cobertura ainda ausente para M0, M1 e M2. Todas foram conferidas individualmente no GitHub com `status=completed`, `conclusion=success`, `head_sha` e URL corretos:

| Frente | Execução | SHA original |
|---|---|---|
| M0 | [43108918918](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43108918918) | `96d6729810102668203ccd4e18a0782edb94e75d` |
| M1 | [43094938708](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43094938708) | `ee350ed31d2fd6235360c51f281b860fb30c0f81` |
| M1 | [43083391358](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43083391358) | `024764478d97b19627e19a52fb6c66032a1d5a4a` |
| M2 | [43108919040](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43108919040) | `96d6729810102668203ccd4e18a0782edb94e75d` |

Registros inseridos em transação administrativa separada, sem execução de SQL pelo GitHub Actions. Contagens e ausência de colisão global verificadas após COMMIT.

## Estado final confirmado no Core

- **42 evidências técnicas**, +8 neste marco (4 PRs e 4 execuções CI).
- **Zero duplicatas globais** por `source/kind/external_key`.
- **7 frentes** e **11 eventos históricos** preservados.
- **3 referências Drive**, **zero documentos M1 importados**, uma concessão `nucleo_manage` ativa; nenhum grant alterado.
- Teste de leitura autenticada: conta autorizada enxerga 42; identidade não autorizada enxerga 0.
- Não foram alterados os estados, próximos passos e critérios das frentes. A conclusão de uma CI não implica conclusão da frente.
- Não houve migration, mudança RLS, permissão ou alteração das 82 páginas locais.

**Próximo portão:** validar visualmente no navegador autenticado que a ficha M4 mostra as PRs adicionais e que as fichas M0/M1/M2 mostram as evidências de CI correspondentes, sem exigir exibição das 101 execuções.
