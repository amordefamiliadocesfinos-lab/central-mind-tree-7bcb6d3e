# CCH — Motor de recomendação baseado em resultados V2 (19/11/2026)

## Arquitetura
Sem sistema paralelo. `health_cch_assess_cycle` executa auditoria somente leitura da versão publicada, usando M4 e perfil F22 e contexto de recuperação quando recente. F13 e F14 permanecem visíveis na jornada; não inventar decisões nem causalidade.

## Lógica
- Excluir sessões voided, aborted e sets não concluídos/não working.
- Comparar apenas mesmo exercício e carga numérica/unidade idênticas, em duas sessões válidas distintas; não equiparar equipamentos.
- Se faltam reps/RIR, reter e explicar dados insuficientes.
- Queda do melhor número de repetições na mesma carga: sinalizar revisão, sem inferir fadiga.
- Última exposição igual ou superior à anterior, alcançando teto prescrito e RIR recente 2–6: marcar candidato a +1 no teto de repetições **apenas** para hipertrofia + estratégia de progressão.
- Os demais objetivos/estratégias recebem proposta conservadora editável sem mudanças automáticas de carga, séries ou RIR.
- Snapshot completo da auditoria gravado no `parameter_set.guided_cycle` da nova versão. Publicação continua manual com gate F22.
- Restrições de acesso via invoker, health_can_read/write_athlete e RLS.

## Limitações explícitas
Um único par de sessões não prova progressão longitudinal ou recuperação. Resultados de força, diferenças de biomecânica e equipamento não são extrapolados. A evolução é orientada e limitada pelo sinal observado; estratégias mais abrangentes exigirão validação científica e de produto.

## Verificação necessária
SQL em banco de teste: RLS, dados nulos, sessões voided, unidades misturadas, mesma carga distinta, processamento de zero ajustes, idempotência e histórico preservado. Interface: erro, ausência de contexto, recomendações, seleção, rascunho, gate de publicação e regressão Rafaela.
