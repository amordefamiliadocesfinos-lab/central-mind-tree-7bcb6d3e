# CCH — DECISÃO DE GOVERNANÇA v3.4 — ABERTURA F13

**Data:** 08/11/2026  
**Status:** APROVADA PELO USUÁRIO  
**Escopo:** F13 — Evolução contínua por dados reais  
**Base:** main@093d7935a838282df3c645c90742bd4cf11d7b4b

## Decisão

O usuário determinou continuar para a próxima fase sem aguardar a homologação operacional completa das frentes anteriores.

A F13 fica desbloqueada para:
- arquitetura;
- implementação em branch;
- CI;
- regressões;
- Gate A/merge.

## Limites

A autorização não:
- declara F11 homologada;
- declara F12 homologada;
- remove TESTES MT da F11;
- libera automaticamente banco ou deploy;
- autoriza auto-otimização;
- autoriza alterações automáticas em treino, dieta ou metas;
- cria F14.

## Direção arquitetural

A F13 deve usar histórico real já existente para:
- comparações longitudinais;
- leitura de tendências por domínio;
- revisão de metas;
- candidatos de replanejamento;
- aprendizado operacional auditável.

A v1 deve preferir:
- read-models;
- comparação explícita entre períodos;
- evidência e reason codes;
- revisão humana.

## Princípio

Histórico real pode gerar **elegibilidade para revisão**.

Histórico real não gera automaticamente:
- prescrição;
- causalidade;
- mudança de plano;
- mudança de treino;
- mudança de dieta;
- alteração de meta.

## Governança

F11/F12 mantêm seus próprios estados e gates.

A F13 pode evoluir o código sem fechar esses gates, mas qualquer dependência operacional precisa ser tratada explicitamente antes de deploy/homologação real.
