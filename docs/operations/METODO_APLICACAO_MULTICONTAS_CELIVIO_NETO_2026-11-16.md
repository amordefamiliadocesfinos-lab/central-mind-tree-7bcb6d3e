# MÉTODO — APLICAÇÃO MULTICONTAS CELIVIO/NETO | 16/11/2026
**Natureza:** adendo de execução da Integração, sem substituir Método Mappings V2.2 CONGELADO de 31/10, Método Mestre do Laboratório, Arquitetura Mestre Shopee, Mapa Mestre V2 ou F12. Método de integração segue 3 portões P1/P2/P3. Mappings conserva seus 4 portões P1–P4 e níveis E0–E5. Nenhum gate fiscal ou autorização é criado por este documento.

## Objetivo e decisão
Atingir em Celivio/Neto, CPF, o nível do fluxo **comprovado** em Adão, CPF: conexão, captura, pedido e itens no Core, Separação, PDF oficial e composição; organização automática de envio apenas depois de validação específica de elegibilidade e autorização. Celivio e Neto são **uma única conta**, identificador de operação netojacobus504, channel_account_id d26c7a30-aa4a-4441-8012-600d70453689. A obrigação de NF anterior ao envio da Viviane PJ não é um gate da paridade Celivio, sem pressupor dispensa fiscal universal para CPF.

## P1 — recuperar/compreender (somente leitura)
- Fixar conta e identificar a shop_id **autenticada** na Shopee. Confirmar proprietário de cada Item ID/Model ID na fonte datada; não usar matriz Adão/Viviane V36 como matriz de Celivio.
- Core real em 16/11: **3 mappings legados, zero pares externos Item/Model completos, 3 pedidos internos, zero conexões OAuth registradas nessa tabela**. Não inferir inexistência de todo acesso externo.
- Legado “Glucose 5 kg” vinculado a “Folha de Ofício A4”, multiplicador 2: divergência material para investigação; nunca reaproveitar ou corrigir automaticamente. Preservar histórico.
- Definir uma diferença real por recorte e identificar se é somente identidade externa nova sob Produto Mestre já suportado ou novo contrato físico/código.

## P2 — execução mínima por responsável (somente após gate)
- Especialista Mappings: P1 Verdade → P2 Proteção → P3 Banco → P4 Funcionamento; E0–E5 sem novos níveis. Reusar produto/variante/apresentação/componentes físicos quando equivalência demonstrada. Para Celivio, IDs externos são **exclusivos**; não usar SKU/título como fallback, nem interpretar model_id=0 como variação real automaticamente; conferir componentes, unidade, kits e multiplicadores. Escritas no Core somente com autorização específica, proteção de unicidade e conferência independente.
- Especialista Integração: OAuth individual autorizado, Raw, preview somente leitura, writer canônico, reconciliação, Core/Hub/GCP quando material. GitHub-first; Cloud Shell operado pelo proprietário; sem construtor Lovable. Não abrir rota, Scheduler, worker ou deploy sem lacuna comprovada.
- Comercial: anúncio, variações, preço, catálogo publicado. Operações: separação e fato físico. Fiscal: eventuais exigências de emissão. Não alterar outros domínios por conveniência.
- Isolar conta, tokens, item/model, pedido/pacote, lease, claim, logs, autorizações e flags. Adão Scheduler permanece PAUSED; Viviane inalterada.

## P3 — comprovar/registrar por alcance
- Distinguir fonte autenticada, mapping cadastrado, preview não mutável, build/CI/merge, revisão/digest/flags, OAuth, pedido real criado, itens, Separação, PDF vinculado e prévia, envio autorizado, impressão física e postagem. Nenhuma prova substitui outra.
- Preflight LIVE e claim único para organização de envio; falha incerta exige reconciliação antes de retry. Nunca emitir pedido fictício real, alterar estoque, publicar anúncios ou ativar lote só para homologar.
- Checkpoint curto: fonte e data, delta, ação, prova, limite, próximo gatilho. Sem reauditorias amplas e documentos redundantes.

**Primeira ação futura:** leitura autenticada do catálogo netojacobus504 para recuperar shop_id, Item IDs e Model IDs; correlacionar legados e identificar vínculo OAuth. Não implantar mappings antes disso. Esta preparação é exclusivamente documental.
