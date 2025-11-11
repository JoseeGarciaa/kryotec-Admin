import { useState, useCallback, useEffect } from 'react';
import { AuthModel } from '../models/AuthModel';
import { LoginCredentials, AuthState, UserSecurity } from '../models/types/auth';

// El controlador maneja la lógica de negocio y actualiza el estado
export const useAuthController = () => {
  // Estado local que representa el estado actual de autenticación
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true, // Inicialmente cargando
    error: null
  });
  
  // Verificar si hay una sesión activa al iniciar
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await AuthModel.checkAuthStatus();
        if (user) {
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
        } else {
          setAuthState((prev: AuthState) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error al verificar autenticación:', error);
        setAuthState((prev: AuthState) => ({ ...prev, isLoading: false }));
      }
    };
    
    checkAuth();
  }, []);

  // Método para iniciar sesión
  const login = useCallback(async (credentials: LoginCredentials) => {
  setAuthState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Llamar al modelo para autenticar
      const user = await AuthModel.login(credentials);
      
      // Actualizar estado con resultado exitoso
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      
      return { success: true, security: user.security };
    } catch (error) {
      // Manejar errores y actualizar estado
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const security: UserSecurity | undefined = (error as any)?.security;
      
      setAuthState((prev: AuthState) => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      
      return { success: false, error: errorMessage, security };
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await AuthModel.checkAuthStatus();
      if (user) {
        setAuthState((prev: AuthState) => ({
          ...prev,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        }));
      } else {
        setAuthState({ user: null, isAuthenticated: false, isLoading: false, error: null });
      }
    } catch (error) {
      console.error('No se pudo refrescar la sesión de usuario:', error);
      setAuthState((prev: AuthState) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const updateUserSecurity = useCallback((updates: Partial<UserSecurity>) => {
    setAuthState((prev: AuthState) => {
      if (!prev.user) return prev;
      const security = { ...prev.user.security, ...updates };
      const updatedUser = { ...prev.user, security };
      try {
        localStorage.setItem('kryotec_user', JSON.stringify(updatedUser));
      } catch (error) {
        console.warn('No se pudo persistir la información de seguridad actualizada del usuario', error);
      }
      return { ...prev, user: updatedUser };
    });
  }, []);

  // Método para cerrar sesión
  const logout = useCallback(() => {
    // Llamar al modelo para cerrar sesión
    AuthModel.logout();
    
    // Actualizar estado
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  }, []);

  // Devolver estado y métodos para que los usen las vistas
  return {
    ...authState,
    login,
    logout,
    refreshUser,
    updateUserSecurity
  };
};
