// Motor de Coordenação — endpoint HTTP
// Recebe solicitações padronizadas da IA Orquestradora, resolve o Especialista
// responsável e devolve o plano de encaminhamento. Não executa ações reais.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  coordinateRequest,
  getCoordinationLog,
  clearCoordinationLog,
  listSpecialists,
  type CoordinationRequest,
} from "../_shared/coordination-motor.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean).pop() ?? "";

  try {
    // GET /coordination-motor/specialists
    if (req.method === "GET" && path === "specialists") {
      return json({ specialists: listSpecialists() });
    }

    // GET /coordination-motor/log?limit=50
    if (req.method === "GET" && path === "log") {
      const limit = Number(url.searchParams.get("limit") ?? "50");
      return json({ entries: getCoordinationLog(limit) });
    }

    // DELETE /coordination-motor/log
    if (req.method === "DELETE" && path === "log") {
      clearCoordinationLog();
      return json({ ok: true, message: "Log de coordenação limpo." });
    }

    // POST /coordination-motor  (ou /coordination-motor/coordinate)
    if (req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as CoordinationRequest;
      const response = await coordinateRequest(body);
      return json(response);
    }

    return json({ error: "Rota não encontrada" }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
