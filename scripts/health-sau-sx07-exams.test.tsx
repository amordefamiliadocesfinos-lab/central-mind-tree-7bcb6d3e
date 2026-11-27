import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {HealthExamsPage,completeMarkers,vitalPayload} from "../src/modules/health/pages/HealthExamsPage";
const m=vi.hoisted(()=>({athlete:vi.fn(),exams:vi.fn(),request:vi.fn(async()=>"/synthetic-private"),record:vi.fn(async()=>{}),vital:vi.fn(async()=>{}),void:vi.fn(async()=>{}),upload:vi.fn(async()=>{}),reload:vi.fn(async()=>{})}));
vi.mock("../src/modules/health/hooks/useHealthAthlete",()=>({useHealthAthlete:m.athlete}));
vi.mock("../src/modules/health/hooks/useHealthExamsM9",()=>({useHealthExamsM9:m.exams}));
const report={id:"r1",athlete_id:"a",status:"active",laboratory_name:"Laboratório fixture",collected_at:"2026-11-20T10:00:00Z",data_source:"USER_REPORTED",confidence:"moderate"};
const result={id:"x1",athlete_id:"a",lab_report_id:"r1",original_analyte_name:"Marcador A",original_result_text:"<5",original_unit:"mg/dL",original_reference_text:"Texto original",original_flag:"Flag original",confidence:"moderate"};
const doc={id:"d1",athlete_id:"a",status:"active",original_filename:"fixture.pdf",document_date:null,provider_name:null};
const data=()=>({documents:[doc],reports:[report],results:[result],states:[],vitals:[],latestStatesByCode:new Map(),reportResults:()=>[result],loading:false,saving:false,error:null,requestDocumentUrl:m.request,recordLabReport:m.record,recordVital:m.vital,voidDocument:m.void,uploadDocument:m.upload,reload:m.reload});
function setup(){m.athlete.mockReturnValue({athlete:{id:"a"},loading:false});m.exams.mockReturnValue(data());}
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("SX07",()=>{
 it("presents original result and reference, forms closed and no signed request on mount",()=>{
  setup();render(<HealthExamsPage/>);
  expect(screen.getByTestId("sx07-overview").textContent).toContain("Laboratório fixture");
  expect(screen.getByText("<5 mg/dL")).toBeTruthy();
  expect(screen.getByText(/Referência original: Texto original/)).toBeTruthy();
  expect(screen.queryByLabelText("Nome original")).toBeNull();expect(m.request).not.toHaveBeenCalled();expect(m.record).not.toHaveBeenCalled();
 });
 it("rejects partially entered marker instead of dropping it",()=>{
  expect(completeMarkers([{original_analyte_name:"A",original_result_text:"<5"},{original_analyte_name:"B",original_result_text:""}])).toBeNull();
  expect(completeMarkers([{original_analyte_name:"A",original_result_text:"<5"},{original_analyte_name:"",original_result_text:""}])).toHaveLength(1);
 });
 it("preserves qualitative result and blocks partial rows",async()=>{
  setup();render(<HealthExamsPage/>);fireEvent.click(screen.getByRole("button",{name:"Registrar exame manual"}));
  fireEvent.change(screen.getByLabelText("Nome original"),{target:{value:"A"}});
  fireEvent.change(screen.getByLabelText("Resultado original"),{target:{value:"<5"}});
  fireEvent.click(screen.getByRole("button",{name:"Adicionar marcador"}));
  fireEvent.change(screen.getAllByLabelText("Nome original")[1],{target:{value:"B"}});
  const save=screen.getByRole("button",{name:"Salvar resultados declarados"});expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Remover marcador 2"}));fireEvent.click(save);
  await waitFor(()=>expect(m.record).toHaveBeenCalledWith(expect.objectContaining({biomarkers:[expect.objectContaining({original_result_text:"<5",numeric_value:null})]})));
 });
 it("requires explicit unit and pressure pair; changing metric clears stale values",()=>{
  expect(vitalPayload("blood_pressure","120","","mmHg","","")).toBeNull();
  expect(vitalPayload("temperature","37","","mmHg","","")).toBeNull();
  expect(vitalPayload("temperature","37","","°C","","")).toMatchObject({numericValue:37,secondaryNumericValue:null});
  setup();render(<HealthExamsPage/>);fireEvent.click(screen.getByRole("button",{name:"Registrar sinal"}));
  fireEvent.change(screen.getByLabelText("Métrica"),{target:{value:"blood_pressure"}});
  fireEvent.change(screen.getByLabelText("Confirme a unidade da medição"),{target:{value:"mmHg"}});
  fireEvent.change(screen.getByLabelText("Sistólica"),{target:{value:"120"}});
  fireEvent.change(screen.getByLabelText("Diastólica"),{target:{value:"80"}});
  fireEvent.change(screen.getByLabelText("Métrica"),{target:{value:"temperature"}});
  expect((screen.getByLabelText("Valor") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Confirme a unidade da medição") as HTMLSelectElement).value).toBe("");
  expect(screen.queryByLabelText("Diastólica")).toBeNull();
 });
 it("requests private link explicitly and confirms void",async()=>{
  setup();render(<HealthExamsPage/>);fireEvent.click(screen.getByRole("button",{name:"Preparar acesso privado"}));
  await waitFor(()=>expect(m.request).toHaveBeenCalledWith("d1"));await waitFor(()=>expect(screen.getByRole("link",{name:"Abrir documento privado"})).toBeTruthy());
  fireEvent.click(screen.getByRole("button",{name:"Anular documento"}));expect(m.void).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Confirmar anulação"}));await waitFor(()=>expect(m.void).toHaveBeenCalledWith("d1"));
 });
 it("hides stale facts and private links for mismatched athlete",()=>{
  setup();const view=render(<HealthExamsPage/>);m.athlete.mockReturnValue({athlete:{id:"b"},loading:false});view.rerender(<HealthExamsPage/>);
  expect(screen.getByRole("alert").textContent).toContain("Consulta indisponível");expect(screen.queryByText("<5 mg/dL")).toBeNull();expect(screen.queryByRole("button",{name:"Preparar acesso privado"})).toBeNull();
 });
});
