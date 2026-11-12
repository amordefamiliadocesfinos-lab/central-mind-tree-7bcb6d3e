# Núcleo 2.0 — M4 | Homologação individual de 18 evidências e reconciliação no Core

**Data:** 12/11/2026  
**Autoridade:** autorização explícita do proprietário, após apresentação da triagem fundamentada PR #640.  
**Mapa:** Núcleo 2.0 V1.0, M4 — integração técnica.

## Fontes revisadas e homologadas

Antes da reconciliação, o especialista conferiu individualmente na API oficial do GitHub **12 PRs** com `merged=true` e seus `merge_commit_sha` e **6 execuções GitHub Actions** com `status=completed`, `conclusion=success` e `head_sha`. A atribuição por frente foi confrontada com a triagem fundamentada de [PR #640](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/640).

| Frente | PRs homologadas | CI homologados |
|---|---|---|
| NUC-M0 | #601 | — |
| NUC-M1 | #610 | — |
| NUC-M2 | #612 | — |
| NUC-M3 | #615, #616, #617 | — |
| NUC-M4 | #621, #632, #633, #634, #635, #636 | 43237750950, 43237455679, 43235270389, 43235861062, 43234161489, 43238665693 |

**Limite:** as PRs comprovam merge e as execuções comprovam sucesso da respectiva CI, não conclusão de M0–M4. Os IDs #591, #594, #598 e #606 fechados sem merge e #604 ainda aberta continuam **excluídos da homologação como entregas integradas**.

## Procedimento efetivamente executado

1. Consulta às 18 fontes GitHub; todas conferidas individualmente.
2. Leitura do inventário existente em `nucleo_development_evidence`: 16 referências anteriores, nenhuma das 18 novas já presente.
3. Transação administrativa com guardas de contagem de frentes/eventos/referências/documentos/grants, tabela temporária de 18 itens, verificação de códigos, existência das frentes e ausência de colisões globais por `source/kind/external_key`.
4. Inserção **somente** em `public.nucleo_development_evidence` como `verificado`, com `checked_at`, URL, SHA e nota de proveniência; uso do papel administrativo autorizado, não do workflow diário read-only.
5. Validação transacional e consulta independente após o COMMIT: 34 evidências, zero duplicatas globais, nenhuma atualização ou exclusão das 16 originais.

## Estado posterior verificado diretamente no Core

| Verificação | Resultado |
|---|---:|
| Evidências técnicas M4 | **34** |
| Evidências novas | **18** |
| Duplicidade global de GitHub ID | **0** |
| Frentes | 7 |
| Eventos históricos M3 | 11 |
| Referências privadas Drive M2 | 3 |
| Documentos M1 importados | 0 |
| Concessões `nucleo_manage` ativas | 1 |
| Leitura com identidade autorizada | 34 evidências |
| Leitura sem concessão | 0 evidências |

Distribuição por frente, incluindo registros preexistentes: M0 1 PR; M1 2 migrations + 2 PRs + 1 CI; M2 1 migration + 2 PRs; M3 2 migrations + 5 PRs + 2 CI; M4 9 PRs + 7 CI.

## Continuidade e limitações

- O Core recebe evidências apenas quando a relação com a frente é conferida e autorizada; **a descoberta continua read-only**.
- Nenhum registro alterou o estado do Kanban, critérios de aceite, próximo passo, evidência declarada da M3 ou hierarquia de frentes.
- Os demais candidatos da descoberta (589 menos os classificados nesta etapa) continuam sem atribuição e sem importação.
- O acervo local de 82 páginas e as fontes Drive permanecem preservados. Este marco não representa importação documental.
- Não houve novo DDL, migration, RLS, privilégios ou criação de sistema paralelo.
- A visualização das 34 evidências no navegador atualizado permanece uma verificação visual posterior distinta da consulta positiva de RLS já aprovada no Core.

**Estado:** homologação individual e inserção idempotente das 18 evidências concluídas, com auditoria do Core aprovada.
