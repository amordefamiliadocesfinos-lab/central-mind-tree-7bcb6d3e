# F18 — PLANO ALIMENTAR INDIVIDUAL — DEVELOPMENT CLOSURE

**Data:** 09/11/2026
**Status:** IMPLEMENTADA EM GIT · GATE B/C PENDENTES
**Base:** `main@0c8737d386ab30a8f8fad14c5bee1947a54f72fc`

## Arquitetura

- Mapa v4.4 FROZEN
- PR #542 — arquitetura F18 v1

## Implementação

- PR #546
- merge: `0c8737d386ab30a8f8fad14c5bee1947a54f72fc`

## Migration

`supabase/migrations/20261109210340_health_f18_individual_meal_plan.sql`

Nome gerado oficialmente com Supabase CLI 3.1.0.

A migration está somente em Git.
Não foi aplicada em produção por esta frente.

## Entregas

### Dados
- padrões de dia;
- refeições prescritas;
- itens prescritos;
- alternativas/substituições;
- snapshots nutricionais.

### Macros
- energia;
- proteína;
- carboidratos;
- gorduras;
- fibras.

### Segurança
- RLS nas quatro tabelas F18;
- escrita condicionada a permissão do atleta;
- escrita condicionada a versão draft;
- versão publicada imutável;
- funções internas SECURITY INVOKER;
- macros congelados pelo banco a partir da fonte nutricional.

### Interface
Alimentação reorganizada em:
- Plano;
- Refeições;
- Receitas;
- Diário;
- Evolução.

O editor de metas agora expõe todos os macros já suportados por M5.

## Autoridade

F18 não:
- cria consumo real;
- copia prescrição para o diário;
- altera meta automaticamente;
- escolhe alternativa automaticamente;
- altera treino;
- altera peso;
- altera estado M6;
- altera decisão M7.

## Estado

- arquitetura: ✅
- implementação Git: ✅
- migration versionada: ✅
- auditoria estática de autoridade: ✅
- testes: ⏳ adiados
- Gate B: ⛔ não executado
- Gate C/deploy: ⛔ não executado
- plano numérico específico de Deividi: ⏳ ainda precisa de dados atuais e publicação humana explícita
