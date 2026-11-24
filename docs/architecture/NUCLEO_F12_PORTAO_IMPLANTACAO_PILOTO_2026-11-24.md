# Núcleo 2.0 — portão de implantação F1/F2 e piloto NUC
24/11/2026 · checkpoint operacional do Mapa Mestre V1.3 e Continuidade V1.1, não novo mapa.
## Artefato congelado para revisão
- Base #1071 + #1072, merge d3ef48a64e2124fdc4a188f801f98ed89da6923a.
- SQL candidato: [nucleo_identity_read_candidate.sql](proposals/nucleo_identity_read_candidate.sql), Git blob a8bf4322e8023b75461062b35e550c6131be1c14.
- CI nativa 45447372381: 75 suítes, ACLs equivalentes aos defaults observados e concorrência aprovadas.
- O SQL permanece com trava descartável; NÃO executar no Core. Gerar artefato produtivo separado somente após decisão específica e revisão por executor competente.
## Baseline real de somente leitura
Projeto Lovable 1720a410-34cd-4410-995c-8c92c7edf16b / Core xkskyutmtlhivvpfxkjg: PostgreSQL 17.6, consulta administrativa postgres, banco postgres. Schema nucleo_identity ausente, zero RPCs candidatas, cinco fontes legadas com RLS. Uma capacidade nucleo_manage ativa; não constitui identificação do piloto nem autorização.
## Piloto mínimo proposto — um contexto de módulo, exclusivamente leitura
- Módulo NUC: 636768e6-e782-4c7d-8132-e7381621be12.
- Papel histórico declarado: Especialista Núcleo 2.0; especialidade proposta Governança e Continuidade do Núcleo. Não inferir Auth UID ou mandato a partir desses textos.
- Fonte AC-01: 80f64bfb-cfa0-4012-a2ad-b75226881c2d, módulo NUC, workstream NULL, versão 1, estado proposta. Locator docs/architecture/MAPA_CONTINUIDADE_CANONICA_ESPECIALISTAS_NUCLEO20_V1_1_CONGELADO_PLANEJAMENTO_2026-11-19.md. Não promover vigência.
- M4: 95833fbd-38b5-4a0a-abea-45f74214d533; evento 96415dff-3efb-4b09-8fb3-ac39f113fde4. Confirmados no Core. NÃO associar ao vínculo de módulo: a candidata exige contexto exato; frente M4 exigirá assignment e grant próprios, autorizados em ato separado.
- Prazo sugerido: 24 horas a partir da concessão efetiva; não aprovado nem concedido.
- Ator individual Auth verificado, decisor, executor distinto, referência de decisão e curadoria: pendentes; nenhuma identidade fictícia.
- Método geral: referência soberana V1.1 proposta, não método homologado. Método local: NULL até fonte comprovada.
## Ordem de execução após autorização
1. Ato específico de DDL somente leitura, com revisão do SQL e ACLs efetivas atuais, identificação do executor e backup/schema dump verificável. Não reutilizar o papel administrativo como identidade do piloto.
2. Gerar artefato de aplicação próprio com preflight fail-closed (projeto verificado externamente, schema e RPCs ausentes, versão >=17 <18, cinco fontes legadas presentes com RLS); preservar transação única e checagem ACL. Não remover a trava do arquivo descartável versionado.
3. Aplicar apenas schema/RPCs vazios; conferir catálogo, RLS, ACLs, ausência de registros, compatibilidade legada e negação JWT sem vínculo. Se falhar, parar e reverter de forma autorizada.
4. Ato separado de curadoria e concessão do piloto: confirmar identidade individual, decisor/executor, prazo, escopo módulo, referências e autoria; registrar somente via mecanismo competente aprovado. Não usar o writer G2 experimental nem conceder nucleo_manage. A candidata não fornece escritor de grants ou autorização.
5. Provar consulta pelo JWT real, ausência de conteúdo bruto, negativa de outro usuário/escopo, revogação/expiração. Não usar a conta privilegiada como prova do isolamento.
6. Somente então conectar F3/F4/F5 e ampliar cobertura em lotes autorizados. A referência M4 permanece fora deste primeiro recorte.
## Rollback
Revogar execução/uso/seleção dos clientes nos objetos novos conforme ato aprovado; revogar a concessão por autoridade competente; manter origens, vínculos e trilha. Não DROP CASCADE, não alterar ACLs globais, não apagar registros legados. Verificar a aplicação anterior e registrar readback. Nenhuma execução produtiva nesta rodada.
## Decisão pendente
DDL vazio já autorizado e aplicado conforme atualização abaixo. A concessão individual do piloto permanece em ato separado. F6/F7/B continuam fechados.


## Execução herdada e atualização — 24/11/2026, 17:46 UTC

O portão de DDL foi cumprido nesta sessão por autorização expressa do proprietário. Exportação oficial concluída e preservada fora do repositório; backup diário mais recente listado em 24/11 às 01:31:32 UTC. Export custom PostgreSQL, 4.345 entradas, leitura integral por pg_restore concluída sem erro. Nenhum restore no Core.

Artefato próprio: `proposals/nucleo_identity_production_manual.sql`, fora de migrations; corpo preservado do blob a8bf4322e8023b75461062b35e550c6131be1c14. Trava descartável original intacta. Delta validado em PostgreSQL 17.12 loopback: gates ausentes recusados, transação positiva, conflitos recusados e contenção sem exclusão aprovada. Rollback preparado em `proposals/nucleo_identity_disable_manual.sql`; não executado no Core.

DDL aplicado por conector autenticado no projeto Lovable oficial. Readback: cinco tabelas vazias com RLS, cinco políticas, oito triggers, duas RPCs SECURITY INVOKER/search_path vazio. authenticated somente leitura contextual; anon/service_role/sandbox sem USAGE/EXECUTE. Default ACLs globais, registros, políticas e ACLs das cinco fontes legadas comparados dentro da transação e preservados. Negativa anon e saída []/NULL sem vínculo aprovadas por papel SQL, sem simular JWT individual.

Piloto permanece PREPARADO, NÃO ATIVADO: NUC 636768e6-e782-4c7d-8132-e7381621be12; referência AC-01 existente 80f64bfb-cfa0-4012-a2ad-b75226881c2d ainda proposta; M4 fora do escopo de módulo. Identidade individual, decisor, executor, curadoria e prazo efetivo dependem de ato próprio. Nenhum INSERT produtivo efetuado.

Últimas pendências: autorização/identificação da concessão individual; curadoria das fontes; aplicação pelo mecanismo competente; JWT real positivo/negativo, revogação e expiração quando autorizados; homologações de uso listadas em CA-01–CA-29. Sem ativar writer G2, F6, F7 ou Entrega B.
