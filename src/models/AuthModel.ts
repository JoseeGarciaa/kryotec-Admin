import { User, LoginCredentials, UserSecurity } from './types/auth';
import { apiClient } from '../services/api';

const normalizeRole = (role?: string | null) => {
  if (!role) return role;
  return role === 'soporte' ? 'comercial' : role;
};

// Clave para almacenar el usuario en localStorage
const USER_STORAGE_KEY = 'kryotec_user';
const TOKEN_STORAGE_KEY = 'kryotec_token';

export class AuthModel {
  // Autenticar al usuario mediante la API
  static async login(credentials: LoginCredentials): Promise<User> {
    try {
      const response = await apiClient.post('/auth/login', {
        correo: credentials.email,
        contraseña: credentials.password
      });
      
      if (response.data.success) {
        // Guardar el token si existe
        if (response.data.token) {
          localStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);
        }
        
        // Convertir el usuario de la API al formato de nuestra aplicación
        const apiUser = response.data.user;
        const security: UserSecurity | undefined = response.data.security ? {
          mustChangePassword: response.data.security.mustChangePassword ?? apiUser?.debe_cambiar_contraseña ?? false,
          passwordExpiresAt: response.data.security.passwordExpiresAt ?? apiUser?.contraseña_expira_el ?? null,
          passwordExpired: response.data.security.passwordExpired ?? false,
          passwordChangedAt: response.data.security.passwordChangedAt ?? apiUser?.ultimo_cambio_contraseña ?? null,
          sessionTimeoutMinutes: response.data.security.sessionTimeoutMinutes ?? apiUser?.session_timeout_minutos ?? undefined,
          failedAttempts: response.data.security.failedAttempts ?? apiUser?.intentos_fallidos ?? undefined,
          maxFailedAttempts: response.data.security.maxFailedAttempts ?? undefined,
          remainingAttempts: response.data.security.remainingAttempts ?? undefined,
          isLocked: response.data.security.isLocked ?? apiUser?.bloqueado ?? undefined,
          lockoutUntil: response.data.security.lockoutUntil ?? apiUser?.bloqueado_hasta ?? null
        } : apiUser ? {
          mustChangePassword: apiUser.debe_cambiar_contraseña ?? false,
          passwordExpiresAt: apiUser.contraseña_expira_el ?? null,
          passwordChangedAt: apiUser.ultimo_cambio_contraseña ?? null,
          sessionTimeoutMinutes: apiUser.session_timeout_minutos ?? undefined,
          failedAttempts: apiUser.intentos_fallidos ?? undefined,
          maxFailedAttempts: undefined,
          remainingAttempts: undefined,
          isLocked: apiUser.bloqueado ?? undefined,
          lockoutUntil: apiUser.bloqueado_hasta ?? null
        } : undefined;
        const user: User = {
          id: apiUser.id.toString(),
          email: apiUser.correo,
          name: apiUser.nombre,
          role: normalizeRole(apiUser.rol),
          avatar: undefined,
          security
        };
        
        // Guardar usuario en localStorage para persistencia
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        
        console.log('Login exitoso:', user);
        return user;
      } else {
        throw new Error(response.data.message || 'Error al iniciar sesión');
      }
    } catch (error: any) {
      console.error('Error en login:', error);
      if (error.response) {
        const err = new Error(error.response.data?.error || 'Credenciales inválidas');
        if (error.response.data?.security) {
          (err as any).security = error.response.data.security;
        }
        (err as any).status = error.response.status;
        throw err;
      }
      throw error;
    }
  }

  // Método para cerrar sesión
  static logout(): void {
    // Eliminar usuario y token del localStorage
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    
    console.log('Sesión cerrada correctamente');
  }

  // Método para verificar si hay una sesión activa
  static async checkAuthStatus(): Promise<User | null> {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      return null;
    }
    try {
      // Verificar contra el backend para asegurarnos que el token sigue válido
      const resp = await apiClient.get('/auth/me');
      if (resp.data && resp.data.auth && resp.data.user) {
        const apiUser = resp.data.user;
        const security: UserSecurity | undefined = resp.data.security ? {
          mustChangePassword: resp.data.security.mustChangePassword ?? apiUser?.debe_cambiar_contraseña ?? false,
          passwordExpiresAt: resp.data.security.passwordExpiresAt ?? apiUser?.contraseña_expira_el ?? null,
          passwordExpired: resp.data.security.passwordExpired ?? false,
          passwordChangedAt: resp.data.security.passwordChangedAt ?? apiUser?.ultimo_cambio_contraseña ?? null,
          sessionTimeoutMinutes: resp.data.security.sessionTimeoutMinutes ?? apiUser?.session_timeout_minutos ?? undefined,
          failedAttempts: resp.data.security.failedAttempts ?? apiUser?.intentos_fallidos ?? undefined,
          maxFailedAttempts: resp.data.security.maxFailedAttempts ?? undefined,
          remainingAttempts: resp.data.security.remainingAttempts ?? undefined,
          isLocked: resp.data.security.isLocked ?? apiUser?.bloqueado ?? undefined,
          lockoutUntil: resp.data.security.lockoutUntil ?? apiUser?.bloqueado_hasta ?? null
        } : apiUser ? {
          mustChangePassword: apiUser.debe_cambiar_contraseña ?? false,
          passwordExpiresAt: apiUser.contraseña_expira_el ?? null,
          passwordChangedAt: apiUser.ultimo_cambio_contraseña ?? null,
          sessionTimeoutMinutes: apiUser.session_timeout_minutos ?? undefined,
          failedAttempts: apiUser.intentos_fallidos ?? undefined,
          maxFailedAttempts: undefined,
          remainingAttempts: undefined,
          isLocked: apiUser.bloqueado ?? undefined,
          lockoutUntil: apiUser.bloqueado_hasta ?? null
        } : undefined;
        const user: User = {
          id: apiUser.id.toString(),
            email: apiUser.correo,
            name: apiUser.nombre,
            role: normalizeRole(apiUser.rol),
            avatar: undefined,
            security
        };
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        return user;
      }
      return null;
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        // Token inválido / expirado → limpiar
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        return null;
      }
      console.error('Error verificando sesión:', error);
      return null;
    }
  }
}
