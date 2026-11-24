# Núcleo 2.0 F1/F2 — contrato de execução auditável G2, somente laboratório

**Data:** 23/11/2026  
**Natureza:** engenharia de teste e contrato de servidor, **não** implementação de serviço de produção.  
**Autoridade:** continuação autorizada da F1/F2 na PR #1004, que permanece em draft.

## Objetivo e evidência em código

O arquivo `scripts/nucleo-f1-f2-writer-audit.test.sql` executa, no PostgreSQL descartável, a sequência de decisão independente, concessão `read_context`, histórico, tentativa de reutilização e revogação. É testado após os cenários G1 de `scope_kind=front|module` e não altera o sistema oficial.

**Contrato pretendido de um executor futuro:**
1. O decisor da Camada Mestre autoriza individualmente o beneficiário, escopo, validade, origem e ação, fora do alcance DML do executor.
2. O serviço autenticado e segregado verifica competência e identidade, valida e consome a decisão uma única vez; o papel `f12_grant_executor NOLOGIN` é apenas simulação SQL, sem membership de usuários.
3. A concessão ou revogação, evento append-only e consumo/idempotência devem ocorrer em transação atômica. Não conceder `nucleo_manage` nem acesso a dados brutos.
4. A repetição de `decision_id` deve devolver resultado consistente **sem criar outro efeito**; dois executores concorrentes precisam produzir exatamente um efeito. A candidata testa unicidade e rejeição do replay; a semântica HTTP de idempotência permanece **não implementada**.
5. Revogação requer decisão específica vinculada ao grant, registra ator/decisão próprios, interrompe leitura imediatamente e preserva o histórico anterior.

### Contraprovas presentes na suíte G2
- Inserção com executor errado — NEGADA pelo RLS e correspondência de decisão.
- Insert seguido de exceção intencional em subtransação PostgreSQL — **nenhum** grant ou evento permanece (atomicidade).
- Execução válida de uma concessão de módulo com validade finita e decisão `scope_kind=module`.
- Nova tentativa de consumir a mesma decisão — NEGADA; exatamente um evento inicial.
- Revogação por decisão independente com evento auditável; RLS nega nova leitura; dois eventos preservados.
- A função de decisão é modelada no fixture por gravação prévia da role administrativa do PostgreSQL local. **Não** existe assinatura nem writer do aprovador em produção.

### Lacunas explicitamente não resolvidas
- Não foi construído endpoint HTTP, RPC produtiva, writer assinado, autorização real da Camada Mestre, `getUser` hospedado nem sistema de comando confiável. O campo `approved_actor_auth_uid` da candidata modela a identidade **do executor aprovado para a decisão**, não prova, sozinho, a identidade do decisor da Camada Mestre. Antes de produto, separar o `decider_auth_uid` do `executor_auth_uid`, com provenance verificável e imutável.
- O teste de replay comprova recusa de segunda gravação. Não comprova resposta HTTP idempotente com reenvio de mesmo `request_id`, recuperação após timeout nem deduplicação em múltiplas instâncias.
- O teste de rollback comprova atomicidade dos triggers em uma subtransação local. Testes de duas transações concorrentes específicas **para o mesmo grant** e perdas de conexão ainda exigem suíte própria.
- Não houve alteração de SQL no Core Lovable, concessão de papel, mudanças de RLS produtivas, merge, deploy ou migração.

**Condição de saída:** CI da nova prova G2 aprovada em Postgres descartável e, quando viável, no Supabase Auth local. Mesmo CI verde **não** autoriza merge da PR #1004 nem promoção do writer para produção.
