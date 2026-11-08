# F16 — LEMBRETES E ROTINA — ARQUITETURA V1

## 1. Tabelas

### health_reminder_rules

Configuração persistente por atleta.

Campos:
- id;
- athlete_id;
- reminder_type;
- label;
- enabled;
- schedule_kind;
- days_of_week;
- local_time;
- interval_days;
- start_on;
- timezone;
- status;
- created_by_auth_user_id;
- created_at;
- updated_at.

### health_reminder_events

Ledger append-only de interação.

Eventos:
- completed;
- dismissed.

Campos:
- id;
- athlete_id;
- reminder_rule_id;
- event_type;
- event_date;
- notes;
- recorded_by_auth_user_id;
- occurred_at.

## 2. Agendamento v1

### daily

Devido todos os dias após `local_time`.

### weekly

Devido nos dias selecionados após `local_time`.

Dias:
- 0 domingo
- 1 segunda
- ...
- 6 sábado

### interval

Devido a cada N dias a partir de `start_on`.

## 3. Cálculo

O banco persiste a regra.

A UI calcula se a regra está devida usando:
- data local;
- hora local;
- timezone configurado.

Não existe cron/push na F16 v1.

## 4. RPCs

- `health_f16_save_reminder_rule`
- `health_f16_archive_reminder_rule`
- `health_f16_record_reminder_event`

Todas:
- autenticadas;
- autorizadas por atleta;
- sem acesso anon;
- com search_path fixo.

## 5. Segurança

Tabelas:
- SELECT para authenticated sob RLS;
- sem INSERT/UPDATE/DELETE direto;
- escrita apenas pelas RPCs.

## 6. UI

Rota:
`/saude/rotina`

Seções:
1. rotina de hoje;
2. regras configuradas;
3. criar/editar lembrete;
4. histórico curto.

## 7. Eventos do dia

Uma regra pode ter no máximo um estado operacional do dia na UI.

Se houver:
- completed → concluído;
- dismissed → dispensado.

Novo evento do mesmo dia pode superseder semanticamente o anterior pela ordem temporal na leitura, sem apagar o ledger.

## 8. Autoridade

F16 não:
- altera treino;
- altera dieta;
- altera meta;
- diagnostica;
- cria obrigação clínica;
- impede uso de outro módulo.

## 9. Backend ausente

A UI deve:
- informar indisponibilidade;
- não guardar regras silenciosamente em localStorage como substituto do banco;
- não fingir que lembretes foram persistidos.
