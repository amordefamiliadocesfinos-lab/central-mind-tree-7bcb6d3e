import type { NutritionTarget } from "../hooks/useHealthNutritionM5";

export const targetFields = [
  {label:"Energia",unit:"kcal",min:"energy_kcal_min",max:"energy_kcal_max"},
  {label:"Proteínas",unit:"g",min:"protein_g_min",max:"protein_g_max"},
  {label:"Carboidratos",unit:"g",min:"carbohydrate_g_min",max:"carbohydrate_g_max"},
  {label:"Gorduras",unit:"g",min:"fat_g_min",max:"fat_g_max"},
  {label:"Fibras",unit:"g",min:"fiber_g_min",max:"fiber_g_max"},
] as const;
type TargetKey=typeof targetFields[number]["min"|"max"];
export type TargetValues=Record<TargetKey,string>;
export const formatNumber=(value:number|null|undefined)=>typeof value==="number"&&Number.isFinite(value)&&value>=0
  ?new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(value):"—";
export function validNonnegative(value:string):number|null{
 const clean=value.trim();
 if(!/^\d+(?:[.,]\d+)?$/.test(clean))return null;
 const parsed=Number(clean.replace(",","."));
 return Number.isFinite(parsed)&&parsed>=0?parsed:null;
}
export function targetValues(target: NutritionTarget|null):TargetValues{
 return Object.fromEntries(targetFields.flatMap(field=>[field.min,field.max]).map(key=>[key,target?.[key]==null?"":String(target[key])])) as TargetValues;
}
export function validateTargets(values:TargetValues){
 const payload={} as Record<TargetKey,number|null>;
 for(const field of targetFields){
  for(const key of [field.min,field.max]){
   const raw=values[key].trim();
   const value=raw===""?null:validNonnegative(raw);
   if(raw!==""&&value===null)return {payload:null,error:field.label+": informe um valor não negativo ou deixe vazio."};
   payload[key]=value;
  }
  const lo=payload[field.min],hi=payload[field.max];
  if(lo!==null&&hi!==null&&lo>hi)return {payload:null,error:field.label+": mínimo não pode superar máximo."};
 }
 if(Object.values(payload).every(value=>value===null))return {payload:null,error:"Informe ao menos uma meta."};
 return {payload,error:null};
}
export function rangeLabel(lo:number|null|undefined,hi:number|null|undefined,unit:string){
 const a=formatNumber(lo),b=formatNumber(hi);
 if(a==="—"&&b==="—")return "Não definida";
 if(a==="—")return "Até "+b+" "+unit;
 if(b==="—")return "A partir de "+a+" "+unit;
 return (lo===hi?a:a+"–"+b)+" "+unit;
}
export function ratioLabel(value:number|null|undefined){
 return typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=1?Math.round(value*100)+"%":"Sem base comparável";
}
export const strategyLabels:Record<string,string>={maintenance:"Manutenção",energy_deficit:"Déficit energético",energy_surplus:"Superávit energético",recomposition_support:"Apoio à recomposição",performance_support:"Apoio à performance",custom:"Personalizada"};
export const coverageLabels:Record<string,string>={unobserved:"Sem observações",sparse:"Poucos registros",partial:"Cobertura parcial",complete:"Cobertura completa",sufficient:"Dados suficientes"};
export const confidenceLabels:Record<string,string>={low:"Baixa",moderate:"Moderada",high:"Alta"};
export const statusLabels:Record<string,string>={unknown:"Desconhecido",not_targeted:"Sem meta",below:"Abaixo da faixa",in_range:"Na faixa",above:"Acima da faixa"};
