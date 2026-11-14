/**
 * Núcleo AC-02 / Entrega A+ — resumo de continuidade sobre metadados M3/M4.
 * Nenhum status registrado se converte em homologação, mandato ou prova atual.
 * Não lê corpos, descrições, next_action, URLs ou fontes privadas.
 */
export type Ac02ContinuityFront=Readonly<{id:string;code:string;status:string}>;
export type Ac02ContinuityEvidence=Readonly<{id:string;workstreamId:string;kind:string;observedState:string}>;
export type Ac02ContinuitySummary=Readonly<{
 kind:"nucleo_ac02_resumo_continuidade_consultivo";
 source:"m3_m4_core_declarado";
 completeness:"recorte_incompleto"|"recorte_consultivo";
 counts:Readonly<Record<"planejado"|"em_andamento"|"bloqueado"|"em_validacao"|"concluido",number>>;
 frontsWithEvidence:number;
 frontsWithoutEvidence:number;
 nextCandidates:readonly Readonly<{code:string;status:string;reason:string}>[];
 warnings:readonly string[];
}>;
const statuses=["bloqueado","em_andamento","em_validacao","planejado","concluido"] as const;
type Status=typeof statuses[number];
const allowed=new Set<string>(statuses);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const code=/^[A-Z0-9_-]{3,50}$/;
const evidenceKinds=new Set(["pull_request","commit","workflow_run","ci_run","migration","deployment","manual","outro"]);
const evidenceStates=new Set(["verificado","relatado","nao_verificado","indeterminado"]);
const reason:Record<Status,string>={
 bloqueado:"Frente com bloqueio declarado; consultar motivo original sob acesso autorizado.",
 em_andamento:"Frente em andamento no Core; conferir checkpoint e responsável antes de prosseguir.",
 em_validacao:"Frente em validação declarada; não presumir homologação ou aceite.",
 planejado:"Frente planejada no Core; conferir escopo e prioridade antes de iniciar.",
 concluido:"Frente declarada concluída no Core; não equivale a implantação ou homologação.",
};
export function summarizeAc02Continuity(
 fronts:readonly Ac02ContinuityFront[],
 evidence:readonly Ac02ContinuityEvidence[],
 evidenceRead:"completa"|"indeterminada",
):Ac02ContinuitySummary{
 const warnings:string[]=[];
 const counts={planejado:0,em_andamento:0,bloqueado:0,em_validacao:0,concluido:0};
 const unique=new Map<string,Ac02ContinuityFront>();
 for(const f of fronts){
  if(!uuid.test(f.id)||!code.test(f.code)||!allowed.has(f.status)){
   warnings.push("Frente inválida omitida no resumo");continue;
  }
  if(unique.has(f.id)){warnings.push("Frente duplicada omitida no resumo");continue;}
  unique.set(f.id,f);
  counts[f.status as Status]++;
 }
 const supported=new Set<string>();
 for(const e of evidence){
  if(!uuid.test(e.id)||!unique.has(e.workstreamId)||
    !evidenceKinds.has(e.kind)||!evidenceStates.has(e.observedState))continue;
  supported.add(e.workstreamId);
 }
 const candidates=[...unique.values()].filter(f=>f.status!=="concluido")
  .sort((a,b)=>statuses.indexOf(a.status as Status)-statuses.indexOf(b.status as Status)||a.code.localeCompare(b.code))
  .slice(0,20).map(f=>Object.freeze({
   code:f.code,status:f.status,reason:reason[f.status as Status],
  }));
 if(fronts.length>50||evidence.length>80||evidenceRead!=="completa")
  warnings.push("Recorte técnico parcial/indeterminado: não concluir ausência de frentes ou provas");
 if(!fronts.length)warnings.push("Sem frentes M3 recuperadas no recorte");
 if(!supported.size)warnings.push("Sem evidências M4 relacionadas e autorizadas no recorte");
 return Object.freeze({
  kind:"nucleo_ac02_resumo_continuidade_consultivo" as const,
  source:"m3_m4_core_declarado" as const,
  completeness:warnings.some(w=>w.includes("parcial")||w.includes("inválida")||w.includes("duplicada"))
   ?"recorte_incompleto" as const:"recorte_consultivo" as const,
  counts:Object.freeze(counts),
  frontsWithEvidence:supported.size,
  frontsWithoutEvidence:unique.size-supported.size,
  nextCandidates:Object.freeze(candidates),
  warnings:Object.freeze(warnings),
 });
}
