# CCH — PROPOSTA DE NOVA FRENTE · EXPERIÊNCIA GUIADA DO TREINO · V0.2
**Data:** 23/11/2026 · **Revisão:** V0.2, preferências funcionais aprovadas pelo proprietário · **Status:** ESCOPO F24 APROVADO PELA CAMADA MESTRE EM 23/11/2026; V0.2 NÃO FROZEN; ENGENHARIA G1/G2 EM BRANCH AUTORIZADA; SEM AUTORIZAÇÃO DE MERGE/DEPLOY TÉCNICO.
**Projeto:** Painel Central / Saúde CCH · **Referência:** Issue #966.
**Autoridade superior intocada:** `CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v5_4_FROZEN.md` e `CCH_MAPA_EVOLUCAO_MOTOR_V1_0_FROZEN_2026-11-18.md`.
**Frente oficialmente aberta:** F24 — Experiência Guiada de Execução e Orientação Contextual. *Identificador reservado por decisão expressa da Camada Mestre em 23/11/2026; F23 permanece fechada.*

## 0. Decisões do proprietário — incorporadas à proposta em 23/11/2026
As cinco preferências abaixo foram aprovadas **para refinamento documental**. Esta aprovação não autoriza merge, implantação, schema, Storage, alterações de dados ou ativação de funcionalidades.

| ID | Decisão aprovada | Regra vinculante desta proposta |
|---|---|---|
| D1 | Somente ícone para abrir visualização | Nenhuma foto/miniatura permanente no cartão de execução. Botão de ícone acessível **“Ver movimento”** abre preview sob demanda; fechado por padrão. |
| D2 | Duas opções com igual destaque | Ao completar as séries prescritas, **“Próximo exercício”** e **“+ Série extra”** têm hierarquia visual e alvos de toque equivalentes, sem escolha automática. |
| D3 | Histórico prioritariamente no mesmo aparelho | Mostrar última execução válida do mesmo exercício **e aparelho confirmado**, com data/unidade; fallback rotulado se aparelho diferente ou não verificável. Ausência de comparabilidade proíbe sugestão numérica baseada nesse histórico. |
| D4 | Dicas curtas, ocasionais e silenciáveis | No máximo uma sugestão por momento contextual; opção “Silenciar dicas” acessível, persistência de preferência sujeita ao contrato autorizado; não insistir ao descartar. |
| D5 | Imagem + vídeo curto/GIF sem som | Media viewer sob demanda com foto estática e demonstração curta **silenciosa** (vídeo MP4/WebM ou GIF), fallback acessível; não iniciar mídia automaticamente. |

**Critério transversal:** quando o atleta escolher “+ Série extra”, o sistema permanece no mesmo exercício, registra o fato M4 e somente depois oferece nova escolha de continuação; quando escolher “Próximo exercício”, não cria série extra. Em ambos os casos a versão publicada M3 fica intacta.

## 1. Motivação e regra de governança
Transformar a execução real em uma experiência **uma tela / uma próxima ação**, com demonstração do movimento, séries extras intencionais, referência sutil ao histórico e sugestões úteis, opcionais e fundamentadas na literatura. Não construir motor, fila, catálogo de exercícios ou mecanismo de publicação paralelos.
Esta proposta **não modifica** os mapas FROZEN. A Camada Mestre aprovou a abertura e a numeração F24, com engenharia P0/P1/P2/P4 em branches e PRs pequenas, **sem merge ou deploy técnicos autorizados** por essa deliberação. Sem implantação, sem alteração de atletas, sem coleta de sintomas E5, sem prescrição automática e sem migração produtiva por inferência.

