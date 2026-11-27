import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {MemoryRouter,Route,Routes,useNavigate} from "react-router-dom";
import HealthModule from "../src/modules/health/HealthModule";
const m=vi.hoisted(()=>({athlete:vi.fn(),refresh:vi.fn(),create:vi.fn()}));
vi.mock("../src/modules/health/hooks/useHealthAthlete",()=>({useHealthAthlete:m.athlete}));
vi.mock("../src/modules/health/ui/HealthOnboarding",()=>({HealthOnboarding:()=> <p>Onboarding fixture</p>}));
vi.mock("../src/modules/health/pages/HealthDashboardPage",()=>({HealthDashboardPage:()=> <p data-testid="destination">Dashboard</p>}));
vi.mock("../src/modules/health/pages/HealthWorkoutPage",()=>({HealthWorkoutPage:()=> <p data-testid="destination">Workout</p>}));
vi.mock("../src/modules/health/pages/HealthActivitiesPage",()=>({HealthActivitiesPage:()=> <p data-testid="destination">Activities</p>}));
vi.mock("../src/modules/health/pages/HealthTrainingHistoryPage",()=>({HealthTrainingHistoryPage:()=> <p data-testid="destination">TrainingHistory</p>}));
vi.mock("../src/modules/health/pages/HealthProgramPage",()=>({HealthProgramPage:()=> <p data-testid="destination">Program</p>}));
vi.mock("../src/modules/health/pages/HealthNutritionPage",()=>({HealthNutritionPage:()=> <p data-testid="destination">Nutrition</p>}));
vi.mock("../src/modules/health/pages/HealthBodyPage",()=>({HealthBodyPage:()=> <p data-testid="destination">Body</p>}));
vi.mock("../src/modules/health/pages/HealthRecoveryPage",()=>({HealthRecoveryPage:()=> <p data-testid="destination">Recovery</p>}));
vi.mock("../src/modules/health/pages/HealthExamsPage",()=>({HealthExamsPage:()=> <p data-testid="destination">Exams</p>}));
vi.mock("../src/modules/health/pages/HealthLongitudinalReviewPage",()=>({HealthLongitudinalReviewPage:()=> <p data-testid="destination">LongitudinalReview</p>}));
vi.mock("../src/modules/health/pages/HealthReplanningPage",()=>({HealthReplanningPage:()=> <p data-testid="destination">Replanning</p>}));
vi.mock("../src/modules/health/pages/HealthReportsPage",()=>({HealthReportsPage:()=> <p data-testid="destination">Reports</p>}));
vi.mock("../src/modules/health/pages/HealthRoutinePage",()=>({HealthRoutinePage:()=> <p data-testid="destination">Routine</p>}));
vi.mock("../src/modules/health/pages/HealthAnalyticsPage",()=>({HealthAnalyticsPage:()=> <p data-testid="destination">Analytics</p>}));
vi.mock("../src/modules/health/pages/HealthProfilePage",()=>({HealthProfilePage:()=> <p data-testid="destination">Profile</p>}));
vi.mock("../src/modules/health/pages/HealthLibraryPage",()=>({HealthLibraryPage:()=> <p data-testid="destination">Library</p>}));
const routes=[["hoje","Dashboard"],["treino","Workout"],["treino/atividades","Activities"],["treino/historico","TrainingHistory"],["treino/programa","Program"],["alimentacao","Nutrition"],["evolucao","Body"],["recuperacao","Recovery"],["exames","Exams"],["revisao","LongitudinalReview"],["replanejamento","Replanning"],["relatorios","Reports"],["rotina","Routine"],["analytics","Analytics"],["perfil","Profile"],["biblioteca","Library"]];
function Back(){const navigate=useNavigate();return <button onClick={()=>navigate(-1)}>Back fixture</button>}
function App({initial="/saude"}:{initial?:string}){return <MemoryRouter initialEntries={[initial]}><Back/><Routes><Route path="/saude/*" element={<HealthModule/>}/></Routes></MemoryRouter>}
function allowed(){m.athlete.mockReturnValue({athlete:{id:"fixture"},loading:false,error:null,refresh:m.refresh,createOwnAthlete:m.create})}
afterEach(()=>{cleanup();vi.clearAllMocks()});
describe("SX11 real router and access boundary",()=>{
 it.each(routes)("resolves direct /saude/%s to its registered page",(path,name)=>{
  allowed();render(<App initial={"/saude/"+path}/>);expect(screen.getByTestId("destination").textContent).toBe(name);
  expect(screen.getByRole("navigation",{name:"Navegação Saúde"})).toBeTruthy();
  expect(m.create).not.toHaveBeenCalled();
 });
 it("navigates across domains with actual router and back",()=>{
  allowed();render(<App/>);expect(screen.getByTestId("destination").textContent).toBe("Dashboard");
  const nav=screen.getByRole("navigation",{name:"Navegação Saúde"});
  fireEvent.click(within(nav).getByRole("link",{name:"Alimentação"}));expect(screen.getByTestId("destination").textContent).toBe("Nutrition");
  fireEvent.click(within(nav).getByRole("button",{name:/Mais áreas/}));fireEvent.click(within(nav).getByRole("link",{name:"Relatórios"}));
  expect(screen.getByTestId("destination").textContent).toBe("Reports");
  fireEvent.click(screen.getByRole("button",{name:"Back fixture"}));expect(screen.getByTestId("destination").textContent).toBe("Nutrition");
  expect(m.create).not.toHaveBeenCalled();
 });
 it("fails closed on access error and never creates a profile automatically",()=>{
  m.athlete.mockReturnValue({athlete:{id:"stale"},loading:false,error:"fixture denied",refresh:m.refresh,createOwnAthlete:m.create});
  render(<App initial="/saude/exames"/>);expect(screen.queryByTestId("destination")).toBeNull();
  expect(screen.getByText("Saúde indisponível")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Tentar novamente"}));
  expect(m.refresh).toHaveBeenCalledOnce();expect(m.create).not.toHaveBeenCalled();
 });
 it("hides protected routes during loading and missing athlete",()=>{
  m.athlete.mockReturnValue({athlete:null,loading:true,error:null,refresh:m.refresh,createOwnAthlete:m.create});
  const view=render(<App initial="/saude/relatorios"/>);expect(screen.queryByTestId("destination")).toBeNull();
  m.athlete.mockReturnValue({athlete:null,loading:false,error:null,refresh:m.refresh,createOwnAthlete:m.create});view.rerender(<App initial="/saude/relatorios"/>);
  expect(screen.getByText("Onboarding fixture")).toBeTruthy();expect(screen.queryByTestId("destination")).toBeNull();expect(m.create).not.toHaveBeenCalled();
 });
});
