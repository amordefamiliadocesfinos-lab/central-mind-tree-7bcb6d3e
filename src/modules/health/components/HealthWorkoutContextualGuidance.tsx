import type { F24ExecutionSignal } from "../cch/executionEvidence";
import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Session-local factual guidance. No prescription, telemetry, persistence or AI requests.
 * Mounted at a stable session boundary, outside primary execution controls.
 */
export function HealthWorkoutContextualGuidance({context,sessionContext,eligible,unconfirmed,executionSignal=null}:{
 context:string;sessionContext:string;eligible:boolean;unconfirmed:boolean;executionSignal?:F24ExecutionSignal
}){
 const [silenced,setSilenced]=useState(false);
 const [decisions,setDecisions]=useState<Record<string,"ignored"|"later">>({});
 const [expanded,setExpanded]=useState<string|null>(null);
 const [explaining,setExplaining]=useState(false);
 // Evidence from actual comparable sets has priority over the generic equipment hint.
 // Equipment advice is session-wide, not repeated for every unconfirmed exercise.
 const kind=executionSignal??(unconfirmed?"equipment":null);
 const identity=JSON.stringify([kind==="equipment"?sessionContext:context,kind]);
 const decision=decisions[identity];
 const close=()=>{setExpanded(null);setExplaining(false);};
 useEffect(()=>{
  setExpanded(null);
  setExplaining(false);
 },[identity,eligible]);
 const choose=(value:"ignored"|"later")=>{
  setDecisions(previous=>({...previous,[identity]:value}));
  close();
 };
 const open=()=>{
  setDecisions(previous=>{const next={...previous};delete next[identity];return next;});
  setExpanded(identity);setExplaining(false);
 };
 if(!eligible||!context||!sessionContext)return null;
 if(silenced)return <Button type="button" variant="ghost" className="min-h-11 text-xs text-muted-foreground" onClick={()=>setSilenced(false)}>Reativar orientações</Button>;
 if(!kind||decision==="ignored")return null;
 const isOpen=expanded===identity;
 return <aside data-testid="cch-contextual-guidance" className="rounded-lg border bg-muted/10 px-2 py-1" aria-label="Orientação contextual opcional">
  <div className="flex items-center gap-2">
   <Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true"/>
   <p className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">{decision==="later"?"Orientação adiada":"Orientação disponível"}</p>
   <Button type="button" variant="ghost" className="min-h-11 text-xs" aria-expanded={isOpen} onClick={()=>isOpen?close():open()}>{isOpen?"Recolher":decision==="later"?"Consultar dica":"Ver dica"}</Button>
  </div>
  {isOpen?<div className="space-y-2 px-1 pb-2">
   <p className="text-sm">{kind==="equipment"?"Sem rótulo confirmado, não compare cargas entre aparelhos.":kind==="below_reps"?"As séries de trabalho comparadas ficaram abaixo da faixa prevista de repetições.":"As séries comparadas tiveram RIR abaixo do alvo registrado. Isso não diagnostica fadiga."}</p>
   <Button type="button" variant="ghost" className="min-h-11 px-2 text-xs" aria-expanded={explaining} onClick={()=>setExplaining(value=>!value)}>Por quê?</Button>
   {explaining?<p className="text-xs text-muted-foreground">{kind==="equipment"?"Origem: identificação do equipamento no histórico F24. Aparelhos podem ter resistências diferentes; um rótulo não certifica identidade física.":"Origem: pelo menos duas séries de trabalho concluídas deste exercício, com mesma carga e unidade registradas, comparadas à prescrição. Confiança limitada à sessão; não confirma identidade física do aparelho, recuperação, técnica ou necessidade de ajuste."} Nenhuma carga ou série é sugerida. Após o treino, consulte Programa para revisar as alternativas E2/E3; alterações exigem rascunho e revisão humana.</p>:null}
   <div className="flex flex-wrap gap-1">
    <Button type="button" variant="ghost" className="min-h-11 px-2 text-xs" onClick={()=>choose("ignored")}>Ignorar</Button>
    <Button type="button" variant="ghost" className="min-h-11 px-2 text-xs" onClick={()=>choose("later")}>Ver depois</Button>
    <Button type="button" variant="ghost" className="min-h-11 px-2 text-xs" onClick={()=>{setSilenced(true);close();}}>Silenciar dicas</Button>
   </div>
  </div>:null}
 </aside>;
}
