import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {HealthProfilePage} from "../src/modules/health/pages/HealthProfilePage";
const mock=vi.hoisted(()=>({athlete:vi.fn(),profile:vi.fn(),saveProfile:vi.fn(async()=>{}),saveGoal:vi.fn(async()=>{}),savePhase:vi.fn(async()=>{}),savePreferences:vi.fn(async()=>{}),savePrimaryLocation:vi.fn(async()=>{}),addEquipment:vi.fn(async()=>{}),setEquipmentAvailability:vi.fn(async()=>{}),recordConsent:vi.fn(async()=>{}),reload:vi.fn(async()=>{})}));
vi.mock("../src/modules/health/hooks/useHealthAthlete",()=>({useHealthAthlete:mock.athlete}));
vi.mock("../src/modules/health/hooks/useHealthProfileM1",()=>({useHealthProfileM1:mock.profile}));
const data=()=>({profile:{athlete_id:"a",height_cm:180,date_of_birth:null,training_experience_level:"advanced",dominant_side:null,profile_notes:null,updated_at:"1"},activeGoal:null,activePhase:null,locations:[],primaryLocation:null,equipment:[],preferences:null,latestConsents:{},loading:false,saving:false,error:null,saveProfile:mock.saveProfile,saveGoal:mock.saveGoal,savePhase:mock.savePhase,savePreferences:mock.savePreferences,savePrimaryLocation:mock.savePrimaryLocation,addEquipment:mock.addEquipment,setEquipmentAvailability:mock.setEquipmentAvailability,recordConsent:mock.recordConsent,reload:mock.reload});
function setup(){mock.athlete.mockReturnValue({athlete:{id:"a",display_name:"Fixture"},loading:false});mock.profile.mockReturnValue(data());}
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("SX06 profile",()=>{
 it("shows declared experience separately from absent goal and phase; never saves on mount",()=>{
  setup();render(<HealthProfilePage/>);
  const summary=within(screen.getByTestId("sx06-summary"));
  expect(summary.getByText("Avançado")).toBeTruthy();expect(summary.getByText("Nenhum objetivo definido")).toBeTruthy();
  expect(screen.queryByLabelText("Altura")).toBeNull();
  expect(mock.saveGoal).not.toHaveBeenCalled();expect(mock.recordConsent).not.toHaveBeenCalled();
  expect((screen.getByRole("button",{name:"Editar fase atual"}) as HTMLButtonElement).disabled).toBe(true);
 });
 it("requires explicit goal type and priority",async()=>{
  setup();render(<HealthProfilePage/>);fireEvent.click(screen.getByRole("button",{name:"Editar objetivo"}));
  fireEvent.change(screen.getByLabelText("Nome do objetivo"),{target:{value:"Objetivo A"}});
  const save=screen.getByRole("button",{name:"Salvar objetivo"});expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Tipo de objetivo"),{target:{value:"strength"}});
  fireEvent.change(screen.getByLabelText("Prioridade"),{target:{value:"2"}});
  fireEvent.click(save);await waitFor(()=>expect(mock.saveGoal).toHaveBeenCalledWith({goal_type:"strength",title:"Objetivo A",priority:2,notes:null}));
 });
 it("retains draft on unrelated refresh and blocks stale source",()=>{
  setup();const view=render(<HealthProfilePage/>);fireEvent.click(screen.getByRole("button",{name:"Editar perfil básico"}));
  fireEvent.change(screen.getByLabelText("Altura"),{target:{value:"181,5"}});
  mock.profile.mockReturnValue({...data(),latestConsents:{notifications:{id:"c",athlete_id:"a",decision:"denied"}}});view.rerender(<HealthProfilePage/>);
  expect((screen.getByLabelText("Altura") as HTMLInputElement).value).toBe("181,5");
  const d=data();mock.profile.mockReturnValue({...d,profile:{...d.profile,height_cm:182,updated_at:"2"}});view.rerender(<HealthProfilePage/>);
  expect(screen.getByText(/A referência salva mudou/)).toBeTruthy();expect((screen.getByRole("button",{name:"Salvar perfil básico"}) as HTMLButtonElement).disabled).toBe(true);
 });
 it("validates numeric fields rather than silently replacing invalid input with null",async()=>{
  setup();render(<HealthProfilePage/>);fireEvent.click(screen.getByRole("button",{name:"Editar perfil básico"}));
  const field=screen.getByLabelText("Altura");const save=screen.getByRole("button",{name:"Salvar perfil básico"});
  fireEvent.change(field,{target:{value:"abc"}});expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(field,{target:{value:"181,5"}});fireEvent.click(save);await waitFor(()=>expect(mock.saveProfile).toHaveBeenCalledWith(expect.objectContaining({height_cm:181.5,training_experience_level:"advanced"})));
 });
 it("requires explicit confirmation of denial and preserves absent consent",async()=>{
  setup();render(<HealthProfilePage/>);
  const section=screen.getByText("Mídia privada").closest("section")!;
  expect(within(section).getByText("Sem decisão registrada")).toBeTruthy();
  fireEvent.click(within(section).getByRole("button",{name:"Negar"}));expect(mock.recordConsent).not.toHaveBeenCalled();
  fireEvent.click(within(section).getByRole("button",{name:"Cancelar"}));expect(mock.recordConsent).not.toHaveBeenCalled();
  fireEvent.click(within(section).getByRole("button",{name:"Negar"}));fireEvent.click(within(section).getByRole("button",{name:"Confirmar decisão"}));await waitFor(()=>expect(mock.recordConsent).toHaveBeenCalledWith("private_media_storage","denied"));
 });
 it("clears old athlete drafts and hides mismatched profile",()=>{
  setup();const view=render(<HealthProfilePage/>);fireEvent.click(screen.getByRole("button",{name:"Editar perfil básico"}));
  fireEvent.change(screen.getByLabelText("Altura"),{target:{value:"199"}});
  mock.athlete.mockReturnValue({athlete:{id:"b",display_name:"Outro"},loading:false});view.rerender(<HealthProfilePage/>);
  expect(screen.getByText("Perfil indisponível. Atualize antes de editar.")).toBeTruthy();
  expect(screen.queryByLabelText("Altura")).toBeNull();
 });
});
