import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type HealthAthlete = {
  id: string;
  auth_user_id: string | null;
  owner_auth_user_id: string;
  display_name: string;
  status: "active" | "inactive" | "archived";
  created_at: string;
  updated_at: string;
};

export function useHealthAthlete() {
  const { user } = useAuth();
  const [athlete, setAthlete] = useState<HealthAthlete | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAthlete = useCallback(async () => {
    if (!user?.id) {
      setAthlete(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await (supabase as any)
      .from("health_athletes")
      .select("id,auth_user_id,owner_auth_user_id,display_name,status,created_at,updated_at")
      .eq("auth_user_id", user.id)
      .neq("status", "archived")
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
      setAthlete(null);
    } else {
      setAthlete((data ?? null) as HealthAthlete | null);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchAthlete();
  }, [fetchAthlete]);

  const createOwnAthlete = useCallback(
    async (displayName: string) => {
      if (!user?.id) throw new Error("Sessão inválida.");

      const normalizedName = displayName.trim();
      if (normalizedName.length < 2) throw new Error("Informe um nome válido.");

      const { data, error: insertError } = await (supabase as any)
        .from("health_athletes")
        .insert({
          auth_user_id: user.id,
          owner_auth_user_id: user.id,
          created_by_auth_user_id: user.id,
          display_name: normalizedName,
        })
        .select("id,auth_user_id,owner_auth_user_id,display_name,status,created_at,updated_at")
        .single();

      if (insertError) throw insertError;

      const created = data as HealthAthlete;
      setAthlete(created);
      return created;
    },
    [user?.id],
  );

  return {
    athlete,
    loading,
    error,
    refresh: fetchAthlete,
    createOwnAthlete,
  };
}
