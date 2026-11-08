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
    Tables: Database["public"]["Tables"] & { app_user_module_grants: ModuleGrantsTable };
    Functions: Database["public"]["Functions"] & {
      admin_replace_user_module_grants: {
        Args: { p_target_auth_user_id: string; p_module_keys: string[]; p_actor_auth_user_id: string };
        Returns: string[];
      };
    };
  };
};
