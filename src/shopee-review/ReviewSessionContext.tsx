import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { getStoredReviewSession, loginReview, logoutReview, verifyReviewSession } from './reviewSession';

type ReviewSessionContextValue = {
  expiresAt: string | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const ReviewSessionContext = createContext<ReviewSessionContextValue | undefined>(undefined);

export function ReviewSessionProvider({ children }: { children: ReactNode }) {
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getStoredReviewSession()) { setLoading(false); return; }
    verifyReviewSession().then((expires) => { setExpiresAt(expires); setLoading(false); });
  }, []);

  const signIn = async (username: string, password: string) => {
    await loginReview(username, password);
    const expires = await verifyReviewSession();
    if (!expires) throw new Error('A sessão de revisão não pôde ser validada.');
    setExpiresAt(expires);
  };

  const signOut = async () => { await logoutReview(); setExpiresAt(null); };
  return <ReviewSessionContext.Provider value={{ expiresAt, loading, signIn, signOut }}>{children}</ReviewSessionContext.Provider>;
}

export function useReviewSession() {
  const context = useContext(ReviewSessionContext);
  if (!context) throw new Error('useReviewSession deve ser usado dentro de ReviewSessionProvider.');
  return context;
}
