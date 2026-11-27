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
 return <aside className="rounded-lg border bg-muted/10 px-2 py-1" aria-label="Orientação contextual opcional">
  <div className="flex items-center gap-2"><p className="min-w-0 flex-1 text-xs font-medium">Orientação disponível</p>
  <Button type="button" variant="ghost" className="min-h-11 text-xs" aria-expanded={expanded===identity} onClick={()=>setExpanded(expanded===identity?null:identity)}>{expanded===identity?"Recolher":"Ver dica"}</Button></div>
  {expanded===identity?<div className="space-y-2 pb-2"><p className="text-sm">{kind==="equipment"?"Sem confirmação do aparelho, use o histórico apenas como referência geral.":kind==="below_reps"?"As séries de trabalho comparadas ficaram abaixo da faixa prevista de repetições.":"As séries de trabalho comparadas tiveram RIR registrado abaixo do alvo. Isso indica menor reserva informada, não um diagnóstico de fadiga."}</p>
  <p className="text-xs text-muted-foreground">{kind==="equipment"?"Origem: estado da identificação de equipamento no histórico F24. Aparelhos podem ter resistências diferentes. Um rótulo informado não certifica identidade física.":"Origem: pelo menos duas séries de trabalho concluídas deste exercício, com mesma carga e unidade registradas, comparadas à prescrição. Confiança limitada à sessão; não confirma identidade física do aparelho, recuperação, técnica ou necessidade de ajustar o treino."} Nenhuma carga ou série é sugerida aqui. Após o treino, consulte Programa para escolher o objetivo e revisar as alternativas E2/E3; qualquer alteração depende de rascunho e revisão humana.</p>
  <div className="flex flex-wrap gap-1">
   <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>choose("ignored")}>Ignorar</Button>
   <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>choose("later")}>Ver depois</Button>
   <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={()=>{setSilenced(true);setExpanded(null);}}>Silenciar dicas</Button>
  </div></div>:null}
 </aside>;
}
