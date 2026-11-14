# Núcleo V1.2 — A+ CA-13/CA-17 — Continuidade posterior do especialista CRM

**Data de corte:** 14/11/2026. **Natureza:** reconciliação documental da Ficha Viva CRM, não novo Estado Vigente, homologação ou mandato. **Fonte principal:** Biblioteca original `PCL-MST-ESTADO-CRM-V1.2.txt`, lida integralmente, inclusive adendo de sucessão 04/11/2026. **Fonte técnica:** `docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md` na main; PRs #411, #412, #296 e #297 verificadas no GitHub.

## Hierarquia e classificação de vigência

- Os **nove grupos originais** indexados em `crmAuthoritySourcesV12.ts` (PR #751) são patrimônio preservado e permanecem referências, não documentos importados.
- O `PCL-MST-ESTADO-CRM-V1.2.txt` tem data do estado consolidado **14/10/2026**, base preservada em 07/10 e cabeçalho **PREPARADO PARA PUBLICAÇÃO / NÃO VIGENTE ATÉ SUBSTITUIÇÃO NO REPOSITÓRIO AUTORIZADO**. O próprio arquivo diz que a V1.1 segue como referência anterior até substituição controlada, e que a V1.2 **não substitui** a V1.1 apenas por estar na Biblioteca. A íntegra e o destino canônico da V1.1 não foram verificados nesta rodada; **não afirmar vigência atual além do que a fonte expressamente relata**.
- O mapa CRM–UX02 de **16/10/2026**, na main, registra oito incrementos A-01/A-02/B-01–B-06 integrados, PRs #296 e #297 com CI aprovada; **UAT autenticada pendente**. `CRM 7` é responsável técnico histórico naquele marco, não um mandato de especialista persistente confirmado.
- O **adendo de 04/11/2026** no próprio arquivo V1.2 documenta o repasse **CRM 7 → CRM 8**, ainda classificado como **CHECKPOINT DE SUCESSÃO PREPARADO, NÃO PUBLICADO**. É evidência de transferência descrita, não de autorização atual ou certificação formal. O Núcleo mantém `activeMandate = não certificado no Core`.

## Checkpoint técnico e limites de prova

- **PR #411**, `fix(crm): impedir retornos artificiais de leads por webhooks antigos ou duplicados`, integrada em 04/11/2026, merge SHA `5f178ac08ea5fa39f5870efd3dbe0f0e1c2846f0`. Verificado em GitHub. O adendo descreve diferenciação entre mensagem realmente nova, reação, replay e duplicata; CI declarada, deploy **relatado** pela Camada Mestre, sem reconfirmação independente no runtime desta rodada.
- **PR #412**, `revert(plan): restaurar documento anterior após diagnóstico CRM somente leitura`, integrada em 04/11/2026, merge SHA `c5b86f4bcec8c2e4143690b49b0393120f11edee`. Reverte ajuste incidental de plano; **não** desfaz a correção #411.
- O adendo de sucessão registra **seis casos históricos** ainda sujeitos a reconciliação controlada e necessidade de comprovar funcionamento com eventos legítimos novos. Trata-se de pendências do especialista CRM, não autorização para o Núcleo editar leads, executar replay ou aplicar migration.
- A V1.2 também preserva incerteza do protocolo **F0-B** em runtime e aplicação da migration **F0-D**, além de reconhecer que merge/CI de CRM/UX não equivalem a publicação ou homologação operacional. Esses estados são referências da data do arquivo, não revalidação atual.

## Alterações no Núcleo

O índice `src/lib/nucleo/crmAuthoritySourcesV12.ts` agora contém os quatro checkpoints posteriores acima, **sem substituir** os nove grupos de fontes originais. A Ficha Viva `src/components/nucleo/NucleoModuleKnowledge.tsx` oferece, nas seções CRM FM-01/03/07/08, leitura dos checkpoints e distinção explícita entre sucessão documental, estado vigente, responsabilidade histórica e mandato certificado. A Ficha Viva continua com **proposta local** separada das versões gravadas em M1; nenhuma versão FM é criada ou alterada nesta execução.

## Encaminhamento objetivo / portões CA-13 e CA-17

1. **CA-13:** proposta de conhecimento contextualizada com fonte e linhagem; falta a revisão/aprovação humana e o registro canônico da Ficha Viva completa com autoridade verificada.
2. **CA-17:** transferência histórica CRM7→CRM8 reconhecida de forma rastreável; **não é autorização atual do especialista**, nem norma que substitua V1.1. Exige decisão/registro de mandato e método contemporâneo pela autoridade competente.
3. **Governança:** não duplicar biblioteca B nem forçar M3/M4, não alterar CRM operacional, banco, grants/RLS, fontes originais ou Fichas Vivas persistidas. Testes automatizados garantem integridade do índice e limites semânticos, mas não ensaio real da interface.

**Estado:** reconciliação técnica de continuidade concluída com limites explícitos; CA-13 e CA-17 ainda **parciais**. A aprovação A+ depende dos gates previstos no Mapa Mestre V1.2, inclusive homologações adiadas.