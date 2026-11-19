import {defineConfig} from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
const root=path.resolve(process.cwd(),"tests/cch-e2-browser");
const shared=path.join(root,"mock-hooks.ts");
const names=["useHealthAthlete","useHealthCatalogs","useHealthProgramM3",
  "useHealthTrainingProfileF22","useHealthLongitudinalReviewF13",
  "useHealthReplanningF14","useCchCycleAdvisor"];
export default defineConfig({
 root,
 plugins:[react()],
 resolve:{alias:[
  ...names.map(name=>({find:"../hooks/"+name,replacement:shared})),
  {find:"@",replacement:path.resolve(process.cwd(),"src")}
 ]},
 server:{host:"127.0.0.1",port:4173,strictPort:true,
  proxy:{"/api":"http://127.0.0.1:4174"}},
 build:{outDir:path.join(root,"dist"),emptyOutDir:true}
});
