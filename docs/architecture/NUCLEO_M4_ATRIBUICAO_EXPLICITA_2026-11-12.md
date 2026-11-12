# Núcleo 2.0 M4 — Portão de atribuição explícita

**Data:** 12/11/2026  
**Autoridade:** Mapa Mestre Núcleo 2.0 V1.0; frente M4.

## Distinção das camadas

**Descoberta dinâmica** identifica PRs e execuções CI por fonte oficial, sem vínculo definitivo. O manifesto real da primeira execução continha 600 referências, 11 previamente conhecidas e 589 candidatas sem atribuição. O inventário foi limitado a até três páginas por tipo (PRs e CI); não implica cobertura histórica integral.

**Atribuição explícita** usa `scripts/nucleo-m4-assignment-review.cjs` para validar decisões de revisão individual, com código da frente, URL de fonte confirmada, justificativa substantiva e referência auditável do revisor. Uma candidata só pode ser proposta como aprovada com estado de fonte técnico `merged` ou `success`. PRs de outros módulos devem ser rejeitadas, nunca automaticamente associadas à M4.

**Reconciliação independente** usa `scripts/nucleo-m4-reconcile-review.cjs` após aprovação real da identidade do revisor, confrontando Core, hashes e vínculos. O script de atribuição não comprova legitimidade de uma autorização apenas pela presença de um campo textual. A aplicação ao Core continua uma transação separada com preflight, verificação pós-gravação e proteção append-only.

## Procedimento de revisão

Preparar um arquivo de decisões fora do repositório e sem informações privadas:

```json
{
  "schema_version": "nucleo-m4-manual-decisions-v1",
  "decisions": [
    {
      "kind": "pull_request",
      "external_key": "636",
      "decision": "approve",
      "workstream_code": "NUC-M4",
      "confirmed_source_url": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/636",
      "reviewer_reference": "exemplo-de-registro-de-aprovacao",
      "review_note": "Atribuição revisada contra o Mapa Mestre e a fonte original."
    }
  ]
}
```

**O exemplo não constitui aprovação real da PR #636.** Os dados apresentados não devem ser copiados diretamente para o Core.

Com o manifesto de descoberta original e as decisões efetivamente aprovadas:
`node scripts/nucleo-m4-assignment-review.cjs descoberta.json decisoes.json plano-atribuicao.json`.

O plano gerado continua `read_only=true`, `automatic_core_write=false` e marca cada decisão `pending_independent_reconciliation`. A saída não é diretamente compatível com a API de inserção no banco. Revisar a autoria da decisão antes de usá-la.

## Proteções

- Nenhuma inferência de dono da frente por título, nome da branch, número de PR ou assunto aparente.
- Não aceitar IDs ausentes do manifesto, URLs divergentes, códigos de frente fora do conjunto M0–M5 ou decisões repetidas.
- Não remapear identidade já presente na lista conhecida por este processo.
- Não transformar fontes com estado `open` ou CI sem `success` em evidências aprovadas.
- Sem segredos, alterações no Supabase, modificações de Kanban, documentos, ACLs ou permissões.
- A exclusão de uma candidata do plano é apenas uma decisão de triagem, não exclusão no GitHub nem no Core.

**Marco:** descoberta, atribuição e conciliação têm artefatos e testes independentes. A aprovação humana das 589 candidatas não ocorreu e não deve ser presumida.
