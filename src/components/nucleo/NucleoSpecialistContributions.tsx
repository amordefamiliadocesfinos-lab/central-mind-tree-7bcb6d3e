import { useEffect, useId, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import NucleoContributionDesk from "@/components/nucleo/NucleoContributionDesk";
import NucleoAC01DocumentGovernance from "@/components/nucleo/NucleoAC01DocumentGovernance";

type RecordRow={
 id:string;module_id:string;workstream_id:string|null;specialist_role:string;contribution_kind:string;
 title:string;source_kind:string;source_locator:string;source_reference_id:string|null;
 source_checksum_sha256:string|null;note:string;authority_state:string;
 recorded_by_auth_uid:string;recorded_at:string;lineage_id:string;version_no:number;
 parent_revision_id:string|null;request_id:string;
};
type ACDB=Omit<Database,"public">&{public:Omit<Database["public"],"Tables">&{
 Tables:Database["public"]["Tables"]&{nucleo_specialist_contributions:{
 Row:RecordRow; Insert:Partial<RecordRow>;Update:never;Relationships:[];
 }};
}};
const db=supabase as unknown as SupabaseClient<ACDB>;
const LIMIT=200;
const kinds=["metodo","ecossistema","manual","procedimento","aprendizado","mapa","checkpoint","arquivo","outro"];
type DraftState={dirty:boolean;busy:boolean};
type Props={moduleId:string; moduleName:string; declaredRole:string; onDraftStateChange?:(value:DraftState)=>void; requestedStage?:{stage:DocStage;seq:number}|null};
type ExperienceArea = "contribuicoes" | "fila" | "ciclo";
type DocStage="vincular"|"versoes"|"comparar"|"refinar"|"consolidar"|"decidir"|"vigencia"|"historico";
type GovTab="vigente"|"propostas"|"evolucao"|"decisao"|"historico"|"competencias";
const FLOW:ReadonlyArray<{id:DocStage;name:string;area:ExperienceArea;tab?:GovTab;note:string}>=[
 {id:"vincular",name:"1. Vincular",area:"contribuicoes",note:"Referência ao original; não é importação nem homologação"},
 {id:"versoes",name:"2. Versões",area:"contribuicoes",note:"Versões da contribuição preservadas no Core"},
 {id:"comparar",name:"3. Comparar",area:"contribuicoes",note:"Somente metadados vinculados, sem comparar conteúdo externo"},
 {id:"refinar",name:"4. Refinar",area:"fila",note:"Fila e revisão, sem aprovar conflitos automaticamente"},
 {id:"consolidar",name:"5. Consolidação",area:"ciclo",tab:"evolucao",note:"Preparação consultiva, portão de publicação fechado"},
 {id:"decidir",name:"6. Decisões",area:"ciclo",tab:"decisao",note:"Pedidos e atos apenas quando registrados"},
 {id:"vigencia",name:"7. Vigência",area:"ciclo",tab:"vigente",note:"Publicação interna não equivale a vigência canônica"},
 {id:"historico",name:"8. Histórico",area:"ciclo",tab:"historico",note:"Histórico no recorte autenticado do Core"},
];
const AREAS: Array<{id:ExperienceArea;title:string;hint:string}> = [
 {id:"contribuicoes",title:"Contribuições e origem",hint:"Referências, versões e registro"},
 {id:"fila",title:"Fila e revisões",hint:"Pendências, refinamento e continuidade"},
 {id:"ciclo",title:"Ciclo documental AC-01",hint:"Estados, competências, decisões e histórico"},
];
export default function NucleoSpecialistContributions({moduleId,moduleName,declaredRole,onDraftStateChange,requestedStage}:Props){
 const [area,setArea]=useState<ExperienceArea>("contribuicoes");
 const [flowStep,setFlowStep]=useState<DocStage|null>(null);
 const [governanceTarget,setGovernanceTarget]=useState<{key:GovTab;seq:number}|null>(null);
 const targetCounter=useRef(0);
 const areaId=useId();
 const [rows,setRows]=useState<RecordRow[]>([]);
 const [reading,setReading]=useState(true);
 const [readError,setReadError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [readAt,setReadAt]=useState("");
 const [kind,setKind]=useState("metodo");
 const [parentId,setParentId]=useState("");
 const [title,setTitle]=useState("");
 const [role,setRole]=useState(declaredRole||"");
 const [sourceKind,setSourceKind]=useState("referencia_privada");
 const [locator,setLocator]=useState("");
 const [note,setNote]=useState("");
 const [checksum,setChecksum]=useState("");
 const [saving,setSaving]=useState(false);
 const [feedback,setFeedback]=useState("");
 const requestRef=useRef<string|null>(null);
 const uncertainRef=useRef(false);
 const draftDirty=Boolean(title.trim()||locator.trim()||note.trim()||checksum.trim()||
   role!==(declaredRole||"")||parentId||kind!=="metodo"||sourceKind!=="referencia_privada");
 const draftBusy=saving||uncertainRef.current;
 useEffect(()=>{
   onDraftStateChange?.({dirty:draftDirty,busy:draftBusy});
   return ()=>onDraftStateChange?.({dirty:false,busy:false});
 },[draftDirty,draftBusy,feedback,onDraftStateChange]);
 useEffect(()=>{
   if(!draftDirty&&!draftBusy)return;
   const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
   window.addEventListener("beforeunload",warn);
   return ()=>window.removeEventListener("beforeunload",warn);
 },[draftDirty,draftBusy]);
 useEffect(()=>{setArea("contribuicoes");setFlowStep(null);setGovernanceTarget(null);setRole(declaredRole||"");setTitle("");setLocator("");setNote("");setChecksum("");setParentId("");requestRef.current=null;uncertainRef.current=false;setFeedback("");},[moduleId,declaredRole]);
 useEffect(()=>{
   let mounted=true;setReading(true);setReadError("");setRows([]);setReadAt("");
   void db.from("nucleo_specialist_contributions").select("*")
    .eq("module_id",moduleId).order("recorded_at",{ascending:false}).limit(LIMIT)
    .then(result=>{
      if(!mounted)return;
      if(result.error||!result.data||result.data.length>=LIMIT){
        setReadError("Consulta indisponível ou parcial. Não assumir que a fila esteja vazia nem enviar nova proposta.");
      }else{
        setRows(result.data);setReadAt(new Date().toISOString());
        if(uncertainRef.current&&requestRef.current){
          const prior=result.data.find(item=>item.request_id===requestRef.current);
          if(prior){
            setFeedback("Proposta previamente enviada localizada no Core (v"+prior.version_no+"). Readback de reconciliação confirmado; não reenviar.");
            uncertainRef.current=false;requestRef.current=null;
            setTitle("");setLocator("");setNote("");setChecksum("");setParentId("");
          }else{
            setFeedback("A proposta anterior não foi localizada neste recorte. Estado permanece indeterminado; não criar outra com novo identificador.");
          }
        }
      }
      setReading(false);
    }).catch(()=>{
      if(mounted){setReadError("Leitura interrompida. Reconsulte o Core antes de registrar.");setReading(false);}
    });
   return()=>{mounted=false};
 },[moduleId,refresh]);
 const parent=rows.find(item=>item.id===parentId);
 const latestByLineage=new Map<string,RecordRow>();
 for(const item of rows){const latest=latestByLineage.get(item.lineage_id);if(!latest||item.version_no>latest.version_no)latestByLineage.set(item.lineage_id,item);}
 const latestRows=[...latestByLineage.values()].sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at));
 const compareFields:[string,keyof RecordRow][]=[["Título","title"],["Localizador","source_locator"],["Origem","source_kind"],["SHA-256","source_checksum_sha256"],["Observação","note"]];
 const submit=async()=>{
   if(saving||reading||readError||uncertainRef.current)return;
   const cleanRole=role.trim(),cleanTitle=title.trim(),cleanSource=locator.trim(),cleanNote=note.trim();
   if(cleanRole.length<3||cleanRole.length>180||cleanTitle.length<3||cleanTitle.length>180||
     cleanSource.length<8||cleanSource.length>1500||cleanNote.length>2000||
     (checksum.trim()&&!/^[0-9a-f]{64}$/.test(checksum.trim()))){
     setFeedback("Confira papel (3–180), título (3–180), localizador (8–1.500), nota (até 2.000) e SHA-256 opcional.");
     return;
   }
   if(parentId && (!parent || latestByLineage.get(parent.lineage_id)?.id!==parent.id || parent.specialist_role!==cleanRole || parent.contribution_kind!==kind)){
     setFeedback("A versão anterior precisa pertencer ao mesmo especialista e tipo. Reconsulte e selecione novamente.");return;
   }
   if(!window.confirm(parent ? "Registrar NOVA revisão append-only da contribuição? A referência anterior permanece preservada e nenhuma versão será homologada." : "Registrar uma NOVA proposta de contribuição por referência? O original não será importado e nenhum mandato ou documento será homologado."))return;
   setSaving(true);setFeedback("");
   const requestId=requestRef.current??crypto.randomUUID();
   requestRef.current=requestId;
   try{
     const result=await db.from("nucleo_specialist_contributions").insert({
       module_id:moduleId,specialist_role:cleanRole,contribution_kind:kind,title:cleanTitle,
       source_kind:sourceKind,source_locator:cleanSource,source_checksum_sha256:checksum.trim()||null,
       note:cleanNote,request_id:requestId,parent_revision_id:parent?.id??null,
     }).select("*").maybeSingle();
     if(result.error||!result.data){uncertainRef.current=true;
       setFeedback("Gravação não confirmada: não repita a proposta. Reconsulte e confira o request_id antes de qualquer nova ação.");return;}
     const check=await db.from("nucleo_specialist_contributions").select("*").eq("id",result.data.id).maybeSingle();
     if(check.error||!check.data||check.data.request_id!==requestId||
        check.data.module_id!==moduleId||check.data.specialist_role!==cleanRole||
        check.data.source_locator!==cleanSource||
        check.data.version_no!==(parent?parent.version_no+1:1)||
        check.data.parent_revision_id!==(parent?.id??null)||
        check.data.authority_state!==(parent?"em_evolucao":"proposta")){
       uncertainRef.current=true;setFeedback("Inserção retornou, mas readback não confirmou todos os dados. Confira a origem antes de repetir.");return;
     }
     requestRef.current=null;setTitle("");setLocator("");setNote("");setChecksum("");setParentId("");
     setFeedback("Contribuição confirmada no Core por readback. Não homologada; versões anteriores preservadas na origem.");
     setRefresh(n=>n+1);
   }catch{
     uncertainRef.current=true;setFeedback("Transporte interrompido: estado indeterminado. Não repetir sem reconciliação.");
   }finally{setSaving(false);}
 };
 useEffect(()=>{
  if(!requestedStage)return;
  const step=FLOW.find(item=>item.id===requestedStage.stage);
  if(!step)return;
  setFlowStep(step.id);setArea(step.area);
  if(step.tab)setGovernanceTarget({key:step.tab,seq:++targetCounter.current});
 },[requestedStage,moduleId]);
 const goToFlow=(step:(typeof FLOW)[number])=>{
  setFlowStep(step.id);
  setArea(step.area);
  if(step.tab)setGovernanceTarget({key:step.tab,seq:++targetCounter.current});
  requestAnimationFrame(()=>{
    const target=step.id==="vincular"?"nucleo-ac01-source-form"
      :step.id==="versoes"||step.id==="comparar"?"nucleo-ac01-source-versions"
      :areaId+"-"+step.area;
    document.getElementById(target)?.scrollIntoView({behavior:"smooth",block:"start"});
  });
 };
 return <section className="nucleo-v22-surface p-3 md:p-4 space-y-3" aria-label="Contribuições documentais do especialista AC-01">
   <div>
     <h4 className="nucleo-v22-title text-lg">Conhecimento e Evolução — contribuições do especialista</h4>
     <p className="text-xs text-muted-foreground mt-1">
       Piloto transversal por referência. Registra metadados do documento original, não carrega arquivo nem certifica especialista.
       O papel informado não equivale a mandato vigente e nenhum conteúdo é enviado à IA.
     </p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
     <Badge variant="outline" className="nucleo-v22-ac01-count">{moduleName} · {reading?"consultando":readError?"leitura indeterminada":rows.length+" contribuição(ões) no recorte"}</Badge>
     <Badge variant="outline">Papel declarado; mandato não inferido</Badge>
   </div>
   <p className="nucleo-v22-guard text-xs">
     Proposta ou revisão registrada não é decisão homologada. Publicação interna AC-01 não comprova atualização canônica da Ficha Viva, Drive ou GitHub.
   </p>
   {reading&&<p role="status" className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">Consultando contribuições autorizadas do Core…</p>}
   {readError&&<p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{readError}</p>}
   <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={saving||reading}
     onClick={()=>setRefresh(n=>n+1)}>Reconsultar registros</Button>
   <nav aria-label="Ciclo documental AC-01 — atalhos" className="rounded-xl border border-[#d2e3fc] bg-[#e8f0fe] p-3 dark:border-blue-900 dark:bg-blue-950/20">
     <p className="font-semibold text-sm text-[#174ea6] dark:text-blue-200">Do documento ao histórico</p>
     <p className="text-xs text-muted-foreground mb-2">Roteiro de consulta, sem decisões ou publicações automáticas.</p>
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
       {FLOW.map(step=><button key={step.id} type="button" onClick={()=>goToFlow(step)}
         aria-pressed={flowStep===step.id} aria-label={step.name+": "+step.note}
         className={"min-h-11 rounded-lg border px-2 py-2 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] "+
           (flowStep===step.id?"border-[#1a73e8] bg-white text-[#174ea6] dark:bg-blue-950 dark:text-blue-100":"border-[#d2e3fc] bg-white hover:bg-[#f5f9ff] dark:bg-slate-900")}>
         {step.name}
       </button>)}
     </div>
     {flowStep&&<p role="status" className="mt-2 text-xs text-muted-foreground">
       {FLOW.find(step=>step.id===flowStep)?.note}
     </p>}
   </nav>
   <nav className="nucleo-v22-tabs grid grid-cols-1 sm:grid-cols-3" aria-label="Jornada documental do especialista">
     {AREAS.map(item=><Button key={item.id} type="button"
       variant={area===item.id?"default":"outline"}
       className="nucleo-v22-pill h-auto min-h-14 justify-start px-3 py-2 text-left"
       aria-pressed={area===item.id} aria-controls={areaId+"-"+item.id}
       onClick={()=>setArea(item.id)}>
       <span className="flex min-w-0 flex-col gap-0.5 whitespace-normal">
         <span className="text-sm font-semibold">{item.title}</span>
         <span className={area===item.id?"text-xs text-primary-foreground/80":"text-xs text-muted-foreground"}>{item.hint}</span>
       </span>
     </Button>)}
   </nav>
   {/* Alternância só visual: minutas e filtros locais permanecem montados. */}
   <div id={areaId+"-fila"} hidden={area!=="fila"} className="space-y-3">
     {!reading&&!readError&&readAt
       ? <NucleoContributionDesk moduleName={moduleName} declaredRole={declaredRole} rows={rows} readAt={readAt}/>
       : <p className="rounded-md border p-3 text-sm text-muted-foreground">Fila consultiva disponível após leitura completa do Core. Consulta indisponível não significa ausência de propostas.</p>}
   </div>
   <div id={areaId+"-ciclo"} hidden={area!=="ciclo"} className="space-y-3">
     {!reading&&!readError&&readAt
       ? <NucleoAC01DocumentGovernance moduleId={moduleId} moduleName={moduleName} declaredRole={declaredRole}
         contributions={rows} readAt={readAt} requestedTab={governanceTarget}/>
       : <p className="rounded-md border p-3 text-sm text-muted-foreground">Estados, decisões e competências requerem leitura confirmada. Nenhum ato decisório ou publicação está habilitado nesta interface.</p>}
   </div>
   <div id={areaId+"-contribuicoes"} hidden={area!=="contribuicoes"} className="space-y-3">
   {!reading&&!readError&&<div id="nucleo-ac01-source-versions" className="scroll-mt-28 space-y-2">
     {rows.length===0&&<p role="status" className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
       Nenhuma contribuição AC-01 persistida neste módulo. Isso não significa ausência de métodos nas fontes externas.
     </p>}
     {rows.map(item=><details key={item.id} className="nucleo-v22-card-hover p-3 text-xs">
       <summary className="cursor-pointer font-semibold">
         {item.title} · {item.contribution_kind} · v{item.version_no}
       </summary>
       <div className="space-y-1 mt-2">
         <Badge variant="outline">{item.authority_state} — não homologado</Badge>
         <p>Papel funcional declarado: {item.specialist_role}</p>
         <p className="break-all">Origem: {item.source_kind} · identificador/localizador: {item.source_locator}</p>
         <p>SHA-256 declarado: {item.source_checksum_sha256||"Não fornecido"}</p>
         <p>Registrada: {new Date(item.recorded_at).toLocaleString("pt-BR")} · autoria autenticada: {item.recorded_by_auth_uid?.slice(0,8)||"indeterminada"}…</p>
         <p className="break-words">{item.note}</p>
         <p>Versão anterior: {item.parent_revision_id||"Contribuição inicial"}</p>
         {item.parent_revision_id&&(()=>{const previous=rows.find(r=>r.id===item.parent_revision_id);return previous ? <div className="mt-2 rounded border p-2 space-y-1"><strong>Comparação de metadados com v{previous.version_no}</strong>{compareFields.filter(([,key])=>item[key]!==previous[key]).map(([label,key])=><div key={key} className="break-words"><span className="font-medium">{label}</span><p className="text-destructive">Anterior: {String(previous[key]??"não informado")}</p><p>Nova revisão: {String(item[key]??"não informado")}</p></div>)}{compareFields.every(([,key])=>item[key]===previous[key])&&<p>Metadados iguais; conteúdo da fonte não foi comparado.</p>}<p className="text-muted-foreground">Comparação limitada a metadados declarados, não é diff do conteúdo privado nem certificação da fonte.</p></div>:<p className="text-muted-foreground">Versão anterior fora do recorte; comparação indisponível.</p>})()}
       </div>
     </details>)}
   </div>}
   <div id="nucleo-ac01-source-form" className="nucleo-v22-soft-surface scroll-mt-28 space-y-3 p-3">
     <h5 className="text-sm font-semibold">{parent?"Registrar revisão da contribuição":"Vincular nova contribuição"} — não homologada</h5>
     <label className="block space-y-1 text-sm">Histórico / versão de origem
       <select value={parentId} disabled={saving||reading||Boolean(readError)} onChange={e=>{const id=e.target.value;setParentId(id);const selected=rows.find(row=>row.id===id);if(selected){setRole(selected.specialist_role);setKind(selected.contribution_kind);setTitle(selected.title);setSourceKind(selected.source_kind);setLocator(selected.source_locator);setNote(selected.note);setChecksum(selected.source_checksum_sha256??"");}}} className="min-h-11 w-full min-w-0 rounded-md border bg-background px-2 text-sm">
         <option value="">Nova contribuição — v1</option>
         {latestRows.map(item=><option key={item.id} value={item.id}>{item.title} · {item.specialist_role} · v{item.version_no}</option>)}
       </select>
     </label>
     <div className="grid gap-2 sm:grid-cols-2">
       <label className="space-y-1 text-sm">Papel funcional do especialista (declarado)
         <Input className="min-h-11 text-sm" value={role} onChange={e=>setRole(e.target.value)} maxLength={180} disabled={saving||reading||Boolean(readError)}/>
       </label>
       <label className="space-y-1 text-sm">Tipo documental
         <select value={kind} disabled={saving||reading||Boolean(readError)} onChange={e=>setKind(e.target.value)} className="min-h-11 w-full min-w-0 rounded-md border bg-background px-2 text-sm">
           {kinds.map(k=><option key={k} value={k}>{k}</option>)}
         </select>
       </label>
     </div>
     <label className="block space-y-1 text-sm">Título de referência
       <Input className="min-h-11 text-sm" value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} disabled={saving||reading||Boolean(readError)}/>
     </label>
     <div className="grid gap-2 sm:grid-cols-2">
       <label className="space-y-1 text-sm">Origem declarada
         <select value={sourceKind} disabled={saving||reading||Boolean(readError)} onChange={e=>setSourceKind(e.target.value)} className="min-h-11 w-full min-w-0 rounded-md border bg-background px-2 text-sm">
           <option value="referencia_privada">Referência privada autorizada</option>
           <option value="google_drive">Google Drive</option>
           <option value="github">GitHub</option>
         </select>
       </label>
       <label className="space-y-1 text-sm">Hash SHA-256 (se confirmado na fonte)
         <Input className="min-h-11 text-sm" value={checksum} onChange={e=>setChecksum(e.target.value)} maxLength={64} disabled={saving||reading||Boolean(readError)}/>
       </label>
     </div>
     <label className="block space-y-1 text-sm">Localizador do original (não inserir senha nem conteúdo privado)
       <Input className="min-h-11 text-sm" value={locator} onChange={e=>setLocator(e.target.value)} maxLength={1500} disabled={saving||reading||Boolean(readError)}/>
     </label>
     <label className="block space-y-1 text-sm">Contexto e cuidados de origem
       <Textarea className="text-sm" value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} rows={3} disabled={saving||reading||Boolean(readError)}/>
     </label>
     <p className="text-xs text-muted-foreground">Nova contribuição: v1/proposta. Revisão: versão incrementada pelo Core, em evolução e append-only. A comparação exibe somente metadados; homologação e alteração de vigência exigem processos separados.</p>
     <Button type="button" size="sm" className="min-h-11 w-full whitespace-normal sm:w-auto" onClick={()=>void submit()} disabled={reading||Boolean(readError)||saving||uncertainRef.current}>
       {saving?"Conferindo registro…":"Registrar proposta e conferir no Core"}
     </Button>
     {feedback&&<p role="status" className="rounded-md border p-3 text-sm">{feedback}</p>}
   </div>
   </div>
 </section>;
}
