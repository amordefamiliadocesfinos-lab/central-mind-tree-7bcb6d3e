import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AuthAppUser = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  auth_user_id: string | null;
};

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  appUser: AuthAppUser | null;
  loading: boolean;
  profileLoading: boolean;
  isProductionOperator: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeRole(role?: string | null) {
  return (role || '').trim().toLocaleUpperCase('pt-BR');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [appUser, setAppUser] = useState<AuthAppUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user?.id ?? null;
      const userChanged = currentUserIdRef.current !== nextUserId;

      currentUserIdRef.current = nextUserId;

      // Token/session refreshes for the same user must not invalidate an already
      // loaded operational profile. Only an actual identity change reloads it.
      if (userChanged) {
        setAppUser(null);
        setProfileLoading(!!nextUserId);
      } else if (!nextUserId) {
        setAppUser(null);
        setProfileLoading(false);
      }

      setSession(nextSession);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applySession(newSession);
    });

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!session?.user?.id) {
      setAppUser(null);
      setProfileLoading(false);
      return () => { mounted = false; };
    }

    setProfileLoading(true);
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('app_users')
          .select('id,name,role,email,avatar_url,is_active,auth_user_id')
          .eq('auth_user_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!mounted) return;
        if (error) console.error('Erro ao carregar perfil operacional:', error);
        setAppUser((data || null) as AuthAppUser | null);
      } catch (error) {
        if (!mounted) return;
        console.error('Erro inesperado ao carregar perfil operacional:', error);
        setAppUser(null);
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [session?.user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    currentUserIdRef.current = null;
    setSession(null);
    setAppUser(null);
    setProfileLoading(false);
  }, []);

  const isProductionOperator = normalizeRole(appUser?.role) === 'PRODUÇÃO';

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      appUser,
      loading,
      profileLoading,
      isProductionOperator,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
