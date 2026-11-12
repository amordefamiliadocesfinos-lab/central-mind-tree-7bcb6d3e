# Núcleo 2.0 — M4 | Triagem fundamentada da descoberta GitHub

**Data:** 12/11/2026  
**Autoridade:** Camada Mestre; Mapa Mestre Núcleo 2.0 V1.0 — escopo congelado.  
**Base examinada:** artefato da execução real [#43237750950](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43237750950), arquivo `nucleo-m4-discovery-unassigned.json` do ZIP `13953406943`, com 600 referências consultadas (11 conhecidas; 589 sem atribuição). A busca limitada a 3 páginas por tipo **não é inventário completo**.

## 1. Triagem técnica: candidatos com vínculo explícito

Após comparar títulos, identificação e estados das PRs diretamente no GitHub, selecionei as seguintes **12 PRs mescladas** que ainda não faziam parte da lista explícita das onze fontes do primeiro catálogo. O vínculo abaixo é **proposta técnica fundamentada**, não aprovação automática de inserção no Core.

| Frente sugerida | PRs verificadas | Motivo técnico |
|---|---|---|
| M0 | [#601](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/601) | Backup local na main, sem concluir toda a auditoria M0 |
| M1 | [#610](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/610) | Pré-validação offline da M1 |
| M2 | [#612](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/612) | Catalogação inicial e verificação RLS |
| M3 | [#615](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/615), [#616](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/616), [#617](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/617) | Macrofrentes, elegibilidade de identidade e concessão auditada |
| M4 | [#621](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/621), [#632](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/632), [#633](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/633), [#634](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/634), [#635](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/635), [#636](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/636) | Evidências, reconciliação, CI read-only, bloqueio cruzado, auditoria e descoberta |

As PRs dessa tabela estão `merged=true` na consulta ao GitHub. O evento `merged` só confirma a integração da PR: não homologa a frente nem comprova a ausência de regressões.

**Não duplicar as PRs já existentes no Core:** #608, #611, #614, #619, #622, #624, #626. A lista da tabela é complementar; antes de inserir, o reconciliador deverá consultar novamente a tabela `nucleo_development_evidence` para confirmar ausência de identidade idêntica.

## 2. CI associados: seis execuções técnicas verificadas

| Execução | Estado conferido | Proposta |
|---|---|---|
| [#43237750950](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43237750950) | success | M4 — descoberta real |
| [#43237455679](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43237455679) | success | M4 — testes da descoberta |
| [#43235270389](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43235270389) | success | M4 — refresh de onze fontes |
| [#43235861062](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43235861062) | success | M4 — proteção de vínculo cruzado |
| [#43234161489](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43234161489) | success | M4 — testes do reconciliador |
| [#43238665693](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43238665693) | success | M4 — portão de atribuição explícita |

A associação sugerida refere-se **ao objeto técnico do workflow**, não a um cálculo de progresso do Núcleo.

## 3. Bloqueados ou retidos para decisão

| PR | Condição real | Tratamento |
|---|---|---|
| #591 | Fechada, sem merge | Substituída; não registrar como código integrado |
| #598 | Fechada, sem merge | Substituída por #601 |
| #594 | Fechada, sem merge | Proposta de contrato bloqueada; não tratar como migration |
| #606 | Fechada, sem merge | Pré-validação M1 não mesclada; preservar a história, não a confundir com entrega integrada |
| #604 | Aberta, sem merge | Auditoria M0 ainda em análise; não marcar M0 concluída |

A triagem histórica pode preservar estes cinco identificadores como **referência de decisão/risco**, mas não como evidência de implantação.

## 4. Critérios de aceite para atribuição final

1. Identidade, URL, estado e SHA da fonte conferidos novamente.
2. Verificação da frente competente contra o mapa soberano; uma decisão do especialista **não equivale** a aprovação administrativa presumida.
3. Consulta mínima ao Core para confirmar se o mesmo `source/kind/external_key` já está ligado a alguma frente, inclusive outra.
4. Evidências novas somente por transação administrativa independente, com preflight, RLS, readback e idempotência. O workflow diário permanece sem credenciais do Core.
5. Nenhum registro histórico antigo substituído, nenhum título/código/status M3 alterado, nenhuma página local ou documento Drive importado.

## 5. Saída reutilizável

O arquivo `NUCLEO_M4_TRIAGEM_FUNDAMENTADA_2026-11-12.json` guarda 18 propostas (12 PRs e 6 CI), URLs e justificativas, todos com `classification=proposal_for_review`. **Não é** o arquivo `nucleo-m4-manual-decisions-v1`, pois esse só deve nascer após aprovação específica e auditável da atribuição.

**Cobertura:** seleção inicial fundamentada das 589 candidatas, não avaliação individual integral das 589 entradas. As demais permanecem sem decisão, não são excluídas nem classificadas por suposição.
