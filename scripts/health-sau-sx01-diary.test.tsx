import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HealthNutritionDiarySX01 } from "../src/modules/health/components/HealthNutritionDiarySX01";
import type { useHealthNutritionM5, MealItem } from "../src/modules/health/hooks/useHealthNutritionM5";
import type { useHealthNutritionStateM6 } from "../src/modules/health/hooks/useHealthNutritionStateM6";

type Nutrition=ReturnType<typeof useHealthNutritionM5>;
type State=ReturnType<typeof useHealthNutritionStateM6>;
const date=()=>{const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const item:MealItem={id:"item-a",athlete_id:"athlete-a",meal_log_id:"meal-a",item_name_snapshot:"Alimento A",quantity:100,unit_code:"g",energy_kcal_snapshot:200,protein_g_snapshot:15,carbohydrate_g_snapshot:20,fat_g_snapshot:6,fiber_g_snapshot:null,status:"active"};
function fixture(overrides:Partial<Nutrition>={}):Nutrition{
 const plan={id:"plan-a",athlete_id:"athlete-a",current_version_id:"v1",name:"Plano teste",status:"active"};
 const version={id:"v1",plan_id:plan.id,athlete_id:plan.athlete_id,version_number:1,status:"published",strategy_type:"maintenance",title:"V1",rationale:null};
 return {readDate:date(),plan,version,target:{id:"target-a",plan_version_id:"v1",athlete_id:"athlete-a",energy_kcal_min:2200,energy_kcal_max:2400,protein_g_min:120,protein_g_max:150,carbohydrate_g_min:null,carbohydrate_g_max:null,fat_g_min:null,fat_g_max:null,fiber_g_min:null,fiber_g_max:null},
  day:{id:"day-a",athlete_id:"athlete-a",log_date:date(),completeness_status:"partial",registration_level:"intermediate",confidence:"moderate"},
  meals:[{id:"meal-a",athlete_id:"athlete-a",food_log_day_id:"day-a",meal_type:"lunch",occurred_at:null},{id:"meal-b",athlete_id:"athlete-a",food_log_day_id:"day-a",meal_type:"snack",occurred_at:null}],
  foods:[{id:"food-a",canonical_name:"Alimento A",brand:null,basis_amount:100,basis_unit:"g",energy_kcal:200,protein_g:15},{id:"food-b",canonical_name:"Bebida B",brand:null,basis_amount:100,basis_unit:"ml",energy_kcal:30,protein_g:null}],
  recipes:[],recipeVersions:[],items:[item],activeItems:[item],totals:{kcal:200,protein:15,carbs:20,fat:6},loading:false,saving:false,error:null,
  reload:vi.fn(async()=>{}),createPlan:vi.fn(async()=>{}),saveTargets:vi.fn(async()=>{}),publishPlan:vi.fn(async()=>{}),createRecipe:vi.fn(async()=>{}),updateRecipeVersion:vi.fn(async()=>{}),addRecipeIngredient:vi.fn(async()=>{}),publishRecipe:vi.fn(async()=>{}),
  createMeal:vi.fn(async()=>{}),logFoodItem:vi.fn(async()=>{}),voidItem:vi.fn(async()=>{}),completeToday:vi.fn(async()=>{}),reopenToday:vi.fn(async()=>{}),...overrides};
}
function state(overrides:Partial<State>={}):State{
 return {daily:null,rolling7:null,loading:false,refreshing:false,error:null,refresh:vi.fn(async()=>{}),reload:vi.fn(async()=>{}),...overrides};
}
const show=(nutrition:Nutrition,nutritionState=state(),athleteId="athlete-a")=>render(<HealthNutritionDiarySX01 nutrition={nutrition} nutritionState={nutritionState} athleteId={athleteId}/>);
afterEach(cleanup);
describe("SX01 diary — synthetic existing M5/M6 controllers",()=>{
 it("never mutates on render, never treats missing nutrient as zero or uses draft targets",()=>{
  const n=fixture({activeItems:[item,{...item,id:"item-b",energy_kcal_snapshot:null}]});
  const s=state();show(n,s);
  const summary=within(screen.getByTestId("sx01-consumption"));
  expect(summary.getAllByText("—").length).toBe(2);
  expect(summary.queryByText("200 kcal")).toBeNull();
  expect(summary.queryByText(/Meta:/)).toBeNull();
  expect(n.logFoodItem).not.toHaveBeenCalled();
  expect(s.refresh).not.toHaveBeenCalled();
 });
 it("requires explicit meal and food selection, preserves catalog ml and blocks double tap",async()=>{
  let resolve!:()=>void;
  const n=fixture({logFoodItem:vi.fn(()=>new Promise<void>(r=>{resolve=r;}))});
  const s=state();show(n,s);
  expect(screen.queryByRole("button",{name:"Registrar alimento"})).toBeNull();
  fireEvent.change(screen.getByLabelText("Refeição"),{target:{value:"meal-b"}});
  fireEvent.change(screen.getByLabelText("Alimento do catálogo"),{target:{value:"food-b"}});
  const input=screen.getByLabelText("Quantidade (ml)");
  const button=screen.getByRole("button",{name:"Registrar alimento"});
  fireEvent.change(input,{target:{value:"0"}});
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(input,{target:{value:"125,5"}});
  fireEvent.click(button);fireEvent.click(button);
  expect(n.logFoodItem).toHaveBeenCalledTimes(1);
  expect(n.logFoodItem).toHaveBeenCalledWith("meal-b",n.foods[1],125.5,"ml","declared_quantity");
  resolve();await waitFor(()=>expect(s.refresh).toHaveBeenCalledTimes(1));
 });
 it("confirms completion and reopens explicitly; cancel does not write",async()=>{
  const n=fixture();show(n);
  fireEvent.click(screen.getByRole("button",{name:"Concluir dia",exact:true}));
  expect(n.completeToday).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Cancelar",exact:true}));
  expect(n.completeToday).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Concluir dia",exact:true}));
  fireEvent.click(screen.getByRole("button",{name:"Confirmar conclusão"}));
  await waitFor(()=>expect(n.completeToday).toHaveBeenCalledTimes(1));
  cleanup();
  const closed=fixture({day:{...n.day!,completeness_status:"complete"}});
  show(closed);
  expect(screen.queryByLabelText("Refeição")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Reabrir dia",exact:true}));
  expect(closed.reopenToday).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Confirmar reabertura"}));
  await waitFor(()=>expect(closed.reopenToday).toHaveBeenCalledTimes(1));
 });
 it("distinguishes no diary, explicit completed empty diary and stale athlete scope",()=>{
  const absent=fixture({day:null,meals:[],items:[],activeItems:[]});show(absent);
  expect(within(screen.getByTestId("sx01-consumption")).getAllByText("—")).toHaveLength(5);
  cleanup();
  const empty=fixture({day:{...fixture().day!,completeness_status:"complete"},meals:[],items:[],activeItems:[]});show(empty);
  expect(within(screen.getByTestId("sx01-consumption")).getByText("0 kcal")).toBeTruthy();
  cleanup();
  show(fixture(),state(),"athlete-b");
  expect(screen.getByText(/Diário não confirmado/)).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Concluir dia"})).toBeNull();
 });
 it("shows a target range only when M6 and the published version align",()=>{
  const n=fixture();
  const daily={athlete_id:"athlete-a",state_date:date(),food_log_day_id:"day-a",plan_version_id:"v1",target_id:"target-a",observed_item_count:1,observed_meal_count:2,completeness_status:"partial",energy_kcal_consumed:200,energy_kcal_min_target:2200,energy_kcal_max_target:2400} as NonNullable<State["daily"]>;
  const s=state({daily});const view=show(n,s);
  expect(within(screen.getByTestId("sx01-consumption")).getByText(/Meta:.*kcal/)).toBeTruthy();
  view.rerender(<HealthNutritionDiarySX01 nutrition={{...n,version:{...n.version!,status:"draft"}}} nutritionState={s} athleteId="athlete-a"/>);
  expect(within(screen.getByTestId("sx01-consumption")).queryByText(/Meta:/)).toBeNull();
 });
 it("requires explicit correction and retains existing void writer",async()=>{
  const n=fixture();show(n);
  fireEvent.click(screen.getByText(/Almoço 1 · 1 itens/));
  fireEvent.click(screen.getByRole("button",{name:"Anular Alimento A"}));
  expect(n.voidItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Confirmar anulação"}));
  await waitFor(()=>expect(n.voidItem).toHaveBeenCalledWith("item-a"));
 });
});

describe("SX01 residual safety",()=>{
 it("records weighed grams only when explicitly chosen and preserves visual estimates",async()=>{
  const n=fixture();show(n);
  fireEvent.change(screen.getByLabelText("Refeição"),{target:{value:"meal-a"}});
  fireEvent.change(screen.getByLabelText("Alimento do catálogo"),{target:{value:"food-a"}});
  fireEvent.change(screen.getByLabelText("Quantidade (g)"),{target:{value:"100"}});
  fireEvent.change(screen.getByLabelText("Origem da quantidade"),{target:{value:"weighed"}});
  fireEvent.click(screen.getByRole("button",{name:"Registrar alimento"}));
  await waitFor(()=>expect(n.logFoodItem).toHaveBeenCalledWith("meal-a",n.foods[0],100,"g","weighed"));
  await waitFor(()=>expect(screen.getByLabelText("Alimento do catálogo").getAttribute("disabled")).toBeNull());
  fireEvent.change(screen.getByLabelText("Alimento do catálogo"),{target:{value:"food-b"}});
  expect(within(screen.getByLabelText("Origem da quantidade")).queryByText("Pesada em balança")).toBeNull();
  fireEvent.change(screen.getByLabelText("Quantidade (ml)"),{target:{value:"80"}});
  fireEvent.change(screen.getByLabelText("Origem da quantidade"),{target:{value:"visual_estimate"}});
  fireEvent.click(screen.getByRole("button",{name:"Registrar alimento"}));
  await waitFor(()=>expect(n.logFoodItem).toHaveBeenCalledWith("meal-a",n.foods[1],80,"ml","visual_estimate"));
 });
 it("blocks ambiguous retry until readback and human review, never replays",async()=>{
  const n=fixture({logFoodItem:vi.fn(async()=>{throw Error("Resposta perdida");})});show(n);
  fireEvent.change(screen.getByLabelText("Refeição"),{target:{value:"meal-a"}});
  fireEvent.change(screen.getByLabelText("Alimento do catálogo"),{target:{value:"food-a"}});
  fireEvent.change(screen.getByLabelText("Quantidade (g)"),{target:{value:"100"}});
  fireEvent.click(screen.getByRole("button",{name:"Registrar alimento"}));
  await waitFor(()=>expect(screen.getByText(/Resultado da última gravação não confirmado/)).toBeTruthy());
  expect((screen.getByRole("button",{name:"Registrar alimento"}) as HTMLButtonElement).disabled).toBe(true);
  const review=screen.getByRole("button",{name:"Conferi os registros; liberar nova ação"});
  expect((review as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Atualizar diário"}));
  await waitFor(()=>expect((review as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(review);
  expect(n.logFoodItem).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button",{name:"Registrar alimento"}) as HTMLButtonElement).disabled).toBe(true);
 });
 it("blocks stale date even when no diary existed",()=>{
  const n=fixture({readDate:"2000-01-01",day:null,meals:[],items:[],activeItems:[]});show(n);
  expect(screen.getByText(/Diário não confirmado/)).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Concluir dia"})).toBeNull();
  expect(n.completeToday).not.toHaveBeenCalled();
 });
});
