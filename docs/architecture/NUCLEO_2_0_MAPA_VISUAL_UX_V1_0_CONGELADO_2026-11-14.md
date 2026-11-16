# MAPA VISUAL UX — NÚCLEO 2.0 V1.0
**Projeto:** Painel Central — Amor de Família  
**Escopo:** Entrega A+ do Núcleo existente, UX, navegação, arquitetura de informação e experiência visual  
**Estado:** CONGELADO COMO REFERÊNCIA DE EXECUÇÃO DA FRENTE UX, por determinação expressa do proprietário em 14/11/2026.  
**Autoridade superior:** Camada Mestre e MAPA_MESTRE_NUCLEO_2_0_V1_3_AC01_CONHECIMENTO_ESPECIALISTAS_CONGELADO_2026-11-14.  
**Natureza:** mapa de EXPERIÊNCIA (como apresentar e navegar), subordinado ao mapa soberano (o que e sob qual autoridade). Não modifica CA-01–CA-29, M0–M5, schema, governança ou aceites.

## 1. Missão e desenho congelado
Construir UM Núcleo visual compreensível para o gestor: ver o todo, selecionar um módulo, compreender seu especialista e suas frentes, localizar conhecimento, comparar versões e acompanhar decisões com evidência honesta. Não aumentar telas por padrão, não replicar Biblioteca, não iniciar Entrega B ou M6. A operação GitHub/Supabase e demais especialistas não depende de o Núcleo estar disponível.

**Estrutura de três níveis, em uma experiência integrada:**
1. **VISÃO GERAL — decidir onde olhar:** módulos reais e cobertura, prioridades e bloqueios demonstrados, ações pendentes, dados e data de conferência. A governança NUC é distinta dos módulos operacionais.
2. **MÓDULO — compreender:** objetivo, telas/funções, especialista/competência, desenvolvimento e conhecimento. Um módulo selecionado mantém identidade e orientação visíveis.
3. **DETALHE/PROVA — agir com contexto:** frente/checkpoint/evidências, especialista/mandatos, documento/versão/diferenças, refinamento/solicitação/ato/publicação/histórico. A profundidade é contextual, não outra base ou uma sequência obrigatória de páginas.

A rota atual /nucleo permanece; as oito áreas legadas e os dados originais são preservados. O Núcleo usa vistas complementares sobre as MESMAS fontes e IDs, não duplicação de registros.

## 2. Arquitetura de informação por contexto
### 2.1 Visão Geral
- Cabeçalho com título, função, recorte e última leitura quando comprovada.
- Área de atenção: pendências e bloqueios com motivo e origem; sem inventar percentual, previsão ou progresso.
- Catálogo de módulos com busca, indicação de cobertura (cadastrado, parcial, não verificado) e entrada para a ficha.
- Consulta das frentes e supervisão em contexto distinto, acessível por navegação curta; evitar renderizar simultaneamente todas as seções longas.
- Contagens indicam o universo real consultado, distinguindo NUC/governança de módulos externos e limite de paginação.

### 2.2 Ficha do módulo — quatro áreas estáveis
1. **Operação:** o que é/faz, rotas, telas, controles, tarefas guiadas e fonte de verificação.
2. **Desenvolvimento:** frentes e subfrentes, prioridade, bloqueio, próxima ação, critérios, estado, lista/árvore/Kanban, histórico e evidência.
3. **Especialistas:** papel funcional, responsabilidade declarada, método/ecossistema, mandato/certificação, limites e vínculos documentais.
4. **Conhecimento e Evolução:** Ficha Viva FM-01–FM-10, fontes, propostas, versões, revisões, comparações, solicitações, decisões, publicação e histórico.

Selecionar módulo e mudar área não deve reinventar a identidade, os títulos nem os filtros necessários. A ficha pode conter dados parciais claramente qualificados; ausência de cadastro no Core não equivale à ausência do módulo na organização.

### 2.3 Especialista e documentação
- Identidade do especialista é um PAPEL FUNCIONAL persistente, não o nome do chat nem um mandato presumido.
- O especialista mostra: responsabilidade, escopo, método e versão, fontes, histórico de continuidade, conhecimento produzido, pendências e prova de competência quando existente.
- Ingresso na jornada documental: **Módulo → Especialista → Conhecimento/Evolução → Documento/Versão → Comparar → Refinar → Solicitar decisão → Ato competente → Publicação comprovada → Histórico**.
- Essa é uma trilha de CONSULTA e preparação; um passo sem contrato de escrita liberado deve aparecer como indisponível/bloqueado, nunca como concluído.

## 3. Contrato visual documental AC-01
Uma experiência documental coerente reaproveita NucleoSpecialistContributions, NucleoContributionDesk, NucleoAC01DocumentGovernance, NucleoModuleKnowledge, NucleoAC01ReviewTrail e NucleoAC01DecisionIntake/Status. Unificar a apresentação e o contexto, SEM fundir tabelas, eventos ou autoridades.

**Eixos independentes a exibir:**
- **Estado do documento:** recebido, proposta, em análise/evolução, aguardando decisão, vigente declarado, histórico/supersedido, divergente/bloqueado, conforme fonte e taxonomia efetiva.
- **Autoridade:** fonte declarada, competência certificada, decisão efetiva, referência canônica vigente externamente comprovada ou NÃO COMPROVADA. Ter acesso técnico nucleo_manage não cria mandato substantivo.
- **Execução:** contribuição registrada, revisão/solicitação persistida, ato decisório, publicação INTERNA AC-01, atualização canônica de Ficha Viva/Drive/GitHub comprovada. São eventos diferentes.
- **Prova:** quem propôs, revisou, solicitou, decidiu e executou; data, fonte, ID, versão, histórico. Não inventar autor nem atribuir decisão à IA.

**Regra crítica:** a aba/etiqueta "Vigente" jamais pode apresentar publicação interna AC-01 como se fosse vigência canônica externa. Estados de leitura incompleta, zero ocorrências e falta de direito de acesso devem ser distintos. Delegação, revogação, decisão, publicação e CAS permanecem SEM botões executores enquanto respectivos portões INSERT/RPC estiverem fechados.

## 4. Comparação e refinamento
- Escolher explicitamente versão A e versão B, exibindo título, origem, estado, data e versão de cada uma.
- Resumo da comparação + inclusão/remoção por linhas, marcação textual além de cor e contexto antes/depois; não atribuir equivalência semântica ou conflito de autoridade a um diff textual.
- O comparador atual de FM é determinístico, local e limitado a 12.000 caracteres e 180 linhas por lado; acima disso, mostrar "comparação integral indisponível" e link/referência à fonte, NUNCA diff parcial como integral.
- Refinar prepara nova revisão/rascunho, preserva original e história; não equivale a homologação.
- Rascunho não salvo deve permanecer protegido ao navegar/trocar visão, com confirmação quando houver risco de descarte.
- Minutas consultivas, pedidos, atos de decisão e publicação devem ter rótulos e efeitos diferentes.

## 5. Padrão de interface e acessibilidade
- Reaproveitar componentes UI, tipografia, ícones, tokens de cor e layout responsivo do Painel Central. Não impor redesign visual global sem necessidade.
- Cabeçalhos curtos, títulos familiares, blocos escaneáveis e detalhes progressivos, sem exigir leitura de documentos extensos na primeira dobra.
- Em cada nível: "Onde estou?", "O que é?", "Qual o estado e a prova?", "O que posso fazer agora?". Caminho de volta sem perder seleção e rascunho.
- Busca e filtros dentro do recorte efetivo, com rótulos, total/limite, vazio orientador e erro sem falso sucesso.
- Não usar somente cor para comunicar estado; indicar texto e significados de bloqueio. Mostrar data da consulta e proveniência quando relevante.
- Teclado: foco visível, controles semânticos, ordem de Tab coerente, Escape/cancelamento quando cabível e alvos de toque confortáveis.
- Testar por código e preview compatível: desktop ≥1366, intermediário ~1024, tablet ~768 e mobile ~390/320 px. Meta de contraste WCAG 2.2 AA; aceites visuais e testes humanos integrais ADIADOS pelo proprietário.
- Evitar rolagem longa como único modo de navegação. Preferir entradas de escopo e transição contextual, preservando seleção e estado.

## 6. Frentes de execução congeladas
| Ordem | Frente | Mudança autorizada de UX | Critério de aceite técnico proporcional |
|---|---|---|---|
| UX-A1 | Entrada progressiva da Central | Separar apresentação geral de acompanhamento detalhado; manter links para fichas e conteúdo sem perder estados | Visão Geral padrão; acesso às frentes em um controle; nenhum writer/contrato alterado; build/CI |
| UX-A2 | Contexto e navegação de módulo | Melhorar hierarquia de navegação das quatro áreas, resumo, retorno e preservação de seleção | Alternância clara, acesso às mesmas funcionalidades/rotas, nenhuma fonte duplicada |
| UX-A3 | Especialista e AC-01 unificados visualmente | Consolidar navegação da fila e contexto do documento sem alterar schema/autoridade | Estados, origem, solicitações, histórico e competências encontráveis; atos não executáveis |
| UX-A4 | Comparador legível e contextual | Melhorar organização da versão A/B e apresentação determinística com limites preservados | Sem diferenças inventadas, sem truncar silenciosamente, acessibilidade |
| UX-A5 | Estados e responsividade | Refinar vazios, falhas, foco, densidade, mobile, acessibilidade | Cobertura estática/automatizada apropriada; UAT real pendente |
| UX-A6 | Consolidação de evidências | Conferir critérios CA impactados e documentação de alteração mínima | Resultado técnico ≠ homologação humana; referencia o mapa existente |

A execução é por **microfrente no GitHub**: branch pequena → alteração mínima → testes/build/CI quando disponíveis → PR → conferência → merge conforme governança. Evitar alterar simultaneamente os arquivos da frente Núcleo técnica; conflitos de backend, RLS e autoridade pertencem ao Especialista Núcleo/Camada Mestre.

## 7. Critérios de aceite de experiência
1. Gestor encontra módulo real e próximo trabalho sem ler logs/chats longos.
2. Do módulo, acessa diretamente Operação, Desenvolvimento, Especialista e Conhecimento, sem sair do Núcleo nem perder contexto.
3. Frentes selecionadas mantêm ID, status, histórico, fontes e ação comprováveis, com lista/árvore/quadro sobre o mesmo registro.
4. Documento selecionado identifica versão e origem; proposta não se torna vigente por ser mais recente.
5. A comparação mostra diferenças textuais reais ou limitação explícita.
6. O gestor distingue proposição, revisão, pedido, ato, publicação AC-01 interna e alteração canônica.
7. A fila de pendências e a trilha de continuidade indicam autoria, data, limites e fonte quando há prova.
8. A experiência informa inacessibilidade e dados incompletos sem apresentar zero como ausência global.
9. Layouts e controles passam por testes técnicos compatíveis sem regredir UX/CRM ou segurança.
10. **Aceite humano completo da Entrega A+ permanece PENDENTE**, ainda que microfrentes de código sejam aprovadas.

