# CCH — DECISÃO DE GOVERNANÇA v4.0 — ABERTURA DAS PRÓXIMAS FRENTES

**Data:** 08/11/2026  
**Status:** APROVADA EXPLICITAMENTE PELO USUÁRIO  
**Base:** `main@e1893f10bd1d706db2890a65de890064d6eeee36`

## Decisão

O usuário autorizou explicitamente a continuidade para novas frentes do CCH sem aguardar os testes atualmente adiados.

Esta decisão:

- encerra a trava anterior que proibia abrir frente além da F13;
- mantém TESTES MT adiados;
- mantém Gate B e Gate C separados;
- não transforma teste não executado em PASS;
- não autoriza alteração de banco produção sem Gate B;
- não autoriza deploy sem Gate C;
- mantém Git/GitHub/código como método de implementação;
- não autoriza Lovable Builder como autor.

## Novas frentes aprovadas

### F14 — Replanejamento Assistido

Missão:
transformar uma revisão F13 e seu outcome humano em um caso de replanejamento explícito, auditável e humano.

F14 pode:
- abrir caso de revisão;
- registrar quais domínios precisam de revisão;
- preservar snapshot/evidência;
- registrar decisão humana por domínio;
- registrar notas e estado do caso;
- direcionar para o módulo especialista apropriado.

F14 não pode:
- alterar automaticamente treino;
- alterar automaticamente dieta;
- alterar automaticamente meta/fase;
- inferir diagnóstico;
- prescrever tratamento;
- usar IA como autoridade final.

### F15 — Relatórios Longitudinais

Missão:
consolidar dados e evolução em relatórios legíveis e exportáveis, preservando fonte, período, cobertura e confiança.

Não cria score global nem diagnóstico.

### F16 — Lembretes e Rotina

Missão:
permitir lembretes de registro e acompanhamento, com controle explícito do usuário.

Não deve criar comportamento compulsivo, alertas clínicos automáticos ou decisões de treino/dieta.

## Política de execução sem testes

Arquitetura, migrations versionadas, frontend, hooks, contratos e documentação podem avançar sem aguardar testes.

Entretanto:

- qualquer migration nova permanece somente em Git até Gate B;
- backend ausente deve ser tratado explicitamente pela UI;
- nenhuma homologação operacional é inferida;
- nenhuma frente é marcada PASS operacional sem evidência real.

## Ordem

1. F14 arquitetura;
2. F14 implementação;
3. F15 arquitetura/implementação;
4. F16 arquitetura/implementação;
5. ativação/testes quando o usuário decidir retomar.
