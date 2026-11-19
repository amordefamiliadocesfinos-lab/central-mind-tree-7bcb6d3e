# CCH — Plano orientado por histórico, objetivo recomendado e agenda flexível

## Escopo
Implementação inicial, integrada ao M3/M4/F13/F14/F22 e à PR #952.
Não cria outro motor/programa, não publica automaticamente nem altera dados de produção.

## Jornada
1. Auditoria de sessões/séries válidas por programa-versão (exclui record_status voided).
2. Exposição de cobertura e comparabilidade por exercício e unidade.
3. Pergunta de objetivo, com recomendações fundamentadas e alternativas, sem pressupor gordura corporal.
4. Seleção da estratégia e disponibilidade flexível.
5. Transação SQL invoker: lê somente dados do atleta, valida conclusão da fila via M3, gera draft versionado.
6. Para hipertrofia + progressão, apenas quando existem 2 sessões distintas comparáveis, todas as séries com carga, reps e RIR >=2 e reps >= teto prescrito, propõe +1 ao teto de repetições; sem aumento de cargas ou séries. Caso contrário conserva prescrição e exige revisão.
7. Metadados registram estratégia/objetivo/quantidade de evidências e decisões no parameter_set; publicação continua separada pelo gate F22.

## Limites
- A leitura de F13/F14 permanece como contexto longitudinal/replanejamento externo; não há decisão automática baseada em fatores clínicos ou inferência causal.
- Flexível significa sequência por fila, não calendário fixo; não representa novo agendador.
- Não se altera versão publicada ou histórico. Um rascunho já existente bloqueia geração duplicada.

## Critérios de validação antes de liberar
TypeScript; SQL em ambiente isolado; chamada anônima e outro atleta negadas; repetição da chamada rejeita duplicação; sessões voided fora da amostra; fila bloqueada impede geração; RIR ausente não provoca progressão; versão anterior intocada; publicação manual e gate F22; regressão para Rafaela.
