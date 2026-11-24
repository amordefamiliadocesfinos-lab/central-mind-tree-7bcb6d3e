import { test,expect } from "@playwright/test";

const START="http://127.0.0.1:4177/";
async function isolateNetwork(page){
 await page.route("**/*", async route=>{
   const url=route.request().url();
   if(url.startsWith(START) || url.startsWith("data:") || url.startsWith("blob:"))
     return route.continue();
   throw new Error("G5-E blocked non-local request: "+url);
 });
}
async function open(page){
 await isolateNetwork(page);
 await page.goto("/");
 await expect(page.getByTestId("g5e-isolation")).toContainText("SEM AUTENTICAÇÃO REAL");
 await expect(page.getByTestId("g5e-snapshot")).toContainText("rest 3/3");
}
const extra=(page)=>page.getByRole("button",{name:"+ Série extra",exact:true});
const chosen=(page)=>page.getByRole("button",{name:"Iniciar Supino máquina"});
test("3/3 → 4/3 → 5/3, decision retained after navigation and reload",async({page})=>{
 await open(page);
 await expect(extra(page)).toBeVisible();
 await expect(page.getByRole("button",{name:"Próximo exercício",exact:true}).last()).toBeVisible();
 await extra(page).click();
 await page.getByRole("button",{name:"Próximo exercício",exact:true}).first().click();
 await page.getByRole("button",{name:"Exercício anterior",exact:true}).click();
 await expect(chosen(page)).toBeEnabled();
 await chosen(page).click();
 await expect(page.getByRole("button",{name:"Concluir série"})).toBeVisible();
 await page.getByRole("button",{name:"Concluir série"}).click();
 await expect(page.getByTestId("g5e-snapshot")).toContainText("rest 4/3");
 await expect(page.getByRole("button",{name:"Salvar resultado"})).toBeEnabled();
 await page.getByRole("button",{name:"Salvar resultado"}).click();
 await page.reload();
 await expect(page.getByTestId("g5e-snapshot")).toContainText("rest 4/3");
 await expect(extra(page)).toBeVisible();
 await expect(page.getByRole("button",{name:"Escolha acima como deseja continuar"})).toBeDisabled();
 await extra(page).click();
 await expect(chosen(page)).toBeEnabled();
 await chosen(page).click();
 await page.getByRole("button",{name:"Concluir série"}).click();
 await expect(page.getByTestId("g5e-snapshot")).toContainText("rest 5/3");
 await expect(page.getByRole("button",{name:"+ Série extra",exact:true})).toBeVisible();
});
test("two browser tabs observe synthetic changes; RPC race is validated separately in PostgreSQL",async({browser})=>{
 const ctx=await browser.newContext();
 const first=await ctx.newPage();
 const second=await ctx.newPage();
 try{
  await open(first);
  await isolateNetwork(second);
  await second.goto("/");
  await expect(second.getByTestId("g5e-snapshot")).toContainText("rest 3/3");
  await extra(first).click();
  await chosen(first).click();
  await expect(second.getByTestId("g5e-snapshot")).toContainText("work 3/3");
  await first.getByRole("button",{name:"Concluir série"}).click();
  await expect(second.getByTestId("g5e-snapshot")).toContainText("rest 4/3");
  await second.reload();
  await expect(extra(second)).toBeVisible();
 }finally{await ctx.close();}
});
for(const width of [320,360,390,430,1280]){
 test("responsive active F19 at "+width+"px",async({browser})=>{
  const ctx=await browser.newContext({viewport:{width,height:900}});
  const page=await ctx.newPage();
  try{
   await open(page);
   const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   expect(horizontal).toBeLessThanOrEqual(1);
   const choice=extra(page);
   await expect(choice).toBeVisible();
   const box=await choice.boundingBox();
   expect(box?.height??0).toBeGreaterThanOrEqual(44);
   expect(box?.width??0).toBeGreaterThanOrEqual(120);
   await page.screenshot({path:"test-results/g5e-"+width+".png",fullPage:true});
  }finally{await ctx.close();}
 });
}
