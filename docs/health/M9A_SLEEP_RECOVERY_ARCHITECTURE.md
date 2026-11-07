# M9A — SLEEP & RECOVERY ARCHITECTURE

## Status

**ARQUITETURA DOCUMENTAL — NÃO IMPLEMENTADA**

Este documento abre formalmente a frente M9A após o encerramento da M8.

Nenhuma tabela, RPC, migration, deploy ou dado real é criado por este documento.

## Missão

Criar a camada longitudinal de **sono, recuperação, fadiga, sonolência e prontidão percebida** do CCH.

Fronteira oficial:

- M8 = fatos corporais + estado corporal;
- M9A = fatos de sono/recuperação + estado longitudinal de sono/recuperação;
- planejamento/intervenção = camada posterior;
- decisão integrada = camada posterior ao contrato explícito do Motor Integrado CCH.

M9A descreve o que foi observado. Não prescreve mudança de treino, alimentação, medicação ou tratamento.

## Fontes especialistas herdadas

Fonte funcional especializada:
- `04 — SONO E RECUPERAÇÃO`

Princípios preservados:
- sono é componente central, não periférico;
- registrar o que existe sem inventar o que falta;
- tempo na cama != tempo dormindo;
- qualidade percebida != medida objetiva;
- fadiga geral, muscular, mental e sonolência não são equivalentes;
- associação != causalidade;
- dispositivos/wearables são fontes estimadas e devem carregar origem;
- histórico longitudinal é preservado;
- sinais potencialmente relevantes para saúde devem poder ser encaminhados, sem diagnóstico pelo diário.

## Princípios M9A

- `unknown != zero`;
- fato != percepção != estado != hipótese != decisão != ação;
- dado declarado != dado de dispositivo != dado calculado;
- não converter texto qualitativo em escala numérica sem regra explícita;
- não assumir sono contínuo entre horário de deitar e acordar;
- correção não apaga silenciosamente o fato original;
- estado derivado é recalculável e versionado;
- nenhum valor isolado produz recomendação automática;
- nenhuma associação entre sono e outro módulo é tratada como causalidade automática.

## Contrato factual proposto

### 1. health_sleep_periods

Representa um episódio/período de sono ou tentativa de sono.

Deve poder preservar, quando conhecidos:
- atleta;
- instante/local date de referência;
- horário de deitar;
- horário estimado de início do sono;
- horário de despertar final;
- horário de levantar;
- duração declarada do sono;
- tempo na cama calculável;
- duração de sono calculável somente quando a evidência permitir;
- quantidade de despertares;
- duração acordado durante a noite quando conhecida;
- cochilo/noturno;
- fonte;
- confiança;
- timezone/contexto;
- observações;
- `client_event_id`;
- status `active/superseded/voided`;
- vínculo de supersession.

Regra:
se existirem apenas horário de deitar e horário de acordar, o sistema pode calcular **tempo na cama**, mas não deve rotulá-lo automaticamente como duração efetiva de sono.

### 2. health_recovery_checkins

Observações diárias/subjetivas relacionadas à recuperação.

Campos conceituais:
- qualidade percebida do sono;
- sonolência;
- fadiga geral;
- fadiga muscular;
- fadiga mental;
- recuperação física percebida;
- prontidão percebida para treinar;
- dor muscular/soreness quando informada;
- disposição;
- observações;
- fonte;
- confiança;
- data/hora de observação.

Escalas podem existir futuramente, mas a v1 deve aceitar também descrições qualitativas sem forçar uma conversão artificial.

### 3. health_sleep_device_observations

Registra métricas produzidas por wearable/aplicativo/dispositivo.

Exemplos de `metric_code` possíveis:
- sleep_duration_estimated;
- resting_heart_rate;
- hrv;
- sleep_stage_light;
- sleep_stage_deep;
- sleep_stage_rem;
- awake_time_estimated;
- respiratory_rate;
- outras métricas justificadas.

Cada observação deve preservar:
- valor;
- unidade;
- origem/dispositivo;
- janela/instante;
- método ou provider quando conhecido;
- status de estimativa;
- confiança;
- payload de origem apenas quando necessário e seguro.

Métricas de estágios do sono permanecem **estimativas do dispositivo**, não medições clínicas perfeitas.

