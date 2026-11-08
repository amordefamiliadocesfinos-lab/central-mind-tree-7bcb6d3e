# CCH — DECISÃO DE GOVERNANÇA — TESTES E ATIVAÇÃO ADIADOS

**Data:** 08/11/2026  
**Status:** APROVADA PELO USUÁRIO  
**Escopo:** CCH / Saúde — F10→F13  
**Base:** `main@c2067e27a79df0d278cb4b1c3e325237046a7dd1`

## Decisão

O usuário determinou explicitamente que **os testes operacionais não serão realizados agora** e autorizou a continuidade do trabalho dentro do escopo já congelado.

A decisão mantém:

- TESTES MT adiado;
- Gate B adiado;
- Gate C/deploy adiado;
- homologação operacional adiada;
- desenvolvimento/documentação permitidos;
- nenhuma abertura de F14;
- nenhuma alteração silenciosa do Mapa Soberano;
- nenhuma utilização do Lovable Builder como autor do CCH.

## Consequência

A ausência de TESTES MT:

- não invalida o código já mergeado;
- não transforma teste não executado em PASS;
- não autoriza migration em produção;
- não autoriza deploy de UI dependente de schema ausente;
- não autoriza homologação por inferência.

O estado correto passa a ser:

**desenvolvimento implementado e consolidado; ativação operacional deliberadamente postergada.**

## Fronteira de continuidade

Enquanto os testes permanecerem adiados, são permitidos:

- consolidação documental;
- auditoria estática;
- hardening sem mudança de autoridade;
- organização do backlog de ativação;
- manutenção corretiva não dependente de produção;
- preservação dos contratos e do mapa.

Continuam bloqueados:

- Gate B de qualquer migration ainda não validada em TESTES MT;
- alterações de banco de produção F11/F13;
- Gate C quando a UI depender desses schemas;
- declaração de jornada F12/F13 homologada em dados reais;
- nova macrofase além de F13.

## Regra de retomada

Quando o usuário decidir testar/ativar:

1. retomar do checkpoint versionado;
2. executar TESTES MT canônico;
3. registrar PASS/FAIL real;
4. somente depois avaliar Gate B;
5. pós-check;
6. somente depois avaliar Gate C/deploy;
7. homologação real separada.

Esta decisão altera o **momento dos gates**, não o escopo nem a autoridade do sistema.
