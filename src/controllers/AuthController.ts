import { useState, useCallback, useEffect } from 'react';
import { AuthModel } from '../models/AuthModel';
import { LoginCredentials, AuthState } from '../models/types/auth';

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
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error al verificar autenticación:', error);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };
    
    checkAuth();
  }, []);

  // Método para iniciar sesión
  const login = useCallback(async (credentials: LoginCredentials) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
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
      
      return { success: true };
    } catch (error) {
      // Manejar errores y actualizar estado
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      
      return { success: false, error: errorMessage };
    }
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
    logout
  };
};
