# Núcleo 2.0 — F1/F2 | Decisão G1 sobre autoridade e escopo de leitura V1.0

**Data:** 23/11/2026  
**Origem:** autorização da Camada Mestre para formalizar a autoridade de `read_context` e a regra de escopo modular, na continuidade da PR #1004.  
**Natureza:** **regra de governança para a candidata**, não ato individual de concessão e não autorização de migração, merge ou operação.  
**Mapa:** Núcleo 2.0 V1.3 e Continuidade Canônica V1.1. PR #1004 deve permanecer **DRAFT**.

## G1-A — Quem decide, prepara e executa

1. **Autoridade aprovadora:** a **Camada Mestre / proprietário**, ou autoridade que ela venha a delegar *expressamente por instrumento específico, auditado e com limites de competência*. Na ausência de delegação comprovada, **somente a Camada Mestre** pode aprovar a decisão individual de conceder, renovar ou revogar `read_context`. Esta política **não constitui** uma concessão individual nem cria usuário, papel de banco ou mandato.
2. **Solicitante / preparador:** especialista ou operador autorizado pode preparar proposta, com justificativa e escopo solicitado, mas **não** aprová-la nem transformá-la em grant. Metadados ou vínculos de especialidade não demonstram competência.
3. **Executor:** serviço técnico **futuro**, segregado do aprovador, com identidade própria verificada, privilégios mínimos, capacidade de execução restrita a decisão previamente aprovada e consumível uma única vez. Nenhuma pessoa, conta, Edge Function ou `service_role` recebe poderes por este documento. O executor não cria/aprova a decisão, não muda método, não promove AC-01, não cria mandato, não concede `nucleo_manage` e não publica conhecimento.
4. **Identidade:** a aprovação individual deverá registrar identificador Auth verificado do beneficiário, identidade de quem aprovou, serviço executor, referência de origem/competência e hora/versão. Um texto como `approved_actor_auth_uid` no SQL candidato não basta, por si, para provar a autoridade do decisor.
5. **Indisponibilidade/contingência:** se não houver aprovador competente ou executor operacional homologado, o resultado é **nenhum grant novo**. Não existe aprovação automática, substituição tácita nem bypass de emergência. Delega-se autoridade apenas mediante nova decisão expressa, limitada e auditada.
6. **Revogação:** uma decisão explícita e autônoma deve permitir revogar o grant sem apagar histórico. O executor revalida vigência/competência, faz revogação idempotente e emite evento append-only. Reemissão exige nova decisão e, conforme a situação, novo vínculo; não ressuscitar concessões antigas.

## G1-B — Escopos aprováveis, sempre por decisão explícita

**Regra padrão: negar por ausência de autorização.** Toda concessão individual exige `scope_kind` explícito, alvo e motivo; **`front_id=NULL` jamais pode significar, isoladamente, autorização ampla**.

| Escopo | Requisitos | Abrangência permitida |
| --- | --- | --- |
| `front` — preferencial | `specialty_id`, `module_id`, `front_id` reais e coerentes com a árvore M3; decisão individual vigente | Somente cartões aprovados da especialidade, módulo e frente autorizados. Subfrentes não são incluídas automaticamente sem definição explícita aprovada. |
| `module` — exceção justificada | `specialty_id` e `module_id` reais; campo `scope_kind=module`; justificativa de necessidade de leitura transversal, autorização **individual** da Camada Mestre, vigência finita e reavaliação, escopo registrado na auditoria | Cartões saneados aprovados de **somente aquele módulo e especialidade**, incluindo frentes/subfrentes **apenas quando a decisão declara essa abrangência**. Nunca outros módulos, outras especialidades ou tabelas brutas. |
| ausente/ambíguo/sem frente | Sem declaração explícita, sem identidade verificada, sem prazo ou sem decisão | **Nenhuma leitura**; falha fechada. |

**Não aprovar:** `scope_kind=all`, wildcard entre módulos/especialidades, concessão baseada em nome textual do especialista, `front_id=NULL` por omissão do cliente, concessão permanente implícita, atribuição de `nucleo_manage`, acesso a corpo de AC-01/FM, execução sucessória F6/F7 ou DML.

