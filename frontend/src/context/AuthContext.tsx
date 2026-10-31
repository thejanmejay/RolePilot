import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, authService, getRememberMePreference, setRememberMePreference } from '../services/authService';

export interface AuthContextType {
  token: string | null;
  email: string | null;
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  login: (token: string, session?: Session | null, user?: User | null, rememberMe?: boolean) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwtEmail(token: string): string | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    return parsed.email || parsed.sub || null;
  } catch {
    return null;
  }
}

export function hasStoredAuthSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('supabase_access_token')) return true;
    if (sessionStorage.getItem('supabase_access_token')) return true;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key);
        if (val && val !== '{}' && val !== 'null') return true;
      }
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = sessionStorage.getItem(key);
        if (val && val !== '{}' && val !== 'null') return true;
      }
    }
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    if (hash.includes('access_token=') || search.includes('code=')) return true;
  } catch {
    return false;
  }
  return false;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('supabase_access_token') || sessionStorage.getItem('supabase_access_token');
    } catch {
      return null;
    }
  });

  const [email, setEmail] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('supabase_access_token') || sessionStorage.getItem('supabase_access_token');
      return saved ? parseJwtEmail(saved) : null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return hasStoredAuthSession();
  });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const login = useCallback(
    (newToken: string, newSession?: Session | null, newUser?: User | null, rememberMe?: boolean) => {
      const trimmed = newToken.trim();
      const shouldRemember = rememberMe !== undefined ? rememberMe : getRememberMePreference();
      setRememberMePreference(shouldRemember);
      try {
        if (shouldRemember) {
          localStorage.setItem('supabase_access_token', trimmed);
          sessionStorage.removeItem('supabase_access_token');
        } else {
          sessionStorage.setItem('supabase_access_token', trimmed);
          localStorage.removeItem('supabase_access_token');
        }
      } catch {
        // Safe fallback
      }
      setToken(trimmed);
      setEmail(newUser?.email || parseJwtEmail(trimmed));
      if (newUser) setUser(newUser);
      if (newSession) setSession(newSession);
      setIsLoading(false);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authService.signOut();
    } catch {
      authService.clearLocalClientData();
    }
    setToken(null);
    setEmail(null);
    setUser(null);
    setSession(null);
    setIsPasswordRecovery(false);
    setIsLoading(false);

    window.dispatchEvent(new CustomEvent('auth:logout'));
    window.dispatchEvent(new CustomEvent('auth:cleared'));
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        let currentUser = data.session.user;
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            currentUser = userData.user;
          }
        } catch {
          // Fallback to session user
        }

        setSession(data.session);
        setUser(currentUser);

        const isConfirmed = !currentUser || !!currentUser.email_confirmed_at;
        if (isConfirmed) {
          const accessToken = data.session.access_token;
          setToken(accessToken);
          setEmail(currentUser?.email || parseJwtEmail(accessToken));
          const remember = getRememberMePreference();
          try {
            if (remember) {
              localStorage.setItem('supabase_access_token', accessToken);
              sessionStorage.removeItem('supabase_access_token');
            } else {
              sessionStorage.setItem('supabase_access_token', accessToken);
              localStorage.removeItem('supabase_access_token');
            }
          } catch {
            // Safe fallback
          }
        } else {
          setToken(null);
          setEmail(currentUser?.email || null);
          try {
            localStorage.removeItem('supabase_access_token');
            sessionStorage.removeItem('supabase_access_token');
          } catch {
            // Safe fallback
          }
        }
      } else {
        authService.clearLocalClientData();
        setToken(null);
        setEmail(null);
        setUser(null);
        setSession(null);
        window.dispatchEvent(new CustomEvent('auth:cleared'));
      }
    } catch {
      console.warn('Session restoration failed. Please sign in again.');
      authService.clearLocalClientData();
      setToken(null);
      setEmail(null);
      setUser(null);
      setSession(null);
      window.dispatchEvent(new CustomEvent('auth:cleared'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial session check on mount only if potential session exists
    if (hasStoredAuthSession()) {
      refreshSession();
    } else {
      setIsLoading(false);
    }

    // 2. Listen to Supabase auth state changes
    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          if (event === 'PASSWORD_RECOVERY') {
            setIsPasswordRecovery(true);
          } else if (event === 'SIGNED_IN') {
            setIsPasswordRecovery(false);
          }

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
            if (currentSession?.access_token) {
              const currentUser = currentSession.user;
              const isConfirmed = !currentUser || !!currentUser.email_confirmed_at;
              setSession(currentSession);
              setUser(currentUser);

              if (isConfirmed) {
                setToken(currentSession.access_token);
                setEmail(currentUser?.email || parseJwtEmail(currentSession.access_token));
                const remember = getRememberMePreference();
                try {
                  if (remember) {
                    localStorage.setItem('supabase_access_token', currentSession.access_token);
                    sessionStorage.removeItem('supabase_access_token');
                  } else {
                    sessionStorage.setItem('supabase_access_token', currentSession.access_token);
                    localStorage.removeItem('supabase_access_token');
                  }
                } catch {
                  // Safe fallback
                }
              } else {
                setToken(null);
                setEmail(currentUser?.email || null);
                try {
                  localStorage.removeItem('supabase_access_token');
                  sessionStorage.removeItem('supabase_access_token');
                } catch {
                  // Safe fallback
                }
              }
            } else {
              setToken(null);
              setEmail(null);
              setUser(null);
              setSession(null);
              authService.clearLocalClientData();
              window.dispatchEvent(new CustomEvent('auth:cleared'));
            }
          } else if (event === 'SIGNED_OUT') {
            setIsPasswordRecovery(false);
            setToken(null);
            setEmail(null);
            setUser(null);
            setSession(null);
            authService.clearLocalClientData();
            window.dispatchEvent(new CustomEvent('auth:cleared'));
          }
          setIsLoading(false);
        }
      );

      // 3. Listen for external storage clearing (e.g. Chrome DevTools -> Application -> Clear site data)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === null || e.key === 'supabase_access_token' || (e.key && e.key.startsWith('sb-'))) {
          if (!hasStoredAuthSession()) {
            setToken(null);
            setEmail(null);
            setUser(null);
            setSession(null);
            setIsPasswordRecovery(false);
            setIsLoading(false);
            authService.clearLocalClientData();
            window.dispatchEvent(new CustomEvent('auth:cleared'));
          }
        }
      };

      // 4. Revalidate session when tab becomes visible
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          if (token && !hasStoredAuthSession()) {
            logout();
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        authListener.subscription.unsubscribe();
        window.removeEventListener('storage', handleStorageChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [refreshSession, token, logout]);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        token,
        email,
        user,
        session,
        isAuthenticated: !!token,
        isLoading,
        isPasswordRecovery,
        clearPasswordRecovery,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
