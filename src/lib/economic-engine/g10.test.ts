import { analyzeEconomicIntelligence } from './intelligence';
import { buildGeneralEconomicSnapshot } from './snapshot';
import type { EconomicComponent } from './domain';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('economic-engine/g10.test: ' + message);
}
function eq(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), message + ': esperado ' + String(expected) + ', recebido ' + String(actual));
}

function c(id:string,block:EconomicComponent['block'],amount:number):EconomicComponent{return{
  id,economicKey:id,block,itemName:id,amount,currency:'BRL',unit:'pedido',effect:'COST',
  numericNature:'SIMULATED',costState:'APPLICABLE_WITH_VALUE',knowledgeState:'KNOWN',
  incidence:'I-T',sourceDomain:'test'
};}

const completeDirect = buildGeneralEconomicSnapshot({
  components:[
    c('b1','B1',40),
    c('b2','B2',2),
    c('b3','B3',3),
    c('b4','B4',5),
    c('b5','B5',20),
    c('b6','B6',5),
    {
      id:'b7-none',economicKey:'b7-none',block:'B7',itemName:'sem ocorrência',amount:null,
      currency:'BRL',unit:'evento',effect:'COST',numericNature:'HOMOLOGATED',
      costState:'NOT_APPLICABLE',knowledgeState:'NOT_APPLICABLE',
      incidence:'I-E',sourceDomain:'test'
    },
    {
      id:'b8-p',economicKey:'b8-p',block:'B8',itemName:'overhead pendente',amount:null,
      currency:'BRL',unit:'periodo',effect:'COST',numericNature:'FUTURE_UNDEFINED',
      costState:'METHODOLOGY_PENDING',knowledgeState:'UNKNOWN',
      incidence:'I-M',sourceDomain:'test'
    },
    {
      id:'b9-p',economicKey:'b9-p',block:'B9',itemName:'capital pendente',amount:null,
      currency:'BRL',unit:'periodo',effect:'COST',numericNature:'FUTURE_UNDEFINED',
      costState:'METHODOLOGY_PENDING',knowledgeState:'UNKNOWN',
      incidence:'I-M',sourceDomain:'test'
    },
  ],
  revenue:{amount:100,currency:'BRL',numericNature:'SIMULATED',sourceDomain:'test'},
});

const report = analyzeEconomicIntelligence({
  snapshot: completeDirect,
  context:{channelConfidence:'high',channelWarnings:[],isDominated:false},
});

eq(report.readiness,'READY','B8/B9 pendentes não devem bloquear decisão de contribuição');
eq(report.directKnownCost,75,'custo direto conhecido');
eq(report.contributionKnown,25,'contribuição conhecida');
eq(report.contributionMarginKnown,0.25,'margem de contribuição conhecida');
eq(report.topKnownCostBlock?.block,'B1','maior bloco conhecido');
assert(report.signals.some((s)=>s.id==='structural-pending'),'deve sinalizar B8/B9 pendentes');
assert(report.signals.some((s)=>s.id==='known-contribution'),'deve sinalizar contribuição');

const conditional = analyzeEconomicIntelligence({
  snapshot: buildGeneralEconomicSnapshot({
    components:[c('b1','B1',40)],
    revenue:{amount:100,currency:'BRL',numericNature:'SIMULATED',sourceDomain:'test'},
    pendingBlocks:{B5:'regra pendente',B6:'fiscal pendente'},
  }),
  context:{channelConfidence:'low',isDominated:true,recoveryPrice:105,currentPrice:103},
});
eq(conditional.readiness,'CONDITIONAL','lacuna direta sem bloqueio estrutural deve ser condicional');
assert(conditional.signals.some((s)=>s.id==='price-dominance'),'deve detectar dominância');
assert(conditional.signals.some((s)=>s.id==='channel-low-confidence'),'deve detectar baixa confiança');

const blocked = buildGeneralEconomicSnapshot({
  components:[
    c('dup1','B2',2),
    {...c('dup2','B3',2),economicKey:'dup1'},
  ],
  revenue:{amount:10,currency:'BRL',numericNature:'SIMULATED',sourceDomain:'test'},
});
const blockedReport=analyzeEconomicIntelligence({snapshot:blocked});
eq(blockedReport.readiness,'BLOCKED','dupla contagem deve bloquear inteligência');
assert(blockedReport.blockedBlocks.includes('B2') && blockedReport.blockedBlocks.includes('B3'),'blocos duplicados devem ser bloqueados');

console.log('economic-engine/g10.test: OK');
