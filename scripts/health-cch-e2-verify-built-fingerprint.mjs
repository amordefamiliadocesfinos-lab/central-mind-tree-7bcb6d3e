import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
const output = execFileSync("node",["scripts/health-cch-e2-fingerprint-reference.mjs"],{encoding:"utf8"});
const digest=output.match(/CCH_E2_SOURCE_FINGERPRINT_SHA256=([0-9a-f]{64})/)?.[1];
if(!digest)throw Error("Missing reference digest");
const root="dist/client";
if(!existsSync(root))throw Error("Client bundle directory not found");
let matches=0;
function walk(folder){
 for(const name of readdirSync(folder)){
  const filename=path.join(folder,name);
  if(statSync(filename).isDirectory()){walk(filename);continue;}
  if(/\.(js|mjs|html)$/.test(filename) && readFileSync(filename,"utf8").includes(digest))matches++;
 }
}
walk(root);
if(matches<1)throw Error("Expected fingerprint absent from compiled CCH client output");
console.log(`Verified CCH content fingerprint embedded in ${matches} compiled client files: ${digest}`);
