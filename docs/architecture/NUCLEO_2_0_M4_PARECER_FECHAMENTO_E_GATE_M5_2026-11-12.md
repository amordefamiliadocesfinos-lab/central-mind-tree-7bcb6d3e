# NÚCLEO 2.0 — Avaliação de fechamento M4 e portões de entrada M5

**Data:** 12/11/2026  
**Escopo soberano:** Mapa Mestre Núcleo 2.0 V1.0 — sem criar sistema paralelo.  
**Autoridade:** Camada Mestre.  
**Estado verificado:** M4 em validação, integração técnica implantada, conclusão integral ainda não declarada.

## 1. Decisão técnica — M4

A frente **NUC-M4** foi corretamente evoluída no Core de `planejado` para `em_validacao`, com `evidence_state=comprovada` para a **implantação técnica já demonstrada**. A descrição anterior (“nenhuma integração M4 homologada”) foi substituída por um relato compatível com a realidade comprovada. Não foi marcada como `concluido`: **evidência de PR/CI não é confirmação automática de conclusão da frente**.

A atualização passou por preflight do Core, usou a auditoria nativa M3 e gerou o evento `alterado`, com antes `planejado` e depois `em_validacao`; a escrita administrativa ocorreu sem sessão de navegador, por isso `actor_auth_uid=null` (sem autoria de usuário inventada).

## 2. Matriz factual de aceitação

| Critério | Evidência | Parecer |
|---|---|---|
| Persistência aditiva de evidências GitHub e migrations Supabase | Migration `20261111234500`, tabela `nucleo_development_evidence` | Comprovado |
| Acesso segregado por `nucleo_manage` | RLS ativa, duas políticas e dois gatilhos; testes de acesso autorizada/negada já auditados | Comprovado para cenários verificados |
| Histórico de evidências imutável | Proteção append-only; CI PostgreSQL 17 | Comprovado nos testes registrados |
| Evidências vinculadas a frentes existentes, sem inferir status | 42 registros no Core; 20 atribuídos a NUC-M4 (13 PRs, 7 CI) | Comprovado |
| Apresentação no Núcleo existente | Capturas em produção das fichas M0, M1, M2 e M4, grupos expansíveis | Homologação visual da consulta |
| Coleta GitHub | Workflow read-only com execuções reais; PRs/CI, manifesto temporário | Operacional, consulta limitada/paginada |
| Descoberta, triagem, atribuição e conciliação | Scripts M4 distintos; testes e relatórios GitHub | Comprovado como fluxo controlado |
| Deduplicação e seleção de CI representativas | Comparação contra Core; 101 execuções agrupadas em 8 famílias, 4 representativas inseridas | Comprovado para o lote auditado |
| Migrações Supabase em tempo real | Não existe sincronização Supabase ao vivo; migrations registradas são snapshots manuais verificados | Fora da entrega atual, não presumir |
| Descoberta exaustiva de toda a história do GitHub | Janela da descoberta explicitamente limitada a até 3 páginas por tipo | Não comprovado e não exigido como completude total |
| Autorização contínua / revogação ao longo de sessão aberta | Testes RLS existentes, mas sem homologação específica de concorrência e revogação da UI M4 | Validação complementar, não declarar E2E completo |
| Automação de escrita no Core | Deliberadamente desabilitada; workflow não tem segredo Supabase | Limite de segurança aprovado |

**Síntese:** entrega técnica inicial M4 demonstrada. O fechamento técnico definitivo pode ser deliberado pela Camada Mestre dentro da fronteira de snapshots/read-only/reconciliação humana; **não** pressupõe integração bidirecional, webhook ou monitoramento universal.

## 3. Evidência consolidada — Core

Readback pós-atualização em 12/11/2026:
- `nucleo_development_workstreams`: **7** (NUC e M0–M5).
- `nucleo_development_evidence`: **42**; NUC-M4: **20**, incluindo 13 PRs e 7 runs CI.
- `nucleo_development_events`: **12** (antes eram 11; novo evento M4 de alteração por auditoria).
- `nucleo_source_references`: **3**.
- `nucleo_documents`: **0**, nenhuma das 82 páginas locais importada.
- `nucleo_development_dependencies`: **0 vínculos explícitos**; dependências arquiteturais herdadas do mapa não devem ser representadas falsamente como relações já cadastradas.

A M4 permaneceu `em_validacao` e a M5 permaneceu `planejado`. Sem mudanças em outras frentes, RLS, permissões, documentos ou páginas locais.

## 4. Dependências de entrada da M5

M5 significa **supervisão e IA do desenvolvimento**, não um agente com autorização indiscriminada para operar GitHub ou o banco.

**Entradas confiáveis mínimas:** frentes e seus estados oficiais da M3, histórico imutável de eventos, evidências verificadas M4 com data/proveniência, decisões documentais e limites de `nucleo_manage`. Identificar a diferença entre *estado declarado da frente* e *estado de fonte técnica*.

**Contrato de leitura inicial:** M5 pode analisar apenas informação acessível à identidade autorizada, sem ultrapassar RLS/ACL; a existência de um link Drive não confere permissão para ler conteúdo privado.

**Motor de supervisão (a especificar dentro da M5):**
1. Alertar sobre evidência desatualizada e diferença entre situação declarada e prova recente.
2. Sinalizar dependências sem inventar vínculos inexistentes.
3. Sugerir prioridades e próximas verificações **como recomendações**, com origem e nível de incerteza.
4. Exigir revisão humana para alterar status, conceder capacidades, editar documentos, criar PRs, aplicar migrations ou publicar dados.

**Restrições obrigatórias:** M5 não pode inferir `concluido` porque um workflow retornou `success`; não pode promover documentos, apagar as 82 páginas, conceder `nucleo_manage`, contornar RLS ou enviar dados privados a provedores externos sem contrato autorizado.

## 5. Pontos de governança pendentes

- **M0** ainda conserva validação de escopo documental de origens adicionais; o snapshot das 82 páginas não comprova todas as origens.
- **M1** guarda a persistência com importação deliberadamente desativada; uso positivo em sessão real e política operacional de acesso ainda são critérios próprios.
- **M2** tem catálogo metadata-only com 3 fontes Drive; não confundir referência com conteúdo importado ou homologação de todas as fontes.
- **M3** está em validação para critérios de operação funcional mais amplos, apesar das capturas positivas.
- **M4** está em validação de fechamento técnico; seus 20 registros comprovam entregas técnicas, não declaram status automaticamente.
- **M5** somente pode começar por contrato de supervisão e leitura, após delimitação clara de autoridade. Nenhuma automação de escrita está autorizada.

## 6. Encaminhamento para Camada Mestre

**Parecer do especialista:** recomendar fechamento **da entrega técnica inicial M4** como implementada, com reserva explícita de limites. Manter o registro M4 **em validação**, sem declarar `concluido` até deliberação de encerramento do escopo. Autorizar desenho M5 de supervisão *read-only* e rastreável, sem automações de alteração de dados. Preservar as pendências próprias de M0–M3 sem torná-las bloqueio artificial para o desenho de M5.

Este documento não altera o mapa, não autoriza importação, não concede privilégios e não inicia a IA M5.
