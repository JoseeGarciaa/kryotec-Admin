import { useState, useEffect, useCallback } from 'react';
import { UserModel, AdminUser } from '../models/UserModel';

// Tipo para el estado de carga
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Interfaz para el controlador de usuarios
export interface UserControllerState {
  users: AdminUser[];
  loading: LoadingState;
  error: string | null;
  fetchUsers: () => Promise<void>;
  getUserById: (id: number) => Promise<AdminUser | null>;
  createUser: (userData: Omit<AdminUser, 'id' | 'fecha_creacion' | 'ultimo_ingreso'>) => Promise<AdminUser | null>;
  updateUser: (id: number, userData: Partial<Omit<AdminUser, 'id' | 'fecha_creacion'>>) => Promise<AdminUser | null>;
  deleteUser: (id: number) => Promise<boolean>;
}

// Hook controlador para usuarios
export const useUserController = (): UserControllerState => {
  // Estado para la lista de usuarios
  const [users, setUsers] = useState<AdminUser[]>([]);
  // Estado para el estado de carga
  const [loading, setLoading] = useState<LoadingState>('idle');
  // Estado para mensajes de error
  const [error, setError] = useState<string | null>(null);

  // Función para obtener todos los usuarios
  const fetchUsers = useCallback(async () => {
    try {
      setLoading('loading');
      setError(null);
      const data = await UserModel.getAllUsers();
      setUsers(data);
      setLoading('success');
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      setError('No se pudieron cargar los usuarios. Por favor, intenta de nuevo más tarde.');
      setLoading('error');
    }
  }, []);

  // Función para obtener un usuario por ID
  const getUserById = useCallback(async (id: number): Promise<AdminUser | null> => {
    try {
      return await UserModel.getUserById(id);
    } catch (err) {
      console.error(`Error al obtener usuario con ID ${id}:`, err);
      setError(`No se pudo obtener el usuario con ID ${id}.`);
      return null;
    }
  }, []);

  // Función para crear un nuevo usuario
  const createUser = useCallback(async (userData: Omit<AdminUser, 'id' | 'fecha_creacion' | 'ultimo_ingreso'>): Promise<AdminUser | null> => {
    try {
      const newUser = await UserModel.createUser(userData);
      // Actualizar la lista de usuarios
      setUsers(prevUsers => [...prevUsers, newUser]);
      setError(null); // Limpiar errores previos
      return newUser;
    } catch (err) {
      console.error('Error al crear usuario:', err);
      // Mostrar el mensaje de error específico del servidor
      const errorMessage = err instanceof Error ? err.message : 'No se pudo crear el usuario. Por favor, verifica los datos e intenta de nuevo.';
      setError(errorMessage);
      return null;
    }
  }, []);

  // Función para actualizar un usuario existente
  const updateUser = useCallback(async (id: number, userData: Partial<Omit<AdminUser, 'id' | 'fecha_creacion'>>): Promise<AdminUser | null> => {
    try {
      const updatedUser = await UserModel.updateUser(id, userData);
      if (updatedUser) {
        // Actualizar la lista de usuarios
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === id ? updatedUser : user
          )
        );
      }
      return updatedUser;
    } catch (err) {
      console.error(`Error al actualizar usuario con ID ${id}:`, err);
      setError(`No se pudo actualizar el usuario con ID ${id}.`);
      return null;
    }
  }, []);

  // Función para eliminar (desactivar) un usuario
  const deleteUser = useCallback(async (id: number): Promise<boolean> => {
    try {
      const success = await UserModel.deleteUser(id);
      if (success) {
        // Actualizar la lista de usuarios (marcar como inactivo)
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === id ? { ...user, activo: false } : user
          )
        );
      }
      return success;
    } catch (err) {
      console.error(`Error al eliminar usuario con ID ${id}:`, err);
      setError(`No se pudo eliminar el usuario con ID ${id}.`);
      return false;
    }
  }, []);

  // Cargar usuarios al montar el componente
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Retornar el estado y las funciones
  return {
    users,
    loading,
    error,
    fetchUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
  };
};
