# NÚCLEO 2.0 — PILOTO F1/F2 | ASSUNÇÃO DIRETA E IDENTIDADES

**Data:** 19/11/2026  
**Especialidade-piloto (papel proposto):** Governança e Continuidade do Núcleo — Especialista Núcleo 2.0  
**Autoridade de planejamento:** Mapa de Continuidade Canônica V1.1, subordinado ao Mapa Mestre Núcleo 2.0 V1.3  
**Natureza:** contraprova com fontes reais + especificação da menor intervenção; **não** homologação da assunção produtiva, não gravação AC-01, não mandato, não atualização canônica.

## 1. Objetivo e execução real

Demonstrar que o próprio especialista Núcleo pode recuperar contexto e frentes de sua especialidade diretamente da conectividade disponível **sem intermediar cada leitura por Work**. Foram usados:
- GitHub conectado: leitura de mapa V1.1, contrato AC-02 e código do escritor AC-01 na `main`.
- Lovable conectado: leitura da identidade do projeto e **SELECT** do PostgreSQL do Core oficial (`1720a410-34cd-4410-995c-8c92c7edf16b`).
- Nenhum SQL de escrita, UI autenticada, alteração de permissão, migração, deploy ou criação de método foi executado.

**Porta 0 confirmada por fontes:** repositório `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`, branch `main`; projeto Lovable `1720a410-34cd-4410-995c-8c92c7edf16b`; referência Supabase Cloud oficial `xkskyutmtlhivvpfxkjg`; app `https://central-mind-tree.lovable.app/nucleo`. A capacidade de ler o projeto não comprova a revisão publicada no site.

## 2. Readback do módulo NUC / M3-M4

Identificador real do módulo de governança: `636768e6-e782-4c7d-8132-e7381621be12`, `NUC`, status declarado `em_andamento`, prioridade `alta`, campo textual `specialist="Especialista Núcleo 2.0"`.

| Frente | UUID real M3 | Estado declarado | Observação de continuidade |
|---|---|---|---|
| NUC-M0 | `91708af0-3c10-484f-b493-87cf24811c72` | `em_validacao` | Legado original restrito ao snapshot de 82 páginas, não inventário total |
| NUC-M1 | `3b78dcb7-040a-4d4b-a414-5056740ca4bb` | `em_validacao` | Persistência instalada; importação documental segue não comprovada |
| NUC-M2 | `f37c1362-d2b3-49fa-b775-add0c21acd95` | `em_validacao` | Três referências privadas metadata-only; não importar nem presumir ACL |
| NUC-M3 | `a91b77a2-1abd-46cd-a7cc-0954894fe8dc` | `em_validacao` | Centro visual e writer M3 com readback em código; UAT de Salvar antes adiada |
| NUC-M4 | `95833fbd-38b5-4a0a-abea-45f74214d533` | `em_validacao` | Aceite técnico restrito da Camada Mestre relatado no Core, sem fechamento de estado |
| NUC-M5 | `703b54e4-89ea-473c-b9c8-51606b0c503a` | `em_validacao` | Supervisão read-only; teste humano E2E de revogação adiado |

**Contagens verificadas nesse instante e recorte:** 6 frentes M0–M5; **49** evidências M4 vinculadas a elas; **24** eventos de histórico M3; **0** contribuições AC-01 para módulo NUC; **0** revisões FM para NUC. Contagens não são equivalentes a cobertura completa de toda a história. O snapshot de evidências do Core contém registros predominantemente conferidos em 11–12/11 e não é sincronização GitHub ao vivo.

**Especialistas/vínculos recuperados:** o campo `specialist` de NUC e das seis frentes contém exatamente o mesmo papel textual `Especialista Núcleo 2.0`. **Há um papel declarado, não uma pessoa ou agente autenticado independente, nem sete especialistas.** Não há nesse recorte vínculo relacional N:N entre especialidades e frentes. UX/UI, segurança, backend e outros papéis são **candidatos conceituais**, não cadastros, mandatos ou participação histórica comprovada.

## 3. Cartão mínimo de assunção — piloto NUC

- **Especialidade:** Governança e Continuidade do Núcleo (denominação de planejamento V1.1, não identidade registrada em tabela nova).
- **Contexto:** governança `NUC`, M0–M5; o próprio Núcleo não é módulo operacional equivalente a CRM/SHO.
- **Método/versão de planejamento:** Mapa de Continuidade Canônica V1.1 no GitHub, com V1.0 preservada; não tratar como método FM-08 homologado no Core.
- **Identidade técnica:** Porta 0 acima, GitHub `main` e Cloud Lovable/Supabase oficiais.
- **Trabalho herdado:** 6 frentes em validação, evidências M4 e eventos M3 como referidos; preservar limites de aceite, não reabrir provas já positivas por rotina.
- **Acerto reutilizável:** conectores diretos realizam leitura de GitHub, Lovable e Core; Work não é pré-requisito dessas consultas.
- **Erro/atrito identificado:** confundir indisponibilidade de navegador interativo com indisponibilidade do Núcleo; exigir Work para simples SELECT; tratar `specialist` textual de M3 como cadastro de vários especialistas.
- **Lacuna:** contribuição AC-01 referente ao mapa ainda não registrada; ausência de FM-08/09 persistidas; assunção AC-02 operativa do próprio NUC bloqueada pelo contrato atual.
- **Próxima ação única:** definir/testar um **canal de escrita AC-01 de aplicação, autenticado e auditável**, limitado à proposta de referência do mapa, preservando contratos existentes, em lugar de forçar SQL administrativo.
- **Condição de progresso:** sem autenticação individual e readback do writer, manter proposta pendente, mas continuar consultas, documentação e desenvolvimento de frentes independentes.

