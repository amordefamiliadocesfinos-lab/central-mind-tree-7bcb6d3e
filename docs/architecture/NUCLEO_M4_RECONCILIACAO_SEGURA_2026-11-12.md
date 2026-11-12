# Núcleo 2.0 M4 — reconciliação controlada de novas evidências

**Data:** 12/11/2026  
**Escopo soberano:** M4 — evidências técnicas; a M3 permanece autoridade sobre estados e critérios de aceite.  
**Estado:** contrato de comparação, teste sintético e uma reconciliação pontual de evidência real; nenhuma escrita automática pelo GitHub Actions.

## Sequência obrigatória

1. **Coletar na origem:** `scripts/nucleo-m4-github-refresh.cjs` gera manifesto somente leitura contendo identidade, frente explicitamente mapeada, URL, SHA e resultado conferido das fontes do repositório oficial.
2. **Consultar estado real do Core:** exportar exclusivamente os metadados mínimos de `nucleo_development_evidence`, mantendo IDs de clientes, chaves, documentos privados e credenciais fora do repositório.
3. **Comparar localmente:** `node scripts/nucleo-m4-reconcile-review.cjs manifesto.json core-metadata.json plano.json`. O processo classifica cada referência como `existing`, `new`, `divergent` ou `blocked`.
4. **Bloquear divergências:** mudança de SHA conhecido, PR não mesclada, CI sem sucesso, URL/identidade inválida ou duplicação no manifesto não podem ser promovidas automaticamente.
5. **Revisão de fonte e autoridade:** uma referência `new` é apenas candidata; confrontar o ID com GitHub, o vínculo com a frente e o histórico existente antes de autorizar qualquer INSERT.
6. **Transação pontual:** inserção auditável feita por executor técnico autorizado, com guardas de linha, estado da fonte e ausência de duplicatas. Nunca reescrever registros append-only, alterar `status` M3 nem mudar `nucleo_manage`.
7. **Pós-verificação:** reconsultar evidências, duplicatas, RLS e patrimônio documental, preservando manifesto e registro de decisão sem anexar dados privados.

### Formato do estado existente (somente metadados)

Exemplo de consulta de leitura ao Core para fornecer o segundo argumento do reconciliador:

```sql
SELECT w.code AS workstream_code, e.source, e.kind,
       e.external_key, e.observed_state, e.snapshot
FROM public.nucleo_development_evidence e
JOIN public.nucleo_development_workstreams w ON w.id = e.workstream_id
WHERE e.source = 'github';
```

Exportar o resultado como **array JSON**. A consulta não concede acesso adicional; executar somente sob contexto administrativo autorizado. Não enviar esse arquivo ao GitHub Actions, pois o workflow GitHub permanece **sem segredo de banco**.

### Identidade, duplicidade e granularidade

Chave lógica de uma referência: `workstream_code | source | kind | external_key`. Um mesmo ID em outra frente exige **revisão humana**; não presumir que todas as PRs do repositório pertencem à M4. A presença de um registro verificado para a mesma frente e origem classifica a evidência como existente e impede inserção de outra linha somente porque o horário de conferência mudou. A coluna `checked_at` distingue snapshots, mas não deve servir de justificativa para inflar o catálogo.

Uma diferença comprovada de SHA é `divergent`: interromper a conciliação, registrar investigação, preservar ambos os valores e não executar correção silenciosa. Histórico sem SHA não é evidência de coincidência de SHA; a classificação `existing` significa identidade já cadastrada, não integridade de bytes revalidada.

### Testes e limites

- Dez cenários sintéticos: existente, novo, repetição idempotente, divergência SHA, fonte não aprovada, duplicação no manifesto, vínculo desconhecido, URL falsa, consulta adulterada e contrato de manifesto inválido.
- Nenhuma execução do reconciliador chama APIs do Supabase ou realiza INSERT/UPDATE/DELETE.
- Não converter o agendamento diário do GitHub em um mecanismo de escrita. Um manifesto de conferência ainda exige revisão e ato de reconciliação separado.
- Migrations Supabase requerem conferência de `schema_migrations`; não são inferidas de PRs GitHub.
- A leitura dos documentos `localStorage`, as 82 páginas e os acessos Drive continuam fora da M4.

## Primeiro confronto real (12/11/2026)

Lista ampliada de onze fontes GitHub explicitamente mapeadas. No início da conferência, dez identidades já estavam cadastradas no Core (PRs #608, #611, #614, #619, #622, #624 e quatro execuções CI) e a PR #626 foi identificada como candidata nova para `NUC-M4`. A PR #626 foi consultada diretamente no GitHub e consta como **merged**, com merge SHA `8a3db92ecdcd7800852aa89e8ad587af5f290a4f`. Este dado não conclui M4 como um todo.

**Advertência:** o primeiro confronto usa fontes explicitamente selecionadas, não detecção universal de todas as PRs ou execuções existentes no GitHub.
