# NÚCLEO 2.0 — F1/F2 | G2 Revisão Integrada de Segurança da Cadeia

**Data:** 23/11/2026 (execução CI registrada em UTC de 24/11)  
**Natureza:** análise adversarial e testes de laboratório descartável, conforme decisão da Camada Mestre PR #1004, comentário #7118229984.  
**Estado:** PARECER TÉCNICO, não aprovação operacional nem autorização de merge/deploy.  
**Mapa:** Núcleo 2.0 V1.3 congelado; Continuidade Canônica V1.1. Preservar F6/F7/Entrega B, AC-01/AC-02/FM/M3.

## 1. Inventário efetivamente analisado

- Candidata `scripts/nucleo-f1-f2-concrete-candidate.lab.sql`: tabelas `assignments`, `approved_decisions`, `read_grants`, `grant_history`; RLS `writer_grant_insert`, `writer_grant_update`, `scoped_context`; role sintética `f12_grant_executor`.
- Fixture `scripts/nucleo-f1-f2-g2-authority-lab.sql`: `g2_competences` e `g2_decision_attestations`, sem emissão soberana real.
- Fixture `scripts/nucleo-f1-f2-g2-atomic-attestation-receipt.test.sql`: `g2_guard_atomic_grant`, `g2_execution_receipts`, teste de um commit contendo grant + auditoria + recibo.
- `scripts/nucleo-f1-f2-g2-writer-race.cjs`: duas conexões concorrentes disputando a mesma decisão anterior; **não** prova duas execuções completas da nova tríade atestado/grant/recibo.
- Workflow Supabase Auth local / PostgreSQL 16 isolado; nenhuma conexão à produção.

## 2. Análise de ataques e conclusões

| ID | Ataque ou falha | Proteção/estado verificado | Classificação |
| --- | --- | --- | --- |
| A1 | Consumir decisão de fonte fora da família `synthetic://g2/atomic/%` sem atestado | Trigger `g2_guard_atomic_grant` faz RETURN NEW para outra origem; policy antiga do writer pode permitir grant | **BLOQUEADOR: contorno de cobertura** |
| A2 | Inserir grant de família atestada e dar COMMIT sem recibo | O recibo é INSERT separado e não existe obrigação de finalização da transação | **BLOQUEADOR: contorno de recibo** |
| A3 | Forjar autoridade com string `source_ref`/`proof_ref` | Verificações `LIKE 'synthetic://master/%'` e `LIKE 'synthetic://verified/%'` são marcadores de fixture, não assinatura/verificação externa | **BLOQUEADOR: autoridade soberana não comprovada** |
| A4 | Simular executor alterando `request.jwt.claim.sub` | Nos testes SQL, `SET LOCAL ROLE` + GUC é permitido pelo administrador local; não é modelo de identidade seguro do servidor | **EXIGE staging/arquitetura de identidade** |
| A5 | Concorrência entre dois INSERTs do writer antigo | Índice `f12_grant_decision_once` e trigger de histórico impediram dupla concessão no teste anterior | **CORRIGIDO/COMPROVADO no laboratório anterior** |
| A6 | Concorrência no **novo** consumo atestado com recibo obrigatório | Não há teste end-to-end de dois consumos do mesmo `request_id` na nova transação; receipt separado não força atomicidade universal | **ABERTO para laboratório** |
| A7 | Repetição de `request_id` com payload diferente / pós-timeout | Índices únicos rejeitam novo INSERT; fingerprint atual é string artificial, sem normalização nem contrato HTTP de retorno | **ABERTO para contrato + CI** |
| A8 | Delegação revogada, troca de beneficiário/escopo | Negativas foram aprovadas em fixture, porém emissor soberano e origem verificada inexistentes | **CORRIGIDO/TESTADO na fixture; autoridade real pendente** |
| A9 | Revogação sem atestado/recibo | O protótipo de atestado e recibo modela apenas `result_kind='granted'`; policy legada permite revogação vinculada à decisão, mas sem obrigação de recibo na fixture | **BLOQUEADOR: simetria de revogação** |
| A10 | Executor conceder a si autoridade de aprovar | `f12_grant_executor` não tem INSERT nas tabelas de decisão/atestado de fixture; porém a origem é semeada pela role administrativa local | **SEGREGAÇÃO SQL TESTADA; competência real pendente** |
| A11 | Manipular histórico / alterar grant após revogação | Triggers de imutabilidade e ensaios anteriores G2; testes ainda dependem de privilégios de owner no fixture | **TESTADO em SQL; revisar grants efetivos hospedados** |
| A12 | Leitor ultrapassar frente/módulo, acessar M3 cru | G1 de escopo explícito e RLS de cartões aprovados; cobertura do serviço/provedor ainda pendente | **TESTADO em SQL/Auth local** |

