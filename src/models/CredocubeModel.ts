import axios from 'axios';

// Tipo para un modelo de Credocube (ahora basado en la tabla modelos)
export interface Credocube {
  modelo_id: number;
  nombre_modelo: string;
  volumen_litros: number | null;
  descripcion: string | null;
  dim_ext_frente: number | null;
  dim_ext_profundo: number | null;
  dim_ext_alto: number | null;
  dim_int_frente: number | null;
  dim_int_profundo: number | null;
  dim_int_alto: number | null;
  tic_frente: number | null;
  tic_alto: number | null;
  peso_total_kg: number | null;
  tipo: string | null;
}

// Tipo para crear un nuevo Credocube (sin ID)
export type CreateCredocubeData = Omit<Credocube, 'modelo_id'>;

// URL base de la API - Usar ruta relativa en producción o localhost en desarrollo
const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';

// Modelo para Credocubes
export const CredocubeModel = {
  // Obtener todos los modelos de Credocube
  getAllCredocubes: async (): Promise<Credocube[]> => {
    try {
      const response = await axios.get(`${API_URL}/credocubes`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener modelos de Credocube:', error);
      throw error;
    }
  },

  // Obtener un modelo de Credocube por ID
  getCredocubeById: async (id: number): Promise<Credocube | null> => {
    try {
      const response = await axios.get(`${API_URL}/credocubes/${id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      console.error(`Error al obtener modelo de Credocube con ID ${id}:`, error);
      throw error;
    }
  },

  // Crear un nuevo modelo de Credocube
  createCredocube: async (credocubeData: CreateCredocubeData): Promise<Credocube> => {
    try {
      const response = await axios.post(`${API_URL}/credocubes`, credocubeData);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error || 'Error al crear modelo de Credocube');
      }
      console.error('Error al crear modelo de Credocube:', error);
      throw error;
    }
  },

  // Actualizar un modelo de Credocube existente
  updateCredocube: async (id: number, credocubeData: Partial<CreateCredocubeData>): Promise<Credocube | null> => {
    try {
      const response = await axios.put(`${API_URL}/credocubes/${id}`, credocubeData);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      console.error(`Error al actualizar modelo de Credocube con ID ${id}:`, error);
      throw error;
    }
  },

  // Eliminar un modelo de Credocube
  deleteCredocube: async (id: number): Promise<boolean> => {
    try {
      await axios.delete(`${API_URL}/credocubes/${id}`);
      return true;
    } catch (error) {
      console.error(`Error al eliminar modelo de Credocube con ID ${id}:`, error);
      return false;
    }
  }
};
