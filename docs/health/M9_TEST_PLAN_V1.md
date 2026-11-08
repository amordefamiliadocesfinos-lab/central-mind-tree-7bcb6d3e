# M9 — TEST PLAN v1

**Status:** CASOS DE TESTE FECHADOS — NÃO EXECUTADOS

Ambiente de execução futuro:
**PAINEL CENTRAL — TESTES MT / Supabase `enfekhgcsbzovxtqdlwh`**

Nenhum teste desta especificação foi executado ainda porque a implementação M9 não existe.

## 1. Estratégia

Camadas:
1. schema/integridade;
2. RLS/grants;
3. RPC/idempotência;
4. estados derivados;
5. Storage;
6. frontend;
7. regressão M0→M8;
8. CI.

Para policies, criar testes pgTAP em `supabase/tests/` quando a implementação iniciar.

## 2. M9A — fatos

### Sleep period
- cria período apenas com duração declarada;
- cria período com timestamps completos;
- deitar + acordar calcula time_in_bed, não sleep_duration;
- minutos negativos rejeitados;
- period_type inválido rejeitado;
- replay do client_event_id retorna mesmo id;
- supersession preserva anterior;
- void exige motivo;
- void é idempotente.

### Recovery
- ordinal 1 e 5 aceitos;
- ordinal 0/6 rejeitado;
- raw_text sem ordinal aceito;
- nenhum valor e nenhum texto rejeitado;
- "dormi bem" não vira ordinal automaticamente;
- metric_code inválido rejeitado.

### Wearable
- lote válido aceito;
- external_id repetido não duplica;
- provider preservado;
- estágio do sono permanece estimado;
- HRV com método/provider incompatível não gera comparação forte;
- métrica desconhecida não contamina rolling state.

## 3. M9A — rolling state

Para 7 dias:
- 0/7 => unobserved;
- 1–3/7 => sparse;
- 4/7 => partial;
- 5–7/7 => complete.

Para 14:
- 0 => unobserved;
- 1–6 => sparse;
- 7–9 => partial;
- 10–14 => complete.

Para 28:
- 0 => unobserved;
- 1–13 => sparse;
- 14–19 => partial;
- 20–28 => complete.

Testar cada dimensão separadamente.

Caso crítico:
5 dias de duração + 1 dia de fadiga:
- sleep_duration complete;
- fatigue sparse.

Ausência nunca produz média zero.

## 4. M9B — documentos e extração

- registra metadado apenas para path do atleta;
- path com `..` rejeitado;
- documento de A não pode ser associado a B;
- extraction inicia pending;
- extracted não cria lab_report;
- review_required não cria lab_report;
- confirmed cria report + results em transação;
- falha em um result faz rollback de tudo;
- reject não apaga documento;
- confirmar duas vezes não duplica;
- engine/version/confidence preservados.

## 5. M9B — resultados

- original_analyte_name preservado;
- original_result_text não numérico aceito;
- unidade nula aceita quando documento não informa;
- reference_text preservado;
- alias sem canonical_code não descarta resultado;
- LOINC opcional;
- fuzzy match não auto-confirma canonical_code;
- normalização não sobrescreve original;
- reference range alterada gera reason code;
- unidade incompatível => not comparable;
- observação única => SINGLE_OBSERVATION_ONLY.

## 6. Sinais vitais

- pressão permite par sistólica/diastólica;
- condição/equipamento preservados;
- replay idempotente;
- cross-athlete bloqueado;
- ausência de unidade não é inventada.

## 7. RLS/grants

Para todas as tabelas por atleta:
- anon select = deny;
- authenticated sem acesso = 0 rows;
- can_read = select;
- can_write sem can_read inconsistente deve seguir regra M0 efetiva;
- direct insert/update/delete frontend = deny;
- RPC autorizada = allow;
- RPC cross-athlete = deny.

Catálogo:
- authenticated select = allow;
- anon = deny;
- frontend insert/update/delete = deny.

## 8. Storage

- upload `A/clinical/...` por writer A = allow;
- upload no path B = deny;
- signed URL/read por reader A = allow;
- reader sem acesso = deny;
- delete por read-only = deny;
- delete por writer = allow;
- SQL não manipula storage.objects para criar/remover binário.

## 9. Frontend mobile

### /saude/recuperacao
- loading;
- empty;
- erro;
- registro parcial;
- 7/14/28;
- unknown;
- keyboard mobile;
- touch targets >= 44px;
- sem scroll horizontal obrigatório no formulário.

### /saude/exames
- lista vazia;
- upload;
- staging/review;
- confirmação;
- resultado não numérico;
- unidade/referência longa;
- documento sem parse;
- erro de signed URL;
- histórico;
- comparabilidade unknown.

## 10. Regressão

Após implementar M9:
- /saude/treino continua;
- /saude/alimentacao continua;
- /saude/evolucao continua;
- M7 continua sem ajuste calórico automático;
- health-private fotos M8 continuam;
- /academia permanece separado;
- shell/footer global não quebra.

## 11. CI

- npm ci;
- lint Health;
- build;
- supabase test db / pgTAP quando configurado;
- diff restrito;
- zero segredo no client;
- advisors sem finding novo crítico M9.

## 12. Critério de PASS

Nenhuma homologação M9 pode ser declarada com:
- cross-athlete falhando;
- anon com acesso;
- unknown convertido em zero;
- extraction virando fato sem confirmação;
- documento clínico público;
- erro fatal mobile.
