# Núcleo 2.0 — M3: carga inicial auditada do acompanhamento

**Data:** 11/11/2026  
**Core:** Painel Central — Amor de Família  
**Autoridade:** Camada Mestre e Mapa Mestre Núcleo 2.0 V1.0 (escopo congelado).  
**Fonte de estados:** fatos verificados nas PRs #598, #601, #608, #610, #611, #612 e #614, registros de migrations e auditoria do backup de uma origem.

## Escopo do cadastro

Foram inseridas **somente as macrofrentes M0–M5 já mencionadas no escopo vigente**, vinculadas ao módulo raiz `NUC`. Nenhuma subfrente específica foi presumida e nenhum documento legado foi copiado. Este registro **não é uma transcrição literal de um arquivo independente do Mapa Mestre**; representa um cadastro operacional macro a ser confrontado com o mapa soberano quando esse arquivo estiver acessível.

| Código | Título resumido | Status de acompanhamento | Limite de evidência |
|---|---|---|---|
| NUC | Núcleo 2.0 | em_andamento | Conjunto do programa, sem conclusão global |
| NUC-M0 | Auditoria e preservação | em_validacao | Backup de 82 páginas de **uma origem** comprovado; outras origens não declaradas vazias |
| NUC-M1 | Persistência e governança | em_validacao | Schema M1 aplicado, CI e rollback testados; sessão autorizada real pendente |
| NUC-M2 | Biblioteca e referências Drive | em_validacao | Três referências catalogadas; consulta positiva com identidade real pendente |
| NUC-M3 | Central Visual | em_validacao | PR #614 e schema aplicados; E2E visual com identidade autorizada pendente |
| NUC-M4 | Integração técnica | planejado | Não afirmar integração automática de commits, PRs, CI ou migrations |
| NUC-M5 | Supervisão e IA | planejado | Não inferir alertas, agentes ou autonomia já homologados |

Todos os registros preservam especialista funcional `Especialista Núcleo 2.0`, código imutável, dependência pai–filho e evidências/limites descritos individualmente. Nenhum percentual foi preenchido.

### Auditoria e correção de M0

O primeiro registro macro da M0 classificou `concluido` apenas o **snapshot de uma origem**. Para não confundir esse fato com a conclusão de toda a auditoria M0, a classificação foi corrigida para `em_validacao`, mantendo a evidência comprovada da origem. A alteração criou **evento histórico adicional**, sem exclusão ou reescrita.

### Evidência técnica após transações

Consulta exclusivamente de verificação no Core oficial:
- 7 registros M3 (`NUC` + seis frentes);
- **8 eventos históricos**: 7 `criado` + 1 `alterado`;
- 0 dependências artificiais;
- 0 IDs pai inexistentes;
- M1: 0 documentos, 0 revisões, 0 lotes;
- M2: 3 referências privadas preservadas;
- 0 concessões `nucleo_manage`;
- sessão sintética com `SET LOCAL ROLE authenticated` e claim sem capacidade: **0 linhas visíveis** no catálogo M3; transação encerrada por `ROLLBACK`.

O registro foi criado por acesso administrativo do conector ao Core; os campos `created_by_auth_uid` não receberam usuário autenticado e permanecem `NULL`. A evidência de execução é o histórico do banco mais este registro, não uma atribuição fictícia a um login.

### Homologação de interface

**Ainda pendente** por não existir nenhuma concessão individual ativa de `nucleo_manage`. Não conceder capacidade a usuários por inferência, pelo cargo textual ou apenas porque são administradores. Homologação positiva requer identidade autorizada nominalmente e sua sessão real, conferindo leitura, alteração, histórico e revogação.

A implantação da M3 foi registrada na PR #614; código pronto e CI de PostgreSQL 17/build aprovados **não substituem** essa homologação E2E.

### Preservação

Nenhuma das 82 páginas foi migrada, editada ou excluída. O `localStorage` segue sendo a fonte das páginas legadas. A Base V1.2 permanece privada, provisória e não homologada. Nenhuma ACL do Google Drive ou de módulos externos foi alterada.

**Status do marco:** catalogação macro e auditoria M3 concluídas; homologação com identidade real e conferência textual do mapa soberano original continuam pendentes.
