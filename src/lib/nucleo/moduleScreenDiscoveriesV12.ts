import { CRM_SCREENS } from "./operationalKnowledgeV12";
/**
 * Núcleo 2.0 V1.2 — mapa de superfícies/telas descobertas no código.
 * Apenas inventário visual e leitura, não manual nem prova de deploy/UAT.
 * Links profundos somente quando a página implementa o parâmetro de URL.
 */
export type ModuleScreenDiscovery = {
  id:string; name:string; area:string; description:string;
  route:string|null; source:string; navigation:"rota_verificada"|"abrir_modulo_selecionar_aba"|"referencia_sem_rota";
  check:string; limitation:string;
};
const repo="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/";
const page=(path:string)=>repo+path;
const screen=(id:string,name:string,area:string,description:string,route:string|null,source:string,navigation:ModuleScreenDiscovery["navigation"],check:string,limitation:string):ModuleScreenDiscovery=>
  ({id,name,area,description,route,source:page(source),navigation,check,limitation});
const onlyTab="O botão abre uma área da interface, não comprova gravação, integração ou procedimento homologado.";
const checkTab="Conferir o título/aba selecionada na interface autenticada, sem acionar comandos de escrita.";
export const MODULE_SCREENS_V12:Readonly<Record<string,ReadonlyArray<ModuleScreenDiscovery>>>={
 CRM:CRM_SCREENS.map(item=>({
  id:item.id,
  name:item.label,area:"Atendimento",description:item.description,
  route:item.route,source:item.source,
  navigation:"rota_verificada" as const,
  check:"Confirmar rota e contexto da tela na sessão autorizada; não alterar contatos em inspeção.",
  limitation:"Rota e código não comprovam integração WhatsApp, persistência ou homologação de uso real.",
 })),

 FIN:[
  screen("dashboard","Dashboard","Visão geral","Painel de indicadores financeiros.",null,"src/pages/Financeiro.tsx","abrir_modulo_selecionar_aba",checkTab,"Dados e regras de apuração ainda exigem conferência operacional."),
  screen("receber","Receber","Lançamentos","Área de contas e lançamentos a receber.",null,"src/pages/Financeiro.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
  screen("pagar","Pagar","Lançamentos","Área de contas e lançamentos a pagar.",null,"src/pages/Financeiro.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
  screen("contas","Contas","Cadastros","Gestão de contas financeiras.",null,"src/pages/Financeiro.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
  screen("notas","Notas","Documentos","Área de notas no Financeiro.",null,"src/pages/Financeiro.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
  screen("categorias","Categorias","Cadastros","Classificação financeira.",null,"src/pages/Financeiro.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
 ],
 OPE:[
  screen("orders","Pedidos","Comercial","Gestão operacional dos pedidos.", "/operacoes?tab=orders","src/pages/Operacoes.tsx","rota_verificada","Confirmar aba Pedidos ao abrir a rota e consultar histórico/estado sem modificar pedidos.",onlyTab),
  screen("purchases","Compras","Suprimentos","Compras, fornecedores e recebimento.", "/operacoes?tab=purchases","src/pages/Operacoes.tsx","rota_verificada",checkTab,"Não comprova fechamento de compra ou faturamento."),
  screen("products","Produtos","Cadastros","Cadastro e apresentação de produtos.", "/operacoes?tab=products","src/pages/Operacoes.tsx","rota_verificada",checkTab,onlyTab),
  screen("inventory","Estoque","Suprimentos","Visão operacional de saldos e movimentação.", "/operacoes?tab=inventory","src/pages/Operacoes.tsx","rota_verificada",checkTab,"Não confirma consistência física de estoque."),
  screen("production","Produção","Produção","Área de acompanhamento de produção.", "/operacoes?tab=production","src/pages/Operacoes.tsx","rota_verificada",checkTab,onlyTab),
  screen("mrp","MRP","Planejamento","Necessidades de material e contexto de compras.", "/operacoes?tab=mrp","src/pages/Operacoes.tsx","rota_verificada",checkTab,"Presença do MRP não comprova compra criada automaticamente."),
  screen("separation","Separação","Expedição","Preparação e separação operacional.", "/operacoes?tab=separation","src/pages/Operacoes.tsx","rota_verificada",checkTab,onlyTab),
 ],
 ROT:[
  screen("day","Dia","Planejamento","Blocos e ações da visão diária.",null,"src/pages/Rotina.tsx","abrir_modulo_selecionar_aba",checkTab,"Não inferir conclusão de blocos."),
  screen("week","Semana","Planejamento","Blocos distribuídos pela semana.",null,"src/pages/Rotina.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
  screen("month","Mês","Planejamento","Planejamento mensal.",null,"src/pages/Rotina.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
 ],
 CAP:[
  screen("decisao","Caixa de decisão","Triagem","Entradas aguardando classificação.",null,"src/pages/CapturaCentral.tsx","abrir_modulo_selecionar_aba",checkTab,"Fazer/Planejar/Guardar/Arquivar são comandos com efeitos de escrita, não executar em inspeção."),
  screen("planejadas","Em fluxo","Acompanhamento","Entradas em fluxo de trabalho.",null,"src/pages/CapturaCentral.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
  screen("referencias","Referências","Consulta","Entradas guardadas como referência.",null,"src/pages/CapturaCentral.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
  screen("arquivadas","Arquivadas","Histórico","Itens marcados como arquivados.",null,"src/pages/CapturaCentral.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
 ],
 DIG:[
  screen("ideias","Ideias","Conteúdo","Ideias e suas visualizações.", "/digital?tab=ideias","src/pages/Digital.tsx","rota_verificada",checkTab,"Não comprova aprovação ou publicação."),
  screen("calendario","Calendário","Conteúdo","Planejamento visual do conteúdo.", "/digital?tab=calendario","src/pages/Digital.tsx","rota_verificada",checkTab,onlyTab),
  screen("midia","Mídia","Conteúdo","Organização de mídias.", "/digital?tab=midia","src/pages/Digital.tsx","rota_verificada",checkTab,onlyTab),
  screen("engajamento","Engajar","Engajamento","Visão de ações de engajamento.", "/digital?tab=engajamento","src/pages/Digital.tsx","rota_verificada",checkTab,onlyTab),
  screen("metricas","Métricas","Insights","Visão de indicadores digitais.", "/digital?tab=metricas","src/pages/Digital.tsx","rota_verificada",checkTab,"Resultados/integrações reais exigem verificação."),
  screen("plataformas","Canais","Insights","Superfície de canais e plataformas.", "/digital?tab=plataformas","src/pages/Digital.tsx","rota_verificada",checkTab,"Não autoriza publicação ou integração externa."),
  screen("campanhas","Campanhas","Conteúdo","Aba existente no código; deep-link tab não reconhecido no efeito de leitura de URL.",null,"src/pages/Digital.tsx","abrir_modulo_selecionar_aba",checkTab,onlyTab),
 ],
 ASS:[
  screen("chat","Chat","Assistente","Conversa de suporte executivo.",null,"src/pages/Assistente.tsx","abrir_modulo_selecionar_aba",checkTab,"Não autoriza executar ações do Assistente ou coletar conversas."),
  screen("insights","Insights","Análise","Propostas de insights e filtros.",null,"src/pages/Assistente.tsx","abrir_modulo_selecionar_aba",checkTab,"Insight não representa decisão aprovada."),
  screen("policies","Políticas","Governança","Políticas apresentadas na interface.",null,"src/pages/Assistente.tsx","abrir_modulo_selecionar_aba",checkTab,"A interface não certifica autoridade ou vigência de política."),
  screen("log","Histórico","Auditoria","Superfície de histórico na interface.",null,"src/pages/Assistente.tsx","abrir_modulo_selecionar_aba",checkTab,"Não assumir completude ou integridade do log sem readback."),
 ],
};
