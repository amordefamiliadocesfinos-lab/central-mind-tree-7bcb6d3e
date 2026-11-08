import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AdminAccessDatabase } from "./module-grants.types";

export type ProvisionMode = "invite" | "temporary_password";

export type ProvisionUserInput = {
  name: string;
  email: string;
  mode: ProvisionMode;
  temporaryPassword?: string;
  role?: string | null;
  appUserId?: string | null;
  healthAthleteId?: string | null;
};

export type ProvisionStep = {
  status: "created" | "linked" | "existing" | "skipped" | "failed";
  message: string;
  id?: string | null;
};

export type ProvisionUserResult = {
  status: "success" | "partial_failure";
  auth: ProvisionStep;
  appUser: ProvisionStep;
  healthAthlete: ProvisionStep;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function findAuthUserByEmail(admin: SupabaseClient<Database>, email: string): Promise<User | null> {
  const normalized = normalizeEmail(email);
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data.users.find((user) => normalizeEmail(user.email ?? "") === normalized);
    if (found) return found;
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function resolveAppUser(
  admin: SupabaseClient<Database>,
  input: ProvisionUserInput,
) {
  if (input.appUserId) {
    const { data, error } = await admin
      .from("app_users")
      .select("id,name,email,role,is_active,auth_user_id")
      .eq("id", input.appUserId)
      .maybeSingle();
    if (error) throw error;
    if (data && data.email && normalizeEmail(data.email) !== normalizeEmail(input.email)) {
      throw new Error("E-mail informado diverge do cadastro selecionado.");
    }
    return data ?? null;
  }

  const { data, error } = await admin
    .from("app_users")
    .select("id,name,email,role,is_active,auth_user_id")
    .ilike("email", normalizeEmail(input.email))
    .limit(2);
  if (error) throw error;
  if ((data ?? []).length === 1) return data[0];

  if ((data ?? []).length > 1) throw new Error("E-mail ambíguo: selecione o cadastro por ID.");
  // Display names are not unique identifiers; never link a person by name.
  return null;
}

async function resolveHealthAthlete(
  admin: SupabaseClient<Database>,
  input: ProvisionUserInput,
) {
  if (!input.healthAthleteId) return null;

  const { data, error } = await admin
    .from("health_athletes")
    .select("id,display_name,auth_user_id,owner_auth_user_id,status")
    .eq("id", input.healthAthleteId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function listProvisioningContext(admin: SupabaseClient<Database>) {
  const [appUsersResult, athletesResult] = await Promise.all([
    admin
      .from("app_users")
      .select("id,name,email,role,is_active,auth_user_id")
      .order("name"),
    admin
      .from("health_athletes")
      .select("id,display_name,auth_user_id,status")
      .eq("status", "active")
      .order("display_name"),
  ]);

  if (appUsersResult.error) throw appUsersResult.error;
  if (athletesResult.error) throw athletesResult.error;

  const scopedAdmin = admin as unknown as SupabaseClient<AdminAccessDatabase>;
  const { data: moduleGrants, error: grantsError } = await scopedAdmin
    .from("app_user_module_grants")
    .select("auth_user_id,module_key");
  if (grantsError) throw grantsError;

  return {
    appUsers: appUsersResult.data ?? [],
    athletes: athletesResult.data ?? [],
    moduleGrants: moduleGrants ?? [],
  };
}

export const ADMIN_MODULE_KEYS = [
  "saude", "planejamento", "calendario", "rotina", "foco", "metas",
  "minha-area", "assistente", "nucleo", "captura", "operacoes",
  "financeiro", "crm", "digital", "producao", "academia",
  "dashboard", "reunioes", "rotas", "oportunidades", "planilhas",
] as const;

export type AdminModuleKey = typeof ADMIN_MODULE_KEYS[number];

export async function replaceUserModuleGrants(
  admin: SupabaseClient<Database>,
  actorAuthUserId: string,
  targetAuthUserId: string,
  modules: string[],
) {
  if (!targetAuthUserId || !Array.isArray(modules) ||
      modules.some((module) => !ADMIN_MODULE_KEYS.includes(module as AdminModuleKey))) {
    throw new Error("Seleção de permissões inválida.");
  }
  const { data: linkedUser, error: linkError } = await admin.from("app_users")
    .select("id,auth_user_id,is_active").eq("auth_user_id", targetAuthUserId).maybeSingle();
  if (linkError || !linkedUser?.is_active) {
    throw new Error("Usuário ativo com vínculo Auth obrigatório.");
  }
  const { data: targetCapability, error: capabilityError } = await admin
    .from("app_admin_capabilities")
    .select("id").eq("auth_user_id", targetAuthUserId)
    .eq("capability", "provision_users").eq("active", true)
    .is("revoked_at", null).maybeSingle();
  if (capabilityError || targetCapability) {
    throw new Error("Não é permitido editar módulos de outro administrador por esta tela.");
  }
  const scopedAdmin = admin as unknown as SupabaseClient<AdminAccessDatabase>;
  const { data, error } = await scopedAdmin.rpc("admin_replace_user_module_grants", {
    p_target_auth_user_id: targetAuthUserId,
    p_module_keys: [...new Set(modules)],
    p_actor_auth_user_id: actorAuthUserId,
  });
  if (error) throw new Error("Não foi possível salvar as permissões.");
  return { modules: data };
}

export async function provisionUser(
  admin: SupabaseClient<Database>,
  input: ProvisionUserInput,
): Promise<ProvisionUserResult> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (!name) throw new Error("Nome é obrigatório.");
  if (!email || !email.includes("@")) throw new Error("E-mail inválido.");
  if (input.mode === "temporary_password" && (input.temporaryPassword?.length ?? 0) < 8) {
    throw new Error("A senha temporária deve ter pelo menos 8 caracteres.");
  }

  let authUser = await findAuthUserByEmail(admin, email);
  let authCreatedNow = false;

  const result: ProvisionUserResult = {
    status: "success",
    auth: { status: "existing", message: "Conta Auth já existente.", id: authUser?.id ?? null },
    appUser: { status: "skipped", message: "Sem vínculo operacional solicitado." },
    healthAthlete: { status: "skipped", message: "Sem vínculo Saúde solicitado." },
  };

  if (!authUser) {
    if (input.mode === "invite") {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name, full_name: name },
      });
      if (error) throw error;
      authUser = data.user;
      authCreatedNow = true;
      result.auth = {
        status: "created",
        message: "Convite enviado e usuário Auth criado.",
        id: authUser.id,
      };
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: input.temporaryPassword!,
        email_confirm: true,
        user_metadata: { name, full_name: name },
      });
      if (error) throw error;
      authUser = data.user;
      authCreatedNow = true;
      result.auth = {
        status: "created",
        message: "Usuário Auth criado com senha temporária.",
        id: authUser.id,
      };
    }
  }

  if (!authUser?.id) throw new Error("Não foi possível resolver o usuário Auth.");

  try {
    const appUser = await resolveAppUser(admin, input);

    if (appUser) {
      if (appUser.auth_user_id && appUser.auth_user_id !== authUser.id) {
        throw new Error("O cadastro operacional selecionado já está vinculado a outro login.");
      }

      const { error } = await admin
        .from("app_users")
        .update({
          auth_user_id: authUser.id,
          email,
          ...(input.role?.trim() ? { role: input.role.trim() } : {}),
        })
        .eq("id", appUser.id);
      if (error) throw error;

      result.appUser = {
        status: appUser.auth_user_id === authUser.id ? "existing" : "linked",
        message: "Cadastro operacional vinculado ao login.",
        id: appUser.id,
      };
    } else if (input.role?.trim()) {
      const { data, error } = await admin
        .from("app_users")
        .insert({
          name,
          email,
          role: input.role.trim(),
          is_active: true,
          auth_user_id: authUser.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      result.appUser = {
        status: "created",
        message: "Cadastro operacional criado e vinculado.",
        id: data.id,
      };
    }
  } catch (error) {
    result.status = "partial_failure";
    result.appUser = {
      status: "failed",
      message: error instanceof Error ? error.message : "Falha no vínculo operacional.",
    };
  }

  try {
    const athlete = await resolveHealthAthlete(admin, input);
    if (athlete) {
      if (athlete.auth_user_id && athlete.auth_user_id !== authUser.id) {
        throw new Error("O perfil Saúde selecionado já está vinculado a outro login.");
      }

      const { error } = await admin
        .from("health_athletes")
        .update({ auth_user_id: authUser.id })
        .eq("id", athlete.id);
      if (error) throw error;

      result.healthAthlete = {
        status: athlete.auth_user_id === authUser.id ? "existing" : "linked",
        message: "Perfil Saúde existente vinculado ao login sem recriar histórico.",
        id: athlete.id,
      };
    }
  } catch (error) {
    result.status = "partial_failure";
    result.healthAthlete = {
      status: "failed",
      message: error instanceof Error ? error.message : "Falha no vínculo Saúde.",
    };
  }

  if (authCreatedNow && result.status === "partial_failure") {
    result.auth.message += " A conta foi mantida para reconciliação; não houve exclusão silenciosa.";
  }

  return result;
}
