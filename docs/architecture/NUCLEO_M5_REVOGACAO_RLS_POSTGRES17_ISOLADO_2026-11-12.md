# Núcleo 2.0 — M5 | Ensaio RLS PostgreSQL 17 com revogação e restauração

**Data:** 12/11/2026  
**Mapa soberano:** Núcleo 2.0 V1.0, M5 — Supervisão e IA do Desenvolvimento

## Objetivo

Validar a mudança de acesso após revogação de `nucleo_manage` em um **PostgreSQL 17 temporário**, sem tocar na única concessão ativa do Core oficial ou em qualquer conta de produção.

## Ambiente e fidelidade

O GitHub Actions inicia `postgres:17` em serviço isolado e cria tabelas mínimas de capacidades, frentes, evidências e dependências. Reproduz os predicados RLS verificados no Core de `app_admin_capabilities_select_own`, `nucleo_m3_workstreams_read` e `nucleo_m4_evidence_read`. A política de dependências usa a mesma condição de `nucleo_manage` para completar o ensaio; é uma réplica contratual de leitura e **não** um dump integral do Core.

A identidade autenticada é simulada via `SET LOCAL ROLE authenticated` e reivindicação `request.jwt.claim.sub`, em novas transações na **mesma sessão de conexão**. A concessão é revogada por um comando administrativo de ensaio entre as transações; após a revogação, a mesma identidade não vê frentes nem evidências ao fazer uma nova leitura.

## Seis verificações obrigatórias

1. Identidade `nucleo_manage` ativa lê registros sob RLS.
2. Uma segunda identidade com apenas `provision_users` não obtém autorização Núcleo.
3. Revogação da capacidade, sem alterar a identidade da conexão, impede a próxima leitura RLS.
4. Terceira identidade sem concessão também não tem acesso.
5. Restauração da concessão permite nova leitura RLS autorizada.
6. Papel `authenticated` não consegue alterar suas próprias concessões.

O script usa `psql -v ON_ERROR_STOP=1` e falha na primeira divergência. Nenhum segredo do Painel Central é enviado ao CI.

## Limites do teste

Este ensaio é **uma homologação real do mecanismo PostgreSQL/RLS em banco isolado**, não uma revogação end-to-end do Supabase Auth no navegador publicado. Ele também não testa push de eventos ou remoção instantânea do conteúdo na tela sem nova solicitação: a M5 revalida sob clique, mudança de identidade e retorno da aba.

O teste Node `nucleo-m5-revocation-isolated.test.cjs`, previamente aprovado, cobre a outra parte: impedir que uma resposta assíncrona obsoleta republique dados após a invalidação da sessão. Os dois testes são complementares; um não substitui o outro.

## Preservação

Nenhuma conta real foi criada ou revogada, nenhum `grant` de produção foi modificado e nenhum conteúdo documental foi lido, importado, excluído ou reescrito. M5 permanece `em_validacao`. Não usar a conta administrativa existente como identidade de ensaio.

**Próximo portão real:** um usuário de homologação independente no ambiente de teste, com sessão de navegador controlada e políticas devidamente isoladas. Não declarar esse portão concluído apenas pelos seis testes SQL.
