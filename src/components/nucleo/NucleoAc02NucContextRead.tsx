import {useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
type Front={code:string;title:string;status:string;evidence_state:string;next_action:string;evidence_count:number};
type Contribution={id:string;title:string;version_no:number;authority_state:string;source_kind:string;source_locator:string};
type Context={
 contract:"nucleo_ac02_context_nuc_v1";
 status:"consultivo_nao_homologado";
 module:{id:string;code:"NUC"};
 specialist:{role:string;specialty:string;specialty_state:string;mandate:string;successor:string};
 contribution:Contribution;
 fronts:Front[];
 limitations:string[];
 checked_at:string;
};
const ID="636768e6-e782-4c7d-8132-e7381621be12";
const CONTRIBUTION_ID="80f64bfb-cfa0-4012-a2ad-b75226881c2d";
const isContext=(v:unknown):v is Context=>{
 if(!v||typeof v!=="object")return false;
 const item=v as Partial<Context>;
 return item.contract==="nucleo_ac02_context_nuc_v1"&&
   item.status==="consultivo_nao_homologado"&&item.module?.id===ID&&item.module?.code==="NUC"&&
   item.contribution?.id===CONTRIBUTION_ID&&item.contribution.authority_state==="proposta"&&
   item.contribution.version_no===1&&Array.isArray(item.fronts)&&item.fronts.length===6&&
   item.fronts.every(f=>/^NUC-M[0-5]$/.test(f.code)&&Number.isSafeInteger(f.evidence_count)&&
      typeof f.next_action==="string")&&
   new Set(item.fronts.map(f=>f.code)).size===6&&Array.isArray(item.limitations);
};
export default function NucleoAc02NucContextRead(){
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<Context|null>(null);
 const [error,setError]=useState("");
 async function read(){
  if(busy)return;
  setBusy(true);setError("");setResult(null);
  try{
   const user=await supabase.auth.getUser();
   if(user.error||!user.data.user){setError("Sessão pessoal não comprovada. Entre na conta autorizada.");return;}
   const response=await supabase.functions.invoke("nucleo-ac02-context-read",{body:{module_id:ID}});
   if(response.error||!isContext(response.data)){
    setError("Consulta indisponível, negada ou incompleta. Sem pacote de assunção certificado.");return;
   }
   setResult(response.data);
  }catch{setError("Falha ao consultar o contexto protegido; nenhum estado foi alterado.");}
  finally{setBusy(false);}
 }
 return <section className="rounded-xl border p-3 space-y-3" aria-label="Assunção consultiva do Núcleo AC-02">
  <div className="space-y-1">
   <h4 className="text-sm font-semibold">Continuidade do Especialista Núcleo · AC-02</h4>
   <p className="text-xs text-muted-foreground">Consulta restrita por sessão e permissão. Não concede mandato, não homologa mapa nem entrega contexto a outro usuário.</p>
  </div>
  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void read()}>
   {busy?"Consultando Core…":"Preparar contexto NUC para continuidade"}
  </Button>
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  {result&&<div className="space-y-2">
   <p role="status" className="text-xs font-medium">Contexto consultivo confirmado pela leitura autenticada. Nenhum sucessor ou mandato foi certificado.</p>
   <p className="text-xs">Mapa: {result.contribution.title} · v{result.contribution.version_no} · {result.contribution.authority_state}</p>
   <p className="text-xs break-all">Contribuição AC-01: {result.contribution.id}</p>
   <p className="text-xs">Especialidade descritiva: {result.specialist.specialty} — não homologada</p>
   <div className="space-y-2">{result.fronts.map(front=><div key={front.code} className="rounded-md border p-2 text-xs space-y-1">
    <p className="font-semibold">{front.code} · {front.title}</p>
    <p>Estado: {front.status} · Evidência: {front.evidence_state} · Provas M4 acessíveis: {front.evidence_count}</p>
    <p>Próxima ação M3: {front.next_action}</p>
   </div>)}</div>
   <p className="text-xs text-muted-foreground">Verificado em {new Date(result.checked_at).toLocaleString("pt-BR")}. Fonte: Core, sob permissão do usuário.</p>
   <p className="text-xs text-muted-foreground">Limites: {result.limitations.join(" ")}</p>
  </div>}
 </section>;
}
