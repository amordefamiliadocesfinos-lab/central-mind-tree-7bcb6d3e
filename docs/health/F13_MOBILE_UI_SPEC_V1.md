# F13 — MOBILE UI SPEC v1

**Status:** DOCUMENTAL  
**Rota:** /saude/revisao

---

## 1. Cabeçalho

Título:
**Revisão longitudinal**

Subtexto:
“Compare períodos reais e registre uma revisão. As diferenças não são uma nota de saúde nem uma recomendação automática.”

---

## 2. Contexto da meta

Card:
- meta primária;
- fase ativa;
- data de início;
- target date quando houver.

Não mostrar percentual de progresso sem métrica-alvo formal.

---

## 3. Períodos

Mostrar explicitamente:

Atual:
DD/MM → DD/MM

Anterior:
DD/MM → DD/MM

Janela:
28 dias.

---

## 4. Cards comparativos

Ordem:
1. Treino
2. Alimentação
3. Evolução corporal
4. Recuperação
5. Decisão integrada — contexto

Cada card:
- current;
- prior;
- delta quando válido;
- cobertura/confiança;
- unavailable explícito.

---

## 5. Semáforos

Não usar verde/vermelho como “bom/ruim” clínico.

Pode usar:
- neutro;
- disponível;
- indisponível;
- atenção operacional de dados.

---

## 6. Gerar revisão

Botão:
**Gerar revisão longitudinal**

Ação explícita.

Não rodar automaticamente.

Se paused:
mostrar:
“Revisão gerada, mas não há domínios comparáveis suficientes neste momento.”

---

## 7. Registrar resultado

Após run:

Título:
**Resultado da revisão**

Opções:
- Continuar observando
- Revisar objetivo/fase
- Revisar treino
- Revisar alimentação
- Revisar recuperação
- Revisar múltiplas áreas
- Dados insuficientes

Pode haver notas opcionais.

---

## 8. CTA após outcome

Exemplos:
- review_goal → “Abrir perfil e objetivo”
- review_training → “Abrir programa”
- review_nutrition → “Abrir alimentação”
- review_recovery → “Abrir recuperação”

CTA navega.

Não aplica mudanças.

---

## 9. Mobile

Alvos:
320–430 px.

Requisitos:
- cards empilhados;
- current/prior legíveis sem tabela larga;
- deltas quebram linha;
- CTA >=44 px;
- notes textarea responsiva;
- zero overflow da página.

---

## 10. Desktop

Pode usar grid 2 colunas.

Não depender de hover.

---

## 11. Histórico

Mostrar lista de outcomes anteriores:
- data;
- outcome;
- targets;
- autor quando apropriado.

Não mostrar snapshot JSON cru.

---

## 12. Acessibilidade

- status com texto;
- foco visível;
- labels completos;
- campos com descrição;
- loading e erro anunciáveis.
