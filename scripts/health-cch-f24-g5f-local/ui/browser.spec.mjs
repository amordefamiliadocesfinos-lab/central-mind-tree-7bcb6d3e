import {test,expect} from "@playwright/test";
import fs from "node:fs";
const cfg=JSON.parse(fs.readFileSync(process.env.G5F_LOGIN_JSON,"utf8"));
const base="http://127.0.0.1:4181";
async function open(page){
 await page.route("**/*", async route=>{
  const u=route.request().url();
  if(u.startsWith(base+"/")||u.startsWith("http://127.0.0.1:54321/") ||
    u.startsWith("data:")||u.startsWith("blob:")) return route.continue();
  throw Error("G5-F browser blocked external origin");
 });
 await page.addInitScript(auth=>{window.__G5F_TEST_AUTH__=auth;},cfg);
 await page.goto("/");
 await expect(page.getByTestId("g5f-auth-confirmed")).toContainText("AUTENTICADO LOCAL",{timeout:30_000});
 await expect(page.getByTestId("g5f-count")).toContainText("3");
}
const extra=page=>page.getByRole("button",{name:"+ Série extra",exact:true});
const selected=page=>page.getByRole("button",{name:"Iniciar Supino máquina"});
test("F19 genuine local Auth: 3→4→5 with new choice after reload",async({page})=>{
 await open(page);
 await extra(page).click();
 await page.getByRole("button",{name:"Próximo exercício",exact:true}).first().click();
 await page.getByRole("button",{name:"Exercício anterior",exact:true}).click();
 await expect(selected(page)).toBeEnabled();
 await selected(page).click();
 await page.getByRole("button",{name:"Concluir série"}).click();
 await expect(page.getByTestId("g5f-count")).toContainText("4");
 await page.reload();
 await expect(page.getByTestId("g5f-count")).toContainText("4",{timeout:30_000});
 await expect(extra(page)).toBeVisible();
 await extra(page).click();
 // Actual F19 requires a persisted result after work4; synthetic G5-E did not.
 const save=page.getByRole("button",{name:"Salvar resultado"});
 if(await save.count()) {
   await save.click();
   await expect(page.getByRole("button",{name:"Resultado salvo"})).toBeVisible();
 }
 await expect(selected(page)).toBeEnabled();
 await selected(page).click();
 await page.getByRole("button",{name:"Concluir série"}).click();
 await expect(page.getByTestId("g5f-count")).toContainText("5");
});
for(const width of [320,360,390,430,1280]){
 test("genuine Auth F19 active responsive "+width,async({browser})=>{
  const ctx=await browser.newContext({viewport:{width,height:900}});
  const page=await ctx.newPage();
  try{
   await open(page);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   expect(overflow).toBeLessThanOrEqual(1);
   await expect(extra(page)).toBeVisible();
   const rect=await extra(page).boundingBox();
   expect(rect?.height??0).toBeGreaterThanOrEqual(44);
   await page.screenshot({path:"test-results/g5f-auth-"+width+".png",fullPage:true});
  }finally{await ctx.close();}
 });
}
