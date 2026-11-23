#!/usr/bin/env python3
"""CCH E5-E: REAL local Auth + PostgREST + Storage HTTP exercise, synthetic only.
No database URLs, JWTs, keys, real emails or response bodies emitted to CI logs.
The local Supabase stack must already be running in /tmp, with a unique project id.
"""
import json, os, secrets, subprocess, time, urllib.error, urllib.request
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(os.environ["GITHUB_WORKSPACE"])
WORK = Path(os.environ["E5_STACK_WORKSPACE"])
assert WORK.as_posix().startswith("/tmp/cch-e5e-fullstack-")
values = {}
for line in (WORK / "status.private").read_text().splitlines():
    if "=" in line:
        k,v=line.split("=",1)
        values[k]=v.strip().strip('"')
API = values["API_URL"].rstrip("/")
assert API.startswith("http://127.0.0.1:") or API.startswith("http://localhost:")
ANON = values["ANON_KEY"]
SERVICE = values["SERVICE_ROLE_KEY"]
assert ANON and SERVICE and ANON != SERVICE
def request(method, path, token=None, admin=False, body=None):
    headers = {"apikey":SERVICE if admin else ANON,
               "Authorization":"Bearer "+(SERVICE if admin else token or ANON),
               "Content-Type":"application/json"}
    data=json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(urllib.request.Request(API+path,headers=headers,data=data,method=method),timeout=18) as r:
            raw=r.read()
            return r.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code,None
def assert_status(code, ok, label):
    if code not in ok: raise AssertionError(f"{label} expected {ok}, received HTTP {code}")
    print("E5_HTTP",label,code)
def create_identity(label):
    password=secrets.token_urlsafe(28)
    email=f"cch-e5e-{label}-{secrets.token_hex(4)}@example.test"
    status,user=request("POST","/auth/v1/admin/users",admin=True,body={"email":email,"password":password,"email_confirm":True})
    assert_status(status,{200,201},f"Auth admin create synthetic {label}")
    uid=user["id"]
    status,auth=request("POST","/auth/v1/token?grant_type=password",
                        body={"email":email,"password":password})
    assert_status(status,{200},f"Auth password token {label}")
    assert auth["access_token"]
    return uid,auth["access_token"]
identities={k:create_identity(k) for k in ("athlete_a","athlete_b","coach","owner")}
fixed = {
 "11111111-1111-4111-8111-111111111111":identities["athlete_a"][0],
 "22222222-2222-4222-8222-222222222222":identities["athlete_b"][0],
 "33333333-3333-4333-8333-333333333333":identities["coach"][0],
 "44444444-4444-4444-8444-444444444444":identities["owner"][0],
}
def remap(text):
    for original,actual in fixed.items():text=text.replace(original,actual)
    return text
ps=subprocess.run(["docker","ps","--format","{{.Names}}"],check=True,capture_output=True,text=True).stdout.splitlines()
dbs=[name for name in ps if name.startswith("supabase_db_cch-e5e-isolated-lab")]
assert len(dbs)==1,"Expected exactly one disposable Supabase database container"
DB=dbs[0]
def sql(source, label):
    # All commands run exclusively inside the Docker database of the local stack.
    result=subprocess.run(["docker","exec","-i",DB,"psql","-X","-v","ON_ERROR_STOP=1",
                           "-U","postgres","-d","postgres"],input=source,capture_output=True,text=True,timeout=70)
    if result.returncode:
        tail="\n".join(result.stderr.splitlines()[-9:])
        raise AssertionError(f"{label} failed (local only): {tail[:1300]}")
    print("E5_SQL",label,"PASS")
def apply(path, label=None):
    source=(ROOT/path).read_text()
    sql(remap(source),label or Path(path).name)
