# Núcleo 2.0 — Entrega A+ / Avaliação de maturidade e portões (V1.3)

**Corte documental:** 16/11/2026. **Natureza:** checkpoint avaliativo de leitura, não novo mapa, decisão soberana, homologação, certificação de mandato ou autorização de publicação.  
**Fonte soberana inspecionada diretamente:** `MAPA_MESTRE_NUCLEO_2_0_V1_3_AC01_CONHECIMENTO_ESPECIALISTAS_CONGELADO_2026-11-14 (1).txt` (Parte I, itens 9–10 e 21; Parte II, itens 24–29; Parte III, itens 31–33), fonte documental fornecida pelo proprietário. A redação literal de CA-23–CA-29 permanece ali; esta nota não a substitui.  
**Fonte técnica atual consultada:** `main` observada em `c5348d65fb22a983bbf97bd122974ed244510639`. **Histórico auxiliar:** [checkpoint 73](NUCLEO_2_0_ENTREGA_A_PLUS_REVISAO_MACRO_CHECKPOINT_73_2026-11-16.md), [auditoria 12/11](NUCLEO_2_0_AUDITORIA_FINAL_PENDENCIAS_PRIORIZADAS_2026-11-12.md), [fechamento V1.2 CA-13–22](NUCLEO_V12_A_PLUS_FECHAMENTO_TECNICO_CA13_CA22_2026-11-14.md).

## 1. Parecer executivo: estados que NÃO podem ser confundidos

