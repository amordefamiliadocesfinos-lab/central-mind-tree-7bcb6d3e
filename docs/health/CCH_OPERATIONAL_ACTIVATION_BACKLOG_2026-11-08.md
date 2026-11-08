# CCH / SAÚDE — BACKLOG DE ATIVAÇÃO OPERACIONAL

**Data:** 08/11/2026  
**Status:** CONGELADO PARA RETOMADA FUTURA  
**Origem:** fechamento de desenvolvimento F10→F13

## Princípio

Este backlog **não é uma nova macrofase**.

É somente a lista de operações que ficaram deliberadamente adiadas após o desenvolvimento já concluído.

## A. Pendências F10

- homologação visual mobile diretamente na URL de produção;
- registrar evidência final sem inferir PASS a partir de preview.

## B. Pendências F11

- disponibilizar acesso ao TESTES MT canônico;
- executar workflow/testes F11;
- confirmar PASS estrutural e funcional;
- revisar histórico de migrations antes de Gate B;
- Gate B explícito;
- pós-check banco produção;
- Gate C explícito quando aplicável;
- homologação real.

## C. Pendências F12

- validar jornada ponta a ponta com dependências upstream operacionais;
- confirmar que cada etapa usa dados reais;
- confirmar comportamento de decisão pausada;
- confirmar retomada da jornada;
- homologar sem fixtures.

## D. Pendências F13

- executar **Health F13 TESTES MT Validation** no projeto canônico;
- exigir:
  - `F11_TESTES_MT_POSTCHECK_PASS`;
  - `F11_TESTES_MT_FUNCTIONAL_PASS`;
  - `F13_TESTES_MT_POSTCHECK_PASS`;
  - `F13_TESTES_MT_FUNCTIONAL_PASS`;
  - `F13_TESTES_MT_ROLLBACK_PASS`;
- verificar migration history de produção;
- Gate B explícito;
- aplicar migrations F13 somente após Gate B;
- pós-check;
- Gate C explícito;
- deploy;
- homologação com dois períodos reais de 28 dias quando houver dados suficientes;
- registrar outcome humano;
- confirmar histórico e supersession.

## E. Ordem futura recomendada

Quando a ativação for retomada:

1. TESTES MT F11;
2. Gate B F11;
3. pós-check F11;
4. ativação compatível F11/F12;
5. homologação jornada F12;
6. TESTES MT F13;
7. Gate B F13;
8. pós-check F13;
9. Gate C;
10. homologação longitudinal F13;
11. fechamento operacional final.

A ordem pode ser reconciliada conforme dependências reais do ambiente, mas nenhum gate deve ser inferido como concluído.

## F. Itens que não fazem parte deste backlog

Não incluir automaticamente:

- F14;
- novo especialista;
- diagnóstico automático;
- prescrição automática;
- IA como autoridade crítica;
- autoajuste de treino;
- autoajuste de dieta;
- autoalteração de meta;
- novo produto Health separado;
- integração externa como nova fonte soberana.

Qualquer item desse tipo exige alteração formal do Mapa Soberano.
