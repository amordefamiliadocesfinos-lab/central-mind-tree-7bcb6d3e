# F11 — MOTOR INTEGRADO CCH — OPENING REPORT

**Data:** 08/11/2026  
**Status:** DESBLOQUEADA SOMENTE PARA ARQUITETURA/DOCUMENTAÇÃO  
**Autoridade:** autorização explícita do usuário em 08/11/2026  
**Mapa proposto:** v3.1 FROZEN  
**Base:** `main@0852b8204d8fbb8085fee8aaa7073dd64d8d727e`

## 1. Motivo do desbloqueio

A F10 está:
- implementada;
- testada;
- integrada em `main`;
- publicada em produção;
- homologada visualmente em desktop produção;
- validada em layout mobile no preview.

Permanece apenas:
- prova visual mobile diretamente na URL de produção.

O usuário autorizou explicitamente desbloquear a F11 antes dessa última prova visual.

## 2. Limite da autorização

A F11 fica aberta **somente para arquitetura e documentação**.

Não estão autorizados nesta abertura:
- implementação;
- migration;
- DDL;
- banco produção;
- deploy;
- decisão automática real;
- alteração de treino;
- alteração de dieta;
- diagnóstico;
- F12;
- F13.

## 3. Missão arquitetural F11

Definir o Motor Integrado CCH capaz de orquestrar estados já existentes sem transformar correlação em causalidade e sem permitir decisão crítica baseada em dados insuficientes.

O contrato deverá obrigatoriamente definir:
- entradas soberanas por especialista;
- data sufficiency integrada;
- regras de elegibilidade;
- `DECISION_PAUSED`;
- reason codes;
- algorithm version;
- evidence snapshot;
- target domain;
- decisão vs ação;
- autoridade humana;
- conflitos entre domínios;
- prioridade de regras;
- auditabilidade;
- idempotência;
- supersession/void quando aplicável;
- segurança/RLS;
- TESTES MT;
- critérios de homologação.

## 4. Princípios obrigatórios

- `unknown != zero`;
- fato != estado != decisão != ação;
- ausência de dado não autoriza inferência;
- biomarcador não é diagnóstico;
- sono/recuperação não altera treino sem contrato;
- evolução corporal não altera dieta sem contrato;
- IA não é autoridade final;
- decisão clínica automática continua proibida;
- `DECISION_PAUSED` é resultado válido;
- toda decisão deve ser explicável e versionada.

## 5. Relação com F10

F11 pode ler os mesmos estados especialistas usados pelo Dashboard, mas **não usa o Dashboard como fonte de verdade**.

F10 = projeção/read model.  
F11 = motor de decisão versionado.

Nenhuma regra de decisão pode ficar escondida em componentes F10.

## 6. Próximo passo

Criar e revisar:
- arquitetura F11 v1;
- contrato de entradas;
- contrato de suficiência;
- taxonomia de decisões e reason codes;
- desenho de ledger;
- desenho de segurança;
- plano TESTES MT;
- critérios de aceitação.

Somente depois:
**Gate A documental F11.**