## Estado longitudinal proposto

### health_sleep_recovery_rolling_states

Janelas:
- 7 dias;
- 14 dias;
- 28 dias.

Estado derivado pode incluir:
- dias com qualquer observação;
- dias com duração de sono utilizável;
- média de duração quando comparável;
- variabilidade de duração;
- regularidade de horário quando calculável;
- média/estado de qualidade percebida quando a escala for comparável;
- média/estado de fadiga quando comparável;
- média/estado de recuperação quando comparável;
- média/estado de prontidão quando comparável;
- cochilos observados;
- cobertura;
- confiança;
- `reason_codes`;
- `algorithm_version`;
- data de cálculo.

### Cobertura v1 candidata

A arquitetura propõe a mesma régua estrutural 7/14/28 usada em outros estados, sem transformar ausência em zero:

- `unobserved`: nenhum dia observável;
- `sparse`: evidência insuficiente para tendência;
- `partial`: evidência útil, abaixo do limiar de cobertura;
- `complete`: cobertura suficiente para o indicador calculado.

O limiar final de suficiência deverá ser congelado na implementação versionada. A arquitetura recomenda **não reutilizar automaticamente** um limiar de outro domínio sem teste específico.

## Reason codes mínimos

Exemplos estruturais:
- `NO_SLEEP_DATA`;
- `NO_USABLE_SLEEP_DURATION`;
- `TIME_IN_BED_ONLY`;
- `INSUFFICIENT_SLEEP_COVERAGE`;
- `RECOVERY_UNOBSERVED`;
- `FATIGUE_UNOBSERVED`;
- `READINESS_UNOBSERVED`;
- `DEVICE_ESTIMATE_ONLY`;
- `MIXED_SLEEP_SOURCES`;
- `INSUFFICIENT_COMPARABLE_DAYS`.

Reason code descreve a condição do dado; não é diagnóstico.

## Conexões intermódulo

M9A pode gerar fatos/conexões para análise em:
- 00 — Central;
- 01 — Treino;
- 02 — Alimentação;
- 03/M8 — Físico/Body;
- 05/M9B — Saúde/Exames/Biomarcadores;
- 06 — Planejamento Integrado;
- 07 — Base Científica.

Contrato:
uma conexão significa **merece análise conjunta**, não **causa comprovada**.

## Segurança e privacidade

Na futura implementação:
- mesmo `athlete_id` e matriz de autorização da fundação Health;
- RLS deny-by-default;
- leitura/escrita somente para usuários autorizados ao atleta;
- escrita factual preferencialmente por RPC versionada;
- `SECURITY DEFINER` somente quando necessário, com `search_path` fixo;
- anon sem acesso;
- testes cross-athlete obrigatórios;
- nenhuma projeção detalhada para módulos externos sem contrato explícito.

## Correções

Fatos relevantes devem preservar histórico.

Padrão:
- supersession para substituir um registro factual incorreto;
- void para anular registro inválido;
- estado derivado é recalculado;
- nenhuma correção silenciosa destrói o fato anterior.

## UI futura

Rota sugerida dentro de `/saude/*`:
- `/saude/recuperacao`

Mobile-first.

Blocos esperados:
- registro simples do sono;
- check-in de recuperação;
- estado 7/14/28;
- histórico;
- origem/confiança do dado;
- indicação de dados ausentes sem zeros falsos;
- conexões relevantes sem diagnóstico.

## Fora do escopo M9A v1

- diagnóstico de insônia, apneia ou outro transtorno;
- interpretação clínica de estágios de sono;
- prescrição de medicação;
- alteração automática de treino;
- alteração automática de dieta;
- recomendação terapêutica automática;
- decisão integrada de prontidão que governe treino;
- inferir causalidade a partir de correlação;
- exigir wearable para operar o módulo.

## Critério de saída arquitetural

M9A só pode avançar para implementação após:
- arquitetura versionada aprovada;
- modelo factual revisado;
- contrato de estado/reason codes revisado;
- critérios de suficiência definidos para implementação;
- matriz RLS/cross-athlete definida;
- critérios de aceitação M9 aprovados;
- branch baseada na `main` vigente e sem divergência não reconciliada.
