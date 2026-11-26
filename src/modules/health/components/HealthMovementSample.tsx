import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Original schematic illustrations for UX preview, not approved technique media.
 * Exact M2 identities only; never infer exercise or equipment from names.
 */
const samples:Record<string,"bench"|"squat"|"pullup">={
 "cbbf1aa6-b906-46e8-84ce-b13f67aa4f0a":"bench",
 "78b28ad9-8313-460e-a2bd-449b9e327e5f":"squat",
 "a99fdbea-5be6-427a-8c06-69e469f54087":"pullup"
};
function Pose({kind,second}:{kind:"bench"|"squat"|"pullup";second:boolean}){
 return <svg viewBox="0 0 180 128" className="w-full max-h-40 text-foreground" aria-hidden="true">
  <path d="M12 116H168" stroke="currentColor" opacity=".2"/>
  <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
   {kind==="bench"?<>
    <path d="M24 83H132M40 83V113M118 83V113" opacity=".4"/>
    <circle cx="42" cy="69" r="8"/><path d="M52 74H101L125 94L143 113M88 74L113 100L128 113"/>
    <path d={second?"M63 74L63 43L86 25M78 74L78 43L101 25":"M63 74L44 62L79 51M78 74L104 62L94 51"}/>
    <path d={second?"M70 25H115M73 20V30M112 20V30":"M66 51H107M69 46V56M104 46V56"} stroke="#64748b" strokeWidth="6"/>
   </>:kind==="squat"?<>
    <circle cx={second?78:87} cy={second?42:19} r="8"/>
    <path d={second?"M80 51L104 78L75 91L91 112H108M104 78L121 94L119 112H135M82 53L67 63L54 55":"M87 29L88 65L84 91L84 112H101M88 65L105 91L105 112H122M88 33L69 47L54 32"}/>
    <path d={second?"M45 53H111M48 47V59M108 47V59":"M45 32H120M48 26V38M117 26V38"} stroke="#64748b" strokeWidth="6"/>
   </>:<>
    <path d="M26 114V13H154V114M26 13H154" opacity=".4"/>
    <circle cx="90" cy={second?27:47} r="8"/>
    <path d={second?"M90 37V74L78 98L91 112M90 74L104 98L99 112M90 43L60 43L60 13M90 43L120 43L120 13":"M90 57V92L78 107M90 92L102 107M90 63L64 39L60 13M90 63L116 39L120 13"}/>
   </>}
  </g>
 </svg>;
}
export function HealthMovementSample({exerciseId}:{exerciseId:string}){
 const kind=samples[exerciseId];
 const [playing,setPlaying]=useState(false);
 const [second,setSecond]=useState(false);
 useEffect(()=>{
  if(!playing)return;
  const interval=window.setInterval(()=>setSecond(prev=>!prev),900);
  const end=window.setTimeout(()=>{setPlaying(false);setSecond(false);},5400);
  return ()=>{window.clearInterval(interval);window.clearTimeout(end);};
 },[playing]);
 if(!kind)return null;
 const reduced=typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 return <section className="space-y-2 rounded-xl border p-3" aria-label="Amostra visual provisória">
  <p className="text-sm font-medium">Amostra visual · protótipo</p>
  <p className="text-xs text-muted-foreground">Ilustração esquemática original para testar a interface. Não é demonstração técnica revisada nem orientação de execução.</p>
  {playing&&!reduced?<div className="rounded-lg bg-muted/30"><Pose kind={kind} second={second}/></div>:
   <div className="grid grid-cols-2 gap-2">
    <div className="rounded-lg bg-muted/30"><Pose kind={kind} second={false}/><p className="text-center text-xs pb-1">Quadro A</p></div>
    <div className="rounded-lg bg-muted/30"><Pose kind={kind} second/><p className="text-center text-xs pb-1">Quadro B</p></div>
   </div>}
  {!reduced?<Button type="button" variant="outline" className="min-h-11 w-full" onClick={()=>{setSecond(false);setPlaying(v=>!v);}}>{playing?"Parar amostra":"Reproduzir amostra (5 s)"}</Button>:
   <p className="text-xs text-muted-foreground">Movimento reduzido: quadros estáticos.</p>}
 </section>;
}
