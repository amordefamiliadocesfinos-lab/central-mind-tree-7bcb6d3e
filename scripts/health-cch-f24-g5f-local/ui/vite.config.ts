import {defineConfig} from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
const repo=path.resolve(__dirname,"../../..");
export default defineConfig({
 root:__dirname,plugins:[react()],envDir:repo,
 resolve:{alias:{"@":path.join(repo,"src")}},
 server:{host:"127.0.0.1",port:4181,strictPort:true,fs:{allow:[repo]}},
});
