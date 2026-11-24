import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
const repo = path.resolve(__dirname, "../..");
export default defineConfig({
 root:__dirname, plugins:[react()],
 resolve:{alias:{"@":path.join(repo,"src")}},
 server:{host:"127.0.0.1",port:4177,strictPort:true,fs:{allow:[repo]}},
 preview:{host:"127.0.0.1",port:4177,strictPort:true},
 // The harness imports only the real F19 visual component plus local fixtures.
});
