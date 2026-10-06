# PLANO_TRANSICAO_PRODUCAO_V1_0_CONGELADO

Status: CONGELADO PARA EXECUCAO
Data: 2026-10-06

## Verdade arquitetural
Pedido/Shopee -> MRP -> OP -> Produzir -> Production Fact -> Estoque/BOM -> Produção Real -> Fechamento -> Financeiro.

Regras:
1. MRP planeja.
2. OP organiza e acompanha.
3. production_facts é a verdade física nova.
4. Estoque só muda por fato físico.
5. production_entries e production_logs permanecem somente como legado.
6. Nenhuma nova fonte paralela de produção será criada.

## Ordem de execução congelada
PR-A — T1 Observabilidade / Produção Real
PR-B — T3 Fechar escritor antigo em OP nova
PR-C — T4 OP factual
PR-D — T5 MRP por saldo restante da OP
PR-E — T2 Unificar Produzir + Lotes
PR-F — T6 Navegação enxuta
PR-G — T7 Legado somente leitura
T8 — Validação integrada em uso real

## Fora do escopo
- WIP detalhado entre processos;
- novo motor de estoque;
- nova tabela paralela de produção;
- novo MRP;
- reconstrução das OPs legadas;
- exclusão de production_entries, production_logs ou OPs históricas;
- automação de fechamento não comprovada por uso real.

## Critério de encerramento
O ciclo deve operar sem dupla escrita:
Pedido/MRP -> OP -> Produção Real -> Estoque -> OP restante -> MRP recalculado -> Fechamento.
