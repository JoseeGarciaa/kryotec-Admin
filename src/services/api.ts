import axios from 'axios';
import { AdminUser } from '../models/UserModel';

// URL base de la API - Usar ruta relativa en producción
const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';

// Crear instancia de axios con configuración base
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para manejar tokens de autenticación
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('kryotec_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de respuesta para manejar expiración o invalidez del token
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    // No destruir sesión si es el login mismo fallando
    const isLogin = url.includes('/auth/login');
    if (status === 401 && !isLogin) {
      localStorage.removeItem('kryotec_token');
      localStorage.removeItem('kryotec_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Función para convertir fechas de string a Date en los objetos de usuario
const convertDates = (user: any): AdminUser => {
  return {
    ...user,
    ultimo_ingreso: user.ultimo_ingreso ? new Date(user.ultimo_ingreso) : null,
    fecha_creacion: user.fecha_creacion ? new Date(user.fecha_creacion) : null,
    bloqueado_hasta: user.bloqueado_hasta ? new Date(user.bloqueado_hasta) : null,
    ultimo_cambio_contraseña: user.ultimo_cambio_contraseña ? new Date(user.ultimo_cambio_contraseña) : null,
    contraseña_expira_el: user.contraseña_expira_el ? new Date(user.contraseña_expira_el) : null,
    session_timeout_minutos: user.session_timeout_minutos != null ? Number(user.session_timeout_minutos) : user.session_timeout_minutos
  };
};



// API para usuarios
export const UserAPI = {
  // Obtener todos los usuarios
  getAllUsers: async (): Promise<AdminUser[]> => {
    try {
      const response = await apiClient.get('/users');
      return response.data.map(convertDates);
  } catch (error: any) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  },



// Obtener un usuario por ID

getUserById: async (id: number): Promise<AdminUser | null> => {
    try {
      const response = await apiClient.get(`/users/${id}`);
      return convertDates(response.data);
  } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      console.error(`Error al obtener usuario con ID ${id}:`, error);
      throw error;
    }
  },



// Crear un nuevo usuario

createUser: async (userData: Omit<AdminUser, 'id' | 'fecha_creacion' | 'ultimo_ingreso'>): Promise<AdminUser> => {
    try {
      const response = await apiClient.post(`/users`, userData);
      return convertDates(response.data);
  } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        // Lanzar el mensaje de error del servidor
        throw new Error(error.response.data.error || 'Error al crear usuario');
      }
      console.error('Error al crear usuario:', error);
      throw error;
    }
  },



// Actualizar un usuario existente

updateUser: async (id: number, userData: Partial<Omit<AdminUser, 'id' | 'fecha_creacion'>>): Promise<AdminUser | null> => {
    try {
      const response = await apiClient.put(`/users/${id}`, userData);
      return convertDates(response.data);
  } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      console.error(`Error al actualizar usuario con ID ${id}:`, error);
      throw error;
    }
  },



// Eliminar un usuario (desactivar)

deleteUser: async (id: number): Promise<boolean> => {
    try {
      await apiClient.delete(`/users/${id}`);
      return true;
  } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false;
      }
      console.error(`Error al eliminar usuario con ID ${id}:`, error);
      throw error;
    }
  },



// Actualizar último ingreso

updateLastLogin: async (id: number): Promise<boolean> => {
    try {
      await apiClient.put(`/users/${id}/login`, {});
      return true;
  } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false;
      }
      console.error(`Error al actualizar último ingreso del usuario con ID ${id}:`, error);
      throw error;
    }
  },

};

// API para autenticación
export const AuthAPI = {
  changePassword: async (userId: number, oldPassword: string, newPassword: string): Promise<{ success: boolean; security?: any }> => {
    try {
      const response = await apiClient.post('/auth/change-password', { userId, oldPassword, newPassword });
      return {
        success: !!response.data?.success || response.status === 200,
        security: response.data?.security
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.error || 'Error al cambiar contraseña');
      }
      throw error;
    }
  }
};