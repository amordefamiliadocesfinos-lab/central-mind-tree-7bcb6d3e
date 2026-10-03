import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppUser {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  is_active: boolean;
  avatar_url: string | null;
}

/**
 * Identidade operacional canônica.
 * Resolve exatamente um app_users ativo por auth_user_id = session.user.id.
 * Nome, função e foto pertencem à mesma linha app_users.
 */
export function useActiveUser() {
  const { user, loading: authLoading } = useAuth();
  const [activeUser, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLinked = useCallback(async () => {
    if (!user) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('app_users')
      .select('id, name, role, email, is_active, avatar_url')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    setUser(!error && data ? (data as AppUser) : null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    fetchLinked();
  }, [authLoading, fetchLinked]);

  return {
    activeUserId: activeUser?.id ?? null,
    activeUser,
    users: activeUser ? [activeUser] : [],
    loading: loading || authLoading,
    isLinked: !!activeUser,
    refetch: fetchLinked,
  };
}
