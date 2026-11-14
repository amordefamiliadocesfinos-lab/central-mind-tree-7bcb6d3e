# AC-02 — Contrato mínimo do escritor autenticado e vínculo de evidência
**Mapa:** Núcleo 2.0 V1.3 / Entrega A+  
**Estado:** desenho técnico pré-deploy, não homologado / **NÃO APLICAR EM PRODUÇÃO**  
**Data:** 14/11/2026  
**Continuidade:** PRs #806, #807, #813, #814, #815, #817, #818, #819, #820, #821.

## 1. Problema confirmado
O ledger proposto em `NUCLEO_AC02_HANDOFF_APPENDONLY_PROPOSTA_NAO_APLICAR.sql` permite INSERT pela role `authenticated` enquanto a sessão estiver representada por JWT e RLS. A PR #821 registrou que `auth.uid()` **não é checagem de revogação da sessão**; a role `authenticated` não tem SELECT em `auth.sessions` no Core oficial. Mesmo que uma Edge Function valide revogação, um cliente poderia evitar o gateway e chamar a Data API diretamente enquanto INSERT permanecesse concedido.

**Correção arquitetural obrigatória:** fechamento completo do INSERT direto para roles de cliente, antes de existir gateway produtivo. A proposta SQL adicional `docs/architecture/proposals/NUCLEO_AC02_FECHAMENTO_WRITE_DIRECT_PROPOSTA_NAO_APLICAR.sql` revoga INSERT da tabela para `PUBLIC/anon/authenticated/service_role` e remove a política INSERT anterior. Em CI, o endurecimento roda **após** os ensaios de máquina de estados original, verificando que um usuário inclusive com `nucleo_manage` não consegue mais gravar pela Data API. Este estado é propositalmente SOMENTE LEITURA; não existe escritor de produção liberado.

## 2. Escritor mínimo futuro (proposta de fronteira, não endpoint criado)
**Gateway autenticado restrito**, implementável apenas após revisão/decisão expressa, com uma rota dedicada a **um evento AC-02 por solicitação**, jamais reutilizando `nucleo-knowledge-read` para mutação. Não utilizar construtor visual Lovable.

