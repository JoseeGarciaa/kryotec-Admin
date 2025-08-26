import { apiClient } from '../services/api';
import axios from 'axios';

// Interfaz para una sugerencia de reemplazo
export interface SugerenciaReemplazo {
  sugerencia_id: number;
  cliente_id: number | null;
  inv_id: number | null;
  modelo_sugerido: string | null;
  cantidad_sugerida: number | null;
  fecha_sugerencia: string | null;
  modelo_id: number | null;
  estado: string | null;
  orden_despacho?: string | null;
  detalle_orden?: string | null;
  // Campos adicionales para joins
  nombre_cliente?: string;
  descripcion_inventario?: string;
  producto?: string;
  cantidad_inventario?: number;
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
  total_productos_transportados: number;
  volumen_total_productos: number;
  volumen_total_contenedores?: number;
  volumen_total_disponible?: number;
  espacio_sobrante_m3: number;
  porcentaje_espacio_sobrante?: number;
  eficiencia?: number; // Para compatibilidad con cálculo individual
  eficiencia_porcentaje?: number; // Para cálculo por orden
  mensaje_comparacion?: string;
  recomendacion?: string; // Para compatibilidad con cálculo individual
  recomendacion_nivel?: string; // Para cálculo por orden
  detalle_espacio?: string;
  es_ajuste_perfecto?: boolean;
  nivel_recomendacion?: 'EXCELENTE' | 'BUENO' | 'ACEPTABLE' | 'MALO' | 'EVITAR';
  es_mejor_opcion?: boolean;
  etiqueta_recomendacion?: string;
  dimensiones_internas?: {
    frente: number;
    profundo: number;
    alto: number;
  };
  volumen_litros?: number;
  volumen_modelo_m3?: number;
  orden_despacho?: string;
  resumen_productos?: any[];
  detalle_contenedores_por_producto?: any[]; // Nueva propiedad para detalles específicos
  es_calculo_por_orden?: boolean;
  // Campos obsoletos mantenidos por compatibilidad
  cajas_por_modelo?: number;
  total_cajas_guardadas?: number;
}

// URL base de la API
const API_URL = import.meta.env.PROD 
  ? 'https://kryotec-admin-production.up.railway.app/api' 
  : 'http://localhost:3002/api';

console.log('API_URL configurada:', API_URL);
console.log('Modo producción:', import.meta.env.PROD);

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
      console.log('Modelo: Enviando request a: /sugerencias/calcular');
      console.log('Modelo: Datos enviados:', calculo);
      
      const response = await apiClient.post('/sugerencias/calcular', calculo);
      console.log('Modelo: Respuesta recibida:', response.data);
      return response.data;
    } catch (error) {
      console.error('Modelo: Error al calcular sugerencias:', error);
      if (axios.isAxiosError(error)) {
        console.error('Modelo: Status:', error.response?.status);
        console.error('Modelo: Data:', error.response?.data);
        console.error('Modelo: Headers:', error.response?.headers);
      }
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