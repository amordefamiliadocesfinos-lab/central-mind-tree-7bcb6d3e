# CCH — PROPOSTA DE NOVA FRENTE · EXPERIÊNCIA GUIADA DO TREINO · V0.1
**Data:** 23/11/2026 · **Status:** PROPOSTA PARA APROVAÇÃO DA CAMADA MESTRE; NÃO FROZEN; NÃO AUTORIZA IMPLEMENTAÇÃO/PRODUÇÃO.
**Projeto:** Painel Central / Saúde CCH · **Referência:** Issue #966.
**Autoridade superior intocada:** `CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v5_4_FROZEN.md` e `CCH_MAPA_EVOLUCAO_MOTOR_V1_0_FROZEN_2026-11-18.md`.
**Codinome proposto:** F24 — Experiência Guiada de Execução e Orientação Contextual. *Número sujeito à reserva/validação da Camada Mestre; F23 permanece fechada.*

## 1. Motivação e regra de governança
Transformar a execução real em uma experiência **uma tela / uma próxima ação**, com demonstração do movimento, séries extras intencionais, referência sutil ao histórico e sugestões úteis, opcionais e fundamentadas na literatura. Não construir motor, fila, catálogo de exercícios ou mecanismo de publicação paralelos.
Esta proposta **não modifica** os mapas FROZEN; expansão de escopo e eventual numeração exigem decisão explícita da Camada Mestre. Sem implantação, sem alteração de atletas, sem coleta de sintomas E5, sem prescrição automática e sem migração produtiva por inferência.

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
- Faixa superior: nome + contador `série atual / séries planejadas`; pequena miniatura de movimento e botão discreto “Ver execução”.
- Área de referência de baixo contraste: **Última vez: 80 kg × 8 · RIR 2** *(exemplo, NÃO dado real)* com data, unidade e aviso quando a máquina não é a mesma ou não está identificada. Não sobrepor numericamente à carga atual; não usar efeito visual que prejudique leitura.
- Centro: cronômetro de execução ou descanso, campos carga/reps/RIR quando necessários, **um botão primário por estado**: Iniciar → Concluir/Salvar → Descansar/Próxima série → Próximo exercício. Durante descanso, aviso não intrusivo e opção de prolongar.
- Quando atingir o prescrito (ex.: 3/3): **Próximo exercício** primário e **+ Série extra** secundário visível, nunca automática; registrar 4/3 como executado sem mudar 3 do plano. Exibir opção de retirar/editar apenas conforme contratos M4/F21 existentes.
- Menu recolhido “Mais”: substituir/pular, equipamento, consultar histórico, detalhes de técnica, outras ações. Acessibilidade por textos, tamanho de alvo mínimo de 44 px, não apenas cor, teclado e leitores de tela.
- “Uma tela” significa **um foco e fluxo contínuo sem navegação obrigatória**, não obrigação de todos os controles caberem simultaneamente em qualquer resolução. Priorizar área visível e ações essenciais.

## 4. Blocos de entrega propostos e aceite
### P0 — Contrato UX e baseline (sem escrita)
- Inventariar estados F19: pronto, série ativa, descanso, alvo atingido, extra, pausa, erro, offline/retorno, treino encerrado.
- Formalizar transições e a única autoridade do timer. Evitar duplo botão “registrar” e “concluir” causando duas séries.
- **Aceite:** protótipo lógico e testes de fluxo nos estados; sem alteração de sessões reais.

### P1 — Séries extras e fechamento flexível (M4/F19)
- Implementar `+ Série extra` após alvo alcançado, tanto em cronômetro quanto em percurso sem cronômetro; persistir pela RPC M4 já existente.
- `planned_sets_min/max` são referência da versão publicada, não teto para execução. Guardar `planned vs performed`, motivo opcional e distinguir série extra de edição histórica.
- Casos de teste: 3→4, 3→5, interrupção, retomar, duplo toque/evento idempotente, corrida de duas abas, limite de 100 do schema, edição e resultado F21.
- **Aceite:** quarta série aparece na sessão e no histórico após recarga; plano M3 original permanece 3; sem duplicação de eventos.

### P2 — Histórico discreto da execução anterior (F21)
- Buscar último registro válido do **mesmo exercício e atleta**, distinguindo sessão concluída, versão, equipamento, unidade, tipo de série e possível alteração de máquina; sem comparar números quando origem incompatível.
- Rótulos: “Última vez”, “Máquina não confirmada”, “Sem referência comparável”. Nunca autopreencher carga perigosa nem converter exercícios diferentes.
- **Aceite:** referência correta e estável em troca de exercício/atleta, falha fechada para ausência/erro, sem divulgação cruzada, limite de leitura e sem modificar dados.

