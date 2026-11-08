# F12 — MOBILE UI / JOURNEY SPEC v1

**Status:** DOCUMENTAL  
**Superfície:** /saude/hoje

---

## 1. Ordem da tela

1. cabeçalho Hoje;
2. bloco **Sua jornada CCH**;
3. próximo passo operacional;
4. etapas J1→J7;
5. decisão integrada F11;
6. cards F10 por domínio;
7. como ler a tela.

A ordem pode ser ajustada por responsividade sem alterar semântica.

---

## 2. Bloco Jornada

Título:
**Sua jornada CCH**

Texto:
“Organiza as etapas do seu acompanhamento. Isso representa processo e dados disponíveis, não uma nota de saúde.”

Não mostrar:
- 67%;
- 5/7 como score;
- barra de “saúde”;
- semáforo clínico.

Pode mostrar:
- “Próximo passo”;
- status textual por etapa;
- datas;
- histórico.

---

## 3. Etapa

Cada etapa mostra:
- nome;
- estado operacional;
- evidência curta;
- data quando aplicável;
- CTA.

Status visuais neutros:
- Concluída;
- Disponível;
- Em andamento;
- Aguardando dados;
- Avaliada — pausada;
- Bloqueada;
- Erro.

Cores não devem simular gravidade clínica.

---

## 4. Próximo passo

Um card destacado operacionalmente.

Exemplo:
“Próximo passo: registrar evolução corporal”

Subtexto:
“Esta etapa ainda não possui observação suficiente para a jornada integrada.”

CTA:
“Ir para evolução”

Evitar:
“Você precisa…” em tom clínico;
“Seu corpo não está respondendo”;
“Recuperação ruim”.

---

## 5. Avaliar integração

Quando aplicável:

Botão:
**Avaliar integração**

Texto auxiliar:
“Executa o motor F11 com os dados atuais. Se não houver informação suficiente, a avaliação será registrada como pausada.”

Nunca executar sem clique.

---

## 6. Mobile

Alvos:
- 320;
- 360;
- 375;
- 390;
- 412;
- 430 px.

Requisitos:
- zero overflow da página;
- cards empilhados;
- status com wrap;
- CTA >=44px;
- navegação Health rolável permanece funcional;
- nenhuma tabela larga;
- reason codes traduzidos, máximo 3 inicialmente com expansão opcional.

---

## 7. Desktop

Pode usar:
- linha/stepper vertical ou grid;
- não depender de hover;
- manter ordem lógica J1→J7.

---

## 8. Acessibilidade

- status nunca só por cor;
- ícone com texto;
- foco visível;
- botões com nomes completos;
- loading anunciado;
- erro técnico com mensagem específica.

---

## 9. Backend indisponível

Se F11 ainda não estiver operacional no ambiente:

Mostrar:
“Motor integrado ainda não está disponível neste ambiente.”

Não mostrar:
“Ainda não há decisão” como se fosse ausência factual.

Essa degradação é obrigatória durante a transição v3.3.

---

## 10. Exames

Card/atalho de exames permanece no Dashboard.

Na jornada:
“Contexto clínico — opcional na jornada v1”.

Não entra na sequência J1→J7.
