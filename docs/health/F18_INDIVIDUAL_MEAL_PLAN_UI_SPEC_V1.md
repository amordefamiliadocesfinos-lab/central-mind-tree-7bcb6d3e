# F18 — UI / UX SPEC V1

## Mobile first

### Barra de contexto

No topo:
- atleta;
- plano;
- versão;
- status draft/published.

### Abas

Usar Tabs:
- Plano
- Refeições
- Receitas
- Diário
- Evolução

## Plano

Expor todos os campos já suportados por `health_nutrition_targets`:
- kcal min/max;
- proteína min/max;
- carboidrato min/max;
- gordura min/max;
- fibra min/max.

Mostrar aviso:
"Metas são alvos do plano; o diário continua registrando o consumo real."

## Refeições

Fluxo:
1. criar padrão de dia;
2. adicionar refeição;
3. adicionar alimento ou receita;
4. adicionar alternativa quando necessário.

Cada card de refeição mostra:
- nome;
- horário;
- itens;
- totais previstos.

Cada item mostra:
- quantidade;
- unidade;
- macros;
- alternativas.

## Publicado

Quando a versão estiver publicada:
- todos os controles de edição F18 ficam bloqueados;
- leitura permanece disponível.

## Estados vazios

Sem padrão:
"Crie a estrutura do dia antes das refeições."

Sem itens:
"Esta refeição ainda não tem itens prescritos."

## Segurança semântica

Nunca rotular plano prescrito como:
- "consumido";
- "feito";
- "aderido".

Esses termos pertencem ao diário/estado M6.