## 2. Inventário de reutilização confirmado por leitura de código
| Patrimônio atual | Observação | Uso proposto |
|---|---|---|
| `HealthWorkoutPage.tsx` | Card de registro de série e edição durante sessão já existem; mais de uma superfície de controle | Consolidar no F19, evitar dois caminhos principais redundantes |
| `HealthWorkoutInteractiveTimerF19.tsx` + `F19_INTERACTIVE_WORKOUT_TIMERS_UI_SPEC_V1.md` | Já controla foco no exercício, execução/descanso e troca com setas; ao alcançar alvo planejado oferece próximo exercício | Manter autoridade do timer e acrescentar escolha explícita “+ Série extra” |
| `useHealthWorkoutM4.ts`, `health_m4_log_set` | Calcula próximo `set_number` pela execução; RPC não restringe à quantidade planejada, mas há limite de schema `set_number <= 100` | Não criar RPC de série extra; ajustar UX e validar caso-limite sem prometer infinitas séries |
| `useHealthTrainingHistoryF21.ts` | Histórico real de exercício, séries, cargas, reps, RIR e unidade já disponível em leitura | Adaptador de última sessão válida, sem escrever ou inferir máquina |
| `useHealthCatalogs.ts` | Catálogo `health_exercises`, equipamentos, músculos e equivalências | Relacionar mídia/guia ao exercício existente; não criar catálogo duplicado |
| `E2/E3/M3/M4/F21/F22` | Objetivo, plano, observações, histórico, revisão e publicação manual | Orientações consultivas, nunca alterar programa por sugestão |

## 3. Experiência-alvo — única superfície priorizada
- Tela mobile 320–430 px; foco permanente no **exercício em execução**, com barra compacta para sessão, tempo e pausa.
- Faixa superior: nome + contador `série atual / séries planejadas`; ícone acessível “Ver movimento” que abre mídia sob demanda; nenhuma miniatura ou imagem é exibida permanentemente na área principal.
- Área de referência discreta, sempre legível: **Última vez no mesmo aparelho: 80 kg × 8 · RIR 2** *(exemplo, NÃO dado real)* com data e unidade. Se aparelho atual divergir ou não puder ser confirmado, identificar expressamente a diferença e não tratar a carga como comparável. Não sobrepor numericamente à carga atual; não usar efeito visual que prejudique leitura.
- Centro: cronômetro de execução ou descanso, campos carga/reps/RIR quando necessários, **uma próxima ação principal por estado**, com uma exceção explícita ao concluir a quantidade planejada: **Próximo exercício** e **+ Série extra** aparecem lado a lado, equivalentes. Fluxo padrão: Iniciar → Concluir/Salvar → Descansar/Próxima série → Escolha explícita ao atingir a meta. Durante descanso, aviso não intrusivo e opção de prolongar.
- Quando atingir o prescrito (ex.: 3/3): **Próximo exercício** e **+ Série extra** com igual destaque visual, ambos com alvo acessível, sem seleção automática; registrar 4/3 como executado sem mudar 3 do plano. Exibir opção de retirar/editar apenas conforme contratos M4/F21 existentes.
- Menu recolhido “Mais”: substituir/pular, equipamento, consultar histórico, detalhes de técnica, outras ações. Acessibilidade por textos, tamanho de alvo mínimo de 44 px, não apenas cor, teclado e leitores de tela.
- “Uma tela” significa **um foco e fluxo contínuo sem navegação obrigatória**, não obrigação de todos os controles caberem simultaneamente em qualquer resolução. Priorizar área visível e ações essenciais.

## 4. Blocos de entrega propostos e aceite
### P0 — Contrato UX e baseline (sem escrita)
- Inventariar estados F19: pronto, série ativa, descanso, alvo atingido, extra, pausa, erro, offline/retorno, treino encerrado.
- Formalizar transições e a única autoridade do timer. Evitar duplo botão “registrar” e “concluir” causando duas séries.
- **Aceite:** protótipo lógico e testes de fluxo nos estados; sem alteração de sessões reais.

### P1 — Séries extras e fechamento flexível (M4/F19)
- Implementar escolha de mesmo destaque entre `Próximo exercício` e `+ Série extra` após alvo alcançado, tanto em cronômetro quanto em percurso sem cronômetro; persistir pela RPC M4 já existente. A escolha nunca pode ser executada por default nem quando o atleta apenas descansa.
- `planned_sets_min/max` são referência da versão publicada, não teto para execução. Guardar `planned vs performed`, motivo opcional e distinguir série extra de edição histórica.
- Casos de teste: 3→4, 3→5, interrupção, retomar, duplo toque/evento idempotente, corrida de duas abas, limite de 100 do schema, edição e resultado F21.
- **Aceite:** em 3/3, as duas opções têm igual tamanho/prominência e são navegáveis por teclado/leitor de tela; selecionar série extra continua em 4/3 sem trocar de exercício; selecionar próximo exercício não registra série extra; quarta série aparece no histórico após recarga; plano M3 original permanece 3; sem duplicação de eventos.

