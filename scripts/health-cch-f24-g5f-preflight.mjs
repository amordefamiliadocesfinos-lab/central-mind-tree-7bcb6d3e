/** CCH F24 G5-F: fail-closed *configuration-only* preflight.
 * Does NOT connect to Supabase or prove account isolation/RLS.
 * The official host / project must never be a destination for synthetic writes.
 */
export const PRODUCTION_HOST = "central-mind-tree.lovable.app";
export const PRODUCTION_PROJECT_ID = "1720a410-34cd-4410-995c-8c92c7edf16b";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateG5FEnvironment(input) {
 const errors = [];
 if (input?.isolated !== "true") errors.push("G5F requires explicit isolated=true");
 const projectId = typeof input?.projectId === "string" ? input.projectId.trim() : "";
 if (!UUID.test(projectId)) errors.push("G5F requires a valid dedicated project UUID");
 if (projectId.toLowerCase() === PRODUCTION_PROJECT_ID) errors.push("G5F official project is forbidden");
 let target = null;
 try { target = new URL(input?.targetUrl ?? ""); }
 catch { errors.push("G5F target URL must be valid"); }
 if (target) {
  if (!["https:","http:"].includes(target.protocol)) errors.push("G5F scheme must be HTTP(S)");
  const host = target.hostname.toLowerCase();
  if (target.username || target.password) errors.push("G5F URL credentials are forbidden");
  if (target.search || target.hash) errors.push("G5F target URL must not carry secrets or query strings");
  if (host === PRODUCTION_HOST || host.endsWith("."+PRODUCTION_HOST))
   errors.push("G5F official app hostname is forbidden");
  if (host === "localhost" || host === "127.0.0.1") {
    if (target.protocol !== "http:") errors.push("G5F localhost must use HTTP");
  } else if (target.protocol !== "https:") errors.push("G5F remote URLs must use HTTPS");
  if (host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".lovable.app") &&
      !host.endsWith(".supabase.co")) {
    errors.push("G5F unrecognized remote test provider — require manual authority review");
  }
 }
 if (input?.hasExplicitApproval !== "true") errors.push("G5F needs separate infrastructure authorization");
 return { ok: errors.length === 0, errors, mode: "STATIC_PREFLIGHT_ONLY",
   note: "Even OK does not certify tenancy, Auth, RLS, nonproduction data or remote safety." };
}
