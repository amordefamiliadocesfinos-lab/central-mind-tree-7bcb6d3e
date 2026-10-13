import { buildB8Components } from './b8';
import { buildB9Components, calculateB9CapitalCost } from './b9';
import { composeEconomicResult } from './composer';

function eq(a: unknown,b: unknown,m:string){if(!Object.is(a,b))throw new Error(m+': '+String(a)+' != '+String(b));}

const b8Pending = buildB8Components({
  facts:[{
    id:'rent-1',
    category:'B8.1',
    name:'Aluguel',
    observedValue:1000,
    periodStart:'2026-10-01',
    periodEnd:'2026-10-31',
  }],
  allocation:{status:'pending'},
});
eq(b8Pending[0].costState,'METHODOLOGY_PENDING','B8 observado sem rateio deve ficar pendente');
eq(b8Pending[0].amount,null,'B8 não deve ratear automaticamente');

const b8Allocated = buildB8Components({
  facts:[{
    id:'rent-1',
    category:'B8.1',
    name:'Aluguel',
    observedValue:1000,
    periodStart:'2026-10-01',
    periodEnd:'2026-10-31',
  }],
  allocation:{
    status:'homologated',
    driver:'revenue',
    numerator:100,
    denominator:1000,
    ruleVersion:'test-v1',
  },
});
eq(b8Allocated[0].amount,100,'B8 homologado usa driver explícito');

const b9Pending = buildB9Components({
  capitalBaseValue:5000,
  method:{status:'pending'},
});
eq(b9Pending[0].costState,'METHODOLOGY_PENDING','B9 não inventa taxa de capital');
eq(b9Pending[0].amount,null,'B9 pendente não entra no resultado');

const expectedCapital = 5000 * 0.12 * (30/365);
eq(calculateB9CapitalCost({capitalBaseValue:5000,annualRatePct:12,days:30}),expectedCapital,'fórmula B9');
const b9Known = buildB9Components({
  capitalBaseValue:5000,
  method:{status:'homologated',annualRatePct:12,days:30,base:'inventory',ruleVersion:'capital-v1'},
});
eq(b9Known[0].amount,expectedCapital,'B9 homologado calcula custo de capital');

const structuralPending = composeEconomicResult({
  components:[
    {
      id:'b1',economicKey:'b1',block:'B1',itemName:'direto',amount:40,currency:'BRL',unit:'pedido',
      effect:'COST',numericNature:'SIMULATED',costState:'APPLICABLE_WITH_VALUE',knowledgeState:'KNOWN',
      incidence:'I-T',sourceDomain:'test'
    },
    ...b8Pending,
    ...b9Pending,
  ],
  revenue:{amount:100,currency:'BRL',numericNature:'SIMULATED',sourceDomain:'test'},
});
eq(structuralPending.contribution.amount,60,'N6 permanece disponível antes de B8/B9');
eq(structuralPending.structural.amount,null,'N7 não fecha sem metodologias B8/B9');
eq(structuralPending.structural.completeness,'PARTIAL','N7 declara pendência estrutural');

console.log('economic-engine/g9.test: OK');