### P3 — Mídia e guia didático de exercício (M2 + F19)
- Imagem de identificação do aparelho/exercício; GIF curto ou clipe silencioso em loop para padrão de movimento, com foto estática alternativa. Preferir MP4/WebM compacto quando melhor que GIF; GIF opcional.
- Relação com ID do exercício e variante/equipamento; metadados: `media_kind`, `exercise_id`, `equipment_variant`, `locale`, `source/license`, versão, descrição, texto alternativo e status de revisão. **Schema/storage só depois de proposta de RLS, autorização e orçamento.**
- Nada de upload aberto/execução de conteúdo externo sem validação; limites de arquivo, MIME, duração, tamanho, direitos autorais, autoria, moderação e cache.
- Botão “Ver movimento” com prévia compacta; reprodução sob demanda (sem autoplay disruptivo), loop opcional, modo silencioso, sem vídeo bloquear registro.
- Conteúdo de técnica contextual e cauteloso: ajustes genéricos, amplitude, controle, erros comuns, diferenças de máquinas; não apresentar demonstração como exame biomecânico pessoal.
- **Aceite:** mídia correta por ID e equipamento, fallback quando não houver, sem queda de desempenho ou exposição entre atletas.

### P4 — Sequência compacta e usabilidade (F19)
- Reduzir ações primárias simultâneas; preservar menu para casos raros. Setas permitem navegar sem finalizar automaticamente sessão/exercício.
- Estados claros “agora”, “descanso”, “próxima”, “extra”. Desfazer com auditabilidade; manter treino congelado no contexto de execução enquanto o atleta está treinando, sem quebrar segurança/navegação.
- **Aceite:** cenário completo com uma mão, 320–430 px, acessibilidade, retomada de sessão, cronômetros persistentes e histórico, sem regressão F19.

### P5 — Guia consultivo inteligente, contextual e didático (E2/E3/F13/F14/F21)
- Entrada: objetivo atual escolhido; nível real do praticante; programa publicado; exercício/variante/equipamento; histórico com qualidade e proveniência; recuperação apenas se **disponível e autorizada**; preferências do atleta.
- Saída: até **uma sugestão curta e pertinente por momento**, com “Por quê?”, confiança, limitações e opções “Aplicar como rascunho”, “Ignorar”, “Ver depois”. Não insistir após recusa; regras por estado e cooldown de interface **não clínico**.
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
- **G0 (agora):** aprovação do escopo e nome da frente; revisão da proposta com Camada Mestre, sem alterar congelados.
- **G1:** P0 e P1; correção de série extra e fluxo essencial, reutilizando backend; PR mínima com CI.
- **G2:** P2 e P4; histórico sutil e simplificação da tela, sem dados sensíveis novos.
- **G3:** P3; contrato documental de mídia, direitos, Storage e RLS antes de implementar persistência.
- **G4:** P5 e P6; motor consultivo com evidência e gates de E2/E3, sem ativar E5 ou F23.
- **G5:** homologação autenticada de uso real (quando autorizada), com fingerprint de revisão servida.

## 9. Questões para fechamento com o proprietário
1. Mídias de domínio próprio, licenciadas ou ambos? Preferência por clipes curtos sem som e imagem de capa.
2. Modo padrão: miniatura de aparelho sempre visível ou apenas ícone “Ver movimento” para economizar espaço?
3. Ao concluir a série planejada, o foco padrão é “Próximo exercício”, com “+ Série extra” secundário, ou o atleta prefere escolha equilibrada?
4. Histórico discreto: melhor última sessão **do mesmo exercício+equipamento** ou última execução com aviso explícito de máquina diferente? Sugestão: primeiro comparável, com fallback rotulado.
5. Sugestões durante execução: ativadas por padrão, com opção silenciosa? Sugestão: mínimo e silenciável.

## 10. Definição de pronto da proposta
Este arquivo é **proposta**, não mapa congelado, migração, aprovação de F24, liberação de IA ou autorização produtiva. Após decisão explícita da Camada Mestre, publicar versão aprovada e decompor em PRs pequenos conforme os gates. Issue #966 permanece a linha de continuidade até eventual decisão de vincular outra issue.
