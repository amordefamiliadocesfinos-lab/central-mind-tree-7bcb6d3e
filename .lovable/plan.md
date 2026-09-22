# Auditoria somente leitura — Bloco C (fluidez/UX do CRM)

Nada foi alterado. Diagnóstico factual com localização de código.

## 1) Busca literal por Y2 / Y3 / Y2- / Y3- / Y2_ / Y3_ em `src/`

Nenhuma ocorrência relacionada à Inbox ou ao CRM. As únicas linhas com essas letras são variáveis de recorte de imagem, sem relação com rótulos de interface:

- `src/components/financial/ContactFormDialog.tsx:281` — `const paddedY2 = clamp01(y2 + bboxPadY);`
- `src/components/financial/ContactFormDialog.tsx:286` — uso de `paddedY2` no cálculo de altura
- `src/components/financial/ContactFormDialog.tsx:438` — uso de `paddedY2` no recorte normalizado

Conclusão: não existe prefixo `Y2`/`Y3` no código. Se algo assim aparece na tela, vem de dado gravado (nome de contato, resumo, tag ou anotação), não de rótulo programado.

## 2) Rótulos que realmente aparecem na Inbox

Prioridade — `src/lib/crm/priority.ts:54-70` (`LABELS`):
Precisa responder, Registrar resultado, Retorno vencido, Ação atrasada, Retorno hoje, Ação hoje, Reativação comercial atrasada, Reativação comercial, Follow-up urgente, Esfriando, Fila normal, Ação futura, Aguardando cliente, Conversa resolvida. Níveis P0–P4 em `priority.ts:3`.

Estado do atendimento — `src/lib/crm/attendance.ts:29-32` (`ATTENDANCE_STATE_LABELS`): Responder, Em atendimento, Aguardando resposta, Retomar em…, Concluído.

Resultado (Próxima Ação derivada) — `src/lib/crm/attendance.ts:14-24` e `CONFIG` a partir da linha 34: Atendimento realizado — aguardando resposta, Proposta enviada, Cliente em negociação, Venda fechada, Pós-venda realizado, Cliente respondeu, Telefone inválido, Sem interesse, Apenas registrar.

Etapa comercial — `getCrmStageLabel` usado em `ContatosInbox.tsx:1010`, `:1078`, `:1223`.

Origem/canal — `ContatosInbox.tsx:1013` e `:1078` (`platform_icon` + `platform_name` ou `channel`, com fallback "Canal não informado"); origem de campanha em `:1081-1084`.

Filtros do topo — `ContatosInbox.tsx:908-913` e `:945` (Prioridade, Responder, Hoje, Atrasados, Esfriando, Aguardando cliente) mais os seletores de escopo, etapa, responsável e tag (`:919-966`).

## 3) Coluna lateral (lista) — `ContatosInbox.tsx:988-1042`

Por contato são renderizadas até 4 linhas visuais: avatar + nome + data (`:996-1005`), resumo da última mensagem (`:1006-1007`) e uma faixa com até 8 selos (`:1008-1041`):

| # | Selo | Linha | Classificação |
|---|---|---|---|
| 1 | Etapa comercial | 1009-1011 | depende de uso real |
| 2 | Canal/plataforma (com fallback "Canal não informado") | 1012-1014 | redundante visual |
| 3 | Fornecedor | 1016-1018 | depende de uso real (já existe o seletor de escopo Comercial/Fornecedores) |
| 4 | Estado do atendimento | 1021-1023 | redundante visual quando coincide com o selo de prioridade |
| 5 | Prioridade (P0 destrutivo) | 1026-1028 | necessário operacional |
| 6 | Contador de não lidas | 1031-1033 | necessário operacional |
| 7 | "Xd sem contato" (>7 dias) | 1036-1038 | redundante visual (sobrepõe "Esfriando"/"Follow-up urgente" e a data já mostrada) |
| 8 | Janela Meta (`MetaWindowBadge`, compacto) | 1040 | necessário operacional apenas em WhatsApp; para outros canais é ruído |

Sobreposições factuais: "Aguardando resposta" (selo 4) e "Aguardando cliente" (selo 5) descrevem o mesmo fato por fontes diferentes; "Responder" (selo 4) e "Precisa responder" (selo 5) idem; a data em `:1002` e o selo 7 medem o mesmo intervalo.

## 4) Painel direito "Detalhes do lead" — `ContatosInbox.tsx:1212-1235`

| Bloco | Linha | Já aparece em | Classificação |
|---|---|---|---|
| Avatar + nome + telefone | 1218-1221 | cabeçalho do chat (`:1074-1079`) | redundante visual |
| Etapa comercial | 1223 | cabeçalho (`:1078`) e selo 1 da lista | redundante visual |
| Estado do atendimento | 1224 | selo 4 da lista | depende de uso real (único lugar com o estado no contato aberto) |
| Última interação | 1225 | data na lista (`:1002`) | redundante visual |
| Anotação rápida + agendar retorno (`InboxNoteBlock`) | 1226 | ação de adiar existe também na barra de atendimento (`:1193`) | necessário operacional (grava histórico), com sobreposição parcial de agendamento |
| Observações do cadastro (line-clamp-6) | 1227 | só aqui | necessário operacional |
| Botão "Editar dados" | 1229-1231 | ícone de lápis no cabeçalho (`:1147-1155`) | redundante visual |
| Botão "Abrir cadastro completo" | 1232 | ícone de link externo no cabeçalho (`:1156-1160`) | redundante visual |

Observação adicional: o cabeçalho do chat concentra 10 botões (`:1086-1161`), o que compete visualmente com o painel direito quando ambos estão abertos.

## 5) Resumo da classificação

- Necessário operacional: prioridade, não lidas, janela Meta em WhatsApp, anotação/observações, estado do atendimento no contato aberto.
- Redundante visual: canal na lista, dias sem contato, avatar/nome/telefone/etapa/última interação repetidos no painel direito, botões Editar e Abrir cadastro duplicados.
- Depende de uso real: etapa comercial na lista, selo Fornecedor, estado do atendimento na lista.

Nenhuma alteração proposta nesta rodada.
