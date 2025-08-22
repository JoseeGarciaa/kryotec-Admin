import axios from 'axios';

// Interfaz para una sugerencia de reemplazo
export interface SugerenciaReemplazo {
  sugerencia_id: number;
  cliente_id: number | null;
  inv_id: number | null;
  modelo_sugerido: string | null;
  cantidad_sugerida: number | null;
  modalidad: string | null;
  fecha_sugerencia: string | null;
  modelo_id: number | null;
  estado: string | null;
  // Campos adicionales para joins
  nombre_cliente?: string;
  descripcion_inventario?: string;
  nombre_modelo?: string;
}

// Tipo para crear una nueva sugerencia
export type CreateSugerenciaData = Omit<SugerenciaReemplazo, 'sugerencia_id' | 'fecha_sugerencia' | 'nombre_cliente' | 'descripcion_inventario' | 'nombre_modelo'>;

// Interfaz para el cálculo de sugerencias
export interface CalculoSugerencia {
  cliente_id: number;
  inv_id: number;
  volumen_requerido: number;
  cantidad: number; // Agregar cantidad de cajas
  dimensiones_requeridas: {
    frente: number; // Ahora en mm
    profundo: number; // Ahora en mm
    alto: number; // Ahora en mm
  };
}

// Interfaz para el resultado del cálculo
export interface ResultadoSugerencia {
  modelo_id: number;
  nombre_modelo: string;
  cantidad_sugerida: number;
  cajas_por_modelo?: number; // Agregar información adicional
  total_cajas_guardadas?: number;
  eficiencia: number;
  dimensiones_internas: {
    frente: number;
    profundo: number;
    alto: number;
  };
  volumen_litros: number;
}

// URL base de la API
const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';

// Modelo para Sugerencias
export const SugerenciasModel = {
  // Obtener todas las sugerencias
  getAllSugerencias: async (): Promise<SugerenciaReemplazo[]> => {
    try {
      const response = await axios.get(`${API_URL}/sugerencias`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener sugerencias:', error);
      throw error;
    }
  },

  // Obtener sugerencias por cliente
  getSugerenciasByCliente: async (clienteId: number): Promise<SugerenciaReemplazo[]> => {
    try {
      const response = await axios.get(`${API_URL}/sugerencias/cliente/${clienteId}`);
      return response.data;
    } catch (error) {
      console.error(`Error al obtener sugerencias del cliente ${clienteId}:`, error);
      throw error;
    }
  },

  // Calcular sugerencias para un inventario específico
  calcularSugerencias: async (calculo: CalculoSugerencia): Promise<ResultadoSugerencia[]> => {
    try {
      const response = await axios.post(`${API_URL}/sugerencias/calcular`, calculo);
      return response.data;
    } catch (error) {
      console.error('Error al calcular sugerencias:', error);
      throw error;
    }
  },

  // Crear una nueva sugerencia
  createSugerencia: async (sugerenciaData: CreateSugerenciaData): Promise<SugerenciaReemplazo> => {
    try {
      const response = await axios.post(`${API_URL}/sugerencias`, sugerenciaData);
      return response.data;
    } catch (error) {
      console.error('Error al crear sugerencia:', error);
      throw error;
    }
  },

  // Actualizar una sugerencia
  updateSugerencia: async (id: number, sugerenciaData: Partial<CreateSugerenciaData>): Promise<SugerenciaReemplazo | null> => {
    try {
      const response = await axios.put(`${API_URL}/sugerencias/${id}`, sugerenciaData);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      console.error(`Error al actualizar sugerencia con ID ${id}:`, error);
      throw error;
    }
  },

  // Eliminar una sugerencia
  deleteSugerencia: async (id: number): Promise<boolean> => {
    try {
      await axios.delete(`${API_URL}/sugerencias/${id}`);
      return true;
    } catch (error) {
      console.error(`Error al eliminar sugerencia con ID ${id}:`, error);
      throw error;
    }
  }
};