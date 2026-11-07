# M8 — BODY EVOLUTION

## Missão

Criar a camada objetiva de evolução corporal do CCH.

Fronteira oficial:

- M5 = fatos nutricionais
- M6 = estado nutricional
- M7 = decisão nutricional
- M8 = fatos corporais + estado corporal longitudinal

M8 não altera dieta ou treino automaticamente.

## Princípios

- medida observada != interpretação;
- foto != composição corporal;
- ausência de dado != zero;
- correções preservam histórico;
- fatos corporais são append-only por supersession/void;
- estado derivado é recalculável e versionado;
- fotos privadas exigem consentimento explícito;
- análise de mídia não é executada na M8;
- somatotipo não é driver de decisão. Se usado futuramente, será apenas descritor complementar, nunca substituto de medidas reais.

## Tabelas

### health_body_assessments

Sessão factual de avaliação corporal.

Registra:
- atleta;
- instante e data local;
- fonte;
- confiança;
- condições;
- observações;
- client_event_id;
- status active/superseded/voided;
- vínculo de supersession.

### health_body_measurements

Medidas objetivas vinculadas à avaliação.

Métricas v1:
- peso;
- cintura;
- quadril;
- peito;
- pescoço;
- braço esquerdo/direito;
- coxa esquerda/direita;
- panturrilha esquerda/direita;
- gordura corporal;
- massa magra;
- massa muscular esquelética.

Métodos:
- balança;
- fita;
- bioimpedância;
- adipômetro;
- DEXA;
- estimativa;
- profissional;
- outro.

Faixas amplas de integridade impedem valores absurdos sem transformar o banco em diagnóstico clínico.

### health_body_photo_sets

Protocolo fotográfico corporal privado.

Versão inicial:
`BODY_PHOTO_V1`

Ângulos:
- frente relaxado;
- lado esquerdo relaxado;
- costas relaxado;
- lado direito relaxado.

### health_body_photos

Metadados das imagens.

O binário não é gravado por SQL. O arquivo fica no bucket privado:

`health-private/<athlete_id>/progress/<photo_set_id>/...`

Upload e remoção de binários são feitos exclusivamente pela Supabase Storage API.

### health_body_rolling_states

Estado derivado 7/14/28 dias.

Inclui:
- contagem de pesagens;
- primeiro/último peso;
- mudança de peso;
- tendência kg/semana;
- contagem e mudança de cintura;
- contagem e mudança de gordura corporal;
- quantidade de protocolos fotográficos;
- IMC descritivo quando altura e peso existem;
- coverage;
- confidence;
- reason_codes;
- algorithm_version.

## Cobertura v1

Para cada janela:

- unobserved: nenhum dado corporal;
- sparse: menos de 2 pesagens ou evidência insuficiente;
- partial: 2+ pesagens, mas menos de 70% dos dias;
- complete: pesagens em pelo menos ceil(70% da janela).

Confiança:

- high: coverage complete e método de peso consistente;
- moderate: coverage partial ou métodos mistos;
- low: sparse/unobserved.

## Tendência de peso

A tendência é uma regressão linear descritiva em kg/semana sobre a última pesagem ativa de cada dia.

Ela não deve, sozinha, produzir ajuste nutricional.

## IMC

O IMC é derivado da altura do Perfil e do peso mais recente.

É tratado apenas como indicador descritivo. Não substitui composição corporal nem distribuição de gordura.

## Correções

### Assessment

- nova avaliação pode superseder uma avaliação ativa;
- a anterior muda para `superseded`;
- nenhuma medida antiga é apagada.

### Void

- avaliação incorreta pode ser anulada;
- `void_reason` e `status_changed_at` ficam registrados;
- histórico permanece preservado.

## Fotos e consentimento

Para registrar metadados de fotos, a RPC exige que a decisão mais recente de:

`private_media_storage`

seja:

`granted`

Sem consentimento, o registro é bloqueado.

O frontend também bloqueia a interface de upload e direciona o usuário para Perfil.

## Segurança

Todas as tabelas M8 possuem RLS.

Frontend:
- SELECT das tabelas M8;
- nenhuma escrita direta em facts/estado;
- nenhuma escrita direta nas tabelas de fotos.

RPCs:
- `health_m8_record_body_assessment`
- `health_m8_void_body_assessment`
- `health_m8_refresh_body_state`
- `health_m8_register_body_photo_set`
- `health_m8_void_body_photo_set`

Cada RPC privilegiada:
- usa search_path fixo;
- verifica autorização do atleta;
- não é executável por anon;
- é executável somente por authenticated.

## Storage

O bucket `health-private` já pertence à fundação M0.

M8 reutiliza as policies M0:
- path começa por athlete_id;
- SELECT exige leitura do atleta;
- upload/update/delete exigem escrita no atleta.

O Storage schema é tratado como metadata read-only; operações de arquivo acontecem pela API de Storage.

## UI

Rota:
`/saude/evolucao`

Entregas:
- registro de medidas;
- condição da pesagem;
- método de peso e gordura corporal;
- estados 7/14/28;
- histórico;
- anulação sem apagar histórico;
- protocolo guiado de quatro fotos;
- linha do tempo visual por signed URLs privadas.

## Relação com M7

M7 v1 continua com:

`BODY_RESPONSE_REQUIRED_FOR_PLAN_ADJUSTMENT`

M8 fornece a evidência corporal necessária para uma futura versão do motor integrado.

A existência de M8 não autoriza automaticamente mudança de calorias.

Uma futura integração deverá especificar explicitamente:
- mínimo de cobertura Body;
- duração mínima;
- tendência ponderal aceitável por objetivo;
- cintura/composição como evidência auxiliar;
- discrepâncias entre peso e medidas;
- algoritmo e parameter set versionados;
- capacidade de DECISION_PAUSED.

## Fora do escopo M8 v1

- diagnóstico médico;
- estimar gordura por foto;
- reconhecimento corporal por IA;
- classificação rígida ectomorfo/mesomorfo/endomorfo;
- alteração automática de dieta;
- alteração automática de treino;
- recomendação terapêutica.
