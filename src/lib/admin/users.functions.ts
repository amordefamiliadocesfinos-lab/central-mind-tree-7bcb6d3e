import { createMiddleware, createServerFn, type CustomFetch } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ProvisionUserInput } from "./users.server";

const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Não autenticado.");

  const authenticatedFetch: CustomFetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", "Bearer " + token);
    return fetch(url, { ...init, headers });
  };

  return next({ fetch: authenticatedFetch });
});

async function assertProvisionCapability(
  userScopedSupabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await userScopedSupabase
    .from("app_admin_capabilities")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("capability", "provision_users")
    .eq("active", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw new Error("Falha ao validar permissão administrativa.");
  if (!data) throw new Error("FORBIDDEN: sem permissão para provisionar usuários.");
}

export const getAdminUsersContext = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertProvisionCapability(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listProvisioningContext } = await import("./users.server");
    return listProvisioningContext(supabaseAdmin);
  });

export const provisionPanelUser = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((input: ProvisionUserInput) => input)
  .handler(async ({ data, context }) => {
    await assertProvisionCapability(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { provisionUser } = await import("./users.server");
    return provisionUser(supabaseAdmin, data);
  });
