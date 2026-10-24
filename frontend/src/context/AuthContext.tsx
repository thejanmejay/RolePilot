import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, authService } from '../services/authService';

export interface AuthContextType {
  token: string | null;
  email: string | null;
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, session?: Session | null, user?: User | null) => void;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('supabase_access_token');
  });

  const [email, setEmail] = useState<string | null>(() => {
    const saved = localStorage.getItem('supabase_access_token');
    return saved ? parseJwtEmail(saved) : null;
  });

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const login = useCallback((newToken: string, newSession?: Session | null, newUser?: User | null) => {
    const trimmed = newToken.trim();
    localStorage.setItem('supabase_access_token', trimmed);
    setToken(trimmed);
    setEmail(newUser?.email || parseJwtEmail(trimmed));
    if (newUser) setUser(newUser);
    if (newSession) setSession(newSession);
  }, []);

  const logout = useCallback(async () => {
    await authService.signOut();
    localStorage.removeItem('supabase_access_token');
    setToken(null);
    setEmail(null);
    setUser(null);
    setSession(null);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Fetch authoritative server state using getUser() to avoid stale JWT flags
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
          localStorage.setItem('supabase_access_token', accessToken);
        } else {
          // Unconfirmed account: block access to protected application features
          setToken(null);
          setEmail(currentUser?.email || null);
          localStorage.removeItem('supabase_access_token');
        }
      } else {
        localStorage.removeItem('supabase_access_token');
        setToken(null);
        setEmail(null);
        setUser(null);
        setSession(null);
      }
    } catch (err) {
      console.warn('Session restoration failed:', err);
      setToken(null);
      setEmail(null);
      setUser(null);
      setSession(null);
      localStorage.removeItem('supabase_access_token');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial session check on mount
    refreshSession();

    // 2. Listen to Supabase auth state changes
    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            if (currentSession?.access_token) {
              const currentUser = currentSession.user;
              const isConfirmed = !currentUser || !!currentUser.email_confirmed_at;
              setSession(currentSession);
              setUser(currentUser);

              if (isConfirmed) {
                setToken(currentSession.access_token);
                setEmail(currentUser?.email || parseJwtEmail(currentSession.access_token));
                localStorage.setItem('supabase_access_token', currentSession.access_token);
              } else {
                setToken(null);
                setEmail(currentUser?.email || null);
                localStorage.removeItem('supabase_access_token');
              }
            }
          } else if (event === 'SIGNED_OUT') {
            localStorage.removeItem('supabase_access_token');
            setToken(null);
            setEmail(null);
            setUser(null);
            setSession(null);
          }
          setIsLoading(false);
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, [refreshSession]);

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