migrations=[
 "20261107144000_health_m0_foundation.sql",
 "20261107151317_health_m1_profile_goals.sql",
 "20261107153621_health_m2_catalogs.sql",
 "20261107153848_health_m2_declared_equipment_catalog_fk.sql",
 "20261107155747_health_m3_program_cch.sql",
 "20261107160110_health_m3_program_rpcs.sql",
 "20261107161317_health_m4_live_workout.sql",
 "20261110005023_health_f19_interactive_workout_timers.sql",
 "20261111020500_health_m4_end_workout_anytime.sql",
 "20261111165531_health_f20_multimodal_daily_sessions.sql",
 "20261111171704_health_f21_training_history_management.sql",
 "20261111175335_health_f21_void_workout_requeues_cch.sql",
 "20261112175528_health_f22_adaptive_training_maturity.sql",
]
for m in migrations:
    if m.startswith("20261112175528"):
        apply("supabase/tests/health_cch_e5e_official_athletes.sql","Synthetic F22 prerequisites")
    source=remap((ROOT/"supabase/migrations"/m).read_text())
    if m.startswith("20261112175528"):
        for src,dst in (
            ("08204502-2e7a-4476-a1ac-6a67b57fa35f","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
            ("671fd7a8-7f0f-4c9f-9e73-89c2caf27692","bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
            ("3d18b672-7c56-4c86-b8e9-2f5753a1a710","eeeeeeee-2000-4000-8000-000000000001")
        ): source=source.replace(src,dst)
    sql(source,m)
apply("supabase/candidates/health_cch_e5e_persistence_candidate.sql","E5-E CANDIDATE")
# Reuse the very same official fixture prefix; no execution of later SQL-level tests here.
fixture=(ROOT/"supabase/tests/health_cch_e5e_official_contract.sql").read_text()
fixture=fixture.split("CREATE FUNCTION public.e5e_expect_denied",1)[0]
sql(remap(fixture),"Official M0/M4 roles + E5 policy + sessions")
sql("NOTIFY pgrst, 'reload schema'; NOTIFY pgrst, 'reload config';","PostgREST schema reload")
time.sleep(3)
A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
SESSION="ffffffff-1000-4000-8000-ffffffffffff"
tokens={key:t for key,(_,t) in identities.items()}
uida=identities["athlete_a"][0]
def event(event_type,clientid,payload=None):
    return {"athlete_id":A,"session_id":SESSION,"event_type":event_type,"source":"user",
            "client_event_id":clientid,"created_by_auth_user_id":uida,"payload":payload or {}}
payload={"contract":"cch-e5-session-review-v1","explicit_confirmation":True,
         "recovery":"good","symptoms":"none"}
def post_as(role,path,body):
    return request("POST",path,token=tokens[role],body=body)
def get_as(role,path):
    return request("GET",path,token=tokens[role])
# Before grant, explicit E5 capture is denied.
code,_=post_as("athlete_a","/rest/v1/health_workout_events",
               event("note","dddddddd-0000-4000-8000-000000000010",payload))
assert_status(code,{400,401,403}, "E5 write without consent refused")
# Ordinary M4 recording works before E5 and for authorized readers afterwards.
code,_=post_as("athlete_a","/rest/v1/health_workout_events",
               event("session_completed","dddddddd-0000-4000-8000-000000000011"))
assert_status(code,{201}, "Common M4 event accepted")
consent={"athlete_id":A,"actor_auth_user_id":uida,"consent_type":"e5_personalized_review",
         "decision":"granted","policy_version":"e5-integral-fixture",
         "details":{"contract":"cch-e5-consent-v1","explicit_action":True}}
for role in ("coach","owner","athlete_b"):
    code,_=post_as(role,"/rest/v1/health_consents",consent)
    assert_status(code,{400,401,403},f"{role} cannot grant E5 for A")
code,_=post_as("athlete_a","/rest/v1/health_consents",consent)
assert_status(code,{201},"Athlete A explicit E5 grant")
code,_=post_as("athlete_a","/rest/v1/health_workout_events",
               event("note","dddddddd-0000-4000-8000-000000000012",payload))
assert_status(code,{201},"Athlete A E5 note with consent")
for role,expect_e5,expect_common in (
    ("athlete_a",1,1),("coach",0,1),("owner",0,1),("athlete_b",0,0)):
    code,data=get_as(role,"/rest/v1/health_workout_events?select=event_type,payload")
    assert_status(code,{200},f"M4 SELECT {role}")
    assert isinstance(data,list)
    ev=sum(isinstance(x.get("payload"),dict) and x["payload"].get("contract")=="cch-e5-session-review-v1" for x in data)
    normal=sum(x["event_type"]=="session_completed" for x in data)
    assert (ev,normal)==(expect_e5,expect_common),f"M4 access difference {role}: {(ev,normal)}"
code,data=post_as("athlete_a","/rest/v1/rpc/health_cch_e5_current_session_review",
                  {"p_athlete_id":A,"p_session_id":SESSION})
assert_status(code,{200},"Authenticated PostgREST E5 review RPC")
assert isinstance(data,list) and len(data)==1 and data[0]["recovery"]=="good"
# Revocation immediately affects both raw Data API and purpose-limited RPC.
code,_=post_as("athlete_a","/rest/v1/health_consents",{**consent,"decision":"revoked"})
assert_status(code,{201},"Athlete A revokes E5")
code,data=get_as("athlete_a","/rest/v1/health_workout_events?select=event_type,payload")
assert_status(code,{200},"M4 SELECT after E5 revocation")
assert all(x.get("payload",{}).get("contract")!="cch-e5-session-review-v1" for x in data)
assert any(x["event_type"]=="session_completed" for x in data)
code,data=post_as("athlete_a","/rest/v1/rpc/health_cch_e5_current_session_review",
                  {"p_athlete_id":A,"p_session_id":SESSION})
assert_status(code,{200},"Revoked E5 RPC HTTP")
assert data==[],"Revoked E5 RPC must yield zero rows"
code,_=post_as("athlete_a","/rest/v1/health_workout_events",
               event("note","dddddddd-0000-4000-8000-000000000013",payload))
assert_status(code,{400,401,403},"E5 capture blocked after revocation")
for role in ("coach","owner","athlete_b"):
    code,data=get_as(role,"/rest/v1/health_workout_events?select=event_type,payload")
    assert_status(code,{200},f"M4 after revoke {role}")
    assert all(x.get("payload",{}).get("contract")!="cch-e5-session-review-v1" for x in data)
# Storage is real, but the tested E5 flow creates no buckets/objects.
code,data=request("GET","/storage/v1/bucket",admin=True)
assert_status(code,{200},"Actual Storage API bucket enumeration")
assert isinstance(data,list)
print("CCH_E5E_REAL_AUTH_POSTGREST_STORAGE_HTTP_PASS")
