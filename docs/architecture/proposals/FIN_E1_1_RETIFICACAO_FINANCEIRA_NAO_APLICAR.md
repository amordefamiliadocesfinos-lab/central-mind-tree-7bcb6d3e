# E1.1 — Retificação financeira: contrato candidato (não aplicar)
Mapa V2.1. Complementa E1.7, sem alterar seu modelo nem autorizar migration.
PC-00054: principal registrado 1759,10, pago 1759,10; diferença pretendida 45,00 de natureza não comprovada. Não tratar automaticamente como juros ou novo principal.
## Classificação obrigatória
- Correção de registro: comprovante demonstra que o movimento registrado não corresponde ao caixa ocorrido. Registrar retificação vinculada à origem, preservando o fato anterior e sua revisão; data efetiva comprovada, data de registro distinta. Não fabricar novo pagamento.
- Complemento: novo desembolso/recebimento efetivamente ocorrido; registrar fato distinto vinculado à origem, sem liquidar principal já quitado.
- Estorno/devolução: fato financeiro inverso comprovado; contrato próprio para efeito no principal e conciliação, fora desta primeira prova.
- Classificação: alteração de categoria ou atribuição sem movimentar caixa; trilha própria, fora da prova.
## Primeira prova descartável
Correção do valor de movimento não conciliado: referência imutável ao movimento original, valor anterior efetivo esperado, valor correto positivo em centavos, motivo, referência de evidência, chave idempotente. Delta de caixa aplicado uma vez; principal e obrigação original preservados. O movimento original não é reescrito. Projeção efetiva soma original e deltas. Bloquear conciliação, versão divergente, chave reutilizada com payload diferente e valor sem alteração. Bloquear obrigação e conta na mesma ordem da prova E1.7. Rollback integral.
A prova não define a persistência produtiva: a projeção FIN-F11, value_paid, CRM, compras, produção e conciliação precisam consumir a semântica escolhida antes de ativar qualquer escritor. Não somar deltas ao caixa oficial enquanto o leitor não for compatível. Não substituir comprovante por texto livre: referência de evidência nesta fixture é sintética, não valida documentos.
## Gate
Autorização transversal de representação, migração e consumidores; testes de integração e autoridade real; nenhuma alteração histórica automática. Contraprovas autenticadas acumuladas não impeditivas, REG-FIN-01 preservada.
