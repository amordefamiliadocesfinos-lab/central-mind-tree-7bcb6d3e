# F20 — TREINOS MULTIMODAIS E MÚLTIPLAS SESSÕES DIÁRIAS — ARQUITETURA V1

**Data:** 11/11/2026
**Mapa:** CCH v4.8 FROZEN

## 1. Separação de domínios

### Musculação
Continua em:
- health_workout_sessions;
- health_workout_exercises;
- health_workout_sets;
- health_workout_timer_intervals.

### Outras atividades
Nova camada:
- health_activity_modalities;
- health_activity_sessions;
- health_activity_segments;
- health_activity_events.

Não converter corrida/Pilates em séries artificiais de musculação.

## 2. health_activity_modalities

Catálogo extensível com:
- code;
- name;
- metric_profile;
- sort_order;
- is_active.

## 3. health_activity_sessions

Uma linha por sessão real.

Campos:
- athlete;
- modality;
- título;
- source live/manual/import;
- status active/paused/completed/aborted;
- início/fim;
- pausa acumulada;
- duração ativa;
- distância;
- calorias;
- FC média/máxima;
- RPE;
- cadência;
- elevação;
- passos;
- ritmo médio;
- velocidade média;
- observações.

Sem restrição por data.

## 4. health_activity_segments

Segmentos/voltas opcionais:
- ordem;
- tipo;
- rótulo;
- duração;
- distância;
- pace;
- FC;
- cadência;
- observações.

Uso:
- tiros de corrida;
- voltas;
- aquecimento;
- recuperação;
- blocos de uma aula;
- outros intervalos.

## 5. Cronômetro

Sessão live:
- iniciar;
- pausar;
- retomar;
- concluir.

Duração ativa exclui pausas.

Sessão manual:
- registra uma atividade já realizada;
- horário e duração são informados.

## 6. Cálculos

Quando distância e duração existem:
- pace médio = duração ativa / km;
- velocidade média = km / hora.

Valores calculados pelo banco na conclusão.

## 7. Segurança

- RLS em todas as tabelas expostas;
- leitura por health_can_read_athlete;
- mutação por health_can_write_athlete;
- eventos auditáveis;
- timestamps live gerados pelo servidor;
- sem service role no cliente.

## 8. UX

Treino sem sessão aberta deve mostrar:
- próximo treino CCH;
- botão **Outra atividade**;
- **Sessões de hoje**.

Página Atividades:
- iniciar atividade;
- registrar atividade concluída;
- sessão live com timer;
- concluir e registrar métricas;
- histórico do dia;
- múltiplas sessões sem limite diário.

## 9. Integração futura

F20 cria base para:
- GPS;
- integração relógio/Apple Health/Google Health Connect;
- zonas de FC;
- potência no ciclismo;
- métricas de natação;
- analytics de carga multimodal.

Esses itens não são requisito para v1.