Ordem obrigatória e falha fechada:
1. Receber JWT no header Authorization por conexão segura, definir limite estrito de corpo e ausência de cache; não logar token.
2. Validar assinatura/usuário pelo mecanismo de Auth oficial (`auth.getUser` vinculado ao token) e validar **sessão atual e não revogada** em fonte autoritativa confiável (por exemplo `session_id` contra `auth.sessions` via mecanismo server-only autorizado e de acesso mínimo). **Não assumir que `getUser` sozinho garante revogação imediata**. Se a verificação de sessão não estiver disponível: rejeitar gravação.
3. Derivar `actor_auth_uid` exclusivamente da sessão verificada; rejeitar campos que aleguem autor, decisão, `service_role`, status de homologação ou confirmação de outro usuário. Validar proteção contra repetição com `request_id` e vinculação a `package_id`.
4. Para `preparado/disponibilizado/entregue/falha/expirado/retificado`, confirmar `nucleo_manage` ativo no Core e a autorização vigente no instante da escrita. Para `recebido/aceito`, exigir identidade autenticada igual a `recipient_auth_uid` e `recipient_kind=sucessor_humano`. Um chat IA não pode confirmar recebimento ou aceite.
5. Resolver módulo e origem do pacote sob permissões do gestor: prova de preparação/revisão, conteúdo autorizado, SHA-256 dos **bytes UTF-8 exatos** (#818), versão, destinatário, validade e referência de fonte. Manifesto produzido no cliente tem `local_computed_not_authenticated` e **não é prova server-side**. Ao receber dados, o servidor deve reconstruir ou confrontar um registro confiável do pacote, não confiar em `packageSha256` isolado.
6. Aplicar a pré-validação sintática `ac02-write-preflight.ts` como ajuda, **nunca como guardião de autorização**. Verificar evidência com `evidence_ref` existente, proveniência, tipo, dono e acesso no mesmo módulo antes de chamar de comprovada. Se não for possível verificar, registrar no máximo uma **declaração** onde cabível, nunca “prova verificada”.
7. Executar um único INSERT no ledger, com atributos derivados server-side, sem possibilidade de o cliente enviar SQL, nome de tabela, função ou evento diferente. A operação deve preservar a transição no trigger, a unicidade e a trilha imutável. Responder com somente ID e estado de registro; nunca retornar dados privados ou dizer que houve transferência real.
8. Revalidar que não existe caminho paralelo com INSERT direto, RPC pública/SECURITY DEFINER irrestrita ou chave privilegiada no frontend. O perfil de escrita do backend exigirá mecanismo de credencial minimamente privilegiado **ainda não definido**, com privilégios documentados/testados no Cloud oficial. Não liberar acesso geral ao esquema `auth` e não presumir que a role `service_role` tenha leitura em `auth.sessions`.

**Gate de segurança:** nenhuma das opções de autenticação/autorização do escritor é declarada implementada por esta PR. O contrato deliberadamente não contém nova Edge Function, service key, função SECURITY DEFINER, RPC de escrita ou migration oficial.

## 3. Estados e fontes
O ledger **não armazena conteúdo do pacote**, JWT, chaves, URLs privadas ou anexos. Registra identidades, hash, módulo, papel, destinatário, tipo de evento, anterior, timestamp do servidor e referência de evidência.

| Evento | Ator apto (após autenticação efetiva) | Natureza | Condição de evidência |
|---|---|---|---|
| preparado | gestor `nucleo_manage` | declaração | manifesto conferido contra fonte confiável |
| disponibilizado | gestor `nucleo_manage` | declaração | não significa acessado |
| entregue | gestor `nucleo_manage` | declaração | `evidence_ref` obrigatório; prova ainda requer validação |
| recebido | destinatário humano | confirmação pessoal | própria sessão ativa; não implica aceite |
| aceito | destinatário humano | confirmação pessoal | própria sessão ativa; não equivale à homologação |
| falha | gestor `nucleo_manage` | declaração | `evidence_ref` obrigatório |
| expirado | gestor `nucleo_manage` | declaração | após instante de validade |
| retificado | gestor `nucleo_manage` | declaração | `evidence_ref` obrigatório; cadeia anterior preservada |

**AC02-PROOF-01:** o mecanismo de validação autoritativa de `evidence_ref` e sua fonte de armazenamento segue pendente. A referência não é transformada automaticamente em “verificado” ou fato externo confirmado.

**AC02-PACKAGE-01:** `ac02-package-manifest.ts` apenas comprova equivalência de bytes com o hash calculado; falta provar origem, sessão e aprovação humanas no servidor. `ac02-write-preflight.ts` só retorna `candidate_only_no_authority` ou `rejected`; seus flags de sessão, capacidade, evidência e origem são SEMPRE falsos.

## 4. Prova em CI descartável e gates de implantação
No PostgreSQL 17 de CI, a proposta #817/#821 continua sendo exercitada com sessões sintéticas e transições. **Depois** é aplicada a proposta isolada de bloqueio da escrita direta e verificado que uma role `authenticated` com `nucleo_manage` não consegue inserir. A pré-validação pura testa rejeição de hash divergente, destinatário incompatível, prova ausente e aceite por IA.

**Antes de implantação:**
- definir/autorizar mecanismo efetivo de identificação de sessão ativa e revogação com testes negativos reais ou equivalentes fiéis;
- definir credencial restrita de escrita e auditar seus privilégios, sem `service_role` exposta ao navegador e sem ampliação automática;
- implementar gateway isolado em nova fase autorizada, com teste de bypass direto da Data API;
- resolver fonte verificável de evidência e registro confiável do pacote/manifesto;
- confirmar compatibilidade de RLS e Auth no Lovable Cloud oficial;
- obter autorização explícita para criar migration definitiva e deploy de Edge Function;
- delegar apresentação e histórico ao Especialista UX, sem torná-lo autor de regras de segurança.

**Conclusão técnica:** contrato de fronteiras definido; implementação do escritor, acesso à sessão revogada, fonte de provas e deploy permanecem **pendentes**. A Entrega B não foi iniciada.
