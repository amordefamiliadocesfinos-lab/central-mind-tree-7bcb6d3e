# Cobertura transversal — revisão dos 22 registros preparados

24/11/2026. Continuidade das fontes existentes; não novo mapa. Nenhum lote executado. Todos os 22 checksums SHA-256 conferidos contra o commit congelado. UUIDs dos dez módulos conferidos por SELECT no Core.

| Módulo | Fontes | Frentes reais no Core | Responsável documental | Encaminhamento |
|---|---:|---|---|---|
| ASS | 1 | Nenhuma frente cadastrada | Especialista Assistente / IA — identidade e método vigentes não verificados; pessoa individual não comprovada | Curar fonte e frente com especialista antes de propor registro |
| CAP | 1 | Nenhuma frente cadastrada | Especialista Captura Central — vínculo e método vigentes não verificados; pessoa individual não comprovada | Curar fonte e frente com especialista antes de propor registro |
| CRM | 2 | CRM-UX02 | Especialista CRM — papel funcional, vínculo documental a conciliar; pessoa individual não comprovada | Reutilizar IDs e contexto exato das frentes existentes |
| DIG | 1 | Nenhuma frente cadastrada | Especialista Digital — identidade, método e escopo vigentes não verificados; pessoa individual não comprovada | Curar fonte e frente com especialista antes de propor registro |
| FIN | 1 | Nenhuma frente cadastrada | Especialista Financeiro — vínculo e vigência não verificados; pessoa individual não comprovada | Fonte compartilhada compra/financeiro já existe no lote OPE; evitar duplicar conteúdo |
| NUC | 1 | NUC-M0, NUC-M1, NUC-M2, NUC-M3, NUC-M4, NUC-M5 | Especialista Núcleo 2.0; pessoa individual não comprovada | Conciliar contribuição existente V1.1, sem duplicar |
| OPE | 7 | OPE-03 | Especialista Operações — identidade, autoridade e método vigentes não verificados; pessoa individual não comprovada | Reutilizar IDs e contexto exato das frentes existentes |
| ROT | 1 | Nenhuma frente cadastrada | Especialista Rotina — vínculo e método vigentes não verificados; pessoa individual não comprovada | Curar fonte e frente com especialista antes de propor registro |
| SAU | 4 | Nenhuma frente cadastrada | Especialista Saúde / CCH — vínculo nominal e mandato no Núcleo não reconciliados; pessoa individual não comprovada | Reconciliar próxima ação ainda menciona v5.4; fonte preparada inclui V6.0 |
| SHO | 3 | SHO-F12 | Especialista Integração Shopee — identidade atual e mandato a reconciliar; pessoa individual não comprovada | Reutilizar IDs e contexto exato das frentes existentes |

Duplicidade identificada: Continuidade V1.1 em NUC já registrada como contribuição `80f64bfb-cfa0-4012-a2ad-b75226881c2d`, estado proposta, checksum ausente e locator relativo. A URL imutável preparada e o locator relativo representam a mesma origem; request_id distinto não torna a inserção semanticamente idempotente. Bloquear inserção automática e conciliar pelo writer oficial. Nenhuma duplicidade interna exata de path/checksum entre as 22 fontes.

Saúde: V6.0 e v5.4 são versões distintas, preservadas com autoridades declaradas diferentes; não tratar como duplicata nem promover vigência no Core. Shopee: encerramento histórico retificado não significa F12 encerrada. OPE: fontes ET1 e CB3 são históricas, sem homologação operacional. FIN: vínculo cruzado com OPE exige evidência e escopo próprios, sem copiar registros.

O lote preserva o mesmo algoritmo de request_id do preparador existente. specialist_role fica NULL até identificação do proponente real; o papel histórico do Core é informativo. Não foram criadas identidades, responsáveis, aceites, métodos ou mandatos.

Frentes com lacuna de cobertura: FIN, SAU, DIG, ASS, CAP e ROT não têm frente cadastrada. Foram recuperadas suas fontes reais de código/documentação já preparadas; a criação de frente depende de fonte de escopo e curadoria, e não decorre da presença de uma página no código. CRM-UX02, SHO-F12 e OPE-03 permanecem os IDs reais reutilizáveis.
