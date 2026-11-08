# F11 — TESTES MT ADIADO PARA PRÉ-GATE B

**Data:** 08/11/2026  
**Status:** PENDENTE · NÃO BLOQUEADOR DO GATE A  
**Mapa soberano:** v3.2 FROZEN  
**Escopo:** F11 — Motor Integrado CCH

## Decisão vigente

Por autorização explícita do usuário, TESTES MT foi adiado para uma etapa posterior.

Na v3.2:
- não bloqueia implementação;
- não bloqueia CI descartável;
- não bloqueia Gate A/merge;
- continua obrigatório antes do Gate B de produção.

## Estado F11

- arquitetura: ✅
- implementação: ✅
- PostgreSQL descartável: ✅
- RLS/segurança/cross-athlete: ✅
- regressão F10: ✅
- regressão M9: ✅
- TESTES MT real: ⏳ adiado
- Gate A: apto após reconciliação final do diff
- Gate B: bloqueado até TESTES MT PASS
- Gate C: bloqueado

## Infraestrutura preservada para a fase posterior

O workflow `Health F11 TESTES MT Validation` permanece versionado para execução manual futura via `workflow_dispatch`.

Ele mantém:
- alvo fixo no TESTES MT `enfekhgcsbzovxtqdlwh`;
- recusa de URL que não identifique esse projeto;
- aplicação somente das 4 migrations F11;
- pós-check estrutural e de segurança;
- smoke funcional transacional;
- rollback de dados sintéticos;
- prova de não persistência dos dados artificiais.

## Regra

A ausência de TESTES MT não pode ser registrada como PASS.

Ela permanece pendente até execução real.

Produção não pode substituir TESTES MT.
