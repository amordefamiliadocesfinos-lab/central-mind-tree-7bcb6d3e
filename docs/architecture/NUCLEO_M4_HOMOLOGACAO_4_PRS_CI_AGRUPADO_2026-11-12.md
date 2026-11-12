# Núcleo 2.0 — M4 | Homologação de quatro PRs e consolidação de CI

**Data:** 12/11/2026. **Autoridade:** solicitação explícita do proprietário após a triagem priorizada.  
**Mapa soberano:** Núcleo 2.0 V1.0, frente M4.

## 1. Quatro PRs homologadas e registradas
Conferidas individualmente no GitHub como `merged=true`, com SHA da mesclagem:
- [#637](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/637): atribuição explícita, SHA `0b8ccaaafb41d4026bb25ce6b92329cdf196bed6`.
- [#640](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/640): triagem fundamentada, SHA `ace55836b0c9fa806510312a08eaaa9ba887d817`.
- [#641](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/641): homologação de 18 evidências, SHA `0cc3c98a7b2204e9662e5c017d8a755292c39947`.
- [#643](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/643): fila de revisão priorizada, SHA `31df5c8fd118dcb92c828539a148fd92011bde5d`.

Após preflight do Core (34 evidências anteriores, 7 frentes, 11 eventos, 3 refs Drive, 0 documentos e 1 concessão individual), uma única transação inseriu as quatro evidências, associadas à **NUC-M4**. A validação posterior confirmou **38 evidências e zero identidade GitHub repetida**, sem alteração de status, documentos ou grants. RLS: identidade autorizada vê 38 registros; identidade sem concessão vê 0.

## 2. Consolidação por execução representativa
A fila priorizada de 12/11 registrou 98 execuções CI relevantes por nome; seis já constavam no Core, portanto restavam **92 execuções CI** para triagem, distribuídas em 8 famílias por workflow:

| Workflow | CI prioritários pendentes | Natureza |
|---|---:|---|
| Núcleo M0 — backup legado | 22 | Testes repetidos da preservação local |
| Núcleo M1 — SQL RLS isolado | 8 | Testes de contrato M1 |
| Núcleo M1 — preflight offline | 1 | Pré-validação M1 |
| Núcleo M2 — referências Drive RLS | 21 | Testes de acesso M2 |
| Núcleo M3 — Central Visual RLS | 20 | Testes de permissão M3 |
| Núcleo M3 — no-op e layout | 9 | Testes de atualização sem alteração |
| Núcleo M4 — contrato técnico | 10 | Testes de evidências e atribuições |
| Núcleo M4 — refresh GitHub | 1 | Execução adicional de leitura |
| **Total** | **92** | Não são 92 entregas distintas |

`scripts/nucleo-m4-group-ci-review.cjs` agrupa sem deletar dados: conserva `all_run_ids`, destaca uma execução representativa por nome de workflow e, quando informado um export mínimo autorizado, diferencia o que já está no Core. O GitHub Actions usa somente `[]` como marcador de comparação, pois **não tem acesso ao banco**; logo, sua marcação de candidato **não comprova ausência no Core**.

O agrupamento **não atribui automaticamente uma frente** e não insere CI no banco. A seleção definitiva de uma execução representativa ainda exige conferir SHA/resultado em GitHub, relevância e se já existe fonte equivalente vinculada. Execuções com falha continuam na fila original, fora da categoria de CI aprovada.

## 3. Portões e preservação
- Os 92 CI não foram importados nesta etapa, para evitar ruído e duplicação operacional.
- Nenhuma PR encerrada sem merge foi convertida em entrega.
- Nenhum dos estados M0–M5 foi alterado pelo catálogo.
- 82 páginas locais preservadas; Drive ainda mantém suas três referências, sem promoção documental.
- Sem migrations, RLS, capabilities ou credenciais novas; o workflow GitHub continua somente leitura.

**Próxima decisão técnica:** selecionar somente as execuções de referência que comprovem critérios não cobertos, conferindo sua fonte, em vez de inflar a Central Visual com o histórico completo de CI.
