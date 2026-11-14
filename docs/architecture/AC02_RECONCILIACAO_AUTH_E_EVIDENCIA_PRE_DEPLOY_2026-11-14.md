# AC-02 — Reconciliação de autenticação, autoria e evidência de repasse
**Mapa:** Núcleo 2.0 V1.3 / Entrega A+  
**Data:** 14/11/2026  
**Natureza:** proposta técnica pré-implantação — **NÃO AUTORIZA PRODUÇÃO**

## 1. Inventário comprovado em consultas somente leitura ao Lovable Cloud oficial
Projeto Lovable `1720a410-34cd-4410-995c-8c92c7edf16b`, Supabase Cloud integrado `xkskyutmtlhivvpfxkjg`.

- `auth.sessions` existe e contém `id`, `user_id`, `not_after` e demais metadados de sessão.
- A role `authenticated` **não possui SELECT direto** em `auth.sessions`; `service_role` também não apresentou SELECT no exame de `has_table_privilege`. Logo um trigger `SECURITY INVOKER` não pode simplesmente consultar `auth.sessions` para validar revogação. Não conceder SELECT global em `auth.sessions`, nem usar `SECURITY DEFINER` genérico para contornar a limitação.
- `app_admin_capabilities` possui `auth_user_id,capability,active,revoked_at` e política de SELECT própria; `authenticated` possui SELECT e não possui INSERT.
- O módulo oficial existe em `nucleo_development_workstreams`; mandatos estão em `nucleo_specialist_mandate_records`. Essas tabelas não são evidência de recebimento.
- `nucleo_ac02_handoff_events` e função `nucleo_ac02_handoff_insert_guard()` **não existem** em produção nesta revisão.

As evidências acima são observações da estrutura e das permissões; não se consultaram tokens, credenciais, usuários específicos nem dados privados.

## 2. Diagnóstico de segurança e confiança
**O que a proposta #817 garante em PostgreSQL descartável:** append-only, sequência por pacote, hash/versionamento imutáveis na cadeia, RLS/GRANT limitado, separação de atos declarativos e confirmação do destinatário via `auth.uid()`.

**O que NÃO está garantido:** um `auth.uid()` não comprova por si só que a sessão não foi revogada antes de o JWT expirar. Validar token recebido pelo gateway com `auth.getUser()` é necessário, mas para garantia estrita de revogação será preciso verificar identidade e `session_id` contra fonte autenticada de sessões ou mecanismo de GoTrue equivalente comprovado. A role `authenticated` não pode efetuar esta consulta diretamente. O requisito não deve ser resolvido com GRANT global em `auth.sessions` ou com serviço privilegiado no cliente.

**Gate de implantação AC02-SESSION-01 — BLOQUEADO:** especificar um escritor autenticado restrito e testável antes de abrir INSERT produtivo. Opções a avaliar sem implementação nesta frente: Edge Function dedicada de escrita com verificação de sessão e mediação estrita de autoridade, ou função interna minimamente privilegiada e auditada com validação de sessão. Para qualquer escolha, demonstrar que nenhuma rota alternativa permite um JWT revogado inserir eventos no ledger. Não reutilizar a função `nucleo-knowledge-read` para escrita sem nova autorização de escopo.

## 3. Evidência e semântica dos eventos
A proposta SQL foi endurecida para exigir `evidence_ref` (marcador restrito sem URL sensível) em `entregue`, `falha` e `retificado`. Esse campo indica **referência informada**, não prova externa verificada.

- `preparado`: existe manifesto de bytes; não houve envio.
- `disponibilizado`: declaração do gestor; não comprova que o destinatário acessou.
- `entregue`: declaração do gestor **obrigatoriamente acompanhada de referência**; não corresponde a confirmação humana.
- `recebido`/`aceito`: requerem `confirmacao_destinatario` e `actor_auth_uid=recipient_auth_uid` no banco; passam a ser eventos registráveis **somente após** garantia de sessão ativa.
- `falha`/`retificado`: exigem referência, continuam append-only, não apagam o evento precedente.
- `novo_chat_ia`: não recebe UUID de usuário e NÃO confirma aceite automaticamente; depende de desenho específico de evidência e decisão superior.

**Gate AC02-PROOF-01:** confirmar política de emissão, armazenamento e acesso das evidências citadas por `evidence_ref`; um identificador digitado pelo gestor não pode ser confundido com um comprovante validado. Evitar duplicar M4 ou anexar conteúdo privado ao ledger.

**Gate AC02-PACKAGE-01:** calcular SHA-256 do texto exato produzido pelo pacote #813/#814 e manifestado pela #818, validar o vínculo com módulo/destinatário sob sessão do gestor e impedir que um cliente troque silenciosamente o conteúdo após revisão. O contrato #818 tem `provenance=local_computed_not_authenticated` e não prova autenticidade sozinho.

## 4. Critérios para próxima decisão de implantação
1. Concluir desenho de autenticação do escritor com checagem de revogação; **sem autorização genérica de serviço, sem GRANT em auth.sessions**.
2. Homologar qual fonte representa evidência de `entregue`, `falha` e `retificado`, incluindo autorização e proveniência.
3. Garantir que o pacote/manifesto emitido corresponda aos bytes e metadados efetivamente registrados.
4. Em CI isolada, simular sessão válida, sessão revogada, autor diferente do destinatário, operação após expiração, eventos fora de sequência, requisição duplicada, RLS e privilégio herdado.
5. Após revisão e autorização expressa, gerar migration oficial; hoje o arquivo `docs/architecture/proposals/NUCLEO_AC02_HANDOFF_APPENDONLY_PROPOSTA_NAO_APLICAR.sql` continua **somente proposta** e não será movido para `supabase/migrations/`.
6. Dar ao Especialista UX a classificação de eventos e alertas, não a lógica de autorização. Ensaios produtivos e homologação real permanecem pendentes por ordem do proprietário.

## 5. Compatibilidade e limites
Sem mudança no Core produtivo, sem novo endpoint, sem função SECURITY DEFINER, sem nova capacidade administrativa, sem construtor Lovable, sem autoria automática e sem Entrega B. Preservar PRs #806/#807/#813/#814/#815/#817/#818/#819/#820.