### P2 — Histórico discreto da execução anterior (F21)
- Buscar prioritariamente o último registro válido do **mesmo exercício, atleta e aparelho comprovado**, distinguindo sessão concluída, versão, unidade e tipo de série. Se não houver identidade de aparelho comprovada, permitir somente fallback rotulado (“aparelho diferente” / “não identificado”), sem equivalência numérica inferida, sugestão de incremento ou autopreenchimento.
- Rótulos: “Última vez”, “Máquina não confirmada”, “Sem referência comparável”. Nunca autopreencher carga perigosa nem converter exercícios diferentes.
- **Aceite:** referência correta e estável em troca de exercício/atleta, preferência comprovável pela mesma máquina, aviso explícito para fallback e nenhuma carga sugerida em caso de divergência; falha fechada para ausência/erro, sem divulgação cruzada, limite de leitura e sem modificar dados.

### P3 — Mídia e guia didático de exercício (M2 + F19)
- Imagem de identificação do aparelho/exercício; GIF curto ou clipe silencioso em loop para padrão de movimento, com foto estática alternativa. Preferir MP4/WebM compacto quando melhor que GIF; GIF opcional.
- Relação com ID do exercício e variante/equipamento; metadados: `media_kind`, `exercise_id`, `equipment_variant`, `locale`, `source/license`, versão, descrição, texto alternativo e status de revisão. **Schema/storage só depois de proposta de RLS, autorização e orçamento.**
- Nada de upload aberto/execução de conteúdo externo sem validação; limites de arquivo, MIME, duração, tamanho, direitos autorais, autoria, moderação e cache.
- **Somente ícone** de acionamento “Ver movimento” (com rótulo acessível, tooltip e foco de teclado) na execução. Ao tocar, abrir preview compacto com imagem e vídeo curto/GIF sem som. Reprodução e loop sob demanda, sem autoplay; fechar/restaurar foco não interrompe cronômetro e a falta de mídia não bloqueia registro.
- Conteúdo de técnica contextual e cauteloso: ajustes genéricos, amplitude, controle, erros comuns, diferenças de máquinas; não apresentar demonstração como exame biomecânico pessoal.
- **Aceite:** sem miniatura permanente; ícone abre e fecha preview; imagem estática e clipe/GIF silencioso disponíveis por ID e equipamento, fallback quando não houver, descrição textual acessível, sem autoplay, sem queda de desempenho ou exposição entre atletas.

### P4 — Sequência compacta e usabilidade (F19)
- Reduzir ações primárias simultâneas; **exceção ao final das séries planejadas: duas opções equivalentes e sem padrão pré-selecionado**, nunca ocultar série extra em menu secundário. Preservar menu para casos raros. Setas permitem navegar sem finalizar automaticamente sessão/exercício.
- Estados claros “agora”, “descanso”, “próxima”, “extra”. Desfazer com auditabilidade; manter treino congelado no contexto de execução enquanto o atleta está treinando, sem quebrar segurança/navegação.
- **Aceite:** cenário completo com uma mão, 320–430 px, incluindo comparação de destaque/tamanho das duas ações em 3/3; acessibilidade, retomada de sessão, cronômetros persistentes e histórico, sem regressão F19.

