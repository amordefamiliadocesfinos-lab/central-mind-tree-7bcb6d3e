# Núcleo 2.0 — M1 | Registro de implantação técnica no Core oficial

**Data:** 11/11/2026  
**Projeto:** Painel Central — Amor de Família  
**Autoridade:** Camada Mestre, autonomia ampliada (M1); mapa soberano Núcleo 2.0 V1.0 congelado.

## Escopo implantado
Aplicação aditiva de **schema vazio e permissões do Núcleo**, sem importação de documentos, concessões de `nucleo_manage` ou mudança de leitura da aplicação.

- `20261111193600_nucleo_m1_schema_capability.sql`: amplia o CHECK de `app_admin_capabilities` com `nucleo_manage`, preservando `provision_users`; cria `nucleo_import_batches`, `nucleo_documents`, `nucleo_document_revisions`, RLS e gatilho de imutabilidade de revisões.
- `20261111193601_nucleo_m1_harden_service_role.sql`: corrige privilégios padrão amplos do ambiente, restringindo `service_role` a `SELECT/INSERT` nas três tabelas; proíbe `DELETE` em lotes e documentos com triggers específicos.
- Histórico `supabase_migrations.schema_migrations` recebeu as duas versões, `created_by='chatgpt_git_direct'`, na mesma transação de cada implantação.

## Evidências reais pós-implantação
Fonte: consultas SELECT no Lovable Cloud oficial, PostgreSQL **17.6**.

| Verificação | Observado |
|---|---|
| Tabelas M1 | 3 presentes |
| RLS | habilitada nas 3 |
| Policies | SELECT e INSERT específicas de `nucleo_manage`, por tabela |
| Gatilhos ativos | 1 por tabela (revisions imutáveis; documents e batches sem DELETE) |
| `service_role` | somente SELECT e INSERT nas tabelas M1 |
| `authenticated` | somente SELECT e INSERT nas tabelas M1, sujeitos a RLS |
| `anon` | nenhum GRANT nas tabelas M1 |
| `provision_users` ativo | 1, igual ao preflight |
| `nucleo_manage` concedido | 0 |
| Dados no Núcleo | 0 batches / 0 documentos / 0 revisões |
| Migrations registradas | 20261111193600 e 20261111193601 |

## Testes isolados
- GitHub Actions [#43091707041](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43091707041): PostgreSQL 17, autorização e rollback PASS.
- GitHub Actions [#43094486905](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43094486905): encontrou falha sintática no teste de hardening, corrigida, sem impacto em produção.
- GitHub Actions [#43094643388](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43094643388): **SUCCESS** com privilégios padrão amplos simulados, hardening, autorização positiva/negativa e rollback seguro.

## Preservação e limites
- O backup legado de uma origem, com 82 páginas e SHA-256 `83fc9795454568efdccfcf32746d684d5ff9890267273bfb1236012c49c09438`, permanece **fora do GitHub e fora do banco**.
- Nenhuma publicação de documentos, mudança de `localStorage`, alteração do frontend `/nucleo`, importação, deduplicação ou alteração de RLS de módulos existentes.
- M1 conclui a **implantação técnica da infraestrutura**; a ativação documental e homologação de acesso de um operador real com capacidade concedida ficam em etapas de governança posteriores.
- O SQL de rollback físico fica restrito à situação pré-importação, sem grants e com todas as tabelas vazias; posteriormente usar rollback lógico.
- Nenhuma identidade foi autoautorizada.

## Observação importante
O CHECK em `app_admin_capabilities` era restrito apenas a `provision_users`. A ampliação preserva as concessões existentes. O grant `nucleo_manage` permanece separado, não provisionado.
