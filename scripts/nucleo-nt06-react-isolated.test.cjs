/** UX/NT-06 — teste isolado do componente React REAL, com linhas fictícias e sem Supabase. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const React=require("react"),ts=require("typescript"),{JSDOM}=require("jsdom");
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:"http://localhost/"});
Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=require("react-dom/client"),{act:domAct}=require("react-dom/test-utils");
const act=React.act||domAct;
const root=path.resolve(__dirname,"..");
function loadTS(source,jsx=false){
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:jsx?ts.JsxEmit.React:undefined}}).outputText;
 const m={exports:{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,React,URL,console,
   useEffect:React.useEffect,useMemo:React.useMemo,useState:React.useState,
   supabase,Button,ChevronDown:Icon,ChevronRight:Icon,ExternalLink:Icon,RefreshCw:Icon,
   M4_EVIDENCE_VISIBLE_LIMIT:100,projectM4EvidenceWindow:(rows)=>({visible:rows.slice(0,100),hasMore:rows.length>100})});
 return m.exports;
}
let rows=[],lastLimit=null,lastTable=null;
const q={select(){return this},eq(){return this},order(){return this},async limit(n){lastLimit=n;return{data:rows.slice(0,n),error:null}}};
const supabase={from(t){lastTable=t;return q}};
const Icon=()=>React.createElement("span",{"aria-hidden":true},"•");
const Button=({children,...props})=>React.createElement("button",props,children);
const helper=loadTS(fs.readFileSync(path.join(root,"src/lib/nucleo/m4EvidenceWindow.ts"),"utf8"));
assert.equal(helper.M4_EVIDENCE_VISIBLE_LIMIT,100);
const source=fs.readFileSync(path.join(root,"src/components/nucleo/NucleoTechnicalEvidence.tsx"),"utf8").split("\n").filter(line=>!line.startsWith("import ")).join("\n");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{module:mod,exports:mod.exports,React,URL,console,
  useEffect:React.useEffect,useMemo:React.useMemo,useState:React.useState,
  supabase,Button,ChevronDown:Icon,ChevronRight:Icon,ExternalLink:Icon,RefreshCw:Icon,
  ...helper});
const Component=mod.exports.default;
assert.equal(typeof Component,"function");
(async()=>{
 for(const n of [0,1,99,100,101,150]){
  rows=Array.from({length:n},(_,i)=>({id:"fake-"+i,kind:"commit",title:"Fictícia "+i,
    external_key:"TEST-"+i,observed_state:"observado",source:"sandbox",reference_url:null,
    checked_at:null,recorded_at:"2026-11-01T12:00:00Z",evidence_note:null}));
  lastLimit=null;lastTable=null;
  const host=document.createElement("div");document.body.append(host);const app=createRoot(host);
  await act(async()=>{app.render(React.createElement(Component,{workstreamId:"isolated-"+n}));await Promise.resolve();});
  const t=host.textContent;
  assert.equal(lastTable,"nucleo_development_evidence");
  assert.equal(lastLimit,101);
  assert.ok(t.includes(Math.min(n,100)+" evidência(s) exibida(s)"),"visible count "+n);
  assert.equal(t.includes("Recorte parcial:"),n>100,"partial "+n);
  assert.equal(t.includes("Isso não comprova ausência em outras fontes"),n===0,"zero disclaimer "+n);
  const buttons=host.querySelectorAll('button[aria-expanded]');
  assert.equal(buttons.length,n?1:0);
  if(n){await act(async()=>buttons[0].dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true})));
    assert.equal(host.querySelectorAll("p.font-medium.text-xs.break-words").length,Math.min(n,100));}
  await act(async()=>app.unmount());host.remove();
  console.log("PASS UX/NT-06 React original — registros "+n);
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
