# ECOSSISTEMA — CELIVIO/NETO BASE ADÃO | 16/11/2026
**Estado:** complemento de aplicação ao Ecossistema Especialista Integração Shopee V1.0 (proposta 06/11), refinamentos e Mapa Mestre V2. Preserva quatro frentes F12.1–F12.4, contratos, autonomia dos especialistas e documentação soberana. Não cria arquitetura, sistema, motor, calendário ou quinta frente.

## Comparação e meta
- Adão CPF: **referência comprovada**, Shopee → Hub → Pedido+Itens+Separação no Core → etiqueta oficial vinculada e composição na prévia; organização de envio automática possui provas reais pontuais. Não afirmar 100/dia, escala ou impressão física homologada. Scheduler Adão PAUSED por decisão de custo.
- Viviane PJ: integração e mappings já existentes; emissão de NF antes da organização é sua dependência específica. Homologações visuais complementares ficam postergadas por decisão do proprietário, sem impedir Celivio.
- Celivio=Neto CPF: alvo é **paridade funcional por evidência** com Adão; particularidades fiscais e logísticas são verificadas por conta, sem presumir autorização de ship_order pelo CPF.

## Camadas existentes — reuso e lacuna Celivio
| Camada | Reaproveitar | Conferir só de Celivio |
|---|---|---|
| Conta e OAuth | contrato compartilhado, segurança e reconciliação | shop_id real, vínculo de conta, autorização OAuth, sem copiar credenciais |
| Catálogo/Mapping | Produto Mestre, representação física, componentes homologados | Item ID e Model ID de netojacobus504, variantes, histórico e legado Glucose 5 kg→Folha A4 |
| Captura/Hub | Raw, normalização, HMAC, idempotência, writer canônico | snapshots oficiais e elegibilidade por conta, sem segundo writer |
| Separação | UI e composição compartilhadas | pedido real com mapping correto, itens e Separação |
| Documentos | PDF oficial e prévia combinada | documento de pedido/pacote certo, observação real quando presente |
| Logística | preflight LIVE, claim, reconciliação e limite de tentativas | status, fiscal exigível, método de envio e autorização própria antes de ship_order |
| Nuvem e custos | GitHub/Core/Cloud Run e Cloud Shell existente | tag/revisão/flags/periodicidade próprias apenas quando justificadas, sem reativar Adão |

## Sequência futura por diferença
A — Inventário autenticado: confirmar conta Celivio e shop_id, catálogo Item/Model, estado OAuth; preservar os 3 mappings antigos sem cópia.
B — Mappings pela autoridade competente: P1–P4 e E0–E5 vigentes, localizar equivalências físicas, classificar Glucose 5 kg→Folha A4 e obter autorização para correções/escritas específicas.
C — Integração progressiva: OAuth próprio, leitura/Raw, preview sem efeito, depois importação canônica autorizada e prova de Pedido+Itens+Separação.
D — Documento e operação: recuperar etiqueta de pedido elegível e provar composição na prévia; jamais equiparar PDF à impressão física/coleta/baixa.
E — Organização CPF e frequência: validar exigência fiscal e Shopee LIVE da loja, somente então testar e eventualmente habilitar envio com claim; definir horários/custos com evidência real antes de qualquer Scheduler.

## Regras de governança
- Celivio e Neto são uma única conta (d26c7a30-aa4a-4441-8012-600d70453689). Adão/Viviane permanecem preservados; não transferir Item ID, Model ID, OAuth, históricos, tokens, créditos ou jobs.
- Contexto Core 16/11: 3 mappings legados, zero Item+Model completos, 3 pedidos, nenhuma conexão registrada na tabela OAuth. Não há evidência ainda de importação real ou paridade.
- Incerteza de Writer, refresh, ship_order e documentos exige investigação/reconciliação; previews não criam pedidos, etiquetas ou estoque.
- F12.3: ensaio concorrente de 2 sessões continua adiado; rollout 100/dia não homologado. Homologação Viviane não é requisito para começar inventário Celivio.
- Próximo passo único é **leitura autenticada da loja netojacobus504**, não novo banco, conector, Scheduler ou deploy. É um documento de método/ecossistema, não uma execução operacional.
