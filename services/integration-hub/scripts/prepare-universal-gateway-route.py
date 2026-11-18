#!/usr/bin/env python3
"""Prepare exactly one universal Shopee OAuth GET path in a COPY of published API Gateway OpenAPI.

NO network, GCP change, deployment, or secret output. Fail closed on incompatible
route contracts. Existing document must be the currently published config.
"""
import argparse
from pathlib import Path
import re
import sys

START = "/shopee/live/oauth/start"
ADAO = "/shopee/live/oauth/adao/start"
CELIVIO = "/shopee/live/oauth/celivio/start"
CALLBACK = "/shopee/live/oauth/callback"
UNIVERSAL = "/shopee/live/oauth/universal/start"
OPERATION_ID = "shopeeUniversalOAuthStart"
PATH_HEADER = re.compile(r"^  (?P<quote>['\"]?)(?P<path>/[^\n]*?)(?P=quote):[ \t]*(?:#[^\n]*)?$", re.M)
TOP_LEVEL = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*:[ \t]*(?:#[^\n]*)?$", re.M)
GET_METHOD = re.compile(r"^    get:[ \t]*$", re.M)
OTHER_METHODS = re.compile(r"^    (?:post|put|delete|patch|head|options|trace):", re.M)
OPERATION = re.compile(r"^      operationId:[ \t]*(.+?)[ \t]*$", re.M)


def inventory(source):
    if not isinstance(source, str) or not source.strip():
        raise ValueError("empty OpenAPI document")
    if len(re.findall(r"^paths:[ \t]*$", source, re.M)) != 1:
        raise ValueError("expected one root paths section")
    paths_start = re.search(r"^paths:[ \t]*$", source, re.M).end()
    next_root = TOP_LEVEL.search(source, paths_start)
    paths_end = next_root.start() if next_root else len(source)
    headers = list(PATH_HEADER.finditer(source, paths_start, paths_end))
    out = {}
    for i, match in enumerate(headers):
        path = match.group("path")
        if path in out:
            raise ValueError("duplicate path: " + path)
        start = match.start()
        end = headers[i + 1].start() if i + 1 < len(headers) else paths_end
        out[path] = (start, end, source[start:end], match.group("quote"))
    return out


def prepare(source):
    paths = inventory(source)
    if UNIVERSAL in paths:
        raise ValueError("universal route already exists; not modifying")
    for route in (START, ADAO, CELIVIO, CALLBACK):
        if route not in paths:
            raise ValueError("missing required published route: " + route)
        if not GET_METHOD.search(paths[route][2]):
            raise ValueError("GET missing from published route: " + route)
    start, end, block, quote = paths[ADAO]
    if OTHER_METHODS.search(block):
        raise ValueError("unexpected method on Adão source route")
    if len(GET_METHOD.findall(block)) != 1:
        raise ValueError("ambiguous GET definition")
    operations = OPERATION.findall(block)
    if len(operations) != 1:
        raise ValueError("Adão source must have one operationId")
    if re.search(r"^[ \t]+operationId:[ \t]*" + re.escape(OPERATION_ID) + r"[ \t]*$", source, re.M):
        raise ValueError("operationId already reserved")
    # The Adao route may carry a specific backend override, but it must not
    # hard-code an Adao/Celivio-specific URL or use constant-address rewriting.
    if re.search(r"^[ \t]+path_translation:[ \t]*CONSTANT_ADDRESS\b", block, re.M):
        raise ValueError("unsafe route-specific CONSTANT_ADDRESS backend")
    if re.search(r"^[ \t]+address:[ \t]*[^\n]*(?:/shopee/live/oauth/(?:adao|celivio)/start)", block, re.M):
        raise ValueError("source route backend pins a legacy account path")
    first_line = block.splitlines(keepends=True)[0]
    if ADAO not in first_line:
        raise ValueError("source route header not recognized")
    cloned = block.replace(ADAO, UNIVERSAL, 1)
    cloned, op_count = OPERATION.subn("      operationId: " + OPERATION_ID, cloned, count=1)
    if op_count != 1:
        raise ValueError("operationId replacement failed")
    # The cloned route inherits legacy documentation. Rewrite only the new
    # route's summary/response descriptions; never edit an existing route.
    cloned = re.sub(
        r"^      summary:[^\\n]*$",
        "      summary: Start OAuth universal for an authorized Shopee account using a one-time handoff.",
        cloned, count=1, flags=re.M)
    cloned = cloned.replace(
        "description: Public destination selection rejected.",
        "description: Invalid handoff ticket or request.", 1)
    # The universal start returns 409 for expired/consumed/unauthorized tickets.
    if re.search(r"^        '400':[ \\t]*$", cloned, re.M) and not re.search(r"^        '409':[ \\t]*$", cloned, re.M):
        cloned = re.sub(
            r"^(        '400':[ \\t]*\\n(?:          [^\\n]*\\n)*)",
            r"\\g<1>        '409':\\n          description: Handoff ticket expired, consumed or unauthorized.\\n",
            cloned, count=1, flags=re.M)
    if not cloned.endswith("\n"):
        raise ValueError("source route missing terminal newline")
    # We only insert a route. This strict invariant ensures no mutation to
    # callback, legacy paths, security definitions, backends or API identity.
    result = source[:end] + cloned + source[end:]
    if result.replace(cloned, "", 1) != source:
        raise ValueError("cannot prove source document unchanged")
    updated = inventory(result)
    if UNIVERSAL not in updated:
        raise ValueError("new route not found")
    for route in (START, ADAO, CELIVIO, CALLBACK):
        if updated[route][2] != paths[route][2]:
            raise ValueError("existing route unexpectedly modified: " + route)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--published-openapi", required=True, type=Path,
                        help="Export from ACTIVE published API config; never a template")
    parser.add_argument("--output", required=True, type=Path,
                        help="Distinct local file for candidate; never deployment")
    args = parser.parse_args()
    if args.published_openapi.resolve() == args.output.resolve():
        parser.error("source and output must be different files")
    if args.output.exists():
        parser.error("output already exists; refusing overwrite")
    try:
        source = args.published_openapi.read_text(encoding="utf-8")
        result = prepare(source)
        args.output.write_text(result, encoding="utf-8")
    except (OSError, ValueError) as exc:
        print("BLOCKED: " + str(exc), file=sys.stderr)
        return 1
    print("PREPARED: " + UNIVERSAL)
    print("PRESERVED: four existing routes and entire source document")
    print("CANDIDATE: " + str(args.output))
    print("NOT DEPLOYED: no Cloud Run, API config, Gateway or Scheduler modified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
