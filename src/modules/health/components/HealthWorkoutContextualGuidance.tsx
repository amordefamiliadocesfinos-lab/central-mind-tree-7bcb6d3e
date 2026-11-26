import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Session-local factual guidance. No prescription, telemetry, persistence or AI requests. */
export function HealthWorkoutContextualGuidance({context,eligible,unconfirmed}:{context:string;eligible:boolean;unconfirmed:boolean}){
 const [silenced,setSilenced]=useState(false);
 const [decisions,setDecisions]=useState<Record<string,"ignored"|"later"|"opened">>({});
 const [expanded,setExpanded]=useState<string|null>(null);
 const decision=decisions[context];
 const choose=(value:"ignored"|"later"|"opened")=>{
  setDecisions(previous=>({...previous,[context]:value}));
  setExpanded(null);
 };
 if(!eligible||!context)return null;
 if(silenced)return <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>setSilenced(false)}>Reativar orientações</Button>;
 if(!unconfirmed||decision==="ignored")return null;
 if(decision==="later")return <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>choose("opened")}>Consultar orientação adiada</Button>;
 return <aside className="space-y-2 rounded-lg border bg-muted/20 p-3" aria-label="Orientação contextual opcional">
  <p className="text-sm">Sem confirmação do aparelho, use o histórico apenas como referência geral.</p>
  <Button type="button" variant="ghost" className="min-h-11 text-xs" aria-expanded={expanded===context} onClick={()=>setExpanded(expanded===context?null:context)}>Por quê?</Button>
  {expanded===context?<p className="text-xs text-muted-foreground">Origem: estado da identificação de equipamento no histórico F24. Aparelhos podem ter resistências diferentes. Um rótulo informado não certifica identidade física. Nenhuma carga ou série é sugerida aqui.</p>:null}
  <div className="flex flex-wrap gap-1">
   <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>choose("ignored")}>Ignorar</Button>
   <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>choose("later")}>Ver depois</Button>
   <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>{setSilenced(true);setExpanded(null);}}>Silenciar dicas</Button>
  </div>
 </aside>;
}
