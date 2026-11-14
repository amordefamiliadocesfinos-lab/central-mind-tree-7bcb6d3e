/**
 * AC-02 — cobertura documental FM-03, FM-08 e FM-09.
 * Recebe somente metadados autorizados de revisões do módulo no Core.
 * Source reference e corpos de documentos NÃO transitam aqui.
 * Uma revisão FM-09 não certifica o último checkpoint operacional.
 */
export type Ac02DocumentarySection="FM-03"|"FM-08"|"FM-09";
export type Ac02DocumentaryRevision=Readonly<{
 sectionCode:Ac02DocumentarySection;
 id:string;
 versionNo:number;
 authorityState:string;
 evidenceLevel:string|null;
 recordedAt:string;
 sourcePresent:boolean;
}>;
export type Ac02DocumentaryCoverage=Readonly<{
 kind:"nucleo_ac02_cobertura_documental_consultiva";
 entries:readonly Readonly<{
  sectionCode:Ac02DocumentarySection;
  status:"sem_registro"|"referencia_core_declarada";
  revisionId:string|null;
  versionNo:number|null;
  authorityState:string|null;
  recordedAt:string|null;
  sourceReference:"presente_na_revisao"|"ausente"|"nao_verificada";
 }>[];
 warnings:readonly string[];
 operationalCheckpointVerified:false;
 distinctMethodAndEcosystemVerified:false;
}>;
const sections=["FM-03","FM-08","FM-09"] as const;
const uuidExact=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const stateSet=new Set(["rascunho","proposta","homologado","historico","vigente","em_evolucao"]);
const isDate=(v:string)=>/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v));
export function describeAc02DocumentaryCoverage(
 revisions:readonly Ac02DocumentaryRevision[],
 readComplete:boolean,
):Ac02DocumentaryCoverage{
 const warnings:string[]=[];
 const grouped=new Map<string,Ac02DocumentaryRevision>();
 if(!readComplete)warnings.push("Leitura de revisões não comprovadamente completa");
 for(const r of revisions){
  if(!sections.includes(r.sectionCode)||
     !uuidExact.test(r.id)||!Number.isSafeInteger(r.versionNo)||r.versionNo<1||
     !stateSet.has(r.authorityState)||!isDate(r.recordedAt)){
   warnings.push("Metadados de revisão inválidos — registro omitido");continue;
  }
  const prev=grouped.get(r.sectionCode);
  if(prev){
   // Uma única revisão por seção deve chegar da consulta canônica.
   warnings.push("Múltiplas revisões para a mesma seção; conferir origem");
   if(prev.versionNo>=r.versionNo)continue;
  }
  grouped.set(r.sectionCode,r);
 }
 const entries=sections.map(sectionCode=>{
  const v=grouped.get(sectionCode);
  return Object.freeze({
   sectionCode,
   status:v?"referencia_core_declarada" as const:"sem_registro" as const,
   revisionId:v?.id??null,versionNo:v?.versionNo??null,
   authorityState:v?.authorityState??null,recordedAt:v?.recordedAt??null,
   sourceReference:v?(v.sourcePresent?"presente_na_revisao" as const:"ausente" as const):"nao_verificada" as const,
  });
 });
 if(!grouped.has("FM-03"))warnings.push("FM-03: escopo sem revisão na leitura");
 if(!grouped.has("FM-08"))warnings.push("FM-08: método/ecossistema sem revisão na leitura");
 else warnings.push("FM-08: uma única seção não comprova documentos distintos de método e ecossistema");
 if(!grouped.has("FM-09"))warnings.push("FM-09: checkpoint documental sem revisão na leitura");
 warnings.push("FM-09 no Core não comprova o último checkpoint operacional");
 if(entries.some(e=>e.status==="referencia_core_declarada"&&e.sourceReference==="ausente"))
  warnings.push("Existe revisão sem referência de fonte preenchida");
 return Object.freeze({
  kind:"nucleo_ac02_cobertura_documental_consultiva" as const,
  entries:Object.freeze(entries),warnings:Object.freeze(warnings),
  operationalCheckpointVerified:false as const,
  distinctMethodAndEcosystemVerified:false as const,
 });
}
