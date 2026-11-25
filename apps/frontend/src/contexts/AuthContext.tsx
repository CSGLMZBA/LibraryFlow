import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { authService } from '../services/auth-service';
import type { AuthResult, AuthSession, AuthUser, RegisterRole, UserRole } from '../types/auth';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  authNotice: string | null;
  login: (email: string, password: string) => Promise<AuthResult<AuthSession>>;
  register: (email: string, password: string, requestedRole: RegisterRole) => Promise<AuthResult<AuthUser>>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    let mounted = true;
    const restore = () => {
      const started = generation.current;
      void authService.getCurrentSession()
        .then((restored) => { if (mounted && started === generation.current) setSession(restored); })
        .catch(() => { if (mounted && started === generation.current) setAuthNotice('Cannot verify your session. Check your connection and try again.'); })
        .finally(() => { if (mounted) setInitializing(false); });
    };
    restore();
    window.addEventListener('focus', restore);
    return () => { mounted = false; window.removeEventListener('focus', restore); };
  }, []);

  const login = async (email: string, password: string): Promise<AuthResult<AuthSession>> => {
    const started = ++generation.current;
    const result = await authService.login(email, password);
    if (result.success && started === generation.current) { setSession(result.data); setAuthNotice(null); }
    return result;
  };
  const register = async (email: string, password: string, role: RegisterRole): Promise<AuthResult<AuthUser>> => {
    return authService.register(email, password, role);
  };
  const logout = async () => {
    generation.current++;
    try { await authService.logout(); setAuthNotice('You have been logged out.'); }
    catch { setAuthNotice('Sign-out could not be fully confirmed. Check your connection before signing in again.'); }
    finally { setSession(null); }
  };
  const hasRole = (role: UserRole): boolean => session?.user.role === role;

  if (initializing) return <p role="status">Restoring session...</p>;
  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      authNotice,
      login, register, logout, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within an AuthProvider.');
  return value;
}
