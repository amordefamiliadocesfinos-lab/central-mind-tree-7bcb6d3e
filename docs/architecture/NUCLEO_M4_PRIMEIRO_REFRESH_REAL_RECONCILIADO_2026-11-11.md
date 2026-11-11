# Núcleo 2.0 — M4 | Primeira execução real e reconciliação controlada

**Data:** 11/11/2026  
**Mapa soberano:** Núcleo 2.0 V1.0 — M4  
**Estado:** workflow GitHub homologado na primeira execução, reconciliação técnica de três evidências registrada; homologação visual do layout compacto ainda depende de captura atualizada.

## 1. Execução real GitHub Actions

- PR [#622](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/622) integrada: apresentação agrupada das evidências e preflight GitHub read-only.
- PR [#624](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/624) integrada: gatilho `push` somente para alterações ao próprio workflow, além dos gatilhos manual e agendado.
- Workflow **Nucleo M4 - GitHub read-only refresh preflight**, [run #43115167528](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43115167528): `event=push`, commit `1770f1521ea959a55aa0f4fc079fbaa728a23054`, **SUCCESS**.
- Etapas do job concluídas: 4 testes sintéticos; consulta GitHub; geração de manifesto; upload de artefato.
- Log: `M4: fontes conferidas=7, divergência=false; manifesto somente leitura gerado.`
- Artefato GitHub `nucleo-m4-github-preflight` ID `13897687686`, SHA-256 publicado pelo GitHub `f63c17c9015db4566a2beceb5fd51a689d8d9e25e3491a28a52f0c3cdca50497`, retenção de sete dias.
- ZIP foi baixado e seu JSON interno analisado: `schema_version=nucleo-m4-refresh-manifest-v1`, `read_only=true`, `requires_human_review=true`, 7 registros e nenhuma divergência.

| Frente | Tipo | Referência | Estado na fonte |
|---|---|---|---|
| NUC-M1 | PR | #608 | merged |
| NUC-M2 | PR | #611 | merged |
| NUC-M3 | PR | #614 | merged |
| NUC-M3 | PR | #619 | merged |
| NUC-M1 | CI | 43094643388 | success |
| NUC-M3 | CI | 43103257248 | success |
| NUC-M3 | CI | 43108556183 | success |

**Não há escrita no Core durante o workflow.** Este resultado comprova a conferência pontual da lista conhecida, **não** uma integração contínua de todas as PRs futuras. Migrations continuam exigindo leitura do histórico Supabase independentemente.

## 2. Reconciliação controlada, fora do workflow

Depois de comparar as fontes diretamente com o GitHub e inspecionar o artefato, foi executada **transação administrativa separada** no Core, com preflight de contagem, identidade de frente e ausência de duplicatas. Foram adicionados três registros imutáveis a `nucleo_development_evidence`, todos vinculados à frente `NUC-M4`:

- PR #622 — merge confirmado, SHA `2088a5f064df1e41ce1f83f594c5e27e270a076f`.
- PR #624 — merge confirmado, SHA `1770f1521ea959a55aa0f4fc079fbaa728a23054`.
- Run CI #43115167528 — sucesso e 7/7 fontes sem divergências, com ID e hash do artefato registrado no snapshot.

Os registros receberam `observed_state=verificado` e `checked_at` com o horário da reconciliação. **Não foram criados pelo workflow agendado, nem por uma conta de navegador.** O executor técnico administrativo registrou as evidências; nenhum usuário foi falsamente identificado.

Readback pós-transação: **15 evidências totais**; identidade autenticada com `nucleo_manage` vê as 3 de NUC-M4 e uma identidade sem a capacidade vê 0.

## 3. Situação documental e de governança

- `nucleo_development_workstreams`: 7 entradas, estados M3 não modificados.
- `nucleo_development_events`: 11, sem novos eventos porque nenhuma frente foi atualizada.
- `nucleo_source_references`: 3, acesso original Drive não alterado.
- `nucleo_documents`: 0, nenhum conteúdo local das 82 páginas importado.
- `nucleo_manage`: 1 concessão individual já autorizada, mantida.
- Nenhuma migration, RLS, capacidade ou ACL alterada nesta etapa.

## 4. Limite de homologação visual

A revisão do código da PR #622 e o build PostgreSQL/frontend aprovados comprovam implementação dos grupos expansíveis, mas **não substituem a captura da interface publicada**. A aba do navegador conectada ainda devolveu o texto dos cartões antigos, possivelmente sem recarregamento pós-deploy; não se declara essa captura anterior como evidência da nova interface.

Para homologar visualmente: recarregar `/nucleo` na sessão autorizada, abrir Desenvolvimento → NUC-M4 ou NUC-M3 e confirmar os grupos **Pull requests**, **Testes / CI**, **Migrations**, com expansão de um grupo e detalhes de um registro. O botão Recarregar consulta somente o Core, não faz fetch do GitHub.

**Próximas evoluções M4:** o manifesto permanece revisável; qualquer reconciliação posterior deve impedir duplicações, registrar divergências sem inferir conclusão e exigir preflight de identidade/estado no Core.
