# CCH — E4 · Matriz única de fechamento técnico (23/11/2026)

**Autoridade:** CCH v5.4 FROZEN e Evolução do Motor V1.0 FROZEN. **Escopo:** E2/E3/E4 sobre M3/M4/F13/F14/F21/F22. Sem construtor Lovable, F23, SQL novo ou atletas reais.

Esta é a **matriz de evidência**, não um atestado de homologação, publicação ou eficácia do treino. Testes com dados sintéticos não validam a jornada autenticada em produção. Os arquivos de implementação e testes existentes são a fonte de verdade.

| Contrato | Prova existente / reforço E4 | Limite não coberto |
|---|---|---|
| E2 objetivo, alternativas e nível do atleta | `scripts/health-cch-e2.test.mjs`, `scripts/health-cch-e2b.test.mjs`, `scripts/health-cch-e2-preflight.test.mjs`; `prescriptionE2.ts`, `e2Alternatives.ts`, `e2Preflight.ts` | Não comprova seleção e edição humana na UI autenticada |
| E2 draft, motivo, diff e concorrência da edição | `useHealthProgramM3.ts` chama `health_cch_e2_update_draft_prescription`; migração `20261119112000_health_cch_e2c_guarded_prescription.sql` exige versão draft, snapshot anterior, motivo, alterações permitidas, RLS e não publicação; documentação `CCH_E2C_DRAFT_REVIEW_GATE_2026-11-19.md` | Ensaios de banco descartável não equivalem a uso real |
| M3/F22 publicação manual | `health_m3_publish_program_version` é chamada exclusivamente por ação manual; `publicationStructure.ts` é prévia; `scripts/health-cch-e2-f22.test.mjs` e `CCH_E2_F22_PARIDADE_2026-11-19.md` cobrem estrutura e paridade com SQL F22 | Botão/versão efetivamente servida e jornada autenticada ainda sem homologação |
| E3 sessões anuladas e origem da versão | `e3ObservationAdapter.ts` filtra `completed/active`, associa template à versão; `scripts/health-cch-e3-observation.test.mjs` | Consistência transacional de alterações concorrentes não garantida por leitura REST |
| E3 limites de paginação e ordenação | `e3Pagination.ts`, `useHealthE3ReadOnly.ts`, `scripts/health-cch-e3-pagination.test.mjs`; sentinela, ordem composta, unicidade por ID e falha fechada diante de duplicidade/desordem | Uma remoção/inserção que preserve a sequência observada pode escapar à detecção; não equivale a snapshot de banco |
| E4 isolamento de atletas | Hook E3 com scopeKey, invalidação de respostas e filtros de atleta/RLS; testes de mascaramento e rota SQL E2C invoker | Não constitui auditoria completa das permissões elevadas de E5 |
| E4 idempotência, histórico F21, mutações e versões | CI histórico dos módulos M3/M4/F21/F22 e E2 SQL descartável; preservar contratos já aprovados | Revalidar o conjunto de evidências de SQL/RLS exato antes de homologação geral; não inventar prova ausente |
| E4 produto publicado | Verificação visual do Programa, fingerprint e rascunho/publicação manual | **Adiada pelo proprietário**; sem identidade da revisão servida ou comprovação de deploy |
| E5 persistência real | PR #999 com SQL **somente candidata** e contratos consultivos, Issue #966 | G1/G2/G3/G5, implementação produtiva autorizada, avaliação longitudinal real; F23 não aberta |

## Fechamento técnico incremental de 23/11

- **E3/E4 — detecção conservadora de inconsistência entre páginas:** a consulta pagina com ordenação determinística e agora verifica unicidade dos identificadores, sequência ordenada e limites. Uma duplicidade/desordem lança erro e não gera estudo elegível; exemplos sintéticos incluem inserção antes do offset, conteúdo fora de ordem e identificação vazia.
- **E2/M3/F22 — contrato conjunto:** workflow E4 reúne os testes puros *existentes* de prévia E2 e gate estrutural F22 com os testes de paginação. A publicação continua exclusivamente manual e protegida pelo servidor.
- **Escopo explícito:** nenhuma transação real, nenhum ensaio em atleta, nenhuma liberação de política E5 ou frontend do site; o fechamento técnico deve distinguir `implementado`, `CI aprovado`, `homologado`, `implantado`.

## Pendências que não devem ser ocultadas

1. Snapshot transacional ou alternativa de consistência mais forte se a análise E3 vier a apoiar decisões sensíveis em produção; a detecção presente mitiga apenas divergências observáveis.
2. Prova autenticada M3 → objetivo → alternativas → draft → revisão → publicação manual, incluindo a versão de frontend efetivamente servida. **Homologação visual adiada**.
3. Homologação E5 G1–G5, retenção, consentimento, segurança e ativação em momento próprio. Não tratar merge de SQL candidata como deployment.

**Regra de encerramento:** somente considerar o mapa concluído após distinguir evidência de CI, teste RLS/SQL, homologação autenticada e publicação real. Manter Issue #966 aberta até decisão competente.

## Continuidade E4 — revalidação de faixas paginadas (23/11/2026)

**Lacuna identificada:** a verificação de identificadores únicos e ordem monotônica não identifica sozinha exclusão de linha antes do offset (salto ordenado) nem alteração de valores sob o mesmo ID. Em leituras com várias páginas o adaptador E3 passa a requisitar novamente cada faixa previamente consultada e comparar o conteúdo exato. Desvio, erro ou remoção gera falha da leitura e impede exposição de histórico parcial como confiável.

**Escopo técnico:** `E3PageIntegrity.revalidatePages` em `e3Pagination.ts`, habilitado nas fontes paginadas do hook `useHealthE3ReadOnly`. Revalidação acontece apenas após a leitura completa e quando há múltiplas páginas, para não duplicar a consulta de uma só página. Testes simulam salto sem duplicidade, alteração de carga em mesmo registro, fonte estável e fonte de página única. Sem SQL, novas permissões, dados reais, criação de programa ou publicação.

**Limitação preservada:** duas leituras coincidentes **não garantem snapshot transacional** e não excluem alterações que ocorram entre rechecagens, mudanças reversíveis ou variações sincronizadas de tabelas relacionadas. Esta é detecção conservadora de deriva observável, não homologação de concorrência absoluta. Não reivindicar conclusão total de consistência em produção sem contrato transacional próprio e decisão de governança. Homologação visual segue adiada.
