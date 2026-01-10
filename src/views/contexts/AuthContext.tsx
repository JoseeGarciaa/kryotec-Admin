import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AuthState, LoginCredentials, UserSecurity } from '../../models/types/auth';
import { useAuthController } from '../../controllers/AuthController';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string; security?: UserSecurity }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserSecurity: (updates: Partial<UserSecurity>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  const authValue = useAuthController();
  const logoutTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);

  // Decodificar JWT sin librería externa (base64url decode)
  const decodeToken = (token: string): { exp?: number } | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const json = decodeURIComponent(atob(payload).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  // Programa logout cuando el token vaya a expirar
  useEffect(() => {
    const TOKEN_KEY = 'kryotec_token';
    const schedule = () => {
      if (logoutTimerRef.current) {
        window.clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return; // no sesión
      const decoded = decodeToken(token);
      if (!decoded?.exp) return; // sin exp
      const expMs = decoded.exp * 1000; // exp en segundos
      const now = Date.now();
      const remaining = expMs - now;
      if (remaining <= 0) {
        authValue.logout();
        return;
      }
      // Margen de 30s antes de expirar para evitar carrera con backend
      const fireIn = Math.max(0, remaining - 30000);
      logoutTimerRef.current = window.setTimeout(() => {
        authValue.logout();
        // Opcional: mostrar aviso (podrías integrar un toast aquí)
      }, fireIn);
    };

    schedule();
    // Re-schedule cuando cambie autenticación (login/logout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authValue.isAuthenticated, authValue.user]);

  // Logout por inactividad basado en sessionTimeoutMinutes
  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    const clearInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };

    const startInactivityTimer = () => {
      clearInactivityTimer();
      const minutes = authValue.user?.security?.sessionTimeoutMinutes ?? 10;
      const timeoutMs = Math.max(minutes, 1) * 60 * 1000;
      inactivityTimerRef.current = window.setTimeout(() => {
        authValue.logout();
      }, timeoutMs);
    };

    const handleActivity = () => {
      startInactivityTimer();
    };

    if (authValue.isAuthenticated) {
      events.forEach(evt => window.addEventListener(evt, handleActivity));
      startInactivityTimer();
    }

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
      clearInactivityTimer();
    };
  }, [authValue.isAuthenticated, authValue.user?.security?.sessionTimeoutMinutes, authValue.logout]);

  // Limpieza al desmontar
  useEffect(() => () => { if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current); }, []);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};