## 8. Congelamento, manutenção e prova
- Este documento fixa a **arquitetura de experiência da frente UX V1.0**, não concede vigência a documentos de especialistas nem altera o mapa soberano V1.3.
- Mudança de rótulo, ordem ou agrupamento dentro das quatro áreas é permitida se preservar contrato e evidência; revisão estrutural do mapa exige novo aceite da Camada Mestre/proprietário.
- Registrar mudanças materiais por delta e PR nesta mesma referência ou na auditoria canônica quando pertinente, sem criar plano duplicado por etapa.
- Origem do diagnóstico: código da main inspecionado em 14/11/2026 (Nucleo.tsx, NucleoDevelopmentCenter.tsx, NucleoOperationalAtlas.tsx, Ficha Viva e AC-01), auditoria canônica de 12–14/11 e PRs #793, #797, #798, #799, #800 e #801. A inspeção de código NÃO é homologação visual autenticada.
- **Próxima ação executiva:** UX-A1, isolando a Visão Geral do detalhamento de frentes na Central atual, sem perda de edição, seleção, acesso ou história.

## 9. Registro de execução e reconciliação UX-A6 — 14/11/2026

**Natureza:** adendo de EVIDÊNCIAS ao mapa UX V1.0 já congelado; não altera os níveis, áreas, critérios, ordem das microfrentes ou autoridade do Mapa Mestre Núcleo V1.3. Fontes: PRs GitHub e workflows do repositório oficial, código de `main`, auditoria canônica em `docs/architecture/NUCLEO_2_0_AUDITORIA_FINAL_PENDENCIAS_PRIORIZADAS_2026-11-12.md`. Evidência de CI **não** é homologação de jornada humana nem prova autônoma de deployment.

### 9.1 Matriz de entrega — evidência, estado e limitação

