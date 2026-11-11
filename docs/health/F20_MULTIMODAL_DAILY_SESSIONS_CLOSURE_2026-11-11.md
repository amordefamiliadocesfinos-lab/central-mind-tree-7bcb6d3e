# F20 — TREINOS MULTIMODAIS E MÚLTIPLAS SESSÕES DIÁRIAS — CLOSURE

**Data:** 11/11/2026
**Status:** OPERACIONAL
**Base:** `main@1088791d493646bd0a2a1ff2667af1b86597af82`

## Entregas

### Múltiplas sessões
- várias sessões no mesmo dia;
- musculação continua em M4/F19;
- atividades multimodais ficam em F20;
- nenhuma unicidade por data;
- uma sessão live por vez entre força e atividade para não sobrepor cronômetros.

### Modalidades
16 modalidades iniciais:
- corrida;
- caminhada;
- ciclismo;
- natação;
- remo;
- elíptico;
- escada;
- cardio geral;
- Pilates;
- yoga;
- mobilidade;
- dança/ritmos;
- trilha;
- esporte;
- artes marciais;
- outra atividade.

Catálogo extensível.

### Registro
- iniciar ao vivo;
- pausar;
- retomar;
- concluir;
- registrar atividade já realizada;
- duração ativa;
- distância;
- pace;
- velocidade;
- calorias;
- FC média/máxima;
- RPE;
- cadência;
- elevação;
- passos;
- observações.

### Corrida / intervalados
- voltas;
- segmentos;
- aquecimento;
- trabalho;
- recuperação;
- intervalo;
- volta à calma.

### Linha do tempo
A tela Atividades reúne no mesmo dia:
- sessões de musculação;
- sessões multimodais;
- horários;
- duração;
- métricas principais.

## Banco

Migration:
`20261111165531_health_f20_multimodal_daily_sessions.sql`

Aplicada no Lovable Cloud.

Postcheck:
- quatro tabelas F20: OK;
- RLS: OK;
- seis RPCs: OK;
- 16 modalidades ativas;
- anon bloqueado;
- histórico de migration alinhado.

## Frontend

Rota:
`/saude/treino/atividades`

Acesso disponível a partir da tela Treino.

## Não incluído na v1

- GPS em tempo real;
- integração com relógios;
- Apple Health;
- Health Connect;
- zonas automáticas de FC;
- potência de ciclismo;
- métricas avançadas de natação.

Essas integrações futuras podem consumir a base F20 sem alterar o modelo de musculação.
