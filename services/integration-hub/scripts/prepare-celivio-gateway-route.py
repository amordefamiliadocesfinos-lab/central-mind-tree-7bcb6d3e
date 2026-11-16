#!/usr/bin/env python3
"""Prepare one Celivio OAuth Gateway path from the currently deployed OpenAPI document.

No network calls, no deployment and no writes outside --output. All existing
paths/backends remain byte-for-byte unchanged. Fail closed on unfamiliar schemas.
"""
import argparse
from pathlib import Path
import re
import sys

VIVIANE = "/shopee/live/oauth/start"
ADAO = "/shopee/live/oauth/adao/start"
CELIVIO = "/shopee/live/oauth/celivio/start"
CALLBACK = "/shopee/live/oauth/callback"


def path_header(path):
    # API Gateway config currently uses OpenAPI YAML with two-space paths.
    return re.compile(r"^  (?P<quote>['\"]?)" + re.escape(path)
                      + r"(?P=quote):[ \t]*(?:#[^\n]*)?$", re.MULTILINE)


def patch(source):
    if not isinstance(source, str) or not source.strip():
        raise ValueError("empty OpenAPI input")
    if path_header(CELIVIO).search(source):
        raise ValueError("Celivio route already exists: refusing duplicate")
    for name in (VIVIANE, ADAO, CALLBACK):
        if len(path_header(name).findall(source)) != 1:
            raise ValueError(f"expected exactly one existing route: {name}")
    paths_header = re.findall(r"^paths:[ \t]*$", source, re.MULTILINE)
    if len(paths_header) != 1:
        raise ValueError("expected one top-level paths section")
    marker = path_header(ADAO).search(source)
    if not marker:
        raise ValueError("missing Adao route")
    # Stop at next two-space path header or top-level YAML section.
    tail = source[marker.end():]
    boundary = re.search(r"^(?:  [\"']?/[^\n]*?:|[A-Za-z][A-Za-z0-9_-]*:)[ \t]*(?:#[^\n]*)?$", tail, re.MULTILINE)
    if not boundary:
        raise ValueError("cannot delimit Adao route safely")
    route = source[marker.start():marker.end() + boundary.start()]
    if not re.search(r"^    get:[ \t]*$", route, re.MULTILINE):
        raise ValueError("Adao route must contain GET")
    if re.search(r"^    (?:post|put|delete|patch):", route, re.MULTILINE):
        raise ValueError("unexpected mutating method on Adao start")
    replacement = route.replace(ADAO, CELIVIO, 1)
    # Explicitly disambiguate operationId (global uniqueness is required).
    operation_ids = re.findall(r"^      operationId:[ \t]*(.+?)\s*$", replacement, re.MULTILINE)
    if len(operation_ids) != 1:
        raise ValueError("Adao route must contain one operationId")
    identifier = "shopeeCelivioOAuthStart"
    if re.search(r"^\s+operationId:\s*" + re.escape(identifier) + r"\s*$", source, re.MULTILINE):
        raise ValueError("Celivio operationId already exists")
    replacement = re.sub(
        r"^      operationId:[ \t]*.+$",
        "      operationId: " + identifier,
        replacement, count=1, flags=re.MULTILINE)
    replacement = replacement.replace("Adão", "Celivio/Neto").replace("Adao", "Celivio").replace("adao", "celivio")
    result = source[:marker.end() + boundary.start()] + replacement + source[marker.end() + boundary.start():]
    if result.replace(replacement, "", 1) != source:
        raise ValueError("existing OpenAPI text changed unexpectedly")
    if len(path_header(CELIVIO).findall(result)) != 1:
        raise ValueError("Celivio route missing after patch")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Current Gateway OpenAPI YAML")
    parser.add_argument("--output", required=True, type=Path, help="Prepared YAML, not deployed")
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error("source and output must differ")
    try:
        source = args.source.read_text(encoding="utf-8")
        result = patch(source)
        args.output.write_text(result, encoding="utf-8")
    except (OSError, ValueError) as error:
        print(f"BLOCKED: {error}", file=sys.stderr)
        return 1
    print(f"PREPARED: {CELIVIO}")
    print(f"UNCHANGED: {VIVIANE}, {ADAO}, {CALLBACK}, existing backend")
    print(f"OUTPUT: {args.output} (local file only; no Gateway or Cloud Run change)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
