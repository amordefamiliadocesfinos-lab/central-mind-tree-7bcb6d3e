# Núcleo 2.0 — P2: reconciliação de contratos existentes
Data: 24/11/2026. Subordinado ao saldo congelado #1037 e mapas soberanos V1.3/V1.1. Registro técnico de preparação, não novo mapa, mandato, homologação ou autorização. Baseline main a459895c48cea216c4e76bf62c174f258fc186aa.

## Decisão de escopo
Quatro módulos sem frente M3 no último readback. Necessidades N1–N5 dos Estados Mestres de 03/10 não são automaticamente frentes atuais. Pesquisa de issues não recuperou identificadores oficiais específicos. As propostas abaixo são recortes de reconciliação, sem código de frente criado ou cadastro automático; autoridade e atualidade devem ser verificadas pelo especialista antes do cadastro. Não repetir contraprovas finais nesta etapa.

| Módulo | Recorte real a reconciliar | Fonte técnica existente | Limite |
|---|---|---|---|
| FIN | Compra → obrigação → pagamento → movimento, N1/N2 | supabase/migrations/20261007134000_separate_purchase_order_billing.sql; 20261014200000_purchase_partial_closure_billing.sql; src/lib/purchases/confirmPurchaseFinancial.ts | Contrato separa pedido, faturamento, recebimento e pagamento; fechamento parcial altera total faturável. Não prova migration aplicada, vigência da função, quitação ou uso atual. |
| DIG | Campanha → CRM → Resultado, N1/N2/N3 | src/hooks/useCampaigns.ts; src/components/digital/CampaignsPanel.tsx; src/components/crm/CampaignPerformancePanel.tsx; supabase/migrations/20261013235000_crm_campaign_recipient_reconciliation.sql | Aplicações Digital e campanhas CRM possuem superfícies distintas; reconciliação de envio CRM F0-D não prova identidade compartilhada ou resultado causal. |
| CAP | Captura → Planejamento → Foco, N1/N2 | supabase/migrations/20260810120000_captura_workflow.sql; src/pages/CapturaCentral.tsx | Contrato de vínculo tarefa e workflow_plans existe; não prova atomicidade de criação/vínculo/plano nem autorização atual. |
| ROT | Rotina → Foco/Planejamento e Registro Universal, N1/N2 | supabase/migrations/20260811120000_routine_orchestration_foundation.sql; supabase/functions/_shared/specialists/rotinas.register.ts; src/hooks/useRoutine.ts | Fundação de recorrência e registro de operações específicas existentes. Não declarar Registro Universal ou arquivamento como inexistentes; tampouco homologar executor ou isolamento. |

## Próxima ação proposta por raiz M3
- FIN: reconciliar contrato histórico de 07/10 e delta de fechamento parcial de 14/10 com especialista e origem dos fatos existentes; confirmar autoridade do vínculo Compra/Financeiro e eventual frente real. Preservar distinção obrigação/movimento. Sem pagamentos ou faturamento de teste.
- DIG: recuperar método 03_MARKETING_CAMPANHAS/00_METODO_VIGENTE e mapear identidade de campaign_applications versus crm_campaigns, origem e resultado; não presumir equivalência de IDs, não enviar mensagens.
- CAP: reconciliar writers e vínculo captura/tarefa/workflow_plans; avaliar lacunas de sincronização e escopo de acesso com autoridade competente. A migration histórica contém política authenticated USING(true) WITH CHECK(true); vigência atual não verificada, encaminhar à revisão de segurança já aberta, sem DDL.
- ROT: reconciliar Fase 04.2.2 e registro Level 1/handlers específicos com método vigente; confirmar identidade/escopo de recorrência, tarefa e conclusão. Preservar ausência de duplicação, não executar blocos.
- ASS: fonte soberana não recuperada, manter lacuna e não criar frente.
 
## Fontes de continuidade
Estados Mestres recuperados em docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-{FINANCEIRO,DIGITAL,CAPTURA-CENTRAL,ROTINA}-V1.0.txt. Evidência de código no baseline acima; não é readback de schema produtivo. F24 Saúde preparada pela #1096; checkpoints CRM/OPE/SHO pela #1097. Gravações M3/FM ainda dependem do escritor autenticado e confirmação de histórico. Não expandir P4 ou antecipar P5.
