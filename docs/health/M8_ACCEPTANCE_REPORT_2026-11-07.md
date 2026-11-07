# M8 — BODY EVOLUTION — ACCEPTANCE REPORT

**Data:** 07/11/2026  
**Branch:** `feat/health-m8-body-evolution-20261107`  
**Base:** `main@a3cc57c97c37725e29418b1dca70b660eaf6e465`

## Ambiente oficial

PAINEL CENTRAL — TESTES MT  
Supabase: `enfekhgcsbzovxtqdlwh`

Produção permaneceu sem M8 durante toda a validação.

## Entregas

Tabelas:
- health_body_assessments
- health_body_measurements
- health_body_photo_sets
- health_body_photos
- health_body_rolling_states

RPCs:
- health_m8_record_body_assessment
- health_m8_void_body_assessment
- health_m8_refresh_body_state
- health_m8_register_body_photo_set
- health_m8_void_body_photo_set

Frontend:
- useHealthBodyM8
- HealthBodyPage
- /saude/evolucao agora usa a tela real M8

## Regressão factual

Foram registrados cinco dias de avaliação no período 01/11→07/11.

### Idempotência

Mesmo client_event_id retornou o mesmo assessment.

PASS.

### Estado 7 dias

- 5 pesagens;
- método único;
- peso inicial: 95,0 kg;
- peso final inicial: 93,5 kg;
- mudança: -1,5 kg;
- tendência: -1,6962 kg/sem;
- cintura: 100,0 → 98,5 cm;
- gordura corporal: 25,0 → 24,5%;
- coverage: complete;
- confidence: high.

PASS.

### Estado 14/28 dias

Mesmos fatos, mas cobertura proporcional insuficiente para complete.

Resultado:
- coverage: partial;
- confidence: moderate.

PASS.

### Correção por supersession

Avaliação de 07/11 foi corrigida:
- original: superseded;
- nova: active;
- peso final recalculado: 93,7 kg;
- cintura final: 98,6 cm;
- gordura final: 24,6%.

PASS.

### Void

Assessment de teste:
- status: voided;
- void_reason registrado;
- status_changed_at registrado.

PASS.

### Integridade

body_fat_pct = 100 foi rejeitado pelo CHECK de faixa plausível.

PASS.

## Fotos

### Sem consentimento

health_m8_register_body_photo_set:

BLOQUEADO com:
`private media storage consent is required`

PASS.

### Com consentimento granted

Registro de photo_set + photo metadata:

PASS.

Teste executado com ROLLBACK; nenhum arquivo falso foi persistido.

### Void de photo set

- status: voided;
- void_reason separado;
- status_changed_at registrado;
- notes originais preservadas.

PASS.

### Escrita direta

INSERT direto em health_body_photo_sets por authenticated:

BLOQUEADO.

PASS.

## Segurança

- RLS ativo nas 5 tabelas M8;
- tabelas expõem apenas SELECT a authenticated;
- nenhuma tabela M8 possui grant anon;
- RPCs SECURITY DEFINER com search_path fixo;
- anon EXECUTE = false;
- authenticated EXECUTE = true;
- cross-athlete record assessment = BLOQUEADO;
- UPDATE direto de assessment = BLOQUEADO.

PASS.

## Storage

A implementação frontend usa:
- upload via Supabase Storage API;
- bucket privado health-private;
- paths por athlete_id;
- createSignedUrl para visualização;
- remove via Storage API em rollback de falha de registro.

O upload binário real será homologado somente após merge/deploy, usando uma foto real do usuário. Não foi criado objeto falso em Storage durante testes.

## Mobile

HealthBodyPage mantém:
- grids responsivos;
- sem largura fixa rígida;
- inputs/botões com alvos de toque min-h-11;
- protocolo de fotos em 1 coluna/2 colunas conforme viewport.

## CI

Run final:
`42418699675`

- npm ci: PASS
- lint Health: PASS
- build completo do PAINEL CENTRAL: PASS

Workflow temporário removido após validação.

## Gates

- merge em main: NÃO EXECUTADO
- migrations M8 em produção: NÃO EXECUTADAS
- deploy M8: NÃO EXECUTADO

M8 pronta para PR Draft.
