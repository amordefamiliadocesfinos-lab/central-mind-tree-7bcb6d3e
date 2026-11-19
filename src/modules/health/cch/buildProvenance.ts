/** Non-secret provenance stamped at Vite build time.
 * A missing Git checkout or CI marker must stay explicitly unknown.
 * Never equate a GitHub merge with a successful remote deployment.
 */
declare const __CCH_BUILD_COMMIT__: string;
declare const __CCH_BUILD_FINGERPRINT__: string;

export type CchBuildProvenance = {
  revision: string | null;
  shortRevision: string | null;
  known: boolean;
  fingerprint: string | null;
  shortFingerprint: string | null;
};

export function cchBuildProvenance(): CchBuildProvenance {
  const supplied = typeof __CCH_BUILD_COMMIT__ === "string" ? __CCH_BUILD_COMMIT__ : "";
  const revision = /^[0-9a-f]{40}$/i.test(supplied) ? supplied.toLowerCase() : null;
  const suppliedFingerprint = typeof __CCH_BUILD_FINGERPRINT__ === "string"
    ? __CCH_BUILD_FINGERPRINT__ : "";
  const fingerprint = /^[0-9a-f]{64}$/i.test(suppliedFingerprint)
    ? suppliedFingerprint.toLowerCase() : null;
  return { revision, shortRevision: revision?.slice(0,12) ?? null,
    known: revision !== null, fingerprint,
    shortFingerprint: fingerprint?.slice(0,16) ?? null } ;
}
