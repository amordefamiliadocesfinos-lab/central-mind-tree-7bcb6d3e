# F15 — RELATÓRIOS LONGITUDINAIS — OPENING

**Data:** 08/11/2026
**Status:** ARQUITETURA ABERTA
**Mapa:** CCH v4.0 FROZEN

## Missão

Transformar os dados já consolidados pelo CCH em um relatório longitudinal legível, exportável e auditável, sem criar uma nova fonte de verdade.

## Princípios

- leitura apenas;
- sem score global;
- sem diagnóstico;
- sem causalidade automática;
- ausência continua ausência;
- cobertura/confiança permanecem visíveis;
- relatório não altera fatos, estados, decisões ou planos.

## Fonte v1

F15 consome:

- F13 revisão longitudinal;
- outcome humano F13;
- F14 caso de replanejamento e itens;
- identidade básica do atleta.

## Saída v1

- relatório em tela;
- impressão via navegador;
- exportação JSON estruturada;
- período e data-base explícitos;
- seções por domínio;
- contexto de revisão/replanejamento;
- avisos de limitação.

## Sem persistência v1

F15 v1 não cria tabela própria.

O relatório é uma projeção de leitura dos dados soberanos existentes.
