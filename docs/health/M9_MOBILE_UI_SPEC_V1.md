# M9 — MOBILE UI SPEC v1

**Status:** UX/UI TÉCNICA FECHADA — NÃO IMPLEMENTADA

Objetivo: integrar M9 ao HealthShell mobile-first sem esmagar a navegação atual.

## 1. Navegação Health

Hoje o shell usa 5 colunas fixas.

M9 adiciona duas rotas canônicas:
- `/saude/recuperacao`;
- `/saude/exames`.

Decisão v1:
substituir a grade fixa de 5 por uma **faixa horizontal rolável** de navegação Health, preservando touch target mínimo e evitando 7 itens comprimidos.

Ordem:
1. Hoje
2. Treino
3. Alimentação
4. Evolução
5. Recuperação
6. Exames
7. Perfil

Requisitos:
- `overflow-x-auto`;
- item com largura mínima suficiente para ícone + label;
- altura >= 56 px;
- item ativo visível;
- rolar item ativo para área visível quando necessário;
- desktop mostra os 7 itens sem obrigar scroll quando houver espaço;
- não alterar footer global do PAINEL CENTRAL.

## 2. /saude/recuperacao

### Header
Título: **Sono e recuperação**  
Subtítulo: **Sono, fadiga e recuperação observados. Estado não é decisão de treino.**

Ações:
- Atualizar estado.

### Card A — Registrar sono
Campos progressivos:
- data;
- tipo: noite/cochilo/outro;
- deitei;
- dormi aproximadamente;
- acordei;
- levantei;
- duração declarada opcional;
- despertares;
- tempo acordado opcional;
- observações.

UX:
- nenhum campo ausente é preenchido;
- mostrar `Tempo na cama` calculado separadamente;
- mostrar `Sono efetivo: desconhecido` quando não houver evidência.

### Card B — Check-in de recuperação
Chips/segmented controls 1–5 opcionais para:
- qualidade do sono;
- sonolência;
- fadiga geral;
- fadiga muscular;
- fadiga mental;
- recuperação física;
- prontidão;
- dor muscular;
- disposição.

Cada métrica também aceita observação textual.

Não exibir score composto.

### Card C — Estado 7 / 14 / 28
Cada janela apresenta dimensões:
- Sono;
- Horários;
- Qualidade;
- Recuperação;
- Fadiga;
- Prontidão.

Para cada dimensão:
- badge coverage;
- observed days / required;
- confidence;
- média/tendência somente quando suficiente;
- reason codes em linguagem humana.

### Card D — Histórico
Timeline de sono/check-ins.
- origem;
- confiança;
- ativo/superseded/voided;
- anular sem apagar.

### Card E — Wearables
v1 pode iniciar read-only/empty state:
- provider;
- última sincronização/importação;
- métricas disponíveis.

Não exigir wearable.

## 3. /saude/exames

### Header
Título: **Exames e biomarcadores**  
Subtítulo: **Resultados, documentos e histórico. Estrutura não é diagnóstico.**

Ações:
- Adicionar exame;
- Adicionar sinal fisiológico.

### Card A — Documentos
Upload:
- PDF/JPEG/PNG/WebP;
- label de privado;
- progresso;
- falha;
- status da extração.

Nunca renderizar URL pública.

### Card B — Revisão de extração
Quando status extracted/review_required:
- laboratório;
- coleta;
- resultado;
- lista de marcadores;
- original name;
- result text;
- unit;
- reference;
- flag;
- confidence.

Ações:
- Confirmar;
- Rejeitar;
- Corrigir antes de confirmar.

Mensagem:
**Extraído ainda não faz parte do histórico confirmado.**

### Card C — Exames confirmados
Agrupar por data/coleta.

Cada marcador exibe:
- nome original;
- valor original;
- unidade;
- referência;
- flag original;
- canonical label discreto se mapeado.

Não usar cor/ícone com linguagem de diagnóstico.

### Card D — Histórico do marcador
Ao abrir um marcador:
- série temporal quando comparável;
- pontos não comparáveis continuam listados;
- reason code;
- mudança de referência/laboratório visível.

### Card E — Sinais fisiológicos
Registro simples:
- pressão;
- FC;
- temperatura;
- SpO2;
- frequência respiratória;
- glicemia;
- outro catalogado.

Sem meta clínica automática.

## 4. Empty / unknown states

Padrão de texto:
- `Desconhecido`
- `Ainda não observado`
- `Sem base comparável`
- `Revisão necessária`

Nunca:
- 0 como ausência;
- "normal" sem contrato clínico;
- diagnóstico automático.

## 5. Mobile ergonomics

- input height >= 44 px;
- botão principal >= 44 px;
- labels sempre visíveis;
- teclado numérico/decimal quando apropriado;
- date/time native-friendly;
- cards de uma coluna no smartphone;
- tabelas viram cards/linhas empilhadas;
- nenhum dado crítico depende de hover;
- respeitar safe-area;
- sticky actions só quando não cobrem footer global.

## 6. Acessibilidade

- labels vinculados;
- aria-label em ícones;
- estados não dependem apenas de cor;
- foco visível;
- mensagens de erro associadas ao campo;
- upload acessível por botão e input.

## 7. Não implementado nesta PR

Esta especificação não altera `HealthModule.tsx` nem `HealthShell.tsx`.
A implementação só ocorre na fase seguinte autorizada.
