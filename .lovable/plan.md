# nucleo-knowledge-read — runtime vs main (investigation result)

## Findings (read-only)
- Local checkout: `ee922ec4d3ba582493583184eeba19aec43ff8e1`, function folder clean. `verify_jwt = true`.
- Source contains FM-10: `index.ts` (3 hits), `ac02-assumption-export.ts` (2), `ac02-documentary-coverage.ts` (5).
- Local sha256: index.ts `767d215f…5277`, ac02-assumption-export.ts `7c3fe4a0…a5c5e`, ac02-documentary-coverage.ts `1a00e10f…48a5`.
- Last known deploy of this function (this chat): 23/11/2026 22:05 UTC, from commit `10b12f4e`, source_sha256 `2318a236…4e78`.
- Since `10b12f4e`, exactly one commit touched these files: `3863de9f` (PR #1100, FM-10 recovery in AC-02). No deploy after it is recorded here.
- Logs: only "booted" at 2026-11-25 19:23:59 UTC; no version/digest in logs.

## Not accessible
- No tool exposes the active deployment ID, runtime version, deploy timestamp or bundled artifact. The deployed version cannot be read directly.

## Most likely cause (inferred, not proven)
- Runtime still runs the 23/11 bundle (before PR #1100). `response.sections` can show FM-10 v2 because it is read from the database. The text export is built by the older shared code, so FM-10 does not appear in section 6.

## Possible next step (needs separate explicit authorization)
- Deploy only `nucleo-knowledge-read` from `ee922ec4` with the native executor. It packages the `_shared` imports and keeps `verify_jwt = true`. Then: POST without token returns 401, and the Work confirms FM-10 in section 6 with login.
- Nothing was changed in this investigation.
