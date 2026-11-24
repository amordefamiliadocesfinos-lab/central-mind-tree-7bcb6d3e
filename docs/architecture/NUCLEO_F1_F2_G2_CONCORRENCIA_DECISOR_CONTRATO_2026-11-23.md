# Núcleo 2.0 — F1/F2 G2 | Contraprova de concorrência e identidade da decisão

**Projeto:** Painel Central — Amor de Família  
**Origem:** deliberação da Camada Mestre registrada em PR #1004, comentário #7116916501.  
**Data:** 23/11/2026 · **Natureza:** especificação e laboratório, não serviço de produção.

## 1. Prova de concorrência em conexões independentes

`scripts/nucleo-f1-f2-g2-writer-race.cjs` cria dois processos `psql` distintos, ambos como executor sintético `f12_grant_executor`, consumindo exatamente o mesmo `decision_ref`. O índice único de decisão impede dois efeitos duráveis. O teste executa: rollback prévio (não sobra grant/auditoria), corrida com dois commits candidatos (1 vence/1 conflito), auditoria única, repetição após resposta potencialmente perdida (o grant anterior continua sendo o único). As sessões são PostgreSQL independentes e a análise mede **linhas persistidas** após commits; não é uma fila HTTP.

## 2. Prova de identidade e competência

`scripts/nucleo-f1-f2-g2-authority-lab.sql` modela, **somente na fixture**, `g2_competences` e `g2_decision_attestations`: `decider_auth_uid`, `executor_auth_uid`, beneficiário, ação, especialidade, módulo, escopo, origem da competência, delegação, prazo, request ID e vínculo de decisão. Auditoria é imutável; executor não tem INSERT em decisões, competência nem atestados. Negativas: delegação revogada, beneficiário alterado e escopo incompatível.

`scripts/nucleo-f1-f2-g2-decider-local-auth.cjs` verifica o `access_token` emitido por GoTrue local com `/auth/v1/user` e a sessão efetiva de `auth.sessions`. Somente **após** verificação o administrador sintético da CI cadastra a competência de teste associada ao UID autenticado e atesta uma decisão; garante que o UID do decisor é diferente do UID executor. **Isso é autenticação real de usuário fictício no GoTrue LOCAL**, não prova de aprovação por uma pessoa com competência soberana nem autoriza criação de usuários hospedados.

### Limite deliberado

A estrutura de autoridade é uma *extensão de fixture* posterior à candidata. Não se integrou o portão de autoridade ao próprio INSERT de `approved_decisions` em todos os caminhos. O sistema real deverá possuir rota protegida que **autentique** o decisor, determine sua competência por dados não editáveis por ele e só então grave a decisão e seu atestado em transação indivisível. `user_metadata` de JWT não pode ser fonte de autorização; uma delegação expressa deve ser validada pela autoridade emissora, não somente por texto `source_ref`. A origem dos atestados deve ser verificada e protegida contra inserção privilegiada fora do fluxo competente.

## 3. Contrato de API futuro — apenas especificação

**Pedido de preparação de decisão:** usuário autenticado solicita `action`, `assignment_id`, `scope_kind`, `front_id` quando aplicável, `beneficiary_auth_uid`, justificativa e vigência. Resposta sem efeitos de acesso.

**Aprovação:** sessão do aprovador autenticada, competência/delegação válida e não revogada, escopo aprovado; armazenar decisão, atestado, identificador da origem/versão, executor designado e `request_id` único. O serviço deve rejeitar exceções e registrar trilha auditável. Não aceitar aprovador por texto/header controlado pelo cliente.

**Consumo:** executor autenticado verifica designação, decisão vigente e não consumida, vínculo/identidade/escopo, revogação de competência e integridade da aprovação. Em transação única: bloquear decisão → inserir concessão (ou revogar a específica) → inserir evento auditável → persistir resultado imutável associado a `request_id` → commit.

**Repetição da mesma requisição:** após timeout ou perda de resposta, `request_id` e hash de parâmetros equivalentes retornam o mesmo `decision_id`, `grant_id` e estado persistido; parâmetros diferentes com o mesmo `request_id` ⇒ conflito sem efeito. A decisão consumida não pode gerar outro grant mesmo que um segundo executor use outro ID de requisição. Apenas após commit retornar sucesso. A CI atual comprova unicidade e consulta estável por `decision_ref`, **não** esse protocolo HTTP.

**Saída esperada do serviço:** estados `aprovacao_necessaria`, `recusado`, `consumido`, `ja_consumido`, `revogado`; mapear HTTP e mensagens sem revelar existência de documentos privados. Falhar fechado se sessão, origem, competência, delegação, grant, escopo ou trilha estiverem inconsistentes.

## 4. Portões não vencidos

Não homologado: autenticação da **Camada Mestre real**; delegação jurídica/operacional verificada em fonte soberana; credencial de serviço executor real; assinatura e atestado criptográfico de decisão; endpoint idempotente e simulação de perda de rede real; recuperação após failover entre serviços; ambiente hospedado fiel; migração e rollback; RBAC/ABAC e RLS da produção; homologação de curadoria documental.

PR #1004 permanece draft. Nenhum merge, deploy, grants reais, novas contas no Core, migrations ou F6/F7/Entrega B. CI isolada comprova apenas o que está explicitamente nos testes.
