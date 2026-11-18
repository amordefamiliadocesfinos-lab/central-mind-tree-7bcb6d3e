#!/usr/bin/env python3
"""F4: offline/read-only check of the *exported, actually published* API Gateway OpenAPI YAML.
Do not supply a guessed repo template as proof of deployment. No network or writes.
"""
from pathlib import Path
import argparse
import re
import sys

ROUTES = {
    "viviane": "/shopee/live/oauth/start",
    "adao": "/shopee/live/oauth/adao/start",
    "celivio": "/shopee/live/oauth/celivio/start",
    "callback": "/shopee/live/oauth/callback",
    "universal": "/shopee/live/oauth/universal/start",
}

def inspect_openapi(source: str):
    if not re.search(r"^paths:\s*$", source, re.M):
        return False, ["BLOCKED: no paths section"]
    paths = {}
    for key, path in ROUTES.items():
        p = re.escape(path)
        matches = list(re.finditer(r"^  ['\"]?" + p + r"['\"]?:\s*$", source, re.M))
        if len(matches) != 1:
            paths[key] = None
            continue
        start = matches[0].end()
        boundary = re.search(r"^(?:  ['\"]?/[^\n]+?:|[a-zA-Z][\w-]*:)\s*$", source[start:], re.M)
        block = source[start:start + boundary.start()] if boundary else source[start:]
        paths[key] = block
    findings = []
    ok = True
    for key, path in ROUTES.items():
        block = paths[key]
        if block is None:
            findings.append(f"BLOCKED: missing or duplicated route {key}: {path}")
            ok = False
            continue
        if not re.search(r"^    get:\s*$", block, re.M):
            findings.append(f"BLOCKED: GET absent in {key}: {path}")
            ok = False
        else:
            findings.append(f"FOUND: GET {path}")
    # Backend must be checked against the actual deployed config; don't claim it from URL alone.
    if ok:
        findings.append("ROUTES PRESENT IN SUPPLIED DOCUMENT. Confirm source is deployed Gateway config.")
    return ok, findings

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--published-openapi", type=Path, required=True)
    args = ap.parse_args()
    try:
        source = args.published_openapi.read_text(encoding="utf-8")
    except OSError as ex:
        print(f"BLOCKED: {ex}", file=sys.stderr)
        return 2
    ok, findings = inspect_openapi(source)
    print("\n".join(findings))
    print("SECURITY: no gateway configuration changed")
    return 0 if ok else 1

if __name__ == "__main__":
    raise SystemExit(main())
