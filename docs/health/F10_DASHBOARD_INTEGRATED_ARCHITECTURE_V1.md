# F10 — DASHBOARD INTEGRADO — ARQUITETURA v1

**Data:** 07/11/2026
**Status:** ARQUITETURA DOCUMENTAL — IMPLEMENTAÇÃO NÃO INICIADA
**Mapa soberano:** CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v3_FROZEN.md
**Base:** main@b6b50fc7a72c4e4e911153e8dd7f3aab0b5fc333

---

## 1. Missão

Evoluir /saude/hoje para o Dashboard Integrado do CCH, consolidando leitura e estado dos domínios já homologados M0→M9.

F10 é uma camada de projeção e síntese.

F10:
- lê verdades existentes;
- organiza o estado atual;
- evidencia cobertura, confiança, data e ausência de dados;
- oferece navegação para o especialista correto.

F10 não:
- cria nova verdade clínica;
- cria score global;
- calcula novo motor de decisão;
- diagnostica;
- altera treino;
- altera alimentação;
- altera plano;
- interpreta causalidade;
- executa ações automáticas.

## 2. Fronteira arquitetural

Cada especialista continua soberano sobre seu próprio domínio.

O Dashboard não possui tabela factual própria na v1.

Domínios:
- Treino: M3/M4;
- Alimentação: M5/M6;
- Decisão nutricional existente: M7;
- Físico: M8;
- Sono/Recuperação: M9A;
- Exames/Biomarcadores: M9B;
- Identidade/Perfil: M0/M1.

Regra principal:

**Dashboard != motor.**

F10 pode mostrar que uma decisão M7 já existe, mas não cria, reavalia ou expande essa decisão.

F10 não antecipa F11.

## 3. Persistência v1

A v1 não cria:
- health_dashboard_*;
- snapshot persistido;
- ledger integrado;
- score composto;
- tabela de alertas genéricos.

O carregamento de /saude/hoje não executa:
- refresh de estado;
- avaliação de decisão;
- escrita factual;
- mutation RPC.

Implementação futura prevista:
useHealthDashboardF10(athleteId)

Esse hook realizará SELECTs mínimos, paralelos e filtrados por athlete_id.

Se medição real demonstrar problema de performance, uma read-model RPC poderá ser proposta em alteração técnica específica, sem transformar o Dashboard em fonte de verdade.

## 4. Modelo conceitual

Cada bloco de domínio retorna:
- domain;
- availability;
- freshness;
- confidence quando a fonte possuir;
- coverage quando a fonte possuir;
- as_of;
- reason_codes quando existentes;
- indicadores já calculados pelo especialista;
- CTA para a rota soberana.

availability:
- available: há dado exibível;
- unknown: não há dado suficiente/observado;
- error: a fonte falhou;
- not_applicable: estado não se aplica ao contexto atual.

freshness:
- today: estado é da data local atual;
- historical: existe último estado anterior explicitamente datado;
- not_applicable: fonte não é diária.

Não criar limiar arbitrário de stale na v1.

## 5. Blocos v1

### 5.1 Treino — Agora / Próximo

Fontes:
- health_workout_sessions;
- health_cch_queue_entries;
- health_session_templates.

Mostrar, quando existir:
- sessão ativa/pausada;
- horário de início;
- template/sessão atual;
- próximo item da fila;
- posição/estado da fila;
- CTA /saude/treino.

Não mostrar:
- score de performance;
- prontidão calculada pelo Dashboard;
- recomendação de carga;
- decisão de trocar treino.

Se não houver sessão nem fila:
“Nenhum treino ativo ou programado.”

### 5.2 Alimentação — Hoje

Fonte diária:
health_nutrition_daily_states.

Fonte longitudinal:
health_nutrition_rolling_states, janela 7 dias.

Decisão existente:
health_nutrition_decisions, janela 7 dias e record_status=current.

Mostrar:
- refeições observadas;
- itens observados;
- energia consumida somente se calculada;
- proteína consumida somente se calculada;
- completeness/state status;
- coverage/confidence 7 dias;
- status da decisão M7, quando já existir;
- reason codes resumidos;
- CTA /saude/alimentacao.

Regras:
- não executar health_m6_refresh_*;
- não executar health_m7_evaluate_nutrition_decision;
- paused permanece pausado;
- ausência de decisão = “Ainda não avaliado”, nunca “manter”.

### 5.3 Evolução corporal

Fonte:
health_body_rolling_states.

Janela principal:
7 dias.

Pode mostrar:
- último peso, se disponível;
- mudança/tendência já calculada, se disponível;
- cintura, se disponível;
- body fat, se disponível;
- quantidade de protocolos fotográficos;
- coverage;
- confidence;
- reason codes;
- CTA /saude/evolucao.

Não pode:
- classificar corpo;
- estimar gordura por foto;
- recomendar calorias;
- usar peso isolado como decisão.

### 5.4 Sono e recuperação

