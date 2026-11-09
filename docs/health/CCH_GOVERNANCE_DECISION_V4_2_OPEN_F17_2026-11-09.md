# CCH — DECISÃO DE GOVERNANÇA v4.2 — ABERTURA F17

**Data:** 09/11/2026  
**Status:** APROVADA POR CONTINUIDADE EXPLÍCITA DO USUÁRIO  
**Base:** `main@5b785e244368aa8e09005d12ee0f4359cc8fa3e8`

## Achado objetivo

A auditoria do módulo Saúde confirmou que:

- dashboards numéricos existem;
- relatórios longitudinais existem;
- estados e históricos factuais existem;
- **nenhum componente de gráfico está presente no módulo Health**;
- o requisito original do produto inclui dashboards e gráficos.

Portanto existe uma lacuna real entre o requisito do CCH e a interface atual.

## Nova frente

### F17 — Analytics Visual e Histórico

Missão:
transformar históricos já existentes em visualizações temporais legíveis, sem criar nova fonte de verdade.

Domínios v1:
- treino;
- alimentação;
- evolução corporal;
- sono/recuperação.

## Autoridade

F17 é read-only.

Não:
- cria facts;
- cria estados;
- cria decisões;
- cria score global;
- altera treino/dieta/meta;
- infere causalidade;
- diagnostica;
- prescreve.

## Política de testes

Mantém a autorização vigente de avançar desenvolvimento sem executar testes agora.

Teste não executado continua não executado.

Gate B não se aplica à F17 v1 se não houver migration.

Gate C/deploy permanece separado.
