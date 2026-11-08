import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AdminAccessDatabase } from "./module-grants.types";
import { assertScopedProvisionIdentity } from "./provision-identity-guard";

export type ProvisionMode = "invite" | "temporary_password";

export type ProvisionUserInput = {
  name: string;
  email: string;
  mode: ProvisionMode;
  temporaryPassword?: string;
  role?: string | null;
  appUserId?: string | null;
  healthAthleteId?: string | null;
  modules?: string[];
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
  moduleGrants: ProvisionStep;
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

    const users: User[] = (data.users ?? []) as User[];
    const found = users.find((user) => normalizeEmail(user.email ?? "") === normalized);
    if (found) return found;
    if (users.length < perPage) break;
    if (page === 10) throw new Error("A lista Auth ultrapassou o limite seguro de busca. Não será criada conta sem deduplicação completa.");
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
  const scopedAdmin = admin as unknown as SupabaseClient<AdminAccessDatabase>;
  const [appUsersResult, athletesResult] = await Promise.all([
    scopedAdmin
      .from("app_users")
      .select("id,name,email,role,is_active,auth_user_id,access_model")
      .order("name"),
    admin
      .from("health_athletes")
      .select("id,display_name,auth_user_id,status")
      .eq("status", "active")
      .order("display_name"),
  ]);

  if (appUsersResult.error) throw appUsersResult.error;
  if (athletesResult.error) throw athletesResult.error;

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
  const { data: scope, error: scopeError } = await scopedAdmin.from("app_users")
    .select("access_model").eq("auth_user_id", targetAuthUserId).maybeSingle();
  if (scopeError || scope?.access_model !== "scoped") {
    throw new Error("Contas legadas não podem receber restrições fictícias por esta tela.");
  }
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
  actorAuthUserId: string,
): Promise<ProvisionUserResult> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (!name) throw new Error("Nome é obrigatório.");
  if (!email || !email.includes("@")) throw new Error("E-mail inválido.");
  if (!Array.isArray(input.modules) ||
      input.modules.some((module) => typeof module !== "string" ||
        !ADMIN_MODULE_KEYS.includes(module as AdminModuleKey))) {
    throw new Error("Selecione módulos válidos, mesmo que seja uma lista vazia.");
  }
  if (input.mode === "temporary_password" && (input.temporaryPassword?.length ?? 0) < 8) {
    throw new Error("A senha temporária deve ter pelo menos 8 caracteres.");
  }

  // Validate all requested links before creating a persistent Auth identity.
  // This prevents obvious mismatch cases from leaving an orphaned Auth user.
  const existingApp = await resolveAppUser(admin, input);
  if (input.appUserId && !existingApp) throw new Error("Cadastro selecionado não encontrado.");
  if (existingApp && !existingApp.is_active) throw new Error("Cadastro selecionado está inativo.");
  if (existingApp?.email && normalizeEmail(existingApp.email) !== email) {
    throw new Error("O e-mail diverge do cadastro operacional existente.");
  }
  const existingAthlete = await resolveHealthAthlete(admin, input);
  if (input.healthAthleteId && !existingAthlete) throw new Error("Atleta selecionado não encontrado.");
  if (existingAthlete && (existingAthlete.status !== "active" ||
      existingAthlete.display_name.trim().toLocaleLowerCase("pt-BR") !== name.toLocaleLowerCase("pt-BR"))) {
    throw new Error("Atleta selecionado não corresponde a um perfil ativo desta pessoa.");
  }
  let authUser = await findAuthUserByEmail(admin, email);
  assertScopedProvisionIdentity({
    requestedRole: input.role,
    existingAppRole: existingApp?.role,
    existingAppAuthId: existingApp?.auth_user_id,
    existingAthleteAuthId: existingAthlete?.auth_user_id,
    resolvedAuthId: authUser?.id,
    healthAthleteSelected: !!existingAthlete,
    modules: input.modules,
  });
  let authCreatedNow = false;

  const result: ProvisionUserResult = {
    status: "success",
    auth: { status: "existing", message: "Conta Auth já existente.", id: authUser?.id ?? null },
    appUser: { status: "skipped", message: "Sem vínculo operacional solicitado." },
    healthAthlete: { status: "skipped", message: "Sem vínculo Saúde solicitado." },
    moduleGrants: { status: "skipped", message: "Permissões ainda não registradas." },
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
    const appUser = existingApp;

    if (input.appUserId && !appUser) throw new Error("Cadastro selecionado não encontrado.");
    if (appUser) {
      if (appUser.auth_user_id && appUser.auth_user_id !== authUser.id) {
        throw new Error("O cadastro operacional selecionado já está vinculado a outro login.");
      }

      const scopedAdmin = admin as unknown as SupabaseClient<AdminAccessDatabase>;
      const { error } = await scopedAdmin
        .from("app_users")
        .update({
          auth_user_id: authUser.id,
          email,
          ...(!appUser.auth_user_id ? { access_model: "scoped" as const } : {}),
        })
        .eq("id", appUser.id);
      if (error) throw error;

      result.appUser = {
        status: appUser.auth_user_id === authUser.id ? "existing" : "linked",
        message: "Cadastro operacional vinculado ao login.",
        id: appUser.id,
      };
    } else {
      const scopedAdmin = admin as unknown as SupabaseClient<AdminAccessDatabase>;
      const { data, error } = await scopedAdmin
        .from("app_users")
        .insert({
          name,
          email,
          role: "EXTERNO",
          access_model: "scoped",
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

  // Never continue with athlete linking or grants after the application identity failed.
  // Partial Auth creation must remain unprivileged and be reconciled explicitly.
  if (result.appUser.status === "failed") {
    result.healthAthlete = { status: "skipped", message: "Vínculo Saúde suspenso: vínculo da conta falhou." };
    result.moduleGrants = { status: "skipped", message: "Permissões suspensas: vínculo da conta falhou." };
    if (authCreatedNow) {
      result.auth.message += " Conta sem privilégios, pendente de reconciliação.";
    }
    return result;
  }

  try {
    const athlete = existingAthlete;
    if (input.healthAthleteId && !athlete) {
      throw new Error("Atleta selecionado não encontrado.");
    }
    if (athlete) {
      if (athlete.display_name.trim().toLocaleLowerCase("pt-BR") !== name.toLocaleLowerCase("pt-BR")) {
        throw new Error("Atleta selecionado não corresponde ao nome do usuário informado.");
      }
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

  if (result.appUser.status !== "failed" &&
      result.healthAthlete.status !== "failed") {
    try {
      await replaceUserModuleGrants(admin, actorAuthUserId, authUser.id, input.modules);
      result.moduleGrants = {
        status: "linked",
        message: input.modules.length
          ? "Módulos selecionados registrados (isolamento de dados depende das RLS)."
          : "Nenhum módulo autorizado.",
      };
    } catch (error) {
      result.status = "partial_failure";
      result.moduleGrants = {
        status: "failed",
        message: error instanceof Error ? error.message : "Erro ao salvar módulos.",
      };
    }
  }

  if (authCreatedNow && result.status === "partial_failure") {
    result.auth.message += " A conta foi mantida para reconciliação; não houve exclusão silenciosa.";
  }

  return result;
}
