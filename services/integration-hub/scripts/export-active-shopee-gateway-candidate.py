#!/usr/bin/env python3
"""READ-ONLY Gateway export and local candidate preparation for Shopee OAuth universal.
Requires active Cloud Shell gcloud login; creates local files only (0600).
No API-config creation, deployment, gateway switch or Cloud Run calls.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

PROJECT="painel-central-integration-hub"
API="integration-hub-oauth"
GATEWAY="integration-hub-oauth"
EXPECTED_CONFIG="oauth-celivio-20261116-v1"

def gcloud_json(parts):
    run=subprocess.run(["gcloud",*parts,"--project="+PROJECT,"--format=json"],
                       capture_output=True,text=True,check=False)
    if run.returncode:
        raise ValueError("GCP read-only query unavailable or unauthorized")
    try: return json.loads(run.stdout)
    except json.JSONDecodeError: raise ValueError("invalid gcloud JSON response")

def prepare_export(gateways, config_description, patch):
    if not isinstance(gateways,list):
        raise ValueError("gateway list is unavailable")
    matches=[g for g in gateways if str(g.get("name","")).rsplit("/",1)[-1]==GATEWAY]
    if len(matches)!=1:
        raise ValueError("expected exactly one official Gateway")
    attached=str(matches[0].get("apiConfig",""))
    expected=f"/apis/{API}/configs/{EXPECTED_CONFIG}"
    if not attached.endswith(expected):
        raise ValueError("published API config changed; refuse stale snapshot")
    if str(matches[0].get("state","")).upper() not in ("ACTIVE",""):
        raise ValueError("gateway state not active")
    name=str(config_description.get("name",""))
    if not name.endswith(expected):
        raise ValueError("exported config name differs from published config")
    docs=config_description.get("openapiDocuments")
    if not isinstance(docs,list) or len(docs)!=1:
        raise ValueError("expected exactly one OpenAPI document")
    encoded=docs[0].get("document",{}).get("contents")
    if not isinstance(encoded,str) or not encoded:
        raise ValueError("OpenAPI contents not available through FULL view")
    try: source=base64.b64decode(encoded,validate=True).decode("utf-8")
    except (ValueError,UnicodeDecodeError):
        raise ValueError("OpenAPI base64 cannot be decoded")
    candidate=patch(source)
    return source,candidate,attached

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir",required=True,type=Path,
                        help="new, empty local directory for source/candidate")
    args=parser.parse_args()
    if args.output_dir.exists():
        parser.error("output directory exists; refusing overwrite")
    script=Path(__file__).with_name("prepare-universal-gateway-route.py")
    spec=importlib.util.spec_from_file_location("universal_gateway_patch",script)
    patcher=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(patcher)
    try:
        gateways=gcloud_json(["api-gateway","gateways","list"])
        config=gcloud_json(["api-gateway","api-configs","describe",EXPECTED_CONFIG,
                            "--api="+API,"--view=FULL"])
        source,candidate,attached=prepare_export(gateways,config,patcher.prepare)
        os.umask(0o077)
        args.output_dir.mkdir(mode=0o700,parents=False,exist_ok=False)
        current=args.output_dir/"openapi-published.yaml"
        updated=args.output_dir/"openapi-universal-candidate.yaml"
        current.write_text(source,encoding="utf-8")
        updated.write_text(candidate,encoding="utf-8")
    except (OSError,ValueError,subprocess.SubprocessError) as e:
        print("BLOCKED: "+str(e),file=sys.stderr)
        return 1
    print("VERIFIED: gateway",GATEWAY,"uses",EXPECTED_CONFIG)
    print("SHA256 CURRENT:",hashlib.sha256(source.encode()).hexdigest())
    print("SHA256 CANDIDATE:",hashlib.sha256(candidate.encode()).hexdigest())
    print("ADDED: GET /shopee/live/oauth/universal/start")
    print("PRESERVED: all prior routes, backends, callback and document content")
    print("FILES: local only; restrictive permissions; do not upload configs to chat")
    print("CANDIDATE DIR:",args.output_dir)
    print("NOT DEPLOYED: gateway and Cloud Run untouched")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
