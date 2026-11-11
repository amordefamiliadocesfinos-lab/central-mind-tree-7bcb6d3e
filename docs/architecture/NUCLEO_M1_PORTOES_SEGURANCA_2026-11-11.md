# Núcleo 2.0 — M1: portões técnicos e de segurança (11/11/2026)

**Escopo:** continuidade da M1 com fundamento no backup real de uma origem recebido e validado.  
**Estado:** pré-validação implementada; **nenhuma migration/importação realizada**.  
**Autoridade:** MAPA MESTRE NÚCLEO 2.0 V1.0, M0 preservação e M1 persistência central, sem novos módulos paralelos.

## Inventário único de origem comprovada
- Arquivo original privado: `NUCLEO_LEGADO_BACKUP_2026-11-11T18-53-36-268Z.json` (não versionar no GitHub).
- Exportação: `2026-11-11T18:53:36.268Z`; SHA-256 da coleção bruta: `83fc9795454568efdccfcf32746d684d5ff9890267273bfb1236012c49c09438`.
- Contagem comprovada: 82 páginas, 8 áreas, 36 marcadores locais, 0 IDs repetidos, 0 versões registradas.
- Há três pares de títulos coincidentes em áreas distintas; **não fundir** por título. Toda identidade deve conter `legacy_id` + `proveniência` + `hash`.
- Não atribuir homologação de autoridade aos textos de arquitetura históricos: a data do registro não garante atualidade de seu conteúdo técnico.

## Bloqueio de segurança comprovado por SELECT na base real
`public.app_admin_capabilities` possui CHECK `capability = 'provision_users'`.
O contrato da PR #594 prevê capacidade `nucleo_manage`, **mas ela é rejeitada pelo CHECK vigente**.

**Não executar** a migration proposta na PR #594 e não contornar a restrição por cargo textual (`app_users.role`), `service_role` em cliente ou desativação de RLS.
Qualquer ampliação da enumeração de capacidades altera o modelo administrativo: exige revisão do impacto, aprovação da Camada Mestre, migration controlada e verificação real com identidades autorizadas e restritas.

## Decisões e contratos não destrutivos
1. Implementar pré-validador offline em `scripts/nucleo-m1-preflight.cjs`: leitura local de arquivo autorizado, checksum exato, estrutura de páginas, identidade, áreas, versões, datas, marcadores e colisões de título.
2. Executar via `node scripts/nucleo-m1-preflight.cjs CAMINHO_BACKUP.json [--manifest CAMINHO_MANIFESTO_PRIVADO.json]`. Manifesto opcional destina-se à guarda privada; não é colocado no repositório.
3. O comando informa `VALIDATED_NO_IMPORT` em vez de simular importação. Não abre rede, não acessa Supabase, não escreve `localStorage`, não faz `INSERT/UPDATE/DELETE`.
4. Após RLS e tabelas aprovadas em outra etapa, preparar um modo separado de **staging append-only** com importação idempotente e controle de lote; não liberar UPDATE indiscriminado ou DELETE.
5. Confrontar todos os 82 registros importados com o manifesto (ID, área, conteúdo, hash e datas), antes de migrar a leitura principal da UI.
6. A coleção local original continua preservada; mudança do `Nucleo.tsx` para fonte compartilhada somente após teste E2E e rollback demonstrado.

## Dependências adicionais
- Revisar e corrigir a PR #594 antes de transformá-la em migration executável; considerar a diretriz histórica do projeto de **não vincular diretamente entidades de negócio a `auth.users`** sem revalidar a política arquitetural vigente.
- A identidade da fonte original não contém ID de navegador; o checksum do lote representa o snapshot, não prova que todos os dispositivos já foram inventariados.
- Manter a camada Drive e qualquer promoção documental fora desta M1; Base de Conhecimentos V1.2 provisória permanece não homologada.
- Nenhum arquivo com textos completos do Núcleo deve ser comitado, anexado a logs ou publicado como artifact de CI.

## Checklist de aceite para M1
- [x] Backup real de uma origem validado quanto à integridade.
- [x] Pré-validador de entrada implementado sem writes.
- [x] Testes sintéticos versionados e configurados em CI.
- [ ] CI da PR confirmar sucesso.
- [ ] Security review e autorização de mudança de capacidade/RLS.
- [ ] Migration schema/grants/RLS implementada, aprovada e testada.
- [ ] Lote staging importado sob controle de proveniência e reconciliado.
- [ ] Conferência de 82 documentos no banco sem substituições.
- [ ] Leitura compartilhada habilitada e testada, mantendo fallback seguro.

**Não classificar a M1 como implantada antes de todos os portões necessários.**
