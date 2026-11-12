import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  CORE_BRIDGE_URL, buildSignedHeaders, probeCoreBridge,
} from './core-bridge.mjs';

// F12.3 isolated LIVE *nonmutating* connectivity probe.
// Sends exactly two POSTs: (1) unsigned health => 401, (2) signed health => 200.
// No F12.acquire/stage/ack/resume; no Shopee API, order, or stock operations.
// Never log/return credentials, signed headers, body containing secrets or PII.
export async function runF12SafeBridgeProbe({
  fetchImpl = globalThis.fetch,
  secret = process.env.CORE_BRIDGE_HMAC_SECRET,
  logger = () => {},
} = {}) {
  if (typeof secret !== 'string' || secret.length < 1)
    return {ok:false,code:'hmac_secret_unavailable'};
  if (typeof fetchImpl !== 'function')
    return {ok:false,code:'fetch_unavailable'};
  let unsignedStatus;
  try {
    const r=await fetchImpl(CORE_BRIDGE_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'health'}),
      redirect:'error',
      signal:AbortSignal.timeout(5000),
    });
    unsignedStatus=r.status;
    await r.body?.cancel();
  } catch {
    return {ok:false,code:'unsigned_probe_unavailable'};
  }
  if (unsignedStatus!==401)
    return {ok:false,code:'unsigned_probe_not_rejected',unsigned_status:unsignedStatus};

  // Reuse the Hub's canonical HMAC v1 implementation; avoid credentials
  // or live action payloads other than the strictly read-only health action.
  const healthy=await probeCoreBridge({
    url:CORE_BRIDGE_URL,secret,fetchImpl,
    logger,
    timeoutMs:5000,
  });
  return healthy
    ? {ok:true,code:'bridge_hmac_health_ok',unsigned_status:401,signed_status:200}
    : {ok:false,code:'signed_health_unavailable',unsigned_status:401};
}

if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3 || process.argv[2]!=='--live-safe-health'){
    console.error('Usage: node f12-3-core-bridge-safe-smoke.mjs --live-safe-health');
    process.exitCode=2;
  } else {
    const result=await runF12SafeBridgeProbe();
    console.log(JSON.stringify(result));
    if(!result.ok)process.exitCode=1;
  }
}
