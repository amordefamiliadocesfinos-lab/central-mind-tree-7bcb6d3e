# F19 — CRONÔMETRO INTERATIVO DE TREINO E DESCANSO — ARQUITETURA V1

**Data:** 09/11/2026
**Mapa:** CCH v4.6 FROZEN

## 1. Objetivo

Reduzir a interação durante o treino a toques simples, medindo automaticamente:
- tempo ativo da sessão;
- pausas;
- tempo de execução;
- descanso real;
- excesso de descanso sobre a meta prescrita.

## 2. Fontes de verdade

### Prescrição
M3/M4 continuam soberanos para:
- exercícios;
- séries planejadas;
- faixa de repetições;
- RIR alvo;
- descanso planejado.

### Execução
F19 adiciona fatos temporais.

Nunca converter automaticamente:
- descanso planejado em descanso real;
- reps planejadas em reps reais;
- carga anterior em carga real;
- RIR alvo em RIR real.

## 3. Cronômetro principal da sessão

A sessão M4 recebe:
- `timer_paused_at`;
- `pause_accumulated_seconds`.

Tempo ativo ao vivo:

`now - started_at - pause_accumulated_seconds - pausa_em_andamento`

Estados:
- active;
- paused;
- completed;
- aborted.

### Pausar

Um toque:
- session active → paused;
- grava início da pausa;
- congela qualquer intervalo F19 em execução.

### Retomar

Um toque:
- session paused → active;
- acumula duração da pausa;
- retoma o intervalo F19 que estava pausado.

## 4. Intervalos F19

Tabela: `health_workout_timer_intervals`.

Tipos:
- `work`: tempo de execução de uma série;
- `rest`: descanso entre séries/exercícios.

Campos principais:
- athlete_id;
- session_id;
- workout_exercise_id;
- workout_set_id opcional;
- interval_type;
- set_number opcional;
- status running | paused | completed | cancelled;
- target_seconds opcional;
- started_at;
- paused_at;
- pause_accumulated_seconds;
- ended_at;
- actual_seconds;
- client_event_id;
- notes.

Regra:
- no máximo um intervalo running/paused por sessão.

## 5. Fluxo rápido

### Iniciar série
Toque em:
**Iniciar série**

Cria intervalo `work`.

### Concluir série
Toque em:
**Concluir série**

Em uma operação:
1. encerra `work`;
2. registra série M4 com carga/reps/RIR desconhecidos se não houver dados informados;
3. preserva o tempo real de execução;
4. inicia `rest`;
5. usa `planned_rest_seconds` apenas como meta visual.

A ausência de dados de desempenho permanece NULL.

## 6. Descanso

O descanso:
- conta para cima;
- mostra a meta prescrita;
- enquanto abaixo da meta: "descansando";
- ao atingir meta: "pode voltar";
- depois da meta: continua contando normalmente;
- mostra tempo extra.

Não encerra sozinho.

### Aviso

Quando cruza a meta:
- aviso visual forte;
- vibração se `navigator.vibrate` existir;
- sinal sonoro local se permitido pelo navegador.

Não depende de push notification na v1.

### Voltar ao exercício

Toque:
**Voltar ao exercício**

Em uma operação:
1. encerra descanso;
2. grava `actual_seconds`;
3. atualiza `rest_seconds` da série anterior;
4. inicia automaticamente o próximo intervalo `work` quando ainda houver próxima série.

Se a série planejada terminou:
- usuário pode tocar "Próximo exercício";
- descanso real ainda é preservado.

## 7. Dados de desempenho

Modo rápido F19:
- não exige digitação;
- registra timing factual;
- série pode ter load/reps/RIR NULL.

Modo detalhado existente:
- continua disponível em painel secundário;
- permite carga/reps/RIR;
- não é requisito para o cronômetro funcionar.

## 8. Recuperação após reload

Ao abrir a página:
- buscar sessão open;
- buscar intervalo F19 running/paused;
- reconstruir relógios a partir dos timestamps persistidos;
- nenhuma dependência em localStorage.

## 9. Atualização sem refresh manual

Após cada ação:
- atualizar estado local a partir da resposta/reload do hook;
- listeners de foco/visibility podem reconciliar dados;
- página não exige refresh do usuário.

Realtime não é dependência obrigatória da v1.

## 10. Segurança

- RLS em `health_workout_timer_intervals`;
- leitura via `health_can_read_athlete`;
- escrita somente por RPC F19;
- sem grants diretos INSERT/UPDATE/DELETE para authenticated;
- RPCs SECURITY INVOKER;
- auth.uid obrigatório;
- health_can_write_athlete obrigatório;
- idempotência por client_event_id.

## 11. RPCs v1

- `health_f19_pause_workout`;
- `health_f19_resume_workout`;
- `health_f19_start_work_interval`;
- `health_f19_finish_work_start_rest`;
- `health_f19_finish_rest_start_work`;
- `health_f19_finish_rest`;
- `health_f19_cancel_interval`.

## 12. Compatibilidade M4

F19 não substitui M4.

F19:
- orquestra timers;
- usa `health_workout_sets`;
- usa `health_workout_events`;
- mantém fila e conclusão M4 intactas.

## 13. Gate B

Migration versionada em Git.
Não aplicar produção sem autorização explícita.
