import { buildGeneralEconomicSnapshot } from './snapshot';
import { reconcileGeneralEconomicSnapshot } from './generalReconciliation';
import type { EconomicComponent } from './domain';

function eq(a: unknown,b: unknown,m:string){if(!Object.is(a,b))throw new Error(m+': '+String(a)+' != '+String(b));}
function c(id:string,block:EconomicComponent['block'],amount:number):EconomicComponent{return{
  id,economicKey:id,block,itemName:id,amount,currency:'BRL',unit:'pedido',effect:'COST',
  numericNature:'SIMULATED',costState:'APPLICABLE_WITH_VALUE',knowledgeState:'KNOWN',
  incidence:'I-T',sourceDomain:'test'
};}

const predicted=buildGeneralEconomicSnapshot({
  components:[c('b1','B1',10),c('b2','B2',2),c('b3','B3',1),c('b4','B4',5),c('b5','B5',20)],
  pendingBlocks:{B6:'Fiscal pendente'}
});

eq(predicted.blocks.B1.amount,10,'B1 snapshot');
eq(predicted.blocks.B6.completeness,'PARTIAL','B6 pendente preservado');
eq(predicted.levels.N4,38,'N4 B1-B5');
eq(predicted.levels.N5,null,'N5 não fecha com B6 pendente');

const reconciled=reconcileGeneralEconomicSnapshot(predicted,[
  {block:'B4',amount:6,source:'financeiro'},
  {block:'B5',amount:19.5,source:'settlement'},
]);

eq(reconciled.blocks.B4.delta,1,'delta B4');
eq(reconciled.blocks.B5.delta,-0.5,'delta B5');
eq(reconciled.blocks.B6.status,'inconclusive','B6 sem previsão e sem fato é inconclusivo');
eq(reconciled.overall,'partial','reconciliação com alguns fatos é parcial');

console.log('economic-engine/g8.test: OK');
