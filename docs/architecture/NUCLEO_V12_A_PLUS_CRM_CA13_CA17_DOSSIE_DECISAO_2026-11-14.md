# Núcleo 2.0 V1.2 — A+ CA-13/CA-17 — Dossiê de decisão CRM e modelos FM atualizados

**Natureza:** complemento de engenharia documental dentro da mesma Ficha Viva e da proposta de mandato M5. Não é novo método, mapa, titular, homologação ou publicação do Estado CRM. **Fontes:** Biblioteca `PCL-MST-ESTADO-CRM-V1.2.txt` com adendo CRM 7→CRM 8 em 04/11 (PREPARADO/NÃO PUBLICADO); `docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md`, PRs #411/#412 e reconciliação #751/#752.

## O que já tem prova

- Documentos comerciais 09.01–09.05 e bibliotecas 01–08 permanecem preservados com status fonte a fonte. Os cabeçalhos 09.02/09.03 exigem conciliação de homologação e não devem ser promovidos automaticamente.
- CRM V1.2 de 14/10 é uma versão **preparada e não vigente**, e sua publicação não foi confirmada. A V1.1 foi apontada como referência anterior até substituição controlada.
- Checkpoint UX02 de 16/10 registra CRM 7 responsável técnico e oito incrementos com CI/merge, não UAT.
- Adendo de 04/11 registra CRM 7→CRM 8 como sucessão proposta/preparada; a fonte **não** certifica mandato.
- PR #411 fundiu correção de eventos Meta obsoletos, duplicatas/reação/replay; #412 reverteu mudança incidental de plano sem desfazer #411; CI/merge verificadas, deploy relatado mas não reconfirmado.
- Core oficial consultado neste corte: **0 revisões FM, 0 registros de mandato**; ausência de linhas não invalida documentos que existem fora do Core.

## Ajustes técnicos realizados

1. **FM-05:** atualiza somente a proposta local do catálogo, incluindo Concluir, Reabrir, Tirar da fila, Próximo atendimento e Sem fato novo, preservando diferença entre Resultado, conversa, fila e histórico. O Atlas já oferece controles reais baseados no código, PR #750.
2. **FM-08:** propõe descrição prudente de método e sucessão documental, afirmando explicitamente V1.2 não vigente e a ausência de certificação. Sem titular nominal ou método/versão inventados.
3. **FM-09:** relaciona checkpoints #296/#297, PR #411/#412, UAT pendente, seis históricos e distinção merge/CI/deploy.
4. **M5 proposta de mandato:** oferece ao gestor dossiê CRM com referências e botão **Preparar proposta CRM sem certificação**, que preenche o papel e a referência técnica no formulário local, deixa método e versão vazios e apresenta os gates. Não grava ao clicar; a gravação posterior exige confirmação explícita, é apenas do tipo `proposta`, e não certifica ninguém.

## Decisão formal ainda necessária — CA-17

A autoridade competente deverá informar por fonte verificável:

- Quem é o titular efetivamente autorizado hoje e que função/escopo assume;
- Qual método, versão e documento vigente o mandato utiliza;
- Qual ato de nomeação/substituição produz efeito, com data/escopo;
- Como se revoga/transfere autoridade e quais conflitos documentais devem ser resolvidos.

**Até decisão autenticada:** preservar `não certificado`; não escrever `certificacao`, não conceder permissão, não publicar CRM V1.2.

## Gate CA-13

Revisões FM canônicas dependem de leitura integral da fonte e revisão humana do conteúdo, autoria autenticada, gravação append-only e readback. Os modelos locais, ainda que rastreáveis, não equivalem a revisão validada no Core. Não executar inserção automática para melhorar métricas de cobertura.

## Continuidade sem dispersão

Não reabrir a mesma auditoria de fontes, não recriar Processo Comercial, não importar ZIPs para a Entrega B e não antecipar UAT. Após aprovação formal, os fluxos já existentes de Ficha Viva e registro de mandato são suficientes; não desenvolver outro editor ou tabela só para este piloto.

**Separação de estados:** implementação técnica/merge/CI, deploy Lovable Cloud, execução real, revisão documental, certificação e homologação exigem evidências distintas.
