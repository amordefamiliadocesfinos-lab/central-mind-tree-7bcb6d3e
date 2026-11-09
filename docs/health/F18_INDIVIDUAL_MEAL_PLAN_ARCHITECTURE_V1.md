# F18 — PLANO ALIMENTAR INDIVIDUAL — ARQUITETURA V1

**Data:** 09/11/2026
**Mapa:** CCH v4.4 FROZEN

## 1. Missão

Transformar o plano nutricional M5 em uma prescrição alimentar estruturada por atleta, sem misturar planejamento com consumo real.

## 2. Princípio central

**PRESCRIÇÃO != EXECUÇÃO**

F18 descreve o que foi planejado.
M5 diário descreve o que foi consumido.

Nunca copiar automaticamente uma refeição prescrita para o diário como fato consumido.

## 3. Modelo de dados

### health_nutrition_day_patterns

Representa uma organização de dia dentro de uma versão do plano.

Campos principais:
- plan_version_id;
- athlete_id;
- code;
- name;
- day_type: default | training | rest | custom;
- sequence_order;
- is_default;
- notes.

### health_nutrition_planned_meals

Representa uma refeição prescrita.

Campos:
- day_pattern_id;
- plan_version_id;
- athlete_id;
- meal_type;
- name;
- sequence_order;
- time_start/time_end opcionais;
- notes.

### health_nutrition_planned_items

Representa um item prescrito.

Origem:
- food;
- recipe.

Exatamente uma origem deve existir.

Campos:
- planned_meal_id;
- athlete_id;
- sequence_order;
- source_kind;
- food_id ou recipe_version_id;
- quantity;
- unit_code;
- macro snapshots;
- notes;
- is_optional.

### health_nutrition_item_alternatives

Alternativa estruturada para um item principal.

Campos equivalentes ao item prescrito, com:
- planned_item_id;
- sequence_order;
- source_kind;
- food/recipe;
- quantidade/unidade;
- macro snapshots;
- notes.

Alternativa não substitui automaticamente o item principal.

## 4. Snapshot nutricional

Itens e alternativas guardam snapshots de:
- energy_kcal;
- protein_g;
- carbohydrate_g;
- fat_g;
- fiber_g.

Motivo:
preservar o significado nutricional da versão do plano mesmo se o cadastro global do alimento mudar depois.

## 5. Imutabilidade

Enquanto `health_nutrition_plan_versions.status='draft'`:
- INSERT/UPDATE/DELETE permitidos sob RLS.

Quando `status='published'`:
- F18 é read-only;
- qualquer mudança futura exige nova versão do plano.

## 6. RLS

Toda tabela pública:
- RLS habilitado;
- SELECT condicionado a `health_can_read_athlete(athlete_id)`;
- INSERT/UPDATE/DELETE condicionado a:
  - `health_can_write_athlete(athlete_id)`;
  - versão pai em draft.

Não usar SECURITY DEFINER na v1.

## 7. Relação com metas

`health_nutrition_targets` continua soberana para metas diárias.

A soma das refeições prescritas pode ser exibida como comparação com as metas, mas não deve sobrescrevê-las automaticamente.

## 8. Padrões de dia

V1 suporta:
- default;
- training;
- rest;
- custom.

Não existe carb cycling automático.
Se diferentes padrões forem usados, isso será uma decisão explícita do plano.

## 9. UI

A área Alimentação será reorganizada em abas:

1. Plano
2. Refeições
3. Receitas
4. Diário
5. Evolução

### Plano
- nome;
- estratégia;
- kcal;
- proteína;
- carboidratos;
- gorduras;
- fibras;
- publicação.

### Refeições
- padrões de dia;
- refeições;
- itens;
- alternativas;
- totais previstos.

### Receitas
- editor existente.

### Diário
- consumo real existente.

### Evolução
- M6 + M7 e links para Analytics/Relatórios.

## 10. Autoridade

F18 não:
- registra consumo;
- ajusta meta automaticamente;
- escolhe alternativa automaticamente;
- altera treino;
- altera peso;
- cria diagnóstico;
- publica plano sem ação explícita do usuário.

## 11. Gate B

A migration será versionada em Git, mas não aplicada à produção sem autorização explícita.
