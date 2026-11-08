# F14 — CONTRATO DE AUTORIDADE E DECISÃO V1

## Autoridade permitida

F14 pode:

- ler revisão F13;
- ler outcome humano F13;
- congelar evidência;
- registrar workflow de revisão;
- registrar decisão humana;
- registrar conclusão/void;
- orientar navegação ao especialista.

## Autoridade proibida

F14 não pode executar:

- UPDATE/INSERT em meta/fase;
- publicação de programa de treino;
- alteração de prescrição;
- mudança de calorias/macros;
- criação de medida corporal;
- alteração de estado de recuperação;
- escrita clínica;
- recomendação médica;
- auto-replanning.

## Semântica

### keep_current

Decisão humana de manter o estado atual no domínio.

Não significa que o sistema validou a eficácia da estratégia.

### revise

Indica que o domínio deve ser revisado no especialista.

Não contém prescrição obrigatória.

### defer

A revisão fica deliberadamente adiada.

### not_applicable

O domínio não requer ação dentro deste caso.

## Conclusão do caso

Um caso concluído significa:

> “a revisão humana dos itens deste caso foi registrada.”

Não significa:

> “todas as alterações foram aplicadas e homologadas.”

## Princípios

- outcome humano != ação aplicada;
- revisão != prescrição;
- associação != causalidade;
- desconhecido != zero;
- replanejamento assistido != replanejamento automático;
- F14 nunca toma posse da fonte soberana do especialista.