Fonte:
health_sleep_recovery_rolling_states.

Janela principal:
7 dias.

Mostrar somente valores já produzidos pelo estado M9:
- dias observados por dimensão;
- cobertura por dimensão;
- média de sono, se não nula;
- recuperação média, se não nula;
- fadiga média, se não nula;
- prontidão média, se não nula;
- confidence;
- reason codes;
- CTA /saude/recuperacao.

Não criar:
- readiness score global;
- semáforo de autorização de treino;
- ajuste de treino;
- causalidade sono ↔ performance.

### 5.5 Exames e biomarcadores

Fontes:
- health_lab_reports;
- health_biomarker_longitudinal_states;
- health_vital_observations;
- health_clinical_document_extractions.

Mostrar:
- existência/data do último exame confirmado;
- quantidade de marcadores estruturados no último exame, quando disponível;
- quantidade de estados longitudinais disponíveis;
- data do último sinal fisiológico;
- quantidade de extrações aguardando revisão, quando houver;
- CTA /saude/exames.

Pode exibir:
“1 documento aguardando revisão.”

Não mostrar como síntese automática:
- “exame ruim”;
- “risco”;
- “normal/anormal” inferido pelo Dashboard;
- diagnóstico;
- conduta;
- comparação clínica não produzida pelo especialista.

Não carregar no Dashboard:
- signed URLs;
- binário;
- imagem;
- PDF;
- texto clínico integral.

## 6. Pendências relevantes v1

F10 pode produzir pendências operacionais, não alertas clínicos.

Permitidas:
- treino sem próxima sessão;
- alimentação sem estado observado hoje;
- decisão nutricional pausada por qualidade de dados;
- Body sem observação;
- recuperação sem cobertura;
- documento clínico aguardando revisão.

Cada pendência deve:
- apontar domínio;
- carregar reason code/fonte quando existir;
- levar à rota especialista.

Proibido:
- transformar flag laboratorial em urgência;
- inferir risco médico;
- criar prioridade clínica automática.

## 7. Ausência, erro e parcialidade

Falha de um domínio não derruba o Dashboard inteiro.

Cada cartão possui estado independente.

Empty states:
- “Sem estado nutricional para hoje.”
- “Estado corporal ainda não observado.”
- “Sono/recuperação ainda sem cobertura.”
- “Nenhum exame confirmado.”

Nunca:
- mostrar 0 para dado ausente;
- usar traço como se fosse valor;
- ocultar origem da ausência.

Erro local:
“Não foi possível carregar este domínio.”

Outros cartões continuam disponíveis.

## 8. Tempo e timezone

Estados com as_of_date, state_date ou window_end_date:
- preferir exatamente hoje;
- se houver último histórico, pode ser exibido como “última leitura em DD/MM”;
- histórico nunca é rotulado como “hoje”.

## 9. Segurança

Obrigatório:
- usuário autenticado;
- HealthAccessGuard;
- queries filtradas pelo atleta autorizado;
- RLS como barreira final;
- nenhuma service role no frontend;
- nenhum acesso cross-athlete;
- nenhum documento privado ou signed URL na tela Hoje.

F10 não ganha permissão adicional.

## 10. Performance

Princípios:
- SELECT de campos mínimos;
- limit(1) quando basta último registro;
- queries paralelas;
- nenhuma foto;
- nenhum documento binário;
- nenhuma coleção histórica extensa;
- nenhum select(*) sem necessidade;
- nenhum N+1.

Meta arquitetural:
- até aproximadamente 10 leituras REST pequenas em paralelo na v1;
- otimização posterior somente por medição real.

Uma RPC agregadora futura é permitida apenas como otimização documentada, read-only e sem nova semântica.

## 11. Relação com F11

F10 fornece visibilidade, não decisão integrada.

F11 só poderá usar múltiplos domínios quando tiver contrato próprio, data sufficiency integrada, reason codes, algorithm version, DECISION_PAUSED, regras determinísticas e gates próprios.

Nenhum componente F10 deve embutir lógica escondida do Motor.

## 12. Fora do escopo F10 v1

- score geral de saúde;
- score geral de prontidão;
- recomendação integrada;
- alteração automática de treino;
- alteração automática de dieta;
- diagnóstico;
- triagem clínica automática;
- novo banco de fatos;
- nova fonte soberana;
- notificações automáticas;
- IA gerando decisão;
- correlação causal entre domínios;
- F11/F12/F13.

## 13. Critério de saída arquitetural

A arquitetura F10 pode seguir para implementação somente quando:
1. contrato de leitura estiver congelado;
2. campos por domínio estiverem definidos;
3. estados empty/unknown/error estiverem definidos;
4. UI mobile estiver especificada;
5. segurança/performance estiverem aceitas;
6. PR documental estiver revisada;
7. Gate A documental for explicitamente autorizado.

Até lá, /saude/hoje permanece sem implementação F10.
