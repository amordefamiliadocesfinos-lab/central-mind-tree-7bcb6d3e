import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { HealthDashboardF10 } from "../hooks/useHealthDashboardF10";

const domains=[
 {key:"training",title:"Treinamento",route:"/saude/treino/programa",source:"M3/M4 · programa e execução"},
 {key:"nutrition",title:"Alimentação",route:"/saude/alimentacao",source:"M5/M6/M7 · estados nutricionais"},
 {key:"body",title:"Evolução corporal",route:"/saude/evolucao",source:"M8 · estado corporal"},
 {key:"recovery",title:"Sono e recuperação",route:"/saude/recuperacao",source:"M9 · estado de recuperação"},
 {key:"exams",title:"Exames e biomarcadores",route:"/saude/exames",source:"M9 · registros de saúde"}
] as const;
export function HealthIntegratedDomainHandoff({dashboard}:{dashboard:HealthDashboardF10}){
 return <Card data-testid="cch-u08-domain-handoff">
  <CardHeader><CardTitle className="text-base">Planejamento integrado de saúde</CardTitle></CardHeader>
  <CardContent className="space-y-3">
   <p className="text-sm text-muted-foreground">Consulte a origem de cada informação antes de revisar seu plano. Uma área sem dados não impede registros nas demais.</p>
   <div className="grid gap-2 sm:grid-cols-2">
    {domains.map(domain=>{
     const data=dashboard[domain.key];
     const status=data.error||data.availability==="error"?"Leitura indisponível":
      data.availability==="unknown"?"Não observado":data.availability==="not_applicable"?"Sem registro aplicável":
      data.freshness==="historical"?"Registro anterior":data.freshness==="today"?"Registro de hoje":"Registro disponível";
     return <div key={domain.key} className="rounded-lg border p-3 space-y-1">
      <p className="text-sm font-medium">{domain.title}</p>
      <p className="text-xs">{status}</p>
      <p className="text-xs text-muted-foreground">{domain.source}</p>
      {!data.error&&data.asOf?<p className="text-xs text-muted-foreground">Data de referência: {data.asOf.slice(0,10)}</p>:null}
      <Button asChild variant="outline" className="min-h-11 w-full"><Link to={domain.route}>Consultar {domain.title.toLowerCase()}</Link></Button>
     </div>;
    })}
   </div>
   <div className="grid gap-2 sm:grid-cols-2">
    <Button asChild variant="outline" className="min-h-11"><Link to="/saude/revisao">Revisar evolução (F13)</Link></Button>
    <Button asChild variant="outline" className="min-h-11"><Link to="/saude/replanejamento">Replanejar (F14)</Link></Button>
   </div>
   <p className="text-xs text-muted-foreground">As datas e janelas podem ser diferentes. Esta visão não estabelece causalidade, não interpreta exames clinicamente e não modifica planos. A decisão integrada F11 permanece no escopo nutricional existente.</p>
  </CardContent>
 </Card>;
}
