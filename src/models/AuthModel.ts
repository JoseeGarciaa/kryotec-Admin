import { User, LoginCredentials } from './types/auth';
import { apiClient } from '../services/api';

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
        const user: User = {
          id: apiUser.id.toString(),
          email: apiUser.correo,
          name: apiUser.nombre,
          role: apiUser.rol,
          avatar: undefined
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
        throw new Error(error.response.data?.error || 'Credenciales inválidas');
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
        const user: User = {
          id: apiUser.id.toString(),
            email: apiUser.correo,
            name: apiUser.nombre,
            role: apiUser.rol,
            avatar: undefined
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
