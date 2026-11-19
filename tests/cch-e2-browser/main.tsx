import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {HealthProgramPage} from "../../src/modules/health/pages/HealthProgramPage";
import {Toaster} from "../../src/components/ui/toaster";
import "../../src/index.css";
function IsolatedApp(){
 const [athlete,setAthlete]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{void fetch("/api/session").then(r=>r.json()).then(d=>setAthlete(d.athlete?.id??null))
   .finally(()=>setLoading(false));},[]);
 const login=async(who:"a"|"b")=>{
  const res=await fetch("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({who})});
  if(!res.ok)throw Error("Login sintético recusado");
  window.location.reload();
 };
 if(loading)return <p>Autenticando somente no laboratório descartável...</p>;
 if(!athlete)return <main style={{padding:24,maxWidth:660}}>
  <h1>CCH E2 — Laboratório isolado</h1>
  <p>Somente contas fictícias. Nenhuma rede ou banco de produção é utilizado.</p>
  <button onClick={()=>void login("a")}>Entrar como atleta sintético A</button>
  <button onClick={()=>void login("b")} style={{marginLeft:12}}>Entrar como atleta sintético B</button>
 </main>;
 return <main style={{padding:16,maxWidth:1200,margin:"auto"}}>
  <div data-testid="isolation-banner" style={{border:"2px solid orange",padding:12,marginBottom:16}}>
   <strong>ISOLADO — DADOS SINTÉTICOS — NÃO É PRODUÇÃO</strong>
   <p>Interface React real do programa M3/E2, com hooks substituídos por backend de teste em PostgreSQL descartável.</p>
   <button onClick={async()=>{await fetch("/api/logout",{method:"POST"});window.location.reload()}}>Sair do laboratório</button>
  </div>
  <HealthProgramPage/><Toaster/>
 </main>;
}
createRoot(document.getElementById("root")!).render(<IsolatedApp/>);