| Frente | Evidência GitHub / CI no head da PR | Situação de integração | Limite que permanece |
|---|---|---|---|
| Mapa UX V1.0 | PR [#803](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/803), merge `559a48d8e9d030dcbcab46cf3f32f6e1e8248df1` | **CONGELADO na main** | Não substitui Mapa Mestre V1.3; nenhum aceite humano concedido |
| UX-A1 — navegação progressiva da Central | PR [#802](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/802), head `c776a221b31ae57258cfc83bfafae2beff5d6ece`; M3 desenvolvimento, M3 no-op/layout e M4 evidências **SUCCESS**; M5 supervisão **FAILURE** (run `43621830123`) | **PENDENTE; não integrada** | [Issue #804](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/804) aberta, asserção estática M5 divergente da condição de revisão AC-01 já vigente; ajuste pertence ao Especialista Núcleo |
| UX-A2 — ficha e navegação dos módulos | PR [#805](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/805), merge `ef7467fff37d1cfb7e6ad74a162ed35a8e4ba1a8`; M3 desenvolvimento **SUCCESS** (run `43622931494`) | **Integrada na main / tecnicamente validada** | Preserva contexto de seleção, não garante rascunhos entre módulos/reloads |
| UX-A3A — contribuições, fila e ciclo AC-01 | PR [#808](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/808), merge `a0b4de4c36d7cd79b832d3bf09312df6216e9e67`; AC-01 **SUCCESS** (run `43624056203`) | **Integrada na main / tecnicamente validada** | Estados de consulta não autorizam atos, aprovações ou publicação |
| UX-A3B — Ficha Viva ↔ especialista | PR [#809](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/809), merge `5118e8bcf8590969d9cdc78bc00e4b3312578db9`; M3 desenvolvimento **SUCCESS** (run `43624367162`) | **Integrada na main / tecnicamente validada** | Mantém painéis montados após visita no mesmo módulo; não prova preservação universal de minutas |
| UX-A4 — comparador de versões FM | PR [#810](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/810), merge `0c3721a7382f7d4616bab912666a195d8f5e1a9d`; M3 desenvolvimento **SUCCESS** no head corrigido (run `43625806198`) | **Integrada na main / tecnicamente validada** | Diff somente textual, até 12.000 caracteres e 180 linhas por versão; não identifica conflito de autoridade |
| UX-A5 — responsividade, acessibilidade e estados | PR [#811](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/811), merge `98391d7dbd3fcf54da7c475fddf1db0b6414ffa2`; M3 **SUCCESS** (run `43627221451`) e AC-01 **SUCCESS** (run `43627221376`) | **Integrada na main / tecnicamente validada** | Evidência de CSS, markup e testes estáticos/CI, sem comprovação de WCAG AA ou dispositivos autenticados |
| UX-A6 — reconciliação de evidências | Este adendo **após revisão e merge de sua PR específica** | **Documental**, sem mudança operacional | Não homologa automaticamente CA-01–CA-29, módulos ou Entrega A+ |

**Ponto de corte verificado para esta reconciliação:** `main=98391d7dbd3fcf54da7c475fddf1db0b6414ffa2`; projeto Lovable oficial em `ready`, `latest_commit_sha` igual ao SHA da `main` no momento da consulta. Essa igualdade evidencia sincronização do repositório para a versão observada; **não demonstra** publicação integral de site, atualização canônica externa, disponibilidade de funções Cloud, autorização de operadores ou aceite humano.

### 9.2 Critérios UX do próprio mapa, sem extrapolar os CA soberanos

| Critério do item 7 | Prova atual | Avaliação responsável |
|---|---|---|
| UX 1 — encontrar módulo e próximo trabalho | Catálogo/Atlas existentes, UX-A2 e UX-A5; UX-A1 ainda não integrada | **Parcial**: falta entrada progressiva A1 + uso real |
| UX 2 — quatro áreas do módulo | PR #805, testes de navegação; ligação contextual PR #809 | **Técnico atendido**; usabilidade humana pendente |
| UX 3 — ID, status, evidências e visões das frentes | Estruturas M3/M4 reaproveitadas, sem alteração na fonte | **Preservado no código**; não homologado em uso real |
| UX 4 — versão, fonte e autoridade declaradas | PR #810 e rótulos AC-01; sem promoção automática | **Técnico atendido**; validação de fontes reais pendente |
| UX 5 — diferença textual ou limite expresso | Comparador determinístico original + PR #810, teste de limites | **Técnico atendido**; comparação autenticada humana pendente |
| UX 6 — distinguir proposta, ato, publicação interna/canônica | PR #808 e #809, blocos de advertência e portões fechados | **Técnico parcial**; nenhuma decisão/publicação habilitada ou homologada |
| UX 7 — origem, autoria, continuidade e pendências | Campos, fichas M3, AC-01 e consultas por fontes existentes | **Parcial**: conferir completude e interpretação humana dos recortes |
| UX 8 — falta de acesso ≠ ausência global | PR #811, casos de leitura indisponível/sem registro e erro | **Técnico atendido** nos componentes alterados, não comprova cobertura total |
| UX 9 — regressões e acesso coerente | CI proporcional M3 e AC-01 bem-sucedida para A2–A5; A1 M5 falhou | **Parcial**, pendência A1 e teste visual/acessibilidade aprofundado |
| UX 10 — aceite humano completo | Expressamente adiado pelo proprietário | **PENDENTE**, não homologado |

A revisão acima **não altera nem aprova os critérios CA-01–CA-29**. As cautelas de competência, decisão, revogação, publicação interna e canônica tratadas em CA-23–CA-29/AC-01 continuam sob o Mapa Mestre V1.3 e Especialista Núcleo. As decisões e provas desse núcleo técnico não devem ser reclassificadas como homologação UX. Sem nova RLS, migration, delegação, credencial, gravação ou concessão.

### 9.3 Pendências reais e ordem de tratamento

1. **P1 — Concluir UX-A1 sem contornar M5:** responsável pelo teste/contrato é o Especialista Núcleo; reconciliar issue #804, preservar readback e negativos AC-01; executar CI afetada após ajuste, revisar branch da PR #802 frente à `main` atual (rebase/merge caso necessário), e integrar somente com verificações compatíveis aprovadas. UX acompanha impacto visual, sem assumir autoridade técnica.
2. **P2 — Homologação visual/autenticada ADIADA:** quando o proprietário retomar, observar desktop ≥1366px, 1024px, tablet 768px, mobile 390 e 320px; ordem do teclado, foco, rolagem horizontal, alvos de toque, rótulos e contraste; fluxo Visão Geral → Módulo → Especialista → FM → Comparar → Histórico; estados sem acesso, vazios, dados parciais, sem sinal, falha e retorno. Verificar preservação de minuta em transição e risco de descarte; não afirmar conformidade WCAG 2.2 AA sem medições apropriadas.
3. **P3 — Limites de rascunho e foco:** alternância entre áreas no mesmo módulo retém partes montadas; mudar módulo, recarregar e outras navegações ainda não estão protegidos universalmente. Investigar no uso real ou em microfrente futura autorizada; não interpretar a preservação parcial como garantia de não perda.
4. **P4 — Contrato AC-02 recente:** a auditoria canônica, itens 57 e 58, registra fonte global AC-02 e projeção autenticada `include_ac02` pela Edge Function existente. É uma **dependência visual adicional**: Especialista UX deverá consumir projeção autorizada e diferenciar diretriz/fonte observada/desatualização/conflito/acesso não verificado, com proveniência, sem duplicar configuração. A inclusão como microfrente no mapa **não é automática**: coordenar com Camada Mestre/Especialista Núcleo antes de qualquer mudança visual, preservando o escopo congelado.
5. **P5 — Atualização canônica e publicação:** os portões decisórios/publicação AC-01 permanecem fechados; ensaios positivos em PostgreSQL descartável não autorizam execução em ambiente real. Uma publicação interna não comprova atualização da Ficha Viva/Drive/GitHub.

### 9.4 Encerramento da fase documental

- **UX-A6:** reconciliação documental executada neste mesmo mapa, sem segundo mapa ou base paralela, sem código funcional.
- **UX A2–A5:** integradas e cobertas por CI declarada acima; **UX-A1** segue pendente; **UX A+ integral** e critérios CA não homologados.
- **Próxima ação:** tratar P1 pela frente Núcleo técnica; após seu aceite e nova CI, revisar a UX-A1 e consolidar as evidências finais; manter UAT humano adiado até decisão expressa.

## 10. Atualização de evidências UX-A1 e V2.3–V2.5 — 14/11/2026

**Natureza:** adendo factual à seção 9, sem alterar a arquitetura UX congelada, o Mapa Mestre V1.3 nem CA-01–CA-29. O estado descrito em 9.3/9.4 corresponde ao corte histórico ANTERIOR às PRs abaixo; este adendo registra sua evolução posterior.

| Entrega | Prova de integração na main | Limites e efeito real |
|---|---|---|
| **M5/AC-01 — reconciliação do teste** | [PR #829](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/829), merge `49e2600254ef466e24707050787af4d2679c6874`, workflow M5 `SUCCESS` | Ajuste somente de asserções estáticas para readback condicional `proposta` (inicial) / `em_evolucao` (revisão) e navegação UX-A3B existente. Nenhum writer, RLS, mandato ou portão alterado; [issue #804](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/804) encerrada |
| **UX-A1 — entrada progressiva V2.3** | [PR #830](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/830), merge `1419ef5b32a9ed5ebe0f70b116d0d597b519c631`; M3, M3 no-op/layout, M4, M5 `SUCCESS` | Visão Geral/Atlas e Frentes/Acompanhamento em vistas montadas, com proteção de edições M3 ao trocar de frente, aviso ao descarregar e bloqueio durante gravação. A [PR #802](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/802) foi encerrada **sem merge** por substituição, não eliminada da história |
| **UX V2.4 — rascunhos documentais** | [PR #831](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/831), merge `3918198e9ca7b3641f000c95e6aa97079be14e3b`; M3 e AC-01 `SUCCESS` | Ficha Viva e contribuições do especialista informam edições/pendências; troca de módulo confirma descarte ou é bloqueada por gravação/resultado indeterminado AC-01. Proteção no fechamento da aba. Não é armazenamento automático de rascunhos entre sessões |
| **UX V2.5 — contextos e vigência** | [PR #833](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/833), merge `8b09ccdadebfb2742079b0baca0534c92a75db50`; M0, M2, M3, M3 no-op e AC-01 `SUCCESS` | Menu diferencia Biblioteca **local do navegador** e Central/ **Core** sem criar segunda base. Aba AC-01 agora indica “Vigência e comprovação”; separa fonte FM declarada de publicação INTERNA, sem inferir atualização externa canônica |

### 10.1 Situação após a execução

- **UX-A1 a UX-A6:** microfrentes técnicas previstas no mapa executadas/integradas, com evidências acima e na seção 9. Isso **não equivale** a homologação visual humana, aceite CA-01–CA-29 nem conclusão de todas as funções do Núcleo 2.0.
- **UX V2.3–V2.5:** refinamentos autorizados de apresentação e proteção de estado, sem reconstrução de Núcleo, Ficha Viva, Biblioteca, integração com GitHub/Supabase ou permissões.
- **Pendências ainda legítimas:** homologação autenticada desktop/mobile e acessibilidade integral, ações de navegação SPA externas não cobertas por avisos de `beforeunload`, rascunhos entre sessões/recarregamentos, dependência AC-02 condicionada à Camada Mestre, publicação canônica externa e portões INSERT/RPC fechados. Não criar por padrão novas frentes de aparência sem evidência de uso real.
- **Prova de CI:** verificações técnicas em GitHub Actions; não confirma por si só disponibilidade do deployment final, qualidade visual percebida ou conformidade WCAG 2.2 AA.

## 11. UX V3.0 — Panorama, Foco e Execução — ADENDO CONGELADO (16/11/2026)

**Estado:** CONGELADO por determinação expressa do proprietário. **Hierarquia:** extensão de experiência do Mapa UX V1.0 existente, subordinada ao Mapa Mestre Núcleo 2.0 V1.3 e CA-01–CA-29; não substitui as seções 1–10. Congelamento da orientação **não equivale** a homologação visual humana nem a implementação integral desta rodada.

### 11.1 Problema, objetivo e princípio
O Painel Central já oferece o padrão de encaixes, filtros, gráficos e leitura macro/micro. A Central Núcleo V2.7 melhorou retomada e cartões de situação, porém o acompanhamento ainda agrupa seções longas e indicadores repetidos. O gestor precisa abrir a tela e identificar **onde está, onde parou, o que precisa de atenção e como continuar**, com profundidade escolhida.

**Princípio congelado:** mostrar o essencial primeiro; expandir por intenção. **Panorama → Foco → Execução** em uma única experiência, sem criar segunda Biblioteca, segundo Núcleo, rota paralela, Entrega B ou M6.

### 11.2 Arquitetura dos três modos

| Nível | Entrada | Ação imediata | Detalhe sob demanda |
|---|---|---|---|
| **Panorama geral** | Onde estou, última frente aberta neste navegador ou evento recente do recorte do Core com origem explícita, resumo por estado, atenção e cobertura | Continuar, abrir recorte, localizar módulo | Atlas completo, histórico e supervisão |
| **Foco micro** | Recorte por situação, módulo ou especialista **declarado**, cartões e barras do mesmo universo, lista/kanban focados | Limpar foco, abrir frente sem perder seleção | Ficha, prova e dependências |
| **Execução** | Frente selecionada, código/título, status, próxima ação registrada e bloqueio; autoria/prova quando disponíveis | Editar, salvar, consultar evidência | Histórico, documentação e dependências progressivas |

A transição mantém a rota /nucleo, os mesmos registros e IDs; componentes com minuta devem permanecer montados ou exigir confirmação explícita de descarte. Se a gravação estiver em andamento ou for indeterminada, não descartar contexto silenciosamente. Painéis não devem parecer clicáveis sem ação real.

### 11.3 Paleta e dashboards honestos
Paleta existente: **azul #1A73E8** (navegação/foco), **verde #34A853** (concluído declarado ou evidência realmente verificada, com texto), **amarelo #FBBC04** (validação/atenção), **vermelho #EA4335** (bloqueio) e **azul claro #E8F0FE** (superfície). Cor jamais é prova de homologação.

Barras e percentuais só podem indicar uma **proporção objetiva** do mesmo universo consultado e rotulado:
- Distribuição de estados M3: contagem por estado / total elegível do recorte, incluindo planejado e concluído.
- Concluídas **declaradas** no recorte: estado concluído / frentes e subfrentes elegíveis; **não** percentual geral de desenvolvimento do módulo.
- Bloqueadas, em validação, em andamento e próximas ações preenchidas: contagem e denominador visíveis; próxima ação presente **não** comprova sua execução.
- Estado de evidência **declarado M3**: sem_evidencia, relatada, comprovada. Não equiparar à conferência de prova técnica M4.
- Evidência M4: somente calcular se a consulta M4 sustentar numerador e denominador do mesmo universo; recorte parcial, erro e sem acesso devem ser rotulados. Nunca inferir prova por estado M3.

**Contrato de barra:** nome, numerador, denominador, percentual derivado, fonte, recorte e limitação. Vazio/indisponível não é 0%. Excluir raiz NUC da contagem operacional. Ao agregar módulo, não tomar 100% das frentes concluídas como 100% da implantação real.

### 11.4 Seis microfrentes congeladas

| Ordem | ID | Entrega | Aceite técnico mínimo |
|---|---|---|---|
| 1 | **UX-DIN-01 — Entrada dinâmica** | Compor retomada, atenção, distribuição real e acesso aos recortes num resumo compacto; reduzir repetição visual | Fonte M3 e IDs preservados, erros/vazios, responsividade, build/CI |
| 2 | **UX-DIN-02 — Foco acionável** | Reutilizar filtros V2.7 e incluir situação, módulo, especialista declarado, limpar foco, lista/kanban sob recorte | Filtros sem writers, seleção/rascunho protegidos, retorno ao panorama |
| 3 | **UX-DIN-03 — Barras verdadeiras** | Componente reaproveitável com distribuição, conclusão declarada e cobertura quando comprovável | Testes 0/0, arredondamento, origem e cor+texto; sem porcentagem inventada |
| 4 | **UX-DIN-04 — Resumo micro** | Consulta rápida de status, prioridade, ação, última atualização, especialista declarado e evidência do registro | Abrir a mesma frente/ID, sem duplicar editor ou banco |
| 5 | **UX-DIN-05 — Execução encaixada** | Priorizar próxima ação e recolher progressivamente evidência, dependência, checkpoint e histórico existentes | Guardas de edição preservadas, sem escritores ou portões novos |
| 6 | **UX-DIN-06 — Continuidade visual** | Unificar cartões, barras, acessibilidade, densidade e estados vazios; reconciliar evidências neste mesmo mapa | Build, CI, revisão de limites, homologação visual humana adiada |

**Ordem operacional:** DIN-01 → DIN-02 → DIN-03 → DIN-04 → DIN-05 → DIN-06. Reusar NucleoDevelopmentCenter, NucleoOperationalAtlas, NucleoExecutiveDevelopment, NucleoTechnicalEvidence e componentes FM/AC-01. Não duplicar fontes ou telas.

### 11.5 Governança, testes e limites
- GitHub oficial, branch pequena → teste estático/TypeScript/build → CI → PR → merge. Lovable apenas ambiente de execução, jamais construtor visual.
- Não alterar mandatos, RLS, CA-01–CA-29, contratos FM/AC-01, estado canônico, portões de decisão/publicação, nem atribuir autoridade às cores. Qualquer evolução técnica fora da interface deve ser coordenada com o Especialista Núcleo.
- Não mostrar percentuais de maturidade subjetiva, estimativa de avanço, autoria ou próxima ação inventada. Quando faltar prova, apresentar não verificado/indisponível.
- Congelamento do mapa **não certifica** layout em uso real: homologação humana e verificação WCAG integral seguem adiadas.
- Consolidar resultados e evidências das DINs no **mesmo mapa** como adendos datados. Não criar documentação soberana redundante.

## 12. Evidências UX V3.0 — panorama, foco e execução (16/11/2026)

**Natureza:** atualização de evidências técnicas da seção 11 congelada, no **mesmo mapa**. Não redefine os critérios UX, a arquitetura Mestre V1.3, os contratos AC-01–CA-29 nem a autoridade do Especialista Núcleo. O status abaixo descreve a integração GitHub/CI; **não é homologação visual humana**.

| Microfrente | Integração em main | Efeito observável no código e limite |
|---|---|---|
| **Congelamento do mapa UX V3.0** | [PR #841](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/841), merge dca4b3f90066a2dd6a1e5cf415f54aa020232032 | Seção 11 preservada, critérios de Panorama/Foco/Execução, seis DINs, fontes e numeradores documentados. Sem migração, writer, RLS ou tela paralela |
| **DIN-01 — Entrada dinâmica** | [PR #844](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/844), merge 1f2862fb2504bb8e9bfb8cc0b49f8dd2c557dc87 | Panorama existente V2.7 acrescido de distribuição real M3 e módulo expansível. Mantém retomada, estado e alerta. Não é maturidade do módulo |
| **DIN-02 — Foco acionável** | [PR #844](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/844), merge 1f2862fb2504bb8e9bfb8cc0b49f8dd2c557dc87 | Filtro combinável por módulo, especialista **declarado**, situação e pesquisa; limpar foco, lista/Kanban e leitura sem writers. Análise executiva e supervisão sob demanda |
| **DIN-03 — Barras verificáveis** | [PR #845](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/845), merge 5dce0fed7ea5396bcff21c5f0fa713094edbbc43 | Barra por distribuição de estados e coberturas M3 com numerador, denominador e percentual derivado; 0/0 retorna **não mensurável**. Testes numéricos 0/0, 0/7, 1/3, 2/3, 7/7, inputs inválidos, exclusão de módulos. Nenhuma agregação presumida de prova técnica M4 |
| **DIN-04 — Resumo micro** | [PR #846](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/846), merge bd518e24107dc74c2496bdf74e54c884a3978b73 | Resumo em leitura de até três frentes do recorte: código, status, prioridade, especialista declarado, data M3, evidência declarada e próxima ação. Abrir ficha conserva ID/guardas |
| **DIN-05 — Execução encaixada** | [PR #847](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/847), merge 30ef9f1219f30d92ca6e158e5d14218770d97d29 | Próxima ação editável + Salvar em primeiro plano. Demais campos, M4, dependências e histórico em detalhes progressivos. Prova M4 somente consultada quando aberta; sem novo editor ou mecanismo de escrita |
| **DIN-06 — Densidade, estado e continuidade** | [PR #848](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/848), merge bff273094937bda5d9f9b8996a5a8f3e80440afd | Árvore completa recolhida, aviso duplicado de situação eliminado, indicadores em grid responsivo, hora da última leitura M3 bem-sucedida e erro sem falso timestamp. Testes proporcionais adicionados |

### 12.1 Evidência técnica e escopo preservado

- **GitHub/CI:** todas as PRs de código acima foram integradas após seus workflows pertinentes concluírem com SUCCESS: M3 incluindo RLS e frontend, M4 quando acionado, M5 quando acionado e regressão M3 no-op/layout; DIN-03 teve ao menos M3 completo, incluindo testes numéricos e build. Isso demonstra verificação automática, **não observação autenticada de uso real**.
- **Único Core:** /nucleo e o projeto Supabase existente. Nenhuma tabela nova, migration, writer, concessão de mandato, decisão/assinatura ou publicação foi criada nesta rodada.
- **Cores e percentuais:** sem evolução subjetiva; status e evidência M3 permanecem declarações, não provas de implantação integral. Nenhuma cobertura técnica M4 foi extrapolada sem consulta.
- **Navegação:** filtros só alteram a apresentação; a troca de frente e de módulo continua protegida pelos controles de edição/gravação previamente implementados. Os dados e versões documentais originais não são promovidos automaticamente.
- **Alcance:** mapa e entregas V3.0 se referem à experiência visual do Núcleo A+, não ao fechamento de AC-02, Entrega B ou de todos os serviços do Painel Central.

### 12.2 Pendências explicitamente não homologadas

1. **Homologação humana visual em uso real** segue ADIADA pelo proprietário: desktop, ~1024, tablet, mobile ~390/320, contraste, teclado, foco, rolagem, utilização com dados verdadeiros e clareza de navegação.
2. **Proteção universal de navegação externa SPA** e recuperação de rascunhos após recarga/fechamento permanecem fora do alcance das guardas atuais; não declarar garantia universal de continuidade.
3. **Prova M4 agregada em percentual** não foi implementada sem contrato de consulta com mesmo recorte/denominador. A classificação de evidência M3 **não** valida prova técnica M4.
4. **Vigência canônica, mandatos e portões INSERT/RPC** permanecem sujeitos ao Mapa Mestre, sem abertura pela frente UX.
5. **AC-02** permanece dependente de coordenação específica com Camada Mestre e Especialista Núcleo; não reabrir por conveniência visual.

**Encerramento técnico V3.0:** UX-DIN-01 a 06 integradas e documentadas. Próxima intervenção visual estrutural deve partir de uso real comprovado ou determinação expressa da Camada Mestre, preservando este adendo e as fontes originais.

## 13. Missão UX A+ — funcionalidade e conhecimento — checkpoint técnico (16/11/2026)

**Natureza:** reconciliação da ordem de execução da Camada Mestre de 16/11/2026 com o **mapa UX vigente**. Este adendo registra entregas por PR e limites verificáveis; **não** cria mapa soberano novo, revoga a V3.0, muda o Mapa Mestre Núcleo V1.3 ou certifica o aceite visual humano. O estado técnico final corresponde à integração em main deste checkpoint.

### 13.1 Ordem de execução e evidências reais

| Etapa da ordem Mestre | Entrega UX observável | GitHub / prova | Limitação que permanece |
|---|---|---|---|
| **UX-01 — CRM funcional e navegável** | Na ficha CRM atual, oito atalhos de módulo → telas → controles → procedimento orientado → especialista → conhecimento → desenvolvimento → evidências; salto de etapas e rotas operacionais em nova guia; correção de Ficha Viva do gestor já reconciliada | Núcleo técnico [#851](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/851), correção [#855](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/855); UX [#856](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/856), merge d012c138db30ffdf06baf839d0ae0a4b4242d0f7. M3/frontend build SUCCESS | Roteiros são **inspeções de código**, não manuais homologados nem comprovação de envio/resultado no CRM; lacunas de conteúdo original seguem explícitas |
| **UX-02 — Especialista** | Painéis progressivos: papel/método, mandatos/limites, continuidade AC-02 e documentos AC-01. Painéis visitados preservam minutas durante alternância dentro do módulo | [#857](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/857), merge d490f3b2f278dec04c6c456a3fba01feea7c9ccf; M3 build SUCCESS | Especialista textual declarado no M3 não prova competência/mandato; troca de módulo segue controles de rascunho existentes, sem armazenamento entre sessões |
| **UX-03 — Ciclo AC-01** | Oito atalhos conectados às áreas de vinculação de fonte, versões, comparação limitada de metadados, fila, evolução, solicitações, vigência e histórico existentes; aba de governança selecionada sem mutação | [#858](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/858), merge 3575553d616f869f6bb158d37ca2d1cc4c0cc321; M3 e AC-01 SUCCESS | Comparação de **metadados** não equivale a diff completo do original; decisões/publicação, revogação, vigência canônica continuam sob portões; não foram abertas capacidades decisórias |
| **UX-04 — Registro Mestre e assunção AC-02** | Consulta protegida da identidade oficial com proveniência e observações técnicas; visualização dos cinco estados de assunção com somente rascunho **PREPARADO**, os demais **não comprovados** | Núcleo técnico [#852](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/852); UX [#859](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/859), merge a8e19bc3dadef50567a5def2c9892e82f8e96dac; M3 e AC-01 SUCCESS | Não existe writer ou comprovante de DISPONIBILIZADO, ENTREGUE, RECEBIDO ou ACEITO na UX. Copiar rascunho não equivale a entrega. Identidade documental oficial não certifica status de deploy |
| **UX-05 — Transversal para demais módulos** | Reutilização proporcional de telas, controles e roteiros para módulos com registros de fonte. Botão sem conteúdo fica desabilitado, exibindo cobertura **não verificada** | [#861](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/861), merge acb402a97dc3d5ea511a9efcd2e59e833f955ca4; M3 build SUCCESS | Cobertura parcial de fontes por módulo; não criar manual, link profundo ou estado de homologação inexistentes. [#860](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/860) encerrada **SEM MERGE** por substituição e reconciliação |
| **UX-06 — Continuidade visual e acessibilidade** | Trilha curta de localização do módulo, foco acessível após seleção, barra das jornadas com valores acessíveis de **posição de leitura** e contexto preservado | [#862](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/862), merge d9f03902dcaae62c0115384202fbeacdc202d8be; M3 frontend/RLS SUCCESS | Sem homologação autenticada por operador; não declarar conformidade WCAG integral nem conclusão real de tarefa pela barra de leitura |

### 13.2 Condições, segurança e patrimônio preservado

- A UX-01–06 **foi implementada e verificada tecnicamente no alcance das PRs acima**. Não equivale a concluir integralmente toda a Entrega A+ funcional ou a qualidade visual em uso real. A funcionalidade depende de contrato e cobertura real do Especialista Núcleo; não duplicar sua persistência, identidade, arquitetura, RPCs ou fontes.
- **Contrato funcional único:** Core Supabase Cloud do Painel Central, catálogo/Atlas do Núcleo, FM, AC-01 e AC-02 existentes. Nenhum cadastro duplicado de módulo/especialista, nova Biblioteca, novo writer, migration de autoridade, concessão de acesso, ativação de publicação ou alteração CA-01–CA-29 foi introduzido por estas PRs UX.
- **Cinco estados AC-02:** PREPARADO é rascunho **não homologado** gerado em consulta autenticada, não status global de entrega; DISPONIBILIZADO/ENTREGUE/RECEBIDO/ACEITO **não comprovados** pelo endpoint atual. Qualquer futura persistência desses fatos deve ser entregue/validada pelo Especialista Núcleo sob autoridade e fonte próprias.
- **AC-01:** receber/revisar metadados sem original completo não é confronto documental integral; 'publicado internamente' não prova sincronização externa canônica. Diferenças, atos decisórios e mandatos conservam autorias, fontes e restrições de acesso.
- **Roteiros de uso:** código e inventário fornecem localização e condições **indicativas**, não teste real no WhatsApp/financeiro/operações; novas instruções detalhadas exigem fontes verificáveis e contratos funcionais, sem preenchimento artificial.
- **Prova técnica:** verificações automatizadas em GitHub Actions não substituem UAT, acessibilidade auditada ou conferência de deploy produtivo em cada módulo.

### 13.3 Continuidade objetiva

1. **UX humano/operador pendente por decisão do proprietário:** quando autorizado, verificar sequência de acesso CRM e outros módulos, 1366px, 1024px, 768px, 390px e 320px, teclado, foco, contraste, rascunhos, mudança de módulo, fonte e estados de erro. Não declarar aceite antecipadamente.
2. **Contrato/dado pendente de responsabilidade do Especialista Núcleo:** só quando houver fonte/autoridade, enriquecer finalidades, controles, métodos e conteúdo operacional ausentes; integrar rastreio comprovado de assunção AC-02, se autorizado. Não criar writer no UX.
3. **Integração documental:** manter este mesmo mapa e os contratos originais como norte. Diferenciar fonte declarada, observada e autenticada; não inventar vigência, percentual global ou procedimento prático. Próxima mudança estrutural exige achado de uso real ou determinação da Camada Mestre.

**Status deste adendo:** implementação **UX-01 a UX-06 integrada e documentada**; **homologação visual, cobertura funcional integral A+ e estados reais de transmissão/recebimento AC-02 não concluídos**.