**Achado sobre a candidata atual:** `scoped_context` utiliza `(a.front_id IS NULL OR a.front_id=context_cards.front_id)`. Portanto, **o SQL atual não implementa integralmente G1-B**: uma linha com frente nula amplia a leitura para o módulo, sem um `scope_kind` verificável. Antes de qualquer merge/deploy, é obrigatória uma correção **em laboratório** e novos testes fail-closed; este documento não executa nem presume essa correção.

## G1-C — Registro mínimo exigido por decisão individual

- `decision_id` e `request_id` idempotentes; `action` = `grant_read_context` ou `revoke_read_context`.
- ID do beneficiário autenticado, `assignment_id`, `specialty_id`, `module_id`, `scope_kind`, `front_id` quando aplicável, amplitude de subfrentes se expressa, tipo de cartão permitido.
- Aprovação: identidade e competência do decisor, fundamento, origem e revisão, momento da decisão, início e expiração, justificativa de necessidade (maior para `module`).
- Execução: executor autenticado e separado, timestamp, resultado, `grant_id`, `decision_id` consumido e evento de histórico. Revogação deve identificar decisão própria e grant exato, sem reescrever histórico.
- Falha de autenticação, expiração, falta de escopo, divergência decisor/executor, replay, concorrência, linha órfã ou perda de proveniência ⇒ **nenhum grant** e registro seguro do erro.

## G1-D — Matriz mínima de provas para engenharia subsequente

- [ ] Assignment `front_id=NULL` **sem `scope_kind=module` e sem decisão específica** ⇒ ZERO cartões, nunca wildcard.
- [ ] `scope_kind=front` + frente coincidente ⇒ leitura mínima; outra frente/subfrente ⇒ negado, salvo extensão expressa testada.
- [ ] `scope_kind=module` + aprovação individual, prazo finito e especialidade/módulo coincidentes ⇒ cartões saneados conforme extensão declarada; outras especialidades/módulos ⇒ negados.
- [ ] `module` por omissão, por `front_id=NULL`, por identidade não verificada ou com aprovação genérica ⇒ negado.
- [ ] Revogação, expiração, troca de identidade, encerramento de assignment, logoff e replay ⇒ leitura cessada e histórico preservado.
- [ ] Dois executores concorrentes com a mesma decisão ⇒ exatamente um efeito; nenhuma ampliação involuntária.
- [ ] Leitor jamais recebe `nucleo_manage`, DML, dados M3/M4/AC-01/FM brutos ou conteúdo privado do Drive.
- [ ] Executor não tem `INSERT` em `approved_decisions`; decisor não opera como writer pelo mesmo canal; cada concessão prova a cadeia de competência.
- [ ] RLS + PostgREST/GoTrue locais em staging descartável, com testes negativos, antes de qualquer apreciação de infraestrutura hospedada.
- [ ] Compatibilidade com triggers M3 oficiais, versão da candidata, reversão por estado de uso e readback independente.

## G1-E — O que está decidido e o que continua bloqueado

**Decidido como regra consultiva G1:** Camada Mestre é a autoridade padrão para cada ato individual; executor separado e ainda não implementado; acesso por frente é o padrão mínimo; módulo inteiro é **exceção expressa**, individual, temporária, auditável, nunca inferida de NULL; ausência de executor/aprovação = negar.

**Não decidido / não autorizado:** nenhuma pessoa/instância real foi designada como executor, nenhuma identidade recebeu `read_context`, nenhum método foi homologado, nenhuma mudança produtiva de schema/RLS/grants, nenhum staging pago, nenhuma migration, nenhum merge da PR #1004, nenhuma sucessão F6/F7, nenhuma Entrega B.

**Próximo gate de engenharia (sem produção):** adaptar candidato e provas isoladas para `scope_kind` obrigatório, preservando compatibilidade; depois reavaliar com CI e solicitar decisão separada antes de qualquer infraestrutura ou implantação.
