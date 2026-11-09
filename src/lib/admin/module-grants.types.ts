import type { Database } from "@/integrations/supabase/types";

// Typed preview of the new migration, until the canonical Supabase types are regenerated.
type ModuleGrantsTable = {
  Row: { auth_user_id: string; module_key: string; granted_by_auth_user_id: string; created_at: string };
  Insert: { auth_user_id: string; module_key: string; granted_by_auth_user_id: string; created_at?: string };
  Update: { auth_user_id?: string; module_key?: string; granted_by_auth_user_id?: string; created_at?: string };
  Relationships: [];
};

export type AdminAccessDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Omit<Database["public"]["Tables"], "app_users"> & {
      app_user_module_grants: ModuleGrantsTable;
      app_users: {
        Row: Database["public"]["Tables"]["app_users"]["Row"] & { access_model: "legacy" | "scoped" };
        Insert: Database["public"]["Tables"]["app_users"]["Insert"] & { access_model?: "legacy" | "scoped" };
        Update: Database["public"]["Tables"]["app_users"]["Update"] & { access_model?: "legacy" | "scoped" };
        Relationships: Database["public"]["Tables"]["app_users"]["Relationships"];
      };
    };
    Functions: Database["public"]["Functions"] & {
      admin_replace_user_module_grants: {
        Args: { p_target_auth_user_id: string; p_module_keys: string[]; p_actor_auth_user_id: string };
        Returns: string[];
      };
    };
  };
};
