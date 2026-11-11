# Núcleo 2.0 — M3 | Central Visual de Desenvolvimento

**Mapa soberano:** MAPA MESTRE NÚCLEO 2.0 V1.0 — ESCOPO CONGELADO (11/11/2026)  
**Data de desenvolvimento:** 11/11/2026  
**Natureza:** continuação aditiva do Núcleo existente em `src/pages/Nucleo.tsx`, sem novo sistema paralelo.

## Contrato da M3
- Acesso pela guia **Desenvolvimento** do Núcleo. As oito áreas anteriores permanecem intactas e recuperáveis por um clique.
- Frentes com código estável, tipo `modulo/frente/subfrente`, relação pai–filho, título, escopo original, especialista, prioridade, próximo passo, bloqueio e critério de aceite.
- Fluxo visual em cinco estados: `planejado`, `em_andamento`, `bloqueado`, `em_validacao`, `concluido`.
- `concluido` requer `evidence_state='comprovada'` e nota de evidência não vazia; `bloqueado` requer motivo.
- É proibido apresentar porcentagem inferida; contagens por estado são a única agregação inicial.
- Árvore visual e Kanban, filtros, ficha editável, dependências e linha do tempo de eventos.
- Eventos de criação e atualização são inseridos automaticamente por gatilho e preservados em tabela append-only; não há permissão de exclusão nem de atualização do histórico.
- Identidade do registro (ID/código), tipo e pai ficam congelados após criação; as descobertas alteram a ficha, sem destruir seu escopo anterior, que fica no histórico.
- RLS exige capacidade individual `nucleo_manage`; sem aproveitamento do cargo textual e sem concessão automática.

## Limites de representação
- M3 registra **planejamento e alegações estruturadas**, não valida automaticamente evidências. A nota `comprovada` é uma declaração do operador e precisa de auditoria; o Núcleo não deve anunciá-la como CI/deploy confirmado.
- Vínculos automáticos com commits, PRs, pipelines e migrations pertencem à **M4**, não foram fabricados na M3.
- Detectar bloqueios e alertas inteligentes é matéria da **M5**. M3 exibe campos explícitos, não infere atrasos.
- Nenhuma das 82 páginas locais, três referências Drive ou acervo V1.2 foi importada, convertida ou promovida.
- Nenhuma permissão `nucleo_manage` será concedida automaticamente. Com zero concessões, a visualização fica restrita e não há edição acessível aos operadores atuais.

## Segurança e testes
Migration candidata `20261111222000_nucleo_m3_development_center.sql`, três tabelas:
`nucleo_development_workstreams`, `nucleo_development_events`, `nucleo_development_dependencies`.

Workflow `nucleo-m3-development.yml` usa PostgreSQL 17 descartável com contratos sintéticos M1/M2. Verifica hierarquia, identidade estável, ausência de conclusão sem evidência, histórico, negação a anônimos, usuários scoped e legado sem capability, revogação, tentativa de histórico forjado e proteção contra exclusões. O build completo do frontend é executado separadamente.

## Próximos portões
1. Executar CI de M3 e verificar build e testes SQL de **cada commit final**.
2. Auditar as permissões reais do Core e garantir versionamento no histórico antes da aplicação aditiva.
3. Registrar migrations e conferir tabela/índice/RLS/gatilhos/vazio após aplicação.
4. Não cadastrar frentes ou definir responsáveis/status vigentes por inferência. O mapa determina que documentos e evidências reais devem ser confrontados.
5. Homologar o uso com uma identidade expressamente autorizada, preservando snapshots M1/M2.

**Sem uso do construtor visual Lovable.**

## 11/11/2026 — Aplicação aditiva no Core e evidência
- Migration versionada `20261111222000_nucleo_m3_development_center.sql` aplicada ao Lovable Cloud oficial PostgreSQL 17.6; `supabase_migrations.schema_migrations` registra `nucleo_m3_development_center` com a mesma versão.
- Pré-requisitos M1/M2 conferidos antes da transação; nenhum conflito de schema pré-existente.
- Inspeção SELECT pós-aplicação: **3 tabelas M3 presentes com RLS habilitada**; policies workstreams 3, events 2, dependencies 2; gatilhos ativos workstreams 3, events 1, dependencies 2.
- `authenticated` e `service_role`: SELECT/INSERT em eventos/dependências; SELECT/INSERT/UPDATE nas frentes; nenhuma tabela M3 possui GRANT para `anon` ou GRANT DELETE.
- **0 frentes, 0 eventos, 0 dependências, 0 documentos M1, 3 referências Drive M2, 0 concessões nucleo_manage.**
- [GitHub Actions #43103257248](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43103257248): PostgreSQL 17 e frontend build passaram na versão final da migration.
- Continuidade: código e SQL foram desenvolvidos por GitHub diretamente, sem construtor visual; eventual disponibilização de frontend no domínio oficial depende da sincronização/publicação do commit.
- Homologação funcional com usuário real autorizado permanece separada: ainda **não foi criada qualquer capacidade nucleo_manage** e não foi possível validar o uso autenticado positivo com dados reais.
