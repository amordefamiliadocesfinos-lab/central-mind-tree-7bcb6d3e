# CCH — DECISÃO DE GOVERNANÇA v3.2 — TESTES MT ADIADO

**Data:** 08/11/2026  
**Status:** APROVADA PELO USUÁRIO  
**Escopo:** método de progressão do CCH  
**Não altera:** escopo funcional F10→F13

## Decisão

TESTES MT passa a ser uma etapa de homologação técnica posterior ao merge da implementação.

Ele não deve bloquear:
- desenvolvimento em branch;
- conclusão da implementação;
- CI descartável;
- revisão de código;
- Gate A / merge em `main`.

## Limite

TESTES MT continua obrigatório **antes do Gate B** quando a frente exigir migration/DDL em produção.

Portanto:

branch → CI descartável → Gate A/merge → TESTES MT → Gate B produção → Gate C deploy.

## Motivo

Evitar que indisponibilidade de credencial/infraestrutura do ambiente TESTES MT paralise a evolução do programa, mantendo ao mesmo tempo uma barreira técnica antes de alterações de banco em produção.

## F11

Para a PR #499:
- implementação: concluída;
- CI F11: PASS;
- regressão F10: PASS;
- regressão M9: PASS;
- TESTES MT: pendente, **não bloqueador do Gate A**;
- Gate B permanece bloqueado até PASS real no TESTES MT.

## Invariantes preservadas

- produção não é ambiente de teste;
- migration precisa estar em `main` antes do Gate B;
- TESTES MT não pode ser inferido;
- Lovable Builder/agent continua proibido;
- Gate A/B/C continuam distintos;
- F12/F13 mantêm seus próprios gates.
