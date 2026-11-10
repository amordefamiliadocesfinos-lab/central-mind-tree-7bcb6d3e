# F19 — AUTHORITY AMENDMENT V1.1

**Data:** 09/11/2026

A arquitetura v1 previa RPCs SECURITY INVOKER.

Durante o desenho de integridade foi identificado um conflito:
- intervalos temporais precisam usar timestamps do servidor;
- a tabela de timers não deve aceitar INSERT/UPDATE direto do cliente;
- SECURITY INVOKER sem grants diretos não conseguiria persistir os intervalos.

## Decisão

Os RPCs F19 que mutam timers serão **SECURITY DEFINER**, com:

- `SET search_path = ''`;
- `auth.uid() IS NOT NULL`;
- validação explícita `health_can_write_athlete`;
- IDs de atleta derivados das linhas soberanas, nunca aceitos do cliente;
- timestamps gerados pelo banco;
- idempotência por `client_event_id`;
- PUBLIC e anon revogados;
- execução concedida apenas a authenticated;
- nenhuma permissão direta INSERT/UPDATE/DELETE na tabela de timers.

A tabela mantém RLS para SELECT.

Esta mudança aumenta a integridade factual dos tempos e evita que o cliente possa fabricar timestamps diretamente.
