# F10 — DASHBOARD INTEGRADO — MOBILE UI SPEC v1

**Rota:** /saude/hoje
**Prioridade:** smartphone-first
**Status:** DOCUMENTAL

## 1. Objetivo de UX

Em poucos segundos o usuário deve responder:
- tenho treino ativo ou próximo treino?
- registrei alimentação suficiente hoje?
- como está a cobertura de recuperação?
- existe estado corporal recente?
- existem exames ou documentos aguardando revisão?

Sem score geral.

## 2. Estrutura vertical mobile

### Cabeçalho

Título:
Hoje

Subtítulo:
“Visão integrada dos seus dados. Cada área mantém sua própria fonte e confiança.”

Pode incluir nome do perfil e data local.

Não incluir:
- score geral;
- “saúde boa/ruim”.

### Pendências operacionais

Aparece somente se houver pendências permitidas.

Exemplos:
- “Alimentação de hoje ainda sem dados suficientes.”
- “Recuperação ainda não observada.”
- “1 documento aguarda revisão.”

Máximo visual recomendado: 3; excedentes em “Ver mais”.

### Treino

Sessão ativa:
- “Treino em andamento”;
- horário de início;
- CTA “Continuar treino”.

Próximo treino:
- nome do template;
- posição/estado da fila;
- CTA “Abrir treino”.

Sem programação:
- texto neutro;
- CTA “Ver treino”.

### Alimentação

Mostrar até 4 informações:
- refeições observadas;
- energia, se conhecida;
- proteína, se conhecida;
- estado/cobertura.

Separar Hoje de 7 dias.

Se houver decisão M7:
“Decisão nutricional: pausada/pronta”
e motivo amigável.

### Sono e recuperação

Mostrar:
- cobertura de sono;
- cobertura de recuperação;
- média de sono somente se calculada;
- médias de recuperação/fadiga/prontidão somente se já produzidas.

Se insuficiente:
“Dados insuficientes para média.”

CTA:
“Ver recuperação”.

### Evolução corporal

Mostrar no máximo:
- último peso;
- tendência já calculada;
- cintura;
- coverage/confidence.

Campo sem dado:
“Não observado”.

CTA:
“Ver evolução”.

### Exames e biomarcadores

Mostrar:
- último exame confirmado/data;
- quantidade de marcadores do último exame;
- última observação fisiológica;
- documentos aguardando revisão.

Sem valores laboratoriais em vermelho/verde na v1.

CTA:
“Ver exames”.

## 3. Desktop

Em telas maiores:
- grid de 2 colunas;
- Treino pode ocupar largura maior;
- mesma hierarquia semântica do mobile.

## 4. Estados de componente

Cada card:
- skeleton próprio;
- empty;
- historical;
- error;
- available.

Erro de um card não bloqueia os demais.

## 5. Cores

Cores indicam UI, não diagnóstico.

Permitido:
- neutro;
- primary;
- muted;
- destructive somente para erro técnico.

Evitar:
- vermelho = biomarcador ruim;
- verde = saúde boa;
- semáforo clínico.

## 6. Acessibilidade

- touch targets adequados;
- labels textuais, não apenas cor;
- teclado;
- headings hierárquicos;
- unidades visíveis;
- datas pt-BR;
- reason codes traduzidos.

## 7. Navegação

Permanece:
- Hoje;
- Treino;
- Alimentação;
- Evolução;
- Recuperação;
- Exames;
- Perfil.

F10 não cria item novo.

Hoje torna-se o Dashboard Integrado.

## 8. Critério visual

PASS em produção autenticada quando:
- /saude/hoje renderiza;
- 5 domínios aparecem;
- empty states não inventam valores;
- um erro isolado não derruba toda página;
- navegação funciona;
- smartphone não exige zoom horizontal;
- nenhum score geral aparece;
- nenhum diagnóstico aparece;
- origem/atualidade é compreensível.
