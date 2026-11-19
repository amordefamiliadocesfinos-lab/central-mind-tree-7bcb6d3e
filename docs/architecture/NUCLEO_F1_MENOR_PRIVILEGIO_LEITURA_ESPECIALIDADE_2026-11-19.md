# Núcleo 2.0 · F1 — menor privilégio na leitura consultiva por especialidade

**19/11/2026 | Mapa soberano:** Núcleo 2.0 V1.3 — Entrega A+. **Mapa complementar:** Continuidade Canônica V1.1, D1–D7, F1. **Estado:** diagnóstico e desenho de segurança para deliberação; **não implantado**.

## Resultado da investigação dirigida

Consulta `SELECT` no Core oficial do projeto Lovable `1720a410-34cd-4410-995c-8c92c7edf16b`, instância `xkskyutmtlhivvpfxkjg`:
- `app_admin_capabilities`: existe **1** concessão `nucleo_manage` ativa e não revogada. A leitura dessa tabela é limitada ao `auth.uid()` próprio.
- `nucleo_development_workstreams`, `nucleo_development_events`, `nucleo_development_evidence`, `nucleo_specialist_contributions` e `nucleo_module_knowledge_revisions`: políticas `SELECT` para `authenticated` condicionam consulta a `nucleo_manage` ativo pertencente a `auth.uid()`.
- Várias dessas tabelas também possuem `INSERT` e/ou `UPDATE` condicionados a `nucleo_manage`. **Não é suficiente adicionar uma nova permissão a `app_admin_capabilities` ou trocar apenas o gateway**: o Core mantém a proteção atual, e uma política ampla poderia criar leitura transversal indesejada.
- O leitor `nucleo-ac02-context-read` valida `getUser(token)`, concede acesso com `nucleo_manage`, usa cliente anon + JWT sob RLS e restringe o resultado a metadados NUC e checkpoint M4. Essa consulta funcional do proprietário está aprovada (PRs #997/#1001); não regredir.
- `nucleo_specialist_mandate_records` tem `specialist_auth_uid` opcional e registra **mandato**, não substitui vínculo de **leitura**. `nucleo_specialist_contributions.specialist_role` é texto, não identidade de acesso. Nenhum cadastro N:N real foi comprovado na F2, somente ensaio isolado da PR #1000.

## Contrato mínimo proposto — fora de produção

**Acesso** requer cumulativamente:
1. JWT individual conferido server-side, sessão ativa, sem confiar em `user_metadata`, nome de chat ou segredo de outro usuário.
2. Associação explicitamente concedida por autoridade competente, **existente e vigente** (`auth_uid` + especialidade estável + contexto NUC + papel + ação `read_context` + validade + revogação).
3. Consulta restrita aos campos e fontes aprovados para o contexto da especialidade. FM e conteúdo privado não devem vazar por acesso a tabelas brutas.
4. Nenhuma associação atribui `nucleo_manage`, `write_document`, mandato, aceitação sucessória, homologação ou privilégio de outro módulo.
5. Revogação efetiva em novas consultas e sem confiança em claims JWT desatualizadas. Os casos negativos devem abranger sessão inválida, ausência/expiração/revogação de vínculo, cross-tenant/module/specialty e negação de escrita.
6. Preservar `nucleo_manage` atual para o proprietário enquanto uma futura transição for autorizada e comprovada. **Nunca** enfraquecer políticas existentes por inferência.

**Menor alternativa:** após o portão F2 de identidade N:N real, avaliar uma representação aditiva de `specialty_assignment` com integridade de escopo/validade/revogação, separada de mandato. Construir leitura invoker/ RLS correspondente com permissões limitadas a contexto, possivelmente por projeção dedicada de metadados, **sem acesso direto a todas as tabelas**. As policies e grants concretos dependem de revisão e suíte real PostgreSQL/RLS; não introduzir `SECURITY DEFINER` como atalho ou expor `service_role`. Não adicionar policy `USING(true)` ou concessão genérica a usuários autenticados.

## Prova mínima nesta etapa

`node scripts/nucleo-f1-read-scope-model.test.cjs` executa matriz **somente em memória**, representando vinculação por módulo, especialidade, ator, ação e intervalo. Casos positivos e negativos de isolamento, revogação, expiração, ausência de mandato implícito e compatibilidade com o administrador atual. Testa também que o gateway produtivo continua exigindo `nucleo_manage`.

**Este ensaio não é prova de RLS PostgreSQL em produção, nem autorização ou implantação de vínculo.** Não atribuir identidade ao modelo sintético. Sem migration, grant, policy, usuário, sessão, writer, FM ou nova contribuição.

## Portão de continuidade

**F1 diagnóstico:** lacuna de menor privilégio demonstrada. **F1 acesso por especialidade:** pendente da modelagem/autorização F2 e revisão de segurança com ensaio PostgreSQL isolado, antes de qualquer migration ou deploy. **F3/F5 do proprietário:** permanecem aprovadas sem alteração. **F6/F7:** não abertos.

**Próxima ação única:** submeter à Camada Mestre a necessidade de autorizar o desenho aditivo F2 de vinculação de identidade/competência e seus testes negativos no PostgreSQL isolado. Só então decidir a implantação de leitor de menor privilégio por especialidade, com contrato de leitura mínimo e readback.