### P5 — Guia consultivo inteligente, contextual e didático (E2/E3/F13/F14/F21)
- Entrada: objetivo atual escolhido; nível real do praticante; programa publicado; exercício/variante/equipamento; histórico com qualidade e proveniência; recuperação apenas se **disponível e autorizada**; preferências do atleta.
- Saída: até **uma sugestão curta, ocasional e pertinente por momento**, com “Por quê?”, confiança, limitações e opções “Aplicar como rascunho”, “Ignorar”, “Ver depois” e **“Silenciar dicas”** acessível. Não insistir após recusa nem ao silenciar; regras por estado e cooldown de interface **não clínico**. Mudança de preferência apenas em contrato autorizado, sem presumir telemetria sensível.
- Exemplos: “Força: considerar faixa menor de reps com carga apropriada e mais descanso, caso a técnica e o histórico sustentem”; “A última sessão teve redução de repetições; manter a carga é uma alternativa”; “Experimente outra variação equivalente se o aparelho estiver indisponível”.
- Sugestões de progressão em kg somente com equipamento/id de máquina, incremento confirmado e observações comparáveis; sem isso mostrar escolhas qualitativas. Respeitar resposta a sinais adversos e revisão humana.
- E2 prepara proposta explicada e **draft** editável; M3/F22 publicação somente por ato humano. Durante M4, atleta decide fazer série/reps/carga, ficando a execução registrada, sem reescrever plano.

### P6 — Revisão periódica e periodização orientada por objetivo (E2/E3)
- Checkpoints por dados suficientes/contexto ou pedido do atleta, não dias fixos e nem número universal de sessões.
- Revisões opcionais por microciclos/quinzenas quando fizer sentido, com alternativas de força, hipertrofia, técnica, manutenção ou recuperação; comparar *proposto* × *realizado* sem presumir causalidade.
- Sem calendário rígido, restrição artificial a atleta avançado, auto-progressão ou autopublicação; F23 e E5 real não abertos.
- **Aceite:** múltiplas opções justificadas, histórico/auditoria, dados ausentes rotulados, nenhuma mudança sem ação humana.

## 5. Estratégia científica (fontes para critérios, não receita única)
- ACSM 2026, Position Stand: https://pubmed.ncbi.nlm.nih.gov/41843416/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/ .
- Revisão e network meta-analysis 2023: https://pubmed.ncbi.nlm.nih.gov/37414459/ .
- Revisão de proximidade da falha/RIR 2024: https://pubmed.ncbi.nlm.nih.gov/38970765/ .
- Revisão de intervalos de descanso 2024: https://pmc.ncbi.nlm.nih.gov/articles/PMC11349676/ .
- Técnica e amplitude: https://pubmed.ncbi.nlm.nih.gov/38249086/ .
**Tradução para produto:** para força máxima, oferecer preferencialmente opções com cargas relativas mais altas e trabalho específico, sem converter percentual de 1RM em kg sem teste/estimativa válida; para hipertrofia, admitir ampla gama de cargas/repetições quando esforço, volume e técnica forem adequados, sem “melhor exercício universal”. Descanso é individualizado e pode ser prolongado para preservar qualidade, sobretudo em séries pesadas. Técnicas (amplitude, trajetória, cadência) são específicas ao exercício, corpo e equipamento, e evidências heterogêneas devem ser rotuladas; não diagnosticar ou impor forma única.
**Hierarquia:** diretriz / revisão sistemática > estudo individual > consenso > hipótese; registrar ano, população (iniciantes vs treinados), qualidade, aplicabilidade, limites e atualização. A IA deve **distinguir evidência de inferência**, e ensinar sem insistência.

## 6. Modelo conceitual de decisão (somente proposta; reusar motor atual)
`CONTEXTO AUTORIZADO → CHECAGEM DE ORIGEM/COMPARABILIDADE → OBJETIVO E HISTÓRICO → OPÇÕES + MOTIVO + CONFIANÇA → ESCOLHA DO ATLETA → (a) FATO M4 ou (b) DRAFT E2 → PUBLICAÇÃO HUMANA M3/F22`.
Prioridades: integridade e segurança > vontade do atleta e objetivo > evidência relevante > simplicidade visual > personalização crescente.
Níveis de intervenção: **informativo** (dica), **sugestão** (opção), **proposta de alteração** (draft auditável). Nunca usar “recomendação” como permissão implícita para agir.

