import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Original schematic illustrations for UX preview, not approved technique media.
 * Exact M2 identities only; never infer exercise or equipment from names.
 */
type PoseKind="bench"|"squat"|"pullup"|"chestPress"|"inclinePress"|"lateralRaise"|"seatedRow"|"latPulldown"|"legPress"|"legExtension";
// Catalog-only SELECT on 27/11/2026 confirmed these exact exercise IDs and
// equipment associations. Do not expand by matching names or free-text labels.
const samples:Partial<Record<string,PoseKind>>={
 "cbbf1aa6-b906-46e8-84ce-b13f67aa4f0a":"bench",
 "78b28ad9-8313-460e-a2bd-449b9e327e5f":"squat",
 "a99fdbea-5be6-427a-8c06-69e469f54087":"pullup",
 "c3e88df3-7414-4ebb-a457-b4a8a266dd72":"chestPress",
 "8c608253-bb2b-42e8-a10b-b00c4b502342":"inclinePress",
 "18d9c6a3-4b1e-45ad-8643-02cea77f3461":"lateralRaise",
 "b55f0597-d2a5-4773-b6f7-932092929fa6":"seatedRow",
 "8e88d7a9-9cdd-4975-ab2f-f352b8c6da6f":"latPulldown",
 "e3fee31e-4811-4573-9297-74ae1e24d057":"legPress",
 "651f57cd-a556-4c36-b170-c2a434c289e2":"legExtension"
};
function Pose({kind,second}:{kind:PoseKind;second:boolean}){
 return <svg viewBox="0 0 180 128" className="h-auto w-full max-h-44 text-foreground" aria-hidden="true">
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
   </>:kind==="pullup"?<>
    <path d="M26 114V13H154V114M26 13H154" opacity=".4"/>
    <circle cx="90" cy={second?27:47} r="8"/>
    <path d={second?"M90 37V74L78 98L91 112M90 74L104 98L99 112M90 43L60 43L60 13M90 43L120 43L120 13":"M90 57V92L78 107M90 92L102 107M90 63L64 39L60 13M90 63L116 39L120 13"}/>
   </>:kind==="chestPress"||kind==="inclinePress"?<>
    <path d="M37 112V25M37 84H89M52 84V112M150 112V18H132" opacity=".35" strokeWidth="6"/>
    <path d={kind==="inclinePress"?"M50 84L31 36":"M50 84V36"} opacity=".55" strokeWidth="8"/>
    <circle cx={kind==="inclinePress"?45:59} cy="27" r="8"/>
    <path d={kind==="inclinePress"?"M50 38L69 78L104 79L116 112H136":"M59 38L61 78L105 79L116 112H136"}/>
    <path d={kind==="inclinePress"?(second?"M51 47L88 29L119 10":"M51 47L77 58L89 32"):(second?"M60 45L92 45L123 45":"M60 45L81 62L94 45")}/>
    <path d={kind==="inclinePress"?(second?"M119 10L132 18":"M89 32L132 18"):(second?"M123 45H150":"M94 45H150")} stroke="#64748b" opacity=".8"/>
   </>:kind==="lateralRaise"?<>
    <circle cx="90" cy="19" r="8"/><path d="M90 29V72L76 112H63M90 72L104 112H117"/>
    <path d={second?"M90 38L55 40L22 45M90 38L125 40L158 45":"M90 38L76 59L69 84M90 38L104 59L111 84"}/>
    <path d={second?"M14 40V50M30 40V50M150 40V50M166 40V50":"M61 78V90M77 78V90M103 78V90M119 78V90"} stroke="#64748b" strokeWidth="6"/>
   </>:kind==="seatedRow"?<>
    <path d="M21 90H90M43 90V112M151 17V112M140 54H160" strokeWidth="6" opacity=".35"/>
    <circle cx="51" cy="35" r="8"/><path d="M51 45L55 84L91 84L124 94L138 84"/>
    <path d={second?"M53 49L39 62L79 56":"M53 49L86 55L119 56"}/>
    <path d={second?"M79 56H151":"M119 56H151"} stroke="#64748b" strokeWidth="2"/>
    <path d={second?"M77 50V62":"M117 50V62"} stroke="#64748b" strokeWidth="6"/>
   </>:kind==="latPulldown"?<>
    <path d="M32 112V10H148V112M54 89H126M69 89V112" opacity=".35" strokeWidth="6"/>
    <circle cx="90" cy="42" r="8"/><path d="M90 52V83L118 85L127 112M90 83L65 85L55 112"/>
    <path d={second?"M90 55L58 65L43 43M90 55L122 65L137 43":"M90 55L64 30L43 15M90 55L116 30L137 15"}/>
    <path d={second?"M43 43H137M90 43V10":"M43 15H137M90 15V10"} stroke="#64748b" strokeWidth="3"/>
   </>:kind==="legPress"?<>
    <path d="M21 112H159M24 86L52 112M88 112L156 20M104 112L169 24" opacity=".35" strokeWidth="6"/>
    <path d="M24 82L51 98L86 102" opacity=".55" strokeWidth="8"/>
    <circle cx="37" cy="72" r="8"/><path d="M44 80L81 98"/>
    <path d={second?"M81 98L108 66L135 33":"M81 98L94 58L121 55"}/>
    <path d={second?"M122 26L149 45":"M108 46L135 65"} stroke="#64748b" strokeWidth="7"/>
   </>:<>
    <path d="M35 112V34M35 81H104M58 81V112M104 81V112" opacity=".35" strokeWidth="6"/>
    <circle cx="55" cy="25" r="8"/><path d="M55 35V76L99 78M55 45L75 59L87 75"/>
    <path d={second?"M99 78L143 77H155":"M99 78L106 112H118"}/>
    <path d={second?"M130 70V84":"M99 104H114"} stroke="#64748b" strokeWidth="8"/>
   </>}
  </g>
 </svg>;
}
export function HealthMovementSample({exerciseId}:{exerciseId:string}){
 const kind=samples[exerciseId];
 const [playing,setPlaying]=useState(false);
 const [second,setSecond]=useState(false);
 const [reduced,setReduced]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
 useEffect(()=>{
  const query=window.matchMedia("(prefers-reduced-motion: reduce)");
  const sync=()=>{setReduced(query.matches);if(query.matches){setPlaying(false);setSecond(false);}};
  sync();query.addEventListener("change",sync);
  return ()=>query.removeEventListener("change",sync);
 },[]);
 useEffect(()=>{
  if(!playing||reduced)return;
  const interval=window.setInterval(()=>setSecond(prev=>!prev),900);
  const end=window.setTimeout(()=>{setPlaying(false);setSecond(false);},5400);
  return ()=>{window.clearInterval(interval);window.clearTimeout(end);};
 },[playing,reduced]);
 if(!kind)return null;
 return <section data-testid="cch-movement-sample" className="space-y-2 rounded-xl border p-3" aria-label="Amostra visual provisória">
  <p className="text-sm font-medium">Amostra visual · protótipo</p>
  <p className="text-xs text-muted-foreground">Ilustração esquemática original. Posições ilustrativas, não são instrução de técnica nem representação do aparelho físico utilizado.</p>
  {playing&&!reduced?<div className="rounded-lg bg-muted/30"><Pose kind={kind} second={second}/></div>:
   <div className="grid grid-cols-2 gap-2">
    <div className="rounded-lg bg-muted/30"><Pose kind={kind} second={false}/><p className="text-center text-xs pb-1">Quadro A</p></div>
    <div className="rounded-lg bg-muted/30"><Pose kind={kind} second/><p className="text-center text-xs pb-1">Quadro B</p></div>
   </div>}
  {!reduced?<Button type="button" variant="outline" className="min-h-11 w-full" onClick={()=>{setSecond(false);setPlaying(v=>!v);}}>{playing?"Parar amostra":"Reproduzir amostra (5 s)"}</Button>:
   <p className="text-xs text-muted-foreground">Movimento reduzido: quadros estáticos.</p>}
 </section>;
}
