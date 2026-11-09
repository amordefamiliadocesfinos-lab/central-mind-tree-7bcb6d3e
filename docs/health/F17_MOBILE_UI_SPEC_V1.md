# F17 — MOBILE UI SPEC V1

## Rota
`/saude/analytics`

## Estrutura

1. título e descrição;
2. seletor 30/90/180 dias;
3. resumo de cobertura;
4. gráfico treino;
5. gráfico alimentação;
6. gráfico corpo;
7. gráfico recuperação;
8. limitações.

## Mobile

- uma coluna;
- altura de gráfico ~260–320 px;
- tooltip acessível;
- cards sem scroll horizontal obrigatório;
- seletor com alvo mínimo 44 px;
- legendas curtas;
- dados ausentes sem ponto fictício.

## Desktop

Pode usar grid 2 colunas quando houver espaço.

## Estados vazios

Cada domínio deve explicar:
- “Sem dados neste período”;
- não mostrar linha plana em zero.

## Limitações visíveis

- associação não é causalidade;
- ausência não é zero;
- volume kg não inclui lb/bodyweight;
- escalas de recuperação são percepções ordinais.
