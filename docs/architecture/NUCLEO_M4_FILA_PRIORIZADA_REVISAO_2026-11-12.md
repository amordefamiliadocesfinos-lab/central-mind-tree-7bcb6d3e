# Núcleo 2.0 — M4 | Fila priorizada de revisão das descobertas

**Data:** 12/11/2026. **Escopo:** M4 do Mapa Mestre congelado.

## Motivo e decisão
A primeira descoberta real retornou 600 itens (até 300 PRs e 300 execuções de CI), dos quais 589 foram identificados como candidatos sem atribuição. O volume não significa 589 trabalhos pertencentes ao Núcleo. É necessário priorizar a inspeção sem inventar vínculo, descartar documentos ou alterar a autoridade da M3.

## Comportamento implantado
`scripts/nucleo-m4-prioritize-review.cjs` lê o manifesto completo de descoberta e, quando disponível fora do workflow, somente os metadados mínimos já aprovados do Core. Agrupa sem perder os itens:
- **revisao_prioritaria**: o título (ou branch, se disponível) contém menção explícita a Núcleo/Nucleo **e** a PR consta como mesclada ou CI como sucesso;
- **revisao_de_pendencia_ou_falha**: sinal explícito de Núcleo, mas PR não mesclada ou CI sem sucesso;
- **ja_conhecida**: identidade já cadastrada no Core ou mapeada na lista oficial do coletor;
- **fora_da_triagem_prioritaria**: sem sinais suficientes no material coletado, **não** significa irrelevante, descartada ou rejeitada.

**Não atribui frente.** Todos os itens permanecem com `proposed_workstream_code=null`, `approval=null`, `core_write_allowed=false`, `requires_human_assignment=true`. O sinal textual só altera a ordem de revisão e nunca autoriza importação.

## Execução GitHub Actions
O workflow diário read-only, manual e por push restrito a seus scripts produz mais um arquivo no artefato temporário:
`nucleo-m4-prioritized-review.json`.

O workflow opera **sem credencial Supabase**: para produzir uma primeira fila de candidatos usa exportação vazia do Core, conservando como conhecidas apenas as fontes mapeadas explicitamente pelo coletor. Portanto **não** é permitido interpretar `revisao_prioritaria` como item ainda inexistente no banco. Uma comparação final independente com o Core continua obrigatória antes de qualquer inserção.

## Portões
1. Verificar que nenhuma fonte do manifesto original desapareceu da fila.
2. Revisar os itens prioritários um a um em sua fonte (PR/CI) e conferir a frente competente pelo Mapa Mestre.
3. Comparar identidade global `source/kind/external_key` com o Core e bloquear colisões entre frentes.
4. Somente após autorização e conferência registrar em transação separada, sem reescrever histórico.
5. Preservar os 82 documentos locais, o catálogo Drive, RLS, grants e estados da Central Visual.

### Limites
A coleta é limitada pelas páginas consultadas e não prova cobertura histórica integral. Referência antiga fechada sem merge e CI com falha permanecem para investigação, não como entrega homologada. A fila priorizada não substitui nem altera a triagem individual de 18 evidências homologadas anteriormente.
