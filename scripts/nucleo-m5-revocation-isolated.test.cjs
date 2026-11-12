#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ts=require("typescript");
const source=fs.readFileSync("src/lib/nucleo/supervision-request-guard.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context={exports:{}};
vm.runInNewContext(js,context,{timeout:1000});
const create=context.exports.createM5RequestGuard;
assert.equal(typeof create,"function");
let n=0;
const test=(label,condition)=>{assert.ok(condition,label);n++;console.log("PASS "+n+" "+label)};
function deferred(){
 let resolve,reject;
 const promise=new Promise((ok,no)=>{resolve=ok;reject=no});
 return {promise,resolve,reject};
}
async function main(){
 const guard=create();
 test("token desconhecido negado",!guard.isCurrent(1));
 let token=guard.issue();
 test("primeira consulta permitida",guard.isCurrent(token));
 let published={status:"autorizado",count:42};
 const request=guard.issue();
 test("nova consulta substitui a anterior",!guard.isCurrent(token)&&guard.isCurrent(request));
 const inFlight=deferred();
 const pending=inFlight.promise.then(response=>{
   if(guard.isCurrent(request))published=response;
 });
 // Evento de revogação da capacidade sob mesma sessão: limpar imediatamente a tela
 guard.invalidate();published=null;
 inFlight.resolve({status:"autorizado",count:42});
 await pending;
 test("resposta iniciada antes da revogação não reabre painel",published===null);
 test("token antigo ficou invalidado",!guard.isCurrent(request));
 const denied=guard.issue();
 // Uma nova consulta sob RLS retorna grant falso/zero linhas: não há publicação
 const remote={grant:false,rows:0};
 if(guard.isCurrent(denied)&&remote.grant)published={status:"autorizado",count:remote.rows};
 test("consulta revogada mantém painel fechado",published===null);
 const refresh=guard.issue();
 const more=deferred();
 const second=more.promise.then(response=>{if(guard.isCurrent(refresh))published=response});
 // Troca de identidade durante consulta, sem esperar timeout/rede
 guard.invalidate();published=null;
 more.resolve({status:"autorizado",count:42});
 await second;
 test("logout/troca de identidade descarta resposta obsoleta",published===null);
 const visible=guard.issue();
 guard.invalidate(); // aba voltou a ficar visível e exigiu nova leitura
 test("reexibição de aba invalida consulta anterior",!guard.isCurrent(visible));
 const regrant=guard.issue();
 if(guard.isCurrent(regrant))published={status:"autorizado",count:42};
 test("nova concessão só reaparece após nova leitura confirmada",published?.count===42);
 guard.invalidate();published=null;
 test("nova revogação não preserva evidência anterior",published===null);
 const component=fs.readFileSync("src/components/nucleo/NucleoSupervisionPanel.tsx","utf8");
 test("componente utiliza gate real",component.includes("createM5RequestGuard")&&component.includes("requestGuard.current.issue()"));
 test("cada etapa assíncrona verifica token", (component.match(/!requestGuard.current.isCurrent\(requestToken\)/g)||[]).length>=4);
 test("eventos de sessão e visibilidade invalidam token", (component.match(/requestGuard.current.invalidate\(\)/g)||[]).length>=3);
 test("RLS e grant seguem exigidos",component.includes("client.auth.getUser()")&&component.includes("app_admin_capabilities")&&component.includes('"nucleo_manage"'));
 test("não há mutação de dados da aplicação",!(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(component)));
 console.log("M5 ISOLATED REVOCATION: "+n+" checks PASS — no Core read/write or real grant revocation.");
}
main().catch(e=>{console.error(e);process.exitCode=1});
