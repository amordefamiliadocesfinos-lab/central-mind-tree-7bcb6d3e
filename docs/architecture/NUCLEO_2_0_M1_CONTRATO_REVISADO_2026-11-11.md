# Núcleo 2.0 — M1: contrato revisado e implantação reversível
**Data:** 11/11/2026 | **Autoridade:** Camada Mestre, decisões nas PRs #606 e #594.
**Status:** SQL em branch isolada, NÃO APLICADO ao Lovable Cloud produtivo.
**Referência:** MAPA MESTRE NÚCLEO 2.0 V1.0, preservação M0 e persistência M1.

## Mudanças em relação à PR #594 (rascunho superado)
- `provision_users` permanece intacto. CHECK da capability será explicitamente ampliado para `('provision_users','nucleo_manage')`, mantendo a política existente de leitura própria e os registros atuais.
- `nucleo_manage` **não** é concedida automaticamente a ninguém. Grant e revogação exigem agente administrativo privilegiado, trilha `granted_by_auth_user_id`, `active` e `revoked_at`, fora da interface comum.
- A verificação RLS consulta `app_admin_capabilities` usando apenas `auth.uid()` e a própria política já existente `app_admin_capabilities_select_own`, sem recursão e sem função `SECURITY DEFINER`.
- Retiradas todas as FKs novas para `auth.users`: autores são IDs de referência de auditoria, e a identidade legado usa `legacy_id` + `import_batch_id`. Não acoplar documentos a papel textual `app_users.role`.
- `digital_knowledge_base` continua exclusiva do Digital; Núcleo não cria repositório paralelo de conhecimento.
- Sem `UPDATE` ou `DELETE` via cliente em M1. Revisões têm trigger anti-update/delete; documentos e batches são inicialmente append-only. Escrita normal e versionamento transacional de edição são frente posterior.

## Contrato de tabelas
| Tabela | Função | Regras |
|---|---|---|
| `nucleo_import_batches` | Proveniência e flags do snapshot | hash original, exportação, origem, quantidade, estado; sem upload automático |
| `nucleo_documents` | Documento canônico isolado por lote legado | UUID novo + ID legado, área, título, corpo, tags, datas, hash, autoridade inicialmente não classificada |
| `nucleo_document_revisions` | Snapshots históricos imutáveis | sequência por documento, conteúdo e hash; sem update/delete |

**Proteção contra colisões:** `UNIQUE (import_batch_id,legacy_id)`; não deduplicar por título. Snapshot com 82 páginas, 8 áreas, hash SHA-256 `83fc9795454568efdccfcf32746d684d5ff9890267273bfb1236012c49c09438` permanece fora de Git.

## Matriz RLS desejada
| Identidade | SELECT/INSERT Núcleo | Alterar capacidade | Observação |
|---|---|---|---|
| Autenticado com `nucleo_manage` ativo | Sim | Não pelo navegador | Concessão explícita separada |
| Administrador operacional sem `nucleo_manage` | Não | Não | Papel textual não autoriza |
| Legado com apenas `provision_users` | Não | Não | Privilegiar usuários ≠ Núcleo |
| Scoped Saúde-only | Não | Não | Acesso a Saúde não implica Núcleo |
| Anônimo | Não | Não | Sem GRANT de tabela |
| Usuário com `nucleo_manage` revogado | Não | Não | `revoked_at` e `active=false` |

**Escopo da autorização:** `authenticated` recebe GRANT SELECT/INSERT apenas nas tabelas novas; RLS seleciona exclusivamente detentores de `nucleo_manage`. A concessão da capacidade não é exposta via SQL do frontend: a tabela administrativa continua SELECT apenas para próprio usuário. Não alterar políticas de CRM, Saúde, Financeiro etc.

## Testes (não produtivos)
GitHub Actions cria um **PostgreSQL 16 descartável**, monta versão sintética do contrato preexistente, executa o SQL proposto e verifica:
1. `provision_users` mantida e grants anteriores intactos;
2. acesso positivo de detentor explícito de `nucleo_manage`;
3. negativo de legado com apenas `provision_users`;
4. negativo de scoped Saúde-only sem grant;
5. negativo de usuário `anon`;
6. revogação bloqueando leitura subsequente;
7. imutabilidade de revisions também para executor privilegiado;
8. inexistência de novas políticas sobre outros módulos.

Os testes do CI são reais em Postgres descartável, **não simulam todos os grants/identidades do Lovable Cloud**. Antes de produção: testar no clone representativo com políticas e roles reais, checar corrida/conflito com outras migrations e auditar segurança. O CHECK original e roles foram examinados diretamente via SELECT no banco atual.

## Plano de implantação em portões
1. **P0, concluído:** preservar arquivo privado de origem e confirmar SHA-256, 82 páginas e 36 flags.
2. **P1, atual:** branch/PR com SQL, contrato, matriz de autorização, CI isolado e rollback físico condicionado.
3. **P2, pendente:** revisão de diff, CI, teste de isolamento com identidades reais em ambiente não produtivo; conferir sem privilégios excessivos.
4. **P3, aprovação produtiva separada:** backup do schema + permissões e confirmação da janela de implantação, migration com checksum registrado e verificação de `provision_users`/RLS.
5. **P4, aprovação de importação separada:** staging privado, idempotência e prova de correspondência de todas as 82 páginas (ID, texto, tags, datas, flags e hash). Nunca importar automaticamente de PR ou CI.
6. **P5:** somente depois de reconciliação e E2E, alternar leitura do Núcleo para a fonte compartilhada; conservar localStorage e o original offline para recuperação.

## Reversibilidade
- **Antes da importação:** arquivo `docs/architecture/NUCLEO_M1_ROLLBACK_PREIMPORT_2026-11-11.sql` elimina exclusivamente tabelas novas vazias e restaura o CHECK original. Falha fechado se qualquer conteúdo ou nova capacidade existir; jamais executá-lo após uso.
- **Depois da importação:** rollback **lógico** (feature flag/retorno de leitura para fonte legada e exportação integral do banco); nunca apagar tabelas/documentos. Mudança de schema para trás requer plano próprio com backup e autorização.

## Limitações deliberadas
- A migração está sob `supabase/migrations` **somente nesta branch de PR**; não fazer merge nem sincronizar com Cloud até homologação de produção. O sufixo `PROPOSTA_NAO_APLICAR` é um sinalizador de governança, não substitui bloqueio de deploy.
- Ausência de política UPDATE é proposital: nenhuma edição compartilhada liberada nesta entrega.
- Nenhum grant de `nucleo_manage` é criado e nenhuma das 82 páginas é exposta em GitHub.
