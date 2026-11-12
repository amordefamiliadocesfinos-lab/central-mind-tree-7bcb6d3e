# Núcleo 2.0 — M5: Supervisão assistida V1 (somente leitura)

**Data:** 12/11/2026  
**Mapa soberano:** Núcleo 2.0 V1.0 — M5, sem arquitetura paralela.  
**Entrada:** Entrega técnica inicial M4 comprovada, frente M4 ainda `em_validacao`, M5 ainda `planejado`.

## Entrega implementada

Uma nova seção **Supervisão assistida — M5** foi integrada **à Central Visual de Desenvolvimento existente**. Ela reutiliza os objetos autorizados da M3 (`nucleo_development_workstreams` e dependências) e consulta `nucleo_development_evidence` por Supabase com a identidade da sessão, sujeita à RLS `nucleo_manage`. Nenhuma permissão nova foi concedida.

O motor `src/lib/nucleo/supervision.ts` é **determinístico**, não um LLM nem um agente autônomo. Seu comportamento pode ser testado e auditado sem acesso ao banco:
1. Alerta quando uma evidência já registrada traz `observed_state=divergente`.
2. Sinaliza uma frente declarada `concluido` sem qualquer evidência técnica vinculada como `verificado` nos dados consultados. Trata-se de **convite à conferência**, não prova de que a conclusão é falsa.
3. Expõe bloqueios explicitamente declarados pelos responsáveis.
4. Indica próxima ação vazia em frente ainda não concluída.
5. Mostra evidências `observado` ou `nao_verificado` que precisam de conferência.
6. Exibe a contagem de dependências **cadastradas**, sem inventar relação M4→M5 por inferência de arquitetura.

Cada alerta inclui frente, motivo, sugestão de próxima verificação e, quando cabível, IDs das evidências que deram origem ao diagnóstico. Nenhum resultado gera porcentagem, classificação de conclusão ou alteração automática do Kanban.

## Limites e falhas seguras

- O componente só é montado dentro da Central M3 após verificação de `nucleo_manage` existente.
- Se a consulta de evidências falhar, **não** transforma coleção vazia em diagnóstico; exibe erro e suspende inferências.
- Se a consulta atingir 500 registros (limite paginado), desabilita o relatório para evitar conclusões sobre resultados parciais.
- O botão **Reavaliar** executa novo SELECT sob RLS; não busca GitHub em tempo real nem envia conteúdo a LLMs.
- Não há INSERT/UPDATE/DELETE, edge function, webhook, cron, nova tabela, migration, grant ou uso do construtor Lovable.
- Não consulta conteúdo Drive, não move documentos, não importa/substitui/exclui nenhuma das 82 páginas locais.
- O histórico de eventos M3 e de evidências M4 não é modificado pela supervisão.
- Não executar ação autônoma, criar PR, atualizar o estado da frente nem homologar M4/M5 a partir de alertas.
- Dados antigos continuam como snapshots: um alerta pode exigir nova conferência de origem antes de decisão humana.

## Testes

O teste `scripts/nucleo-m5-supervision.test.cjs` cobre resultados sem alerta, divergência, conclusão declarada sem prova técnica, bloqueio, ausência de próxima ação, fonte pendente, dependências explícitas e fonte desconhecida. A CI `nucleo-m5-supervision.yml` inclui testes determinísticos e build completo.

## Homologação e avanço

Esta entrega é a **primeira implementação técnica M5**, não conclusão da M5. O estado formal M5 permanece `planejado` até atualização de governança fundamentada; nenhuma mudança do estado foi incluída nesta PR.

Antes de homologar a nova seção como funcional na produção:
1. Confirmar build e CI.
2. Conferir a seção na aplicação publicada com sessão autorizada.
3. Verificar comportamento de **Reavaliar** e ausência de escrita; testar negação de acesso em sessão sem capacidade.
4. Rever separadamente políticas e contratos se futuramente for proposta uma IA com geração de recomendações a partir de dados privados.

**Próxima evolução possível:** recomendações com fontes auditáveis e supervisão de dependências efetivamente declaradas. Exige portões específicos antes de qualquer acesso externo, ação automática ou envio de documentos a modelos.
