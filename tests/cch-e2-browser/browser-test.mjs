/** Browser contraprova of the REAL HealthProgramPage component.
 * The hooks and database are isolated fixtures, never production services.
 */
import {chromium} from "playwright";
import fs from "node:fs/promises";
const url="http://127.0.0.1:4173";
const output=process.env.CCH_E2_EVIDENCE??"/tmp/cch-e2-evidence";
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1365,height:850}});
const page=await context.newPage();
const errors=[];
page.on("pageerror",error=>errors.push(String(error)));
const check=(condition,message)=>{if(!condition)throw Error(message);};
async function audit(){const r=await page.request.get(url+"/api/audit");check(r.ok(),"audit endpoint denied");return r.json();}
async function pick(label,option){
 const parent=page.getByText(label,{exact:true}).first().locator("..");
 await parent.getByRole("combobox").click();
 await page.getByRole("option",{name:option,exact:true}).click();
}
async function snap(name){await page.screenshot({path:output+"/"+name+".png",fullPage:true});}
try{
 await page.goto(url);
 await page.getByRole("button",{name:"Entrar como atleta sintético A"}).click();
 await page.getByTestId("isolation-banner").waitFor();
 await page.getByText("Versão rascunho editável").waitFor();
 await page.getByText("Avançado",{exact:true}).first().waitFor();
 await snap("01-e2-rascunho");
 const initial=await audit();
 const target="aaaaaaaa-4000-4000-8000-aaaaaaaaaaaa";
 check(initial.rows.find(x=>x.id===target)?.reps_max===10,"unexpected seed prescription");
 await pick("Objetivo atual para revisar propostas E2","Hipertrofia e desenvolvimento muscular");
 await pick("Recuperação percebida agora","Adequada");
 await pick("Dor que interfere no treino","Não");
 await page.getByRole("button",{name:"Levar ao editor, sem salvar"}).first().waitFor();
 await snap("02-e2-proposta-antes-depois");
 await page.getByRole("button",{name:"Levar ao editor, sem salvar"}).first().click();
 await page.getByRole("button",{name:"Cancelar revisão sem salvar"}).click();
 check((await audit()).rows.find(x=>x.id===target)?.reps_max===10,
  "cancel unexpectedly persisted changed prescription");
 await page.getByRole("button",{name:"Levar ao editor, sem salvar"}).first().click();
 await page.getByRole("button",{name:"Salvar ajustes"}).click();
 await page.getByText("Prescrição atualizada.").waitFor();
 const changed=await audit();
 const changedRow=changed.rows.find(x=>x.id===target);
 check(changedRow.reps_max===11,"E2 proposed rep change not persisted");
 check(changedRow.prescription_notes?.includes("antes="),"before-after audit missing");
 await snap("03-e2-revisao-salva");
 await page.getByRole("button",{name:"Descer na sessão"}).first().click();
 await page.getByPlaceholder("Justificativa da troca/ordem (mín. 10 caracteres)").fill("Posição priorizada para o teste isolado");
 await page.getByRole("button",{name:"Confirmar no rascunho"}).click();
 await page.getByText("E2: ajuste de rascunho registrado.").waitFor();
 check((await audit()).rows.find(x=>x.id===target)?.sequence_order===2,"sequence swap not persisted");
 await snap("04-e2-ordem");
 await page.getByRole("button",{name:/Supino máquina B.*provisional/}).first().click();
 await page.getByPlaceholder("Justificativa da troca/ordem (mín. 10 caracteres)").fill("Substituição provisória aceita apenas no laboratório");
 await page.getByRole("button",{name:"Confirmar no rascunho"}).click();
 await page.getByText("E2: ajuste de rascunho registrado.").waitFor();
 const replaced=(await audit()).rows.find(x=>x.id===target);
 check(replaced.exercise_id==="cccccccc-2000-4000-8000-cccccccccccc","replacement not persisted");
 check(replaced.prescription_notes.includes("provisional"),"provisional classification missing");
 await page.getByText("Estrutura pronta para publicação.").waitFor();
 await snap("05-e2-f22-previa");

 // A second authenticated fixture cannot act on athlete A's draft.
 const contextB=await browser.newContext();
 const pageB=await contextB.newPage();
 await pageB.goto(url);
 await pageB.getByRole("button",{name:"Entrar como atleta sintético B"}).click();
 await pageB.getByTestId("isolation-banner").waitFor();
 const blocked=await pageB.request.post(url+"/api/edit",{data:{
   id:target,versionId:"aaaaaaaa-2000-4000-8000-aaaaaaaaaaab",
   before:{planned_sets_min:3,planned_sets_max:4,reps_min:6,reps_max:11,rir_target:2,rest_seconds:120},
   after:{planned_sets_min:3,planned_sets_max:4,reps_min:6,reps_max:12,rir_target:2,rest_seconds:120},
   reason:"Acesso cruzado deliberadamente recusado"}});
 check(blocked.status()===400,"cross-athlete E2 write not blocked");
 await pageB.close();await contextB.close();

 await page.getByRole("button",{name:"Publicar e gerar fila"}).click();
 await page.getByText("Versão publicada e bloqueada para edição").waitFor();
 const finalState=await audit();
 check(finalState.queue.some(q=>q.program_version_id==="aaaaaaaa-2000-4000-8000-aaaaaaaaaaab"&&q.n===2),
  "published queue not created exactly twice");
 check(finalState.queue.some(q=>q.program_version_id==="aaaaaaaa-2000-4000-8000-aaaaaaaaaaaa"&&q.n===1),
  "existing published queue changed");
 check(finalState.versions.some(v=>v.status==="published"&&v.n===2),
  "both published versions not preserved");
 const replay=await page.request.post(url+"/api/publish",{data:{versionId:"aaaaaaaa-2000-4000-8000-aaaaaaaaaaab"}});
 check(replay.status()===400,"duplicate publish was not refused");
 await snap("06-e2-publicacao-isolada");
 check(errors.length===0,"React page exceptions: "+errors.join(" | "));
 console.log(JSON.stringify({status:"passed",frontend:"real HealthProgramPage with isolated hook bindings",
  auth:"two synthetic cookie sessions and PostgreSQL RLS",snapshots:6,
  checked:["draft","evidence","cancel","save","order","replace","F22","publish","idempotency","cross-user"]}));
}finally{await browser.close();}
