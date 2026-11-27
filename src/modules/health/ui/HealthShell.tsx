import {useRef,useState} from "react";
import {NavLink,Outlet,useLocation} from "react-router-dom";
import {Activity,Apple,Dumbbell,HeartPulse,TrendingUp,UserRound,MoonStar,FlaskConical,History,ListChecks,FileText,BellRing,Menu,BookOpen,ClipboardList,Timer} from "lucide-react";
import {cn} from "@/lib/utils";

const primaryItems=[
 {to:"/saude/hoje",label:"Hoje",mobileLabel:"Hoje",icon:Activity},
 {to:"/saude/treino",label:"Treino",mobileLabel:"Treino",icon:Dumbbell},
 {to:"/saude/alimentacao",label:"Alimentação",mobileLabel:"Dieta",icon:Apple},
 {to:"/saude/evolucao",label:"Evolução",mobileLabel:"Evolução",icon:TrendingUp},
] as const;
const secondaryGroups=[
 {title:"Saúde e perfil",items:[
  {to:"/saude/recuperacao",label:"Sono e recuperação",icon:MoonStar},
  {to:"/saude/exames",label:"Exames e biomarcadores",icon:FlaskConical},
  {to:"/saude/perfil",label:"Perfil",icon:UserRound},
 ]},
 {title:"Treinamento",items:[
  {to:"/saude/treino/programa",label:"Programa de treino",icon:ClipboardList},
  {to:"/saude/treino/historico",label:"Histórico de treino",icon:History},
  {to:"/saude/treino/atividades",label:"Atividades",icon:Timer},
  {to:"/saude/biblioteca",label:"Biblioteca de exercícios",icon:BookOpen},
 ]},
 {title:"Planejamento e análise",items:[
  {to:"/saude/revisao",label:"Revisão",icon:History},
  {to:"/saude/replanejamento",label:"Replanejamento",icon:ListChecks},
  {to:"/saude/rotina",label:"Rotina",icon:BellRing},
  {to:"/saude/relatorios",label:"Relatórios",icon:FileText},
  {to:"/saude/analytics",label:"Gráficos",icon:TrendingUp},
 ]},
] as const;

function HealthNavigation({pathname}:{pathname:string}){
 const [open,setOpen]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null);
 // Training subroutes retain the parent selection; exact link in the secondary menu.
 const primaryActive=primaryItems.some(item=>pathname===item.to||pathname.startsWith(item.to+"/"));
 const moreActive=!primaryActive&&secondaryGroups.some(group=>group.items.some(item=>pathname===item.to));
 const base="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0.5 text-[10px] sm:text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";
 return <nav aria-label="Navegação Saúde" data-testid="sau-sx03-navigation" className="relative mx-auto max-w-5xl border-t px-1 sm:px-3" onKeyDown={event=>{if(event.key==="Escape"&&open){event.preventDefault();setOpen(false);trigger.current?.focus();}}}>
  <div className="grid grid-cols-5 gap-0.5 sm:gap-1">
   {primaryItems.map(({to,label,mobileLabel,icon:Icon})=><NavLink key={to} to={to} aria-label={label} className={({isActive})=>cn(base,isActive?"bg-primary/10 text-primary":"text-muted-foreground hover:bg-muted/40 hover:text-foreground")} onClick={()=>setOpen(false)}>
    <Icon className="h-5 w-5 shrink-0" aria-hidden="true"/>
    <span className="w-full text-center break-words sm:hidden">{mobileLabel}</span><span className="hidden w-full text-center break-words sm:block">{label}</span>
   </NavLink>)}
   <button ref={trigger} type="button" aria-expanded={open} aria-controls="sau-sx03-more" aria-label={moreActive?"Mais áreas do Saúde, seção atual":"Mais áreas do Saúde"} data-active={moreActive?"true":undefined} className={cn(base,open||moreActive?"bg-primary/10 text-primary":"text-muted-foreground hover:bg-muted/40 hover:text-foreground")} onClick={()=>setOpen(value=>!value)}>
    <Menu className="h-5 w-5" aria-hidden="true"/><span>Mais</span>
   </button>
  </div>
  <div id="sau-sx03-more" hidden={!open} className="absolute inset-x-1 top-full z-40 max-h-[min(60dvh,480px)] overflow-y-auto overscroll-contain rounded-b-xl border bg-background p-2 shadow-lg sm:inset-x-3">
   <p className="px-2 pb-1 text-xs text-muted-foreground">Todas as áreas do Saúde</p>
   <div className="grid gap-2 sm:grid-cols-3">
    {secondaryGroups.map(group=><section key={group.title} className="space-y-0.5"><h2 className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group.title}</h2>{group.items.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end onClick={()=>setOpen(false)} className={({isActive})=>cn("flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",isActive?"bg-primary/10 text-primary font-semibold":"hover:bg-muted/40")}><Icon className="h-4 w-4 shrink-0" aria-hidden="true"/><span className="min-w-0 break-words">{label}</span></NavLink>)}</section>)}
   </div>
  </div>
 </nav>;
}
export function HealthShell(){
 const location=useLocation();
 return <div data-cch-health-shell className="min-h-[100dvh] bg-background pb-36 md:pb-20 print:min-h-0 print:pb-0">
  <header data-cch-focus-chrome className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
   <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2 sm:px-4">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><HeartPulse className="h-5 w-5" aria-hidden="true"/></div>
    <div className="min-w-0"><h1 className="truncate text-base font-semibold sm:text-lg">Saúde</h1><p className="truncate text-xs text-muted-foreground">Desenvolvimento individual integrado</p></div>
   </div>
   <HealthNavigation key={location.pathname} pathname={location.pathname}/>
  </header>
  <main data-cch-health-main className="mx-auto w-full max-w-5xl px-3 py-3 sm:px-4 sm:py-5 print:max-w-none print:p-0"><Outlet/></main>
 </div>;
}
