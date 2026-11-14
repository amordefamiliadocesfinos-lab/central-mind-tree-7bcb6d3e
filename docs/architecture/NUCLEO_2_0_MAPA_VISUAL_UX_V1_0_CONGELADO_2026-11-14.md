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