| Dimensão | Estado comprovável neste corte | Limite |
|---|---|---|
| Entrega A (base M0–M5) | Aceite técnico **restrito com ressalvas**, decisão histórica preservada | Não é aceite da A+ nem da migração B |
| Desenvolvimento A+ no GitHub | Evolução substancial de contratos, UI e testes, com PRs mergeadas, incluindo [#870](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/870), [#873–#874](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/874), [#878–#890](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/890), [#893](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/893), [#895](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/895), [#898](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/898), [#900](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/900) | Código mergeado não garante publicação do commit, dados reais, UAT ou aceite humano |
| CI da PR #900 | `postgres-ac01`, `postgres-m3`, `frontend-build`, `ui-build` = **success** no GitHub | São validações automatizadas, não ensaios com gestor no ambiente publicado |
| Implantação da revisão atual | **Não verificada nesta avaliação** | Nenhum readback do deploy correspondente ao SHA atual, nem sessão de navegador real, foi realizado aqui |
| Estado produtivo AC-01/FM | **Última fotografia documental, NÃO leitura atual:** checkpoint 73, item 7, relatou 0 contribuições AC-01, 0 revisões FM e 0 decisões/publicações AC-01 quando consultado | Esses números podem ter mudado; não os publicar como contagens atuais |
| Homologação A+ | **Não comprovada / permanece aberta** | Faltam aceite funcional transversal e provas em uso real previstas nos critérios |
| Entrega B | **Não autorizada** | Não importar/substituir ZIPs, Drive ou backup de 82 páginas |

**Conclusão:** a engenharia de consulta, governança e orientação documental A+ está avançada; **a missão integral e o ciclo AC-01 ponta a ponta não estão demonstrados como homologados**.

## 2. Matriz técnica AC-01: critérios normativos literais da Parte II

| Critério | Implementação observada | Evidência/ponto de verificação faltante | Parecer |
|---|---|---|---|
| **CA-23 — Ingestão ou vínculo de arquivo/referência por especialista, com identidade, origem e preservação do original** | `NucleoSpecialistContributions.tsx` registra referência e metadados append-only, com controles de autoria e readback; fonte original permanece fora do Core | Demonstrar com **fonte real elegível** e sessão autorizada; anexação privada de arquivo não comprovada nesta avaliação | **Parcial; não homologado** |
| **CA-24 — Histórico versionado e convivência de vigente, proposta, em evolução, histórico e divergente** | Versionamento da contribuição, linhagem AC-01, consultas de atos e publicação interna; separação UI de estados declarados | Testar duas versões reais e distinção confiável entre vigente **externo** e propostas; conflitos/divergentes em cenário real | **Parcial; não homologado** |
| **CA-25 — Comparação legível de versões, diferenças, remoções, inclusões e conflitos** | Comparação lado a lado dos **metadados retornados**; falha conservadora em origem/versão ausente | Não há prova de diff textual de inclusões/remoções e conflitos de conteúdo real; verificar original autorizado e formatos | **Parcial; não homologado** |
| **CA-26 — Consolidação assistida e governada, sem aprovação/promulgação automática por IA** | Fila de pendências, critérios, rascunhos locais e repasse humano com vínculos documentais, sem escrita canônica | Piloto real demonstrando rascunho derivado de conteúdo autorizado com procedência e revisão independente | **Parcial; não homologado** |
| **CA-27 — Atualização controlada de referências vigentes após decisão humana competente; versões anteriores preservadas** | Contratos de autoridade/decisão/publicação interna em migration e prévia `canonicalReadinessPreview` bloqueada | Ato humano competente real, caso negativo RLS, atualização de **referência canônica pertinente**, CAS/readback e recuperação histórica | **Não demonstrado de ponta a ponta; NÃO promover** |
| **CA-28 — Visão visual dinâmica das pendências, revisões, filas e decisões do gestor** | Fila CA-28, trilha de eventos, vínculos explícitos de solicitação/decisão, panorama de lacunas, estado documental e navegação por contribuição | Teste real com gestor em dados não fictícios, recarregamento e erro/truncamento; responsividade/teclado em caminhos críticos | **Código avançado; aceite condicionado** |
| **CA-29 — Contexto reutilizável para continuidade de especialistas e orientação de humanos/IA autorizados; com fontes, limites, versões e permissões** | Contexto consultivo e prévia de revisão; contratos AC-02 de assunção e leitura protegida existentes | Sucessão efetiva em sessão autorizada, consulta do agente autorizado, confirmação de recebimento/limites e verificação de permissões | **Parcial; não homologado** |

**Atenção:** a tabela resume achados, mas não renumera nem substitui o texto literal dos CA da fonte soberana. Uma comparação apenas de metadados não satisfaz automaticamente CA-25 integral.

## 3. Cobertura A+ além de AC-01

- **CA-01–CA-12 (alcance transversal M3/M4/M5):** há Atlas, Fichas Vivas, módulos inventariados, evidências M4 e fluxos de consulta; **não há demonstração final** neste corte de cobertura funcional real e aceita de CRM, Shopee, Operações, Financeiro e Saúde, com frentes e critérios completos. Não marcar conjunto homologado.
- **CA-13–CA-22 (experiência operacional):** o fechamento histórico de 14/11 declarou todos condicionados/parciais. PRs posteriores desenvolveram fichas, navegação, controle de revisão, proveniência e continuidade; **não há base para converter o conjunto em aceite humano** apenas por commits. Em especial CA-15 (operador independente), CA-16 (agente autorizado no runtime), CA-19/20 (jornadas, mobile, teclado/contraste), CA-21 (persistência com Auth real) e CA-22 (expansão transversal sem código exclusivo) requerem provas específicas.
- **AC-02:** contratos de consulta, manifesto, continuidade e pacote são consultivos; o [checkpoint 73](NUCLEO_2_0_ENTREGA_A_PLUS_REVISAO_MACRO_CHECKPOINT_73_2026-11-16.md) congela a expansão documental incremental dessa frente e mantém gates de sessão, deploy, confirmação e ledger **adiados**. Não abrir UI ou catálogo paralelo neste checkpoint.

## 4. Gates objetivos restantes, preservando P0–P5 do mapa

| Ordem | Prova mínima de saída | Estado nesta avaliação |
|---|---|---|
| **P0 — Implantação/reconciliação** | SHA publicado confrontado com `main`, migration/Edge Function aplicadas separadamente e data/readback explícitos | **Pendente de leitura produtiva atual** |
| **P1 — Fonte/autoridade** | Fonte legítima, permissão efetiva; RLS positiva/negativa; distinção autor/revisor/decisor/executor e mandato | **Contrato em código; prova operacional parcial/pendente** |
| **P2 — Piloto vertical real** | Módulo/especialista reais → registro de contribuição → readback → versões e histórico, com original intacto | **Pendente de observação atual com dados reais** |
| **P3 — Comparação/refinamento** | Duas versões reais, diferença/remoção/inclusão/conflito verificáveis ou limitação explícita; revisão independente e minuta | **Interface de metadados existe; ensaio integral pendente** |
| **P4 — Decisão governada** | Cenário competente e negativo; atualização controlada da referência vigente, CAS/readback, recuperação de anterior | **Não demonstrado; nenhuma autorização inferida** |
| **P5 — Transmissão/aceite** | Gestor usa fluxo ponta a ponta; sessão desktop/mobile, teclado/contraste; continuidade do especialista e permissão de IA | **Pendente/adiado conforme decisões anteriores** |

**Não impor retomada automática de UAT adiado.** A postergação não equivale a aprovação nem impede correções técnicas independentes permitidas.

## 5. Direção mínima para evitar redundância

1. **Parar de fragmentar a Entrega A+ em novas PRs de cartões, contagens, checklists ou classificações sem lacuna funcional nova comprovada.** Reutilizar componentes AC-01 e AC-02 já existentes.
2. **Primeiro próximo passo técnico:** quando houver sessão/provedor autorizado, conciliar revisão realmente publicada (GitHub × runtime/DB) e registrar apenas evidências novas; não tentar inferir deploy de merge.
3. **Primeiro próximo passo funcional:** piloto autorizado com uma fonte verdadeira e dois registros versionados; documentar caso positivo, negativo e readback. Se não houver registros, classificar como gate pendente, sem criar amostras de fachada.
4. **Depois, sob autoridade competente:** verificar critérios CA-25/26/27 completos, sem transformar a migração B ou novos privilégios em pré-requisitos clandestinos.
5. **Aceite final:** só a Camada Mestre/proprietário pode declarar A+ homologada após evidências por domínio e demonstração observada. Preservar os estados atuais e o patrimônio.

## 6. Limites desta avaliação

**Consultados:** Mapa Mestre V1.3 original da fonte, código/migrations versionados, PRs e check runs #900, relatórios históricos de Core/deploy.  
**Não realizados aqui:** query SQL atual no Core, leitura de segredo/JWT, inspeção da tela publicada em sessão autorizada, validação mobile/teclado com operador, emissão ou registro de decisão, alteração de estado, importação ou distribuição de documentos.  
**Essa ausência impede concluir homologação; não prova inexistência absoluta fora do escopo inspecionado.**

**Resultado de checkpoint:** **A+ — desenvolvimento técnico avançado / homologação funcional pendente**. Entrega A restrita preservada. Entrega B continua não autorizada. **Nenhuma frente nova aberta e nenhuma autoridade ou condição normativa alterada.**


## 7. Readback produtivo dirigido — 16/11/2026 (P0/P1; sem mutação)

**Origem da evidência:** conector de leitura de metadados do projeto Painel Central `1720a410-34cd-4410-995c-8c92c7edf16b`, com `get_project` e `get_database_status`; `SELECT` no PostgreSQL oficial habilitado; `main` lida diretamente no GitHub. **Não foi usado o construtor visual nem executado DDL/DML.**

| Verificação | Resultado observado | Limite probatório |
|---|---|---|
| GitHub `main` | `8442a75ad2cd6917edf3383230632ab0272d1e78` | Commit de referência no instante da leitura |
| Projeto conectado | `project.status=ready`, `is_published=true`, `latest_commit_sha=8442a75ad2cd6917edf3383230632ab0272d1e78` | **SHA informado pelo projeto corresponde à `main`; não foi feita prova de carregamento da UI em sessão real, cache/build publicado, ou execução específica de Edge Function** |
| Banco | `enabled=true`, `stack=supabase` | Banco operacional e consultável, mas não implica jornada documental executada |
| Ledger de migrations | `20261114183000` a `20261114183600`, sete versões listadas na tabela `supabase_migrations.schema_migrations` | Migrations presentes no ledger; não é ensaio de toda trigger/RLS sob sessão JWT |
| RLS | `relrowsecurity=true` nas oito tabelas abaixo; `anon SELECT=false`; `authenticated SELECT=true` como privilégio de tabela | Privilégio `authenticated` **não ignora RLS**; falta testar efetivamente papel autorizado, negado e revogação em sessão |
| Quantidade de registros no Core | Zero nas oito tabelas AC-01/FM/mandatos abaixo, **nesta consulta** | Impede piloto positivo com registros atuais; não demonstra inexistência de documentos externos ou usuários autorizados |

**Tabelas consultadas** (cada uma retornou `count(*)=0`, RLS ativa e `anon SELECT=false`):
`nucleo_specialist_contributions`,
`nucleo_ac01_review_events`,
`nucleo_ac01_decision_requests`,
`nucleo_ac01_decision_acts`,
`nucleo_ac01_publication_events`,
`nucleo_ac01_authority_grants`,
`nucleo_module_knowledge_revisions`,
`nucleo_specialist_mandate_records`.

**Atualização da seção 6:** sua frase “query SQL atual no Core não realizada” descrevia o corte anterior e **foi superada exclusivamente para as leituras listadas neste item 7**. Continuam não executados: ensaio autenticado positivo/negativo com JWT real, navegação de UI publicada, gravação/readback de contribuição real, comparação textual integral entre originais, UAT mobile/teclado, teste de mandato/decisão/publicação e homologação. Não tratar igualdade de SHA como confirmação operacional de todo fluxo.

**Conclusão de portões:**
- **P0 — parcialmente verificado:** metadados GitHub/projeto conciliados, sete migrations no ledger, banco consultável; **runtime visual/endpoints e revisão exata de deploy não homologados**.
- **P1 — parcialmente verificado:** RLS habilitada e sem `anon SELECT` nas oito tabelas; **enforcement em sessões reais ainda não ensaiado**.
- **P2/P3 — condicionados a uma contribuição real elegível, autorização do proprietário e pelo menos duas versões**; não inserir proposta de fachada para satisfazer o teste.
- **P4/P5 — permanecem pendentes e sem autorização implícita**.

**Próximo passo operacional estrito:** somente diante de documento real e acesso autorizado, observar registro de contribuição append-only e readback pelo operador; depois verificar versionamento e comparação conforme o mapa, conservando originais. Sem esse caso, manter P2/P3 aguardando prova, sem abrir nova frente, inventar dado ou marcar Entrega A+ homologada.


## 8. Piloto AC-01 — fonte real selecionada, porta de escrita preservada (16/11/2026)

**Natureza:** pré-conferência efetiva do original e prontidão do piloto P2/P3, **sem registro no Core**. Este apontamento complementa, não substitui, os gates do item 7. Não constitui certificado de vigência ou autorização de uso externo.

**Original realmente reaberto:** arquivo `ATENDIMENTO CRM ETAPAS.zip`, entrada exata `ATENDIMENTO CRM ETAPAS/DOCUMENTO_MESTRE_PROCESSO_COMERCIAL_CRM_AMOR_DE_FAMILIA_V1_0.txt`, de 27.659 bytes. SHA-256 calculado **sobre os bytes brutos dessa entrada**: `d6e1222281ad05d8c7c2e10e0f3b31151ab4bedd7f3a7b057942070faddbdc57`. Foi lido o corpo inicial para conferir título, versão 1.0, finalidade e as oito etapas; **não copiar o conteúdo para o Core**. Hash de bytes não atesta autor, versão vigente ou homologação atual.

**Inventário existente consultado:** `src/lib/nucleo/crmAuthoritySourcesV12.ts` já indexa essa origem sob `CRM-PROCESSO`, como documento mestre da base estrutural. A fonte não foi inventada nem reclassificada. **Módulo real no Core:** `CRM`, `id=f07bb967-788a-45eb-bce7-242581d74cd4`, `kind=modulo`, `status=em_andamento`; especialista descrito como papel funcional com vínculo documental a conciliar. A consulta de capacidade mostrou **1 concessão `nucleo_manage` ativa**, mas isso não comprova que esta execução possui a sessão correspondente.

**Contrato de escrita verificado diretamente:** `supabase/migrations/20261114183000_nucleo_ac01_contributions.sql`, trigger `nucleo_ac01_before_insert()`, exige `auth.uid()` não nulo; política `nucleo_ac01_insert` exige `nucleo_manage` ativo do autor. O fluxo de UI realiza `INSERT` append-only e readback com `request_id`; consulta SQL administrativa não equivale a sessão humana autenticada. **Não contornar trigger/RLS por conexão privilegiada**.

**Campos de origem prontos para conferência humana no formulário existente:**

| Campo | Valor candidato, não salvo |
|---|---|
| Módulo | CRM (ID acima) |
| Papel | Especialista CRM, sujeito a confirmação funcional/autoridade |
| Categoria | `metodo` (classificação a conferir pelo registrador) |
| Título | Documento Mestre — Processo Comercial CRM V1.0 |
| Tipo de origem | `referencia_privada` (arquivo do ZIP fornecido, não importado ao Core) |
| Localizador | `ATENDIMENTO CRM ETAPAS.zip :: ATENDIMENTO CRM ETAPAS/DOCUMENTO_MESTRE_PROCESSO_COMERCIAL_CRM_AMOR_DE_FAMILIA_V1_0.txt` |
| SHA-256 de origem | `d6e1222281ad05d8c7c2e10e0f3b31151ab4bedd7f3a7b057942070faddbdc57` |
| Estado pretendido pelo contrato | `proposta`, **jamais vigente automático** |
| ID de pedido / ator / registro | **Ainda não gerados ou persistidos**; dependerão da UI autorizada |

**Pendências objetivas do piloto, sem aprovar por narrativa:**
1. **P2 (gravação real):** executar apenas pelo formulário AC-01 em sessão autenticada com `nucleo_manage`, sob ação explícita do operador, e conferir o mesmo `request_id` no readback; sem essa sessão a gravação não foi realizada.
2. **P3 (segunda versão legítima):** o ZIP consultado inclui esse documento na versão 1.0; **nenhuma V1.1 deste mesmo Documento Mestre foi comprovada nesta inspeção**. Outros documentos CRM (como Matriz 09.01 V1.1 e dicionários) são identidades distintas e não devem ser usados como “versão 2” da mesma linhagem. Localizar revisão original legítima ou aguardar evolução real antes de criar revisão.
3. **P1/segregação:** validar RLS em sessão legítima (autor autorizado e caso negado) com evidência; existência de concessão administrativa não demonstra direito do ator atual.
4. **P4/P5:** decisões, publicação e homologação permanecem fora deste preparo; não há ato autorizado neste checkpoint.

**Resultado factual:** **fonte e módulo reais conferidos; piloto P2/P3 ainda não executado nem homologado**. Preservados original, Core vazio, gates de autoridade e Mapa V1.3. Não abrir frente de UI paralela nem preencher dados fictícios.
