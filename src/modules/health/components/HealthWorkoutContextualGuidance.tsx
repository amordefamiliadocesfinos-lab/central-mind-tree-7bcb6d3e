import type { F24ExecutionSignal } from "../cch/executionEvidence";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Session-local factual guidance. No prescription, telemetry, persistence or AI requests. */
export function HealthWorkoutContextualGuidance({context,eligible,unconfirmed,executionSignal=null}:{context:string;eligible:boolean;unconfirmed:boolean;executionSignal?:F24ExecutionSignal}){
 const [silenced,setSilenced]=useState(false);
 const [decisions,setDecisions]=useState<Record<string,"ignored"|"later"|"opened">>({});
 const [expanded,setExpanded]=useState<string|null>(null);
 const kind=unconfirmed?"equipment":executionSignal;
 const identity=JSON.stringify([context,kind]);
 const decision=decisions[identity];
 const choose=(value:"ignored"|"later"|"opened")=>{
  setDecisions(previous=>({...previous,[identity]:value}));
  setExpanded(null);
 };
 if(!eligible||!context)return null;
 if(silenced)return <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>setSilenced(false)}>Reativar orientações</Button>;
 if(!kind||decision==="ignored")return null;
 if(decision==="later")return <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>choose("opened")}>Consultar orientação adiada</Button>;
 return <aside className="space-y-2 rounded-lg border bg-muted/20 p-3" aria-label="Orientação contextual opcional">
  <p className="text-sm">{kind==="equipment"?"Sem confirmação do aparelho, use o histórico apenas como referência geral.":kind==="below_reps"?"As séries de trabalho comparadas ficaram abaixo da faixa prevista de repetições.":"As séries de trabalho comparadas tiveram RIR registrado abaixo do alvo. Isso indica menor reserva informada, não um diagnóstico de fadiga."}</p>
  <Button type="button" variant="ghost" className="min-h-11 text-xs" aria-expanded={expanded===identity} onClick={()=>setExpanded(expanded===identity?null:identity)}>Por quê?</Button>
  {expanded===identity?<p className="text-xs text-muted-foreground">{kind==="equipment"?"Origem: estado da identificação de equipamento no histórico F24. Aparelhos podem ter resistências diferentes. Um rótulo informado não certifica identidade física.":"Origem: pelo menos duas séries de trabalho concluídas deste exercício, com mesma carga e unidade registradas, comparadas à prescrição. Confiança limitada à sessão; não confirma identidade física do aparelho, recuperação, técnica ou necessidade de ajustar o treino."} Nenhuma carga ou série é sugerida aqui. Após o treino, consulte Programa para escolher o objetivo e revisar as alternativas E2/E3; qualquer alteração depende de rascunho e revisão humana.</p>:null}
  <div className="flex flex-wrap gap-1">
   <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>choose("ignored")}>Ignorar</Button>
   <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>choose("later")}>Ver depois</Button>
   <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>{setSilenced(true);setExpanded(null);}}>Silenciar dicas</Button>
  </div>
 </aside>;
}
