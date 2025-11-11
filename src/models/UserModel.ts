import { UserAPI } from '../services/api';

export interface AdminUser {
  id: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  rol: 'admin' | 'soporte';
  activo: boolean;
  ultimo_ingreso: Date | null;
  fecha_creacion: Date;
  session_timeout_minutos?: number | null;
  intentos_fallidos?: number;
  bloqueado?: boolean;
  bloqueado_hasta?: Date | null;
  debe_cambiar_contraseña?: boolean;
  ultimo_cambio_contraseña?: Date | null;
  contraseña_expira_el?: Date | null;
  contraseña?: string;
}

export class UserModel {
  // Obtener todos los usuarios
  static async getAllUsers(): Promise<AdminUser[]> {
    try {
      return await UserAPI.getAllUsers();
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  }

  // Obtener un usuario por ID
  static async getUserById(id: number): Promise<AdminUser | null> {
    try {
      return await UserAPI.getUserById(id);
    } catch (error) {
      console.error(`Error al obtener usuario con ID ${id}:`, error);
      throw error;
    }
  }

  // Crear un nuevo usuario
  static async createUser(userData: Omit<AdminUser, 'id' | 'fecha_creacion' | 'ultimo_ingreso'>): Promise<AdminUser> {
    try {
      return await UserAPI.createUser(userData);
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  }

  // Actualizar un usuario existente
  static async updateUser(id: number, userData: Partial<Omit<AdminUser, 'id' | 'fecha_creacion'>>): Promise<AdminUser | null> {
    try {
      return await UserAPI.updateUser(id, userData);
    } catch (error) {
      console.error(`Error al actualizar usuario con ID ${id}:`, error);
      throw error;
    }
  }

  // Eliminar un usuario (desactivar)
  static async deleteUser(id: number): Promise<boolean> {
    try {
      return await UserAPI.deleteUser(id);
    } catch (error) {
      console.error(`Error al eliminar usuario con ID ${id}:`, error);
      throw error;
    }
  }

  // Actualizar último ingreso
  static async updateLastLogin(id: number): Promise<boolean> {
    try {
      return await UserAPI.updateLastLogin(id);
    } catch (error) {
      console.error(`Error al actualizar último ingreso del usuario con ID ${id}:`, error);
      throw error;
    }
  }
}
