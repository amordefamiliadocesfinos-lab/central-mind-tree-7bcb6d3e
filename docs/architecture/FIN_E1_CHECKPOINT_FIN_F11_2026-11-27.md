# FIN — checkpoint E1 / FIN-F11 — 27/11/2026
Mapa Mestre Financeiro e Fiscal V2.1 congelado. Registro GitHub; REG-FIN-01 permanece pendente no Núcleo.
## Evidências
- PR #1180 integrada a90cd63104bb13eaa8c19d4f4330f130b6c02b3c, CI #46027014583: proteção de edição de compra, não retificação transacional.
- PR #1188 prova descartável; #1193 migration integrada eddee0cf37954a07f04b204d23f88dfd61522f1f, CI #46033731604. Cloud confirmou hash 062c28d51539641e2b86b943603556af; histórico schema_migrations versão 20261127170000 não encontrado na consulta anterior. Uso real e demais writers pendentes.
- PR #1203 integrada 2b4c1eb624aa2d11b03f950a386735a2d6ba06a7, CI #46057452726: diagnóstico somente leitura; não regularização.
- PR #1206 integrada 0217faaefab7554295c0d206c8fda4690b6a2533, CI #46059470272: modelo puro de ajustes; persistência pendente de decisão.
- PR #1210 integrada 2f873050a96933cfcbb4d92af1ec98e0ce19f2b1, CI #46060482657: caixa por movement_date e conta efetiva; 19 testes, TypeScript, build. Publicação e consulta autenticada não comprovadas.
## Contraprova FIN-F11 (somente leitura)
Cloud oficial projeto 1720a410-34cd-4410-995c-8c92c7edf16b. Consulta:
```sql
select to_char(m.movement_date,'YYYY-MM') periodo,count(*) movimentos,
round(sum(case when e.type='receber' then m.value else 0 end),2) entradas,
round(sum(case when e.type='pagar' then m.value else 0 end),2) saidas,
round(sum(case when e.type='receber' then m.value else -m.value end),2) liquido
from financial_movements m join financial_entries e on e.id=m.entry_id
where m.movement_date >= '2026-10-01' and m.movement_date < '2026-12-01'
group by 1 order by 1;
```
Outubro: 192 movimentos; entradas 37961.39; saídas 45833.49; líquido -7872.10.
Novembro: 125 movimentos; entradas 32558.31; saídas 29237.49; líquido 3320.82.
317 movimentos com conta e obrigação ativa. Valores são snapshot dos registros existentes, não extrato bancário independente. Reconsultar se houver novas baixas.
Obrigação 8298b070-e2ad-4a6b-baf4-0349749cd323: vencimento 26/10, quitação 03/11, movimentos 20/10 480, 23/10 160, 28/10 320, 03/11 320. Esperado outubro 960 e novembro 320.
Gate funcional: abrir Financeiro autenticado, selecionar cada período sem filtros adicionais, comparar cards, análise interativa e mobile, confirmar conta do movimento, ausência de erro PostgREST e diferença entre vencimento e movimento. Sem criar pagamentos. Se valores mudaram, obter novo oráculo por SQL. Não homologar antes de readback.
## Pendências
E1.1 PC-00054 natureza dos R$45 não comprovada; retificação transacional pendente. E1.3 outros writers. E1.4–6 25 registros fracionados, quatro resíduos, divergência Caixa Principal: diagnóstico, não correção. E1.7 persistência principal versus caixa requer decisão transversal. E1.8 emissão NF não deve conciliar; decisão transversal pendente. E1.9 e E1.10 contraprovas autenticadas. E1 não encerrada.
Errata da baseline PC-00034: presença e quitação comprovadas; causa da ausência anterior na interface não comprovada. Não atribuir definitivamente ao filtro temporal.
Nenhuma regularização histórica autorizada. Próximo gate: contraprova funcional FIN-F11 e ferramenta de integridade, preparar decisões transversais separadas. Preservar V2.1 e REG-FIN-01.
