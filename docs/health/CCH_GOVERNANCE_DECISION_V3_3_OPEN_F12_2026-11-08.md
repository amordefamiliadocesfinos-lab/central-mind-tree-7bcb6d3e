# CCH — DECISÃO DE GOVERNANÇA v3.3 — ABERTURA F12

**Data:** 08/11/2026  
**Status:** APROVADA PELO USUÁRIO  
**Escopo:** F12 — Jornada real completa  
**Base:** main@a91442207bb1ef983dc0aa5fedd352206baae158

## Decisão

O usuário determinou que o programa continue para a próxima fase sem aguardar o TESTES MT da F11.

A F12 fica desbloqueada para:
- arquitetura;
- implementação em branch;
- CI;
- regressões;
- Gate A/merge.

## Limites

A autorização não:
- declara F11 homologada;
- remove TESTES MT da F11;
- libera Gate B F11;
- libera Gate C F11;
- libera automaticamente deploy F12;
- libera F13.

## Dependência operacional

A F12 pode ser desenvolvida e integrada ao código oficial antes da publicação operacional F11.

Porém a homologação real ponta a ponta da F12 exige que as dependências usadas no fluxo estejam realmente operacionais.

Se a F12 consumir dados F11:
- não deve ser publicada antes de o schema/RPC F11 correspondente existir em produção;
- ou deve possuir degradação segura explícita que não gere erro nem invente estado.

## Direção arquitetural

A F12 deve orquestrar a jornada usando fontes existentes.

Preferência:
- nenhuma tabela F12 própria na v1;
- nenhuma duplicação de fonte de verdade;
- estado da jornada derivado em leitura;
- CTAs apenas operacionais/navegacionais;
- nenhuma recomendação clínica/nutricional/de treino nova.

## Sequência preservada

F10 → F11 → F12 → F13 continua sendo a ordem macro.

A exceção altera o critério de avanço do desenvolvimento, não a dependência lógica do produto.