## 7. Regras de não-regressão e gates
1. Atletas avançados continuam advanced; confiança baixa não vira beginner.
2. Nenhum dado real de Deividi/Rafaela é escrito em teste; usar dados sintéticos/ambiente descartável.
3. Versões publicadas e histórico append-only preservados; M4 registra realidade diferente do plano.
4. Autonomia operacional de baixo risco não autoriza automaticamente novo schema, Storage/RLS, consentimento, dados sensíveis ou ativação E5.
5. Prova separada: planejado, código, CI, merge, implantação, homologação autenticada e eficácia individual.
6. Homologação visual pendente por decisão anterior **não bloqueia planejamento nem testes puros**, mas nova jornada UX precisa de homologação quando for liberada.
7. Colaboração interespecialidades: Saúde (prescrição e ciência), UX/Produto (fluxo), Infra/Segurança (mídia e RLS), Camada Mestre (aprovação de escopo).
8. Se a reserva F24 conflitar com nomenclatura existente, escolher identificador aprovado sem renumerar retrospectivamente F23 ou mapas FROZEN.

## 8. Sequência sugerida e portões
- **G0 CONCLUÍDO (23/11):** cinco preferências D1–D5 ratificadas, F24 e escopo P0–P6 aprovados pela Camada Mestre. G1/G2 autorizam engenharia e testes em branch, NÃO merge/deploy técnico. Mapas FROZEN intactos.
- **G1 AUTORIZADO para engenharia:** P0 e P1; correção de série extra e fluxo essencial, reutilizando backend; PR mínima com CI, revisão e **portão de merge posterior**.
- **G2 AUTORIZADO para engenharia:** P2 e P4; histórico sutil e simplificação da tela, sem dados sensíveis novos; revisão e portão de merge posterior.
- **G3 SOMENTE desenho/protótipo:** P3; contrato documental de mídia, direitos, Storage e RLS. Sem bucket, upload ou migração antes de aprovação independente.
- **G4 SOMENTE especificação:** P5 e P6; motor consultivo com evidência e gates de E2/E3, sem ativar E5, autopublicação ou F23.
- **G5 CONDICIONADO:** homologação autenticada de uso real e acessibilidade, com fingerprint de revisão servida, antes de qualquer liberação aos atletas.

## 9. Decisões encerradas e pendências de aprovação
**Encerradas pelo proprietário na revisão V0.2:** D1 ícone de mídia sob demanda; D2 duas escolhas equivalentes ao completar séries; D3 histórico preferencial do mesmo aparelho com avisos; D4 dicas curtas e silenciáveis; D5 imagem + vídeo/GIF silencioso.

**Já aprovado pela Camada Mestre:** abertura da F24, número e escopo conceitual P0–P6; engenharia em branch apenas para P0/P1/P2/P4. **Ainda sujeito a decisão específica:** merge/deploy técnico; direitos/licenciamento e proveniência das mídias; orçamento/arquitetura de Storage, RLS e governança de uploads; acesso e retenção de preferências; priorização de PRs, implantação e homologação de uso real. A especificação não presume que qualquer um desses portões esteja aberto.

## 10. Definição de pronto da proposta
Este arquivo é a **proposta V0.2 com escopo F24 aprovado e gates limitados pela Camada Mestre**. Não é mapa soberano congelado, migração, liberação de IA ou autorização produtiva. A engenharia G1/G2 pode ocorrer em branches e PRs pequenas, com revisão e CI; **integração/deploy técnico necessitam autorização posterior**. Issue #966 permanece a linha de continuidade até eventual decisão de vincular outra issue.

## 11. Changelog da proposta
- **V0.1 (23/11/2026):** inventário e proposta inicial P0–P6.
- **V0.2 (23/11/2026):** incorporadas cinco decisões expressas do proprietário; corrigida hierarquia da ação de série extra, removida miniatura persistente, reforçada equivalência de aparelho, silêncio das dicas e mídia somente sob demanda. Mantidos escopo proposto e portões.

- **Deliberação Camada Mestre (23/11/2026):** F24 oficialmente aberta, D1–D5 ratificadas, G1/G2 em branch autorizados, G3 somente protótipo e G4 somente especificação, G5 homologação obrigatória antes de uso real. Fonte: comentários oficiais da PR #1022 e Issue #966. Não autorizou merge/deploy técnico.
