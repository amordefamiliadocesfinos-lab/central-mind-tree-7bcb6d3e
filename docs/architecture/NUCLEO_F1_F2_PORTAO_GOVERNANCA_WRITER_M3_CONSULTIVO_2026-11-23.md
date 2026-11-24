# Núcleo 2.0 — F1/F2 | Portão consultivo de governança, writer, curadoria e compatibilidade M3

**Data:** 23/11/2026  
**Autoridade:** Camada Mestre — ordem de continuar apenas na segurança e governança F1/F2.  
**Status:** PROPOSTA CONSULTIVA. Não migração, não autorização de execução, não mudança de mapa soberano.  
**Base:** Núcleo 2.0 V1.3 / Continuidade Canônica V1.1; PR #1004 em draft.  

## 1. Proveniência auditada e limites

- Código candidato: `scripts/nucleo-f1-f2-concrete-candidate.lab.sql`, blob `e4d84afb460bbecf266490a4e624c3dd23ad6f22`.
- Suíte de segurança: `scripts/nucleo-f1-f2-concrete-security-review.test.sql`, blob `32389d70a8988db7082525e13bd8d6f24f291a62`.
- Reprodução M3 local: `scripts/nucleo-f1-f2-staging-m3-official-compat.sql`, blob `64d1eae14c71a33c4d6dfc14559098a18f11c39f`.
- Documento técnico herdado: `NUCLEO_F1_F2_ENGENHARIA_CONCRETA_DRAFT_2026-11-19.md`, blob `61367072368db9b8719e404ecbc17e12f5e4d30c`.
- A CI anterior comprovou PostgreSQL 16 isolado e Supabase Auth GoTrue/PostgREST **local** (workflows #45190816656, #45190816436). Não é prova de produção.
- Inspeção SQL **somente leitura** do Core Lovable em 23/11/2026: tabela `public.nucleo_development_workstreams` tem três triggers: `nucleo_m3_workstream_before` → `nucleo_m3_workstream_audit`; `nucleo_m3_workstream_history` → `nucleo_m3_workstream_event`; `nucleo_m3_workstream_no_delete` → `nucleo_reject_delete_guard`. Nenhum foi alterado.

## 2. Contrato de autoridade — quatro atos que não se confundem

| Ato | Origem de autoridade exigida | Resultado permitido | Nunca resulta em |
| --- | --- | --- | --- |
| Definir especialidade e método | Decisão competente, método versionado e proveniência | Cadastro funcional e referência de método | Auth, publicação documental ou mandato |
| Vincular uma instância | Identidade/escopo verificados e registro da decisão | `assignment` N:N com vigência e contexto | Leitura automática ou papel administrativo |
| Aprovar concessão `read_context` | Decisor competente, distinto do executor, decisão imutável e individual | Ato aprovado de acesso mínimo | `nucleo_manage`, DML, homologação AC-01/FM, sucessão |
| Executar/revogar o grant | Executor autenticado e autorizado **para a decisão específica** | Grant limitado, revogação e histórico atômicos | Criação unilateral da decisão ou alteração de mandato |

### 2.1 Separação decidida x executada

**Proposta de invariantes obrigatórias para um writer FUTURO:**
1. A decisão nasce em um fluxo independente do executor, com ID, tipo, alvo, escopo, decisor autenticado, origem, prazo, motivo e integridade. Não aceitar um texto arbitrário como prova de mandato.
2. O executor recebe um comando assinado/validado pelo servidor e revalida a decisão vigente, a sessão atual e o escopo. `auth.uid()` só pode vir de identidade autenticada na borda; nunca de SQL ou headers fornecidos pelo cliente.
3. Atomicidade: validar e consumir a decisão, gravar concessão/revogação e evento de auditoria na mesma transação; idempotência por ID da decisão e request ID, com rejeição de replay e corrida entre executores.
4. O operador que preparou a decisão não pode se atribuir competência nem conceder acesso a si sem autorização específica e trilha de segregação.
5. O executor não pode criar decisões, alterar métodos, reabrir vínculo encerrado, alterar origem aprovada ou oferecer `service_role`/credencial privilegiada ao navegador.
6. Revogação exige decisão própria e deve cessar a nova leitura, preservando grant, ator, decisão e histórico. Reemissão só com nova decisão (e novo vínculo se necessário).

**PENDÊNCIA formal:** nomear papel/instância decisora, instância executora e procedimento de substituição/indisponibilidade. Não existe writer operacional autorizado neste portão.

### 2.2 Observação material de escopo do SQL atual

A policy candidata `scoped_context` exige especialidade e módulo iguais e permite:
`a.front_id IS NULL OR a.front_id = context_cards.front_id`.

Isto dá a `front_id=NULL` **significado de concessão para todas as frentes do mesmo módulo**, não apenas uma frente vazia. O modelo pode precisar desse escopo modular, mas deve ser uma decisão **explícita, tipada, auditada e com teste negativo**. Antes de implantação:
- definir `scope_kind = module | front` (ou equivalente sem alterar a candidata nesta fase);
- impedir que ausência acidental de `front_id` amplie escopo;
- rejeitar concessões globais sem `module_id` e rejeitar frentes fora da árvore M3;
- comprovar que o grant modular não atravessa especialidades, outros módulos ou tabelas brutas;
- exigir aprovação diferenciada para escopo modular mais amplo.
**Estado:** contrato em aberto, não afirmar correção/aprovação automática.

## 3. Matriz de acesso e testes negativos obrigatórios

| Identidade/contexto | Cartão saneado do escopo | Fonte bruta / escrita |
| --- | --- | --- |
| Sem autenticação / token inválido / sessão encerrada | 401 no gateway; sem linhas | Negado |
| Auth sem assignment, grant ou decisão | 403 no gateway; zero linhas por RLS | Negado |
| Auth com specialty ou módulo divergente | 403; zero linhas | Negado |
| Auth com frente diferente em grant de frente específica | 403; zero linhas | Negado |
| Auth com escopo modular **expressamente aprovado** | Somente cartões aprovados do módulo + especialidade | Negado |
| Assignment/grant expirado, encerrado ou revogado | 403; sem linhas | Negado |
| Identidade autorizada + grant vigente e escopo coincidente | 200 e apenas metadados minimizados | DML e dados brutos negados |
| Proprietário com `nucleo_manage` ativo | Leitura legada conforme policy soberana | Nenhuma nova autorização de escrita |

`401/403/200` são requisitos de um futuro endpoint; o banco sob RLS pode retornar lista vazia sem status 403 se a API não classificar a ausência de grant. O gateway deve fazer essa distinção sem revelar existência de outros cartões.

## 4. Compatibilidade M3 verificada contra o Core

Consulta `pg_get_triggerdef`/`pg_get_functiondef` da tabela oficial, apenas leitura:
- `nucleo_m3_workstream_audit`: em UPDATE rejeita alteração de `id`, `code`, `kind`, `parent_id`, `created_at`, `created_by_auth_uid`; também cancela UPDATE sem alteração efetiva dos campos de negócio.
- Valida a hierarquia: `frente` sob `modulo`, `subfrente` sob `frente`. Preenche `updated_at`, `updated_by_auth_uid` e `created_by_auth_uid` na trilha autorizada.
- `nucleo_m3_workstream_event`: insere evento de criação/alteração com antes/depois em `nucleo_development_events`.
- `nucleo_reject_delete_guard`: bloqueia DELETE.
- O clone `f12_core.workstreams` representa apenas parte dessas propriedades; a proteção adicional de reparenting não deve ser instalada na M3 produtiva só porque a simulação passou.

**Portão de compatibilidade:** conferir contratos de order/locks, triggers BEFORE/AFTER, políticas e visões com owner, auditoria e concorrência sob um clone fiel autorizado. Não alterar a M3 atual nem suas policies para acomodar F1/F2. O uso de `SECURITY INVOKER` e `security_invoker=true` em views expostas deve continuar obrigatório; não resolver falha de SELECT introduzindo `SECURITY DEFINER`.

## 5. Cartões consultivos, origens e ciclo de vida

Fluxo proposto: **origem aprovada → minimização dos metadados → classificação do escopo → revisão humana → decisão de publicação consultiva → cartão referenciado**.

Proibir cópia de corpos AC-01/FM, arquivos privados de Drive, dados M4 brutos, identidade pessoal e segredos. Referências de origem e rótulos revisados devem ser rastreáveis e não regraváveis silenciosamente.

**Pendências objetivas:**
- quem aprova a origem, revisa as informações e mantém a lista;
- como uma fonte é invalidada e substituída sem apagar histórico;
- versionamento e políticas de retenção;
- bloqueio de fonte não aprovada, origem externa não verificável e label adulterado;
- revogação de concessão independente da disponibilidade dos cartões.

## 6. Gate de integração futura, sem execução agora

**G0 — atual:** desenho e CI isolados aprovados; nenhuma mudança produtiva.  
**G1 — pendente:** decisão sobre competência do decisor/executor, escopo modular, writer e curadoria.  
**G2 — pendente:** compatibilidade M3 integral, negativa de bypass e cenários de corrida em staging **fiel**, de custo e origem aprovados.  
**G3 — pendente:** Auth/RLS hospedados, UAT de ator autorizado e não autorizado, revogação de sessão e concessão, logs saneados.  
**G4 — pendente:** migration aditiva e rollback projetados, inventário de objetos/dependências, backup, zero consumidores ou política de preservação histórica, autorização distinta e específica.  
**G5 — somente após G1–G4 e nova decisão:** eventual integração e implantação, com readback independente.

### Critérios de parada
Abortar se houver privilégio extra, fonte sem autoridade, reuso de decisão, revogação ineficaz, scope widening acidental, identidade não verificada, alteração da hierarquia M3, exposição de conteúdo bruto, ou rollback que apague histórico.

## 7. Despacho

**PARECER:** contrato consultivo refinado; **NÃO HOMOLOGADO PARA PRODUÇÃO**. Propor ao proprietário decisão separada sobre os papéis decisor/executor e a semântica de escopo modular. Até lá, preservar PR #1004 como draft, sem merge, migration, deploy, grants, conta real, F6/F7 ou Entrega B.