## 4. Menor intervenção técnica de escrita — proposta, NÃO implementada

**Constatação em código:** `src/components/nucleo/NucleoSpecialistContributions.tsx` já possui `submit` que prepara requisição idempotente, identifica usuário por `supabase.auth.getUser()`, grava em `nucleo_specialist_contributions` com `recorded_by_auth_uid`, valida o registro por `select` posterior, usa trava de escrita pendente e impede inferir homologação. O fluxo exige UI/sessão do usuário e sua permissão no Core.

**Não repetir ou contornar o writer:** SQL administrativo por Lovable `query_database` não demonstra identidade do usuário final nem aplica necessariamente o mesmo contexto JWT/RLS da UI. Não utilizar `service_role`, identidade inventada, bypass, grant novo ou valor de `recorded_by_auth_uid` preenchido à mão.

**Desenho incremental recomendado (se autorizado separadamente):**
1. Prover um **comando de registro de proposta AC-01** à integração do agente, por endpoint/app conectado autenticado como usuário real ou delegado com identidade própria e autorização explícita; reaproveitar validações, restrições, idempotência, trilha e estados do AC-01.
2. Distinguir ao menos escopo `module_id`, `specialist_role`, `contribution_kind`, `source_kind`, `source_locator`, `title`, `note`, `request_id`, `parent_revision_id` e permitir apenas `proposta/em_evolucao` conforme contrato.
3. Aplicar autenticação e autorização real do solicitante; uso de JWT individual de curta duração no canal permitido, sem expor tokens ao chat, sem conceder `nucleo_manage` global a todo agente apenas para obter leitura.
4. **Confirmar** persistência, autoria e versão por leitura sob o mesmo escopo; em falha ambígua, reconciliar pelo mesmo `request_id`, jamais repetir inserção com outro identificador.
5. Testes antes do uso: identidade não autenticada, usuário sem permissão, grant revogado, módulo NUC válido para o AC-01 ou bloqueio explícito, duplicação, source não autorizada, falha de leitura de volta e concorrência.
6. Só então vincular uma única contribuição `mapa` ao `NUC` com origem GitHub para `docs/architecture/MAPA_CONTINUIDADE_CANONICA_ESPECIALISTAS_NUCLEO20_V1_1_CONGELADO_PLANEJAMENTO_2026-11-19.md`. **Não** homologar ou marcar vigente automaticamente.

**Alternativa imediata já disponível:** se houver sessão pessoal autenticada com concessão compatível, usar o formulário AC-01 atual, sem adicionar código. Não converter a alternativa de UI em requisito para leitura F1/F2.

## 5. Identidade multiespecialista — prova e decisão

**Prova atual:** M3 `specialist text` singular; AC-01 `specialist_role text` + `module_id`; contratos atuais centralizados no módulo não expressam N:N. Necessidade de 3 ou 5 especialistas por módulo é requisito de planejamento confirmado pelo proprietário, **não** cardinalidade presente no banco.

**Decisão de evolução:** preservar registros existentes e, após aceite funcional da modelagem, propor representação **aditiva** de `especialidade estável`, `instância/ator` e `vínculo de atuação N:N`, com escopo de módulo opcional, frente opcional, responsável/colaborador, temporalidade, origem e mandato independente. Nenhum esquema ou RLS foi proposto como migração executável neste piloto. Reaproveitar M3 como fonte das frentes, AC-01/FM para conhecimento e AC-02 para pacote de assunção.

**Critério de prova futura:** três especialistas distintos associados a um módulo, uma especialidade associada a dois módulos, sucessão sem transferência de mandato, contribuições auditadas e nenhuma duplicação de módulo/frente. Sem isso, não declarar N:N implementado.

## 6. Portões e classificação final F1/F2

| Critério | Resultado |
|---|---|
| Ler fontes oficiais e Core diretamente por conectores | **APROVADO**, neste acesso |
| Porta 0 / identidade técnica | **APROVADA documentalmente**, runtime publicado não certificado |
| Recuperar 6 frentes NUC, evidências e histórico com ressalvas | **APROVADO no recorte consultado** |
| Recuperar nomes/papéis já declarados sem inventar especialistas | **APROVADO**, limitação relacional identificada |
| Assunção de método/ecossistema vigente FM-08 | **NÃO COMPROVADA**, 0 revisões FM em NUC |
| Escrita AC-01 diretamente por agente com identidade auditável | **NÃO IMPLEMENTADA/VERIFICADA** para esta conexão |
| Vincular mapa V1.1 a AC-01 do NUC | **PENDENTE**, 0 contribuições NUC |
| Sucessão/aceite AC-02 para NUC | **PENDENTE**, guarda atual recusa NUC |
| Governança, segurança e histórico preservados | **SIM**, leitura e documentação, nenhuma mutação Core |

**Checkpoint:** F1 leitura direta e F2 recuperação declarativa são comprovadas no recorte. F2 como assunção canônica de método/especialidade e F3 como escrita governada ainda dependem de evolução real. Este documento não amplia escopo, não certifica método nem revoga adiamentos anteriores.

**Próximo gate:** escolher menor caminho de escritor aplicativo autenticado para uma única contribuição AC-01 NUC com readback, sem tocar em schema/mandato; depois ensaiar a assunção consultiva NUC especificamente e os relacionamentos N:N de especialidade.
