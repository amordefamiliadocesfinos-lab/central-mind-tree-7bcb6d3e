# Núcleo 2.0 — M4 | Relatório da reconciliação de 12/11/2026

**Mapa soberano:** Núcleo 2.0 V1.0. **Natureza:** auditoria do mecanismo de conciliação de evidências, sem promoção de estados.

## Entregas
- PR #632: reconciliador `scripts/nucleo-m4-reconcile-review.cjs` integrado na `main`. Entrada: manifesto GitHub de leitura e metadados mínimos exportados do Core. Saída: plano de revisão `existing/new/divergent/blocked`, sem executar qualquer escrita.
- PR #633: gatilho de execução read-only do coletor após alterações controladas nos scripts de atualização.
- PR #634: bloqueio de uma mesma identidade GitHub vinculada a outra frente; não permite classificá-la automaticamente como nova.

## Evidência de execução real
GitHub Actions [#43235270389](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43235270389): **SUCCESS**; o script coletor registrou `fontes conferidas=11, divergência=false`.
- Artefato `nucleo-m4-github-preflight`, ID `13953180097`.
- SHA-256 do artefato ZIP informado pelo GitHub: `ee90e5e667f460f5a14d8dca2defd5f1a7523c42eb3bfeab55e2ad2a196e4e46`.
- Manifesto lido do ZIP: `schema_version=nucleo-m4-refresh-manifest-v1`, `read_only=true`, `requires_human_review=true`, `checked_at=2026-11-12T14:15:23.775Z`.
- Contém onze identidades distintas, todas com `verified_at_source=true`: PRs #608, #611, #614, #619, #622, #624, #626 e runs #43094643388, #43103257248, #43108556183, #43115167528.
- Confronto dos identificadores com o Core após a conciliação: **11 já registrados, zero faltantes, zero duplicados na lista, zero divergências de resultado**. O manifesto não certifica que nenhuma outra PR externa exista: a lista é intencionalmente explícita.

## Reconciliação pontual no Core
- PR #626 foi conferida diretamente no GitHub como **merged**, merge SHA `8a3db92ecdcd7800852aa89e8ad587af5f290a4f`.
- Foi registrada em transação administrativa separada, com preflight e controle de duplicidade, como uma evidência `verificado` ligada a `NUC-M4`, sem executar UPDATE/DELETE na tabela append-only.
- Resultado pós-transação: **16 evidências** no total, uma única referência para PR #626, **zero identidades repetidas** por `workstream_id/source/kind/external_key`.
- Permaneceram 7 frentes, 11 eventos, 3 referências Drive e 0 documentos M1 importados. A capacidade individual `nucleo_manage` continua com uma concessão ativa; não foram concedidas permissões adicionais.

## Testes
- [GitHub Actions #43234161489](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43234161489): testes do reconciliador e build **SUCCESS**.
- [GitHub Actions #43235861062](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43235861062): teste adicional de duplicidade entre frentes, testes de banco e build **SUCCESS**.
- Nenhum agendamento ou workflow de GitHub recebe credencial Supabase, executa scripts de gravação ou altera estado da Central Visual. O reconciliador segue offline e requer revisão antes de cada nova inserção.

## Limites e próximos portões
- A reconciliação foi realizada com fontes **explicitamente mapeadas**; não há inventário universal de todas as PRs, commits e CI do repositório.
- O mesmo ID associado a frentes diferentes agora bloqueia automaticamente o plano e exige decisão humana.
- Divergências de SHA e estados de fonte não aprovados bloqueiam conciliação, nunca são corrigidos silenciosamente.
- Não inferir conclusão de NUC-M4: o estado do Kanban permanece conforme registro anterior, sem alteração automática.
- Caso se queira uma etapa posterior de **descoberta dinâmica de novas PRs**, separar descoberta de atribuição à frente, reconciliação e gravação, preservando a revisão humana.
