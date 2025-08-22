import { useState, useEffect, useCallback } from 'react';
import { CredocubeModel, Credocube, CreateCredocubeData } from '../models/CredocubeModel';

// Tipo para el estado de carga
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Interfaz para el controlador de Credocubes
export interface CredocubeControllerState {
  credocubes: Credocube[];
  loading: LoadingState;
  error: string | null;
  fetchCredocubes: () => Promise<void>;
  getCredocubeById: (id: number) => Promise<Credocube | null>;
  createCredocube: (credocubeData: CreateCredocubeData) => Promise<Credocube | null>;
  updateCredocube: (id: number, credocubeData: Partial<CreateCredocubeData>) => Promise<Credocube | null>;
  deleteCredocube: (id: number) => Promise<boolean>;
}

// Hook controlador para Credocubes
export const useCredocubeController = (): CredocubeControllerState => {
  // Estado para la lista de modelos de Credocube
  const [credocubes, setCredocubes] = useState<Credocube[]>([]);
  // Estado para el estado de carga
  const [loading, setLoading] = useState<LoadingState>('idle');
  // Estado para mensajes de error
  const [error, setError] = useState<string | null>(null);

  // Función para obtener todos los modelos de Credocube
  const fetchCredocubes = useCallback(async () => {
    try {
      setLoading('loading');
      setError(null);
      const data = await CredocubeModel.getAllCredocubes();
      setCredocubes(data);
      setLoading('success');
    } catch (err) {
      console.error('Error al cargar modelos de Credocube:', err);
      setError('No se pudieron cargar los modelos de Credocube. Por favor, intenta de nuevo más tarde.');
      setLoading('error');
    }
  }, []);

  // Función para obtener un modelo de Credocube por ID
  const getCredocubeById = useCallback(async (id: number): Promise<Credocube | null> => {
    try {
      return await CredocubeModel.getCredocubeById(id);
    } catch (err) {
      console.error(`Error al obtener modelo de Credocube con ID ${id}:`, err);
      setError(`No se pudo obtener el modelo de Credocube con ID ${id}.`);
      return null;
    }
  }, []);

  // Función para crear un nuevo modelo de Credocube
  const createCredocube = useCallback(async (credocubeData: CreateCredocubeData): Promise<Credocube | null> => {
    try {
      const newCredocube = await CredocubeModel.createCredocube(credocubeData);
      // Actualizar la lista de modelos de Credocube
      setCredocubes(prevCredocubes => [...prevCredocubes, newCredocube]);
      setError(null); // Limpiar errores previos
      return newCredocube;
    } catch (err) {
      console.error('Error al crear modelo de Credocube:', err);
      // Mostrar el mensaje de error específico del servidor
      const errorMessage = err instanceof Error ? err.message : 'No se pudo crear el modelo de Credocube. Por favor, verifica los datos e intenta de nuevo.';
      setError(errorMessage);
      return null;
    }
  }, []);

  // Función para actualizar un modelo de Credocube existente
  const updateCredocube = useCallback(async (id: number, credocubeData: Partial<CreateCredocubeData>): Promise<Credocube | null> => {
    try {
      const updatedCredocube = await CredocubeModel.updateCredocube(id, credocubeData);
      if (updatedCredocube) {
        // Actualizar la lista de modelos de Credocube
        setCredocubes(prevCredocubes => 
          prevCredocubes.map(credocube => 
            credocube.modelo_id === id ? updatedCredocube : credocube
          )
        );
        setError(null); // Limpiar errores previos
      }
      return updatedCredocube;
    } catch (err) {
      console.error(`Error al actualizar modelo de Credocube con ID ${id}:`, err);
      setError(`No se pudo actualizar el modelo de Credocube con ID ${id}.`);
      return null;
    }
  }, []);

  // Función para eliminar un modelo de Credocube
  const deleteCredocube = useCallback(async (id: number): Promise<boolean> => {
    try {
      const success = await CredocubeModel.deleteCredocube(id);
      if (success) {
        // Eliminar el modelo de Credocube de la lista
        setCredocubes(prevCredocubes => 
          prevCredocubes.filter(credocube => credocube.modelo_id !== id)
        );
        setError(null); // Limpiar errores previos
      }
      return success;
    } catch (err) {
      console.error(`Error al eliminar modelo de Credocube con ID ${id}:`, err);
      setError(`No se pudo eliminar el modelo de Credocube con ID ${id}.`);
      return false;
    }
  }, []);

  // Cargar modelos de Credocube al montar el componente
  useEffect(() => {
    fetchCredocubes();
  }, [fetchCredocubes]);

  return {
    credocubes,
    loading,
    error,
    fetchCredocubes,
    getCredocubeById,
    createCredocube,
    updateCredocube,
    deleteCredocube
  };
};
