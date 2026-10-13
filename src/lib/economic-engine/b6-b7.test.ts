import { buildB6Scenario } from './b6';
import { buildB7Facts, noB7Occurrence, pendingB7Incident } from './b7';
import { composeEconomicResult } from './composer';

function eq(a: unknown,b: unknown,m:string){if(!Object.is(a,b))throw new Error(m+': '+String(a)+' != '+String(b));}

const b6=composeEconomicResult({components:buildB6Scenario({financialCost:2.5,fiscalCost:5})});
eq(b6.blocks.B6.amount,7.5,'B6 soma custos diretos');

const b7none=composeEconomicResult({components:noB7Occurrence()});
eq(b7none.blocks.B7.amount,0,'B7 sem ocorrência não adiciona custo');

const pending=composeEconomicResult({components:[pendingB7Incident({id:'i1',incidentType:'stock_shortage',title:'Ruptura'})]});
eq(pending.blocks.B7.completeness,'PARTIAL','incidente sem impacto econômico fica pendente');
eq(pending.blocks.B7.amount,null,'incidente pendente não inventa custo');

const real=composeEconomicResult({components:buildB7Facts([{id:'a1',incidentId:'i1',incidentType:'return',title:'Devolução',allocatedValue:12,effect:'COST',entryId:'f1',proven:true},{id:'a2',incidentId:'i1',incidentType:'return',title:'Ressarcimento',allocatedValue:5,effect:'RECOVERY',entryId:'f2',proven:true}])});
eq(real.blocks.B7.amount,7,'B7 líquido preserva custo menos recuperação');

console.log('economic-engine/b6-b7.test: OK');