**Prova adversarial adicional**: `scripts/nucleo-f1-f2-g2-security-adversarial.test.sql` monta dois vínculos sintéticos, executa caminhos A1 e A2 sob a role executora no ambiente descartável, verifica existência transitória dos grants e eventos **sem atestado/recibo universal**, faz `ROLLBACK` integral e comprova que não persistem grants, decisões ou históricos de ataque. A saída esperada `CONFIRMED GAP G2` é **evidência de um bloqueio**, não aprovação de segurança.

## 3. Proposta mínima de enforcement (NÃO IMPLEMENTADA)

1. **Porta única fail-closed** para TODOS os atos conceder/revogar; proibir DML direto pelo papel executor nas tabelas de grants, decisões, atestados e receipts. Em produção, construir um escritor invocável somente via serviço de identidade verificada e grants mínimos, com auditoria independente.
2. **Aprovação soberana atômica:** registrar identidade autenticada do decisor, competência/delegação expressa emitida por autoridade confiável, origem imutável, ação/escopo/beneficiário/prazo e versão em uma única operação; validação negativa para delegação revogada. `user_metadata` do JWT e texto fornecido pelo cliente não podem definir competência.
3. **Consumo único e atômico:** bloquear a linha da decisão sob concorrência, revalidar toda a cadeia e a revogação de competência, gravar grant/revocation, evento append-only, recibo e marca de consumo com um único commit; invariantes de banco precisam impedir qualquer grant ativo sem decisão competente + recibo.
4. **Idempotência forte:** definir representação canônica e hash criptográfico dos parâmetros aprovados (ação, assignment, alvo, scope, expirations, command version), `request_id` único, recibo persistido contendo decisão, efeito, hash e estado; replay com mesmo hash retorna o mesmo resultado, com hash diferente responde conflito sem efeito. Testar tempo limite após commit e reenvio em conexão independente.
5. **Revogação simétrica** com decisão própria competente, receipt e fim da leitura sem apagar histórico, inclusive com concessão original encerrada.
6. **RLS / autenticação:** SQL de sessão simulada não prova JWT; usar identidade estabelecida exclusivamente por camada de autenticação com issuer/audience/sessão verificados, sem confiança em GUC de input cliente.
7. **Rollout/rollback futuro:** staging fiel somente após decisão separada de custo, isolamento e identidade; DDL aditiva e reversão preservando trilha histórica; nenhum merge antes dos gates externos.

## 4. Regra de classificação do parecer

**Corrigido em lab:** G1 escopo/isolamento; G2 unicidade e atomicidade dos casos testados; separação SQL de papéis e revogação anterior.  
**Exige decisão de autoridade:** quem comprova competência e delegação com origem soberana, assinatura/trilha, vigência e substituição do aprovador, critério de revogação e acesso modular.  
**Exige novo laboratório:** atestado + receipt universal com negativa de DML fora da porta, revogação simétrica, concorrência do fluxo completo, canonical fingerprint e reenvio após commit.  
**Exige staging/prod (autorização separada):** autenticação humana real, identidade real do executor, Auth/RLS hospedados, rollout, custos e rollback.

**Despacho:** manter G2 de segurança da cadeia **ABERTO** nos pontos A1/A2/A3/A6/A7/A9. A CI anteriormente aprovada permanece válida para o que testou; CI com `CONFIRMED GAP` não significa que os riscos foram corrigidos. PR #1004 permanece aberta/draft, sem merge, migrations, deploy, contas ou grants reais.
