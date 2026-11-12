# Núcleo 2.0 — M4 | Relatório real da priorização por relevância

**Data:** 12/11/2026  
**Mapa soberano:** Núcleo 2.0 V1.0 — frente M4.  
**Natureza:** triagem e auditoria. **Não** é ato de atribuição ou de importação.

## 1. Execução real e artefatos

Workflow [#43246388291](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43246388291): **SUCCESS** na `main`, após merge da [PR #643](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/643).

Artefato [#13956937436](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43246388291) foi baixado e inspecionado; três JSON:
- `nucleo-m4-discovery-unassigned.json` — 600 entradas originais;
- `nucleo-m4-prioritized-review.json` — 600 entradas preservadas em quatro grupos;
- `nucleo-m4-gh-refresh-manifest.json` — onze fontes conhecidas, sem divergência.

SHA-256 do artefato informado pelo GitHub: `428c1ea768bd14d90cc99cad40089ae2da036f44c79289bb57d88c7da756afc9`. Retenção de sete dias. A coleta é limitada a três páginas de PRs e três de CI; **não é um inventário histórico integral**.

## 2. Resultado real da classificação

| Grupo | Total | Significado correto |
|---|---:|---|
| Revisão prioritária | **114** | Título ou branch com sinal explícito de Núcleo e PR mesclada/CI com sucesso |
| Pendência ou falha | **23** | Sinal de Núcleo, mas PR não mesclada ou CI sem sucesso/no estado pendente na coleta |
| Conhecida pelo coletor | **11** | Presente na lista explícita de onze fontes |
| Fora da prioridade textual | **452** | Sem sinal suficiente para priorizar, mas não descartada |
| **Total preservado** | **600** | Cada identidade aparece uma vez no relatório |

A categoria `revisao_prioritaria` **não** autoriza a associação com uma frente. Os 114 registros contêm 16 PRs e 98 CI.

## 3. Confronto adicional com o Core real

Foi consultada a lista atual de identificadores GitHub em `public.nucleo_development_evidence` (as evidências existentes não foram exportadas para o GitHub Actions). O confronto por `source/kind/external_key` encontra:
- Entre os 114 prioritários, **18 já registrados** no Core (12 PRs e 6 CI);
- Restam **96 prioritários não cadastrados**: 4 PRs e 92 execuções CI;
- As quatro PRs não cadastradas são [#637](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/637), [#640](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/640), [#641](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/641) e [#643](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/643), todas relativas à governança e à evolução da M4;
- Entre as 23 pendências/falhas, **5 são PRs** (#591, #594, #598, #604, #606) e **18 são CI**;
- Os 92 CI prioritários não equivalem a 92 frentes de desenvolvimento. São execuções de workflows repetidos: M0 backup (22), M2 refs Drive (21), M3 RLS (20), M4 contrato técnico (10), M3 no-op (9), M1 RLS (8), M4 refresh (1), M1 preflight (1).

A lista do coletor, por si só, reconhece onze fontes; a comparação real com o Core evita regravar as 18 prioritárias já homologadas. O workflow não recebeu credenciais ou dados do Core.

## 4. Próximo lote de investigação

Priorizar a inspeção individual das quatro PRs da M4. Para CI, trabalhar por **workflow e execução de referência**, verificando SHA, resultado final, associação com PR e eventual supersessão por execução mais recente; não importar cada execução repetida como marco único sem justificativa operacional.

Os registros com `failure`, `queued`, `open` ou `closed` sem merge devem permanecer em trilha de investigação e **não** receber classificação `verificado` como entrega aprovada. A PR #604 da auditoria M0 continua fora da categoria concluída.

## 5. Proteções preservadas

A priorização usa apenas leitura do GitHub e não modifica o Core, as frentes, seus estados ou permissões. Não importa nenhuma das 82 páginas locais; não promove versões Drive. A identificação textual da palavra Núcleo é apenas **ordenação de triagem**, nunca autoridade para `NUC-M0...NUC-M5`. Atribuição e reconciliação continuam processos separados, com revisão fundamentada antes da inserção.

**Estado deste marco:** código integrado na PR #643, testes PostgreSQL 17/build aprovados, execução real com 600/600 registros preservados e relatório cruzado com o Core. Nenhuma das 96 candidatas prioritárias pendentes foi inserida nesta etapa.
