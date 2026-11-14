import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
type Props={moduleId:string; moduleName:string; declaredRole:string};
export default function NucleoSpecialistContributions({moduleId,moduleName,declaredRole}:Props){
 const [rows,setRows]=useState<RecordRow[]>([]);
 const [reading,setReading]=useState(true);
 const [readError,setReadError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [kind,setKind]=useState("metodo");
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
 useEffect(()=>{setRole(declaredRole||"");setTitle("");setLocator("");setNote("");setChecksum("");requestRef.current=null;uncertainRef.current=false;setFeedback("");},[moduleId,declaredRole]);
 useEffect(()=>{
   let mounted=true;setReading(true);setReadError("");setRows([]);
   void db.from("nucleo_specialist_contributions").select("*")
    .eq("module_id",moduleId).order("recorded_at",{ascending:false}).limit(LIMIT)
    .then(result=>{
      if(!mounted)return;
      if(result.error||!result.data||result.data.length>=LIMIT){
        setReadError("Consulta indisponível ou parcial. Não assumir que a fila esteja vazia nem enviar nova proposta.");
      }else{setRows(result.data);uncertainRef.current=false;}
      setReading(false);
    }).catch(()=>{
      if(mounted){setReadError("Leitura interrompida. Reconsulte o Core antes de registrar.");setReading(false);}
    });
   return()=>{mounted=false};
 },[moduleId,refresh]);
 const submit=async()=>{
   if(saving||reading||readError||uncertainRef.current)return;
   const cleanRole=role.trim(),cleanTitle=title.trim(),cleanSource=locator.trim(),cleanNote=note.trim();
   if(cleanRole.length<3||cleanRole.length>180||cleanTitle.length<3||cleanTitle.length>180||
     cleanSource.length<8||cleanSource.length>1500||cleanNote.length>2000||
     (checksum.trim()&&!/^[0-9a-f]{64}$/.test(checksum.trim()))){
     setFeedback("Confira papel (3–180), título (3–180), localizador (8–1.500), nota (até 2.000) e SHA-256 opcional.");
     return;
   }
   if(!window.confirm("Registrar uma NOVA proposta de contribuição por referência? O original não será importado e nenhum mandato ou documento será homologado."))return;
   setSaving(true);setFeedback("");
   const requestId=requestRef.current??crypto.randomUUID();
   requestRef.current=requestId;
   try{
     const result=await db.from("nucleo_specialist_contributions").insert({
       module_id:moduleId,specialist_role:cleanRole,contribution_kind:kind,title:cleanTitle,
       source_kind:sourceKind,source_locator:cleanSource,source_checksum_sha256:checksum.trim()||null,
       note:cleanNote,request_id:requestId,
     }).select("*").maybeSingle();
     if(result.error||!result.data){uncertainRef.current=true;
       setFeedback("Gravação não confirmada: não repita a proposta. Reconsulte e confira o request_id antes de qualquer nova ação.");return;}
     const check=await db.from("nucleo_specialist_contributions").select("*").eq("id",result.data.id).maybeSingle();
     if(check.error||!check.data||check.data.request_id!==requestId||
        check.data.module_id!==moduleId||check.data.specialist_role!==cleanRole||
        check.data.source_locator!==cleanSource||check.data.authority_state!=="proposta"||
        check.data.version_no!==1){
       uncertainRef.current=true;setFeedback("Inserção retornou, mas readback não confirmou todos os dados. Confira a origem antes de repetir.");return;
     }
     requestRef.current=null;setTitle("");setLocator("");setNote("");setChecksum("");
     setFeedback("Proposta confirmada no Core por readback. Não homologada; original preservado na origem.");
     setRefresh(n=>n+1);
   }catch{
     uncertainRef.current=true;setFeedback("Transporte interrompido: estado indeterminado. Não repetir sem reconciliação.");
   }finally{setSaving(false);}
 };
 return <section className="rounded-lg border p-3 md:p-4 space-y-3" aria-label="Contribuições documentais do especialista AC-01">
   <div>
     <h4 className="font-semibold text-sm">Conhecimento e Evolução — contribuições do especialista</h4>
     <p className="text-xs text-muted-foreground mt-1">
       Piloto transversal por referência. Registra metadados do documento original, não carrega arquivo nem certifica especialista.
       O papel informado não equivale a mandato vigente e nenhum conteúdo é enviado à IA.
     </p>
   </div>
   <Badge variant="outline">{moduleName} · {reading?"consultando":readError?"leitura indeterminada":rows.length+" contribuição(ões) no recorte"}</Badge>
   {readError&&<p role="alert" className="text-xs text-destructive">{readError}</p>}
   <Button type="button" variant="outline" size="sm" disabled={saving||reading}
      onClick={()=>{requestRef.current=null;uncertainRef.current=false;setRefresh(n=>n+1);}}>Reconsultar registros</Button>
   {!reading&&!readError&&<div className="space-y-2">
     {rows.length===0&&<p className="rounded-md border p-3 text-sm text-muted-foreground">
       Nenhuma contribuição AC-01 persistida neste módulo. Isso não significa ausência de métodos nas fontes externas.
     </p>}
     {rows.map(item=><details key={item.id} className="rounded-md border p-3 text-xs">
       <summary className="cursor-pointer font-semibold">
         {item.title} · {item.contribution_kind} · v{item.version_no}
       </summary>
       <div className="space-y-1 mt-2">
         <Badge variant="outline">{item.authority_state} — não homologado</Badge>
         <p>Papel funcional declarado: {item.specialist_role}</p>
         <p>Origem: {item.source_kind} · identificador/localizador: {item.source_locator}</p>
         <p>SHA-256 declarado: {item.source_checksum_sha256||"Não fornecido"}</p>
         <p>Registrada: {new Date(item.recorded_at).toLocaleString("pt-BR")} · autoria autenticada: {item.recorded_by_auth_uid?.slice(0,8)||"indeterminada"}…</p>
         <p className="break-words">{item.note}</p>
         <p>Versão anterior: {item.parent_revision_id||"Contribuição inicial"}</p>
       </div>
     </details>)}
   </div>}
   <div className="space-y-3 rounded-md bg-muted/30 p-3">
     <h5 className="text-sm font-semibold">Vincular nova contribuição — proposta não homologada</h5>
     <div className="grid gap-2 sm:grid-cols-2">
       <label className="text-xs space-y-1">Papel funcional do especialista (declarado)
         <Input value={role} onChange={e=>setRole(e.target.value)} maxLength={180} disabled={saving}/>
       </label>
       <label className="text-xs space-y-1">Tipo documental
         <select value={kind} onChange={e=>setKind(e.target.value)} className="w-full h-10 border rounded-md bg-background px-2">
           {kinds.map(k=><option key={k} value={k}>{k}</option>)}
         </select>
       </label>
     </div>
     <label className="block text-xs space-y-1">Título de referência
       <Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} disabled={saving}/>
     </label>
     <div className="grid gap-2 sm:grid-cols-2">
       <label className="text-xs space-y-1">Origem declarada
         <select value={sourceKind} onChange={e=>setSourceKind(e.target.value)} className="w-full h-10 border rounded-md bg-background px-2">
           <option value="referencia_privada">Referência privada autorizada</option>
           <option value="google_drive">Google Drive</option>
           <option value="github">GitHub</option>
         </select>
       </label>
       <label className="text-xs space-y-1">Hash SHA-256 (se confirmado na fonte)
         <Input value={checksum} onChange={e=>setChecksum(e.target.value)} maxLength={64} disabled={saving}/>
       </label>
     </div>
     <label className="block text-xs space-y-1">Localizador do original (não inserir senha nem conteúdo privado)
       <Input value={locator} onChange={e=>setLocator(e.target.value)} maxLength={1500} disabled={saving}/>
     </label>
     <label className="block text-xs space-y-1">Contexto e cuidados de origem
       <Textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} rows={3} disabled={saving}/>
     </label>
     <p className="text-xs text-muted-foreground">Registro inicial sempre v1/proposta. Autoria é atribuída pelo Core. Revisão, homologação e alteração de vigência exigem processos separados.</p>
     <Button type="button" size="sm" onClick={()=>void submit()} disabled={reading||Boolean(readError)||saving||uncertainRef.current}>
       {saving?"Conferindo registro…":"Registrar proposta e conferir no Core"}
     </Button>
     {feedback&&<p role="status" className="text-xs">{feedback}</p>}
   </div>
 </section>;
}
