import fs from "node:fs";
import crypto from "node:crypto";
const input = fs.readFileSync("supabase/migrations/20261110005023_health_f19_interactive_workout_timers.sql","utf8");
const names = ["health_f19_pause_workout","health_f19_resume_workout",
"health_f19_start_work_interval","health_f19_finish_work_start_rest",
"health_f19_finish_rest","health_f19_cancel_interval"];
const extracted = names.map(name=>{
 const start = input.indexOf("CREATE OR REPLACE FUNCTION public."+name+"(");
 if(start < 0) throw Error("original F19 function missing: "+name);
 const end = input.indexOf("\n$$;",start);
 if(end<0) throw Error("original F19 function closure missing: "+name);
 return input.slice(start,end+4);
});
const grants = names.map(name=>{
 const args = {
 health_f19_pause_workout:"uuid,uuid",
 health_f19_resume_workout:"uuid,uuid",
 health_f19_start_work_interval:"uuid,uuid",
 health_f19_finish_work_start_rest:"uuid,uuid,numeric,text,integer,numeric",
 health_f19_finish_rest:"uuid,uuid,boolean,uuid",
 health_f19_cancel_interval:"uuid,uuid"
 }[name];
 return "REVOKE ALL ON FUNCTION public."+name+"("+args+") FROM PUBLIC, anon;\n"+
 "GRANT EXECUTE ON FUNCTION public."+name+"("+args+") TO authenticated;";
});
const content = extracted.join("\n\n")+"\n"+grants.join("\n")+"\n";
fs.writeFileSync(process.env.G5F_RPC_SQL,content,{mode:0o600});
const checksum=crypto.createHash("sha256").update(content).digest("hex");
console.log("G5-F original F19 RPC extraction: "+names.length+" functions; sha256 "+checksum);
// No ALTER on official migrations; no production calls; no source rewrites.
