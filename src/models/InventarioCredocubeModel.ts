import axios from 'axios';

export interface InventarioCredocube {
  tenant_schema_name: string;
  nombre_unidad: string;
  fecha_ingreso: string;
  ultima_actualizacion: string;
  activo: boolean;
  categoria?: string | null;
  modelo_id?: number | null;
  volumen_litros?: number | null;
  modelo_nombre?: string | null;
  tipo_modelo?: string | null;
}

// URL base de la API - Usar ruta relativa en producción o localhost en desarrollo
const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';

// Función para interactuar con la API y obtener los datos reales de la tabla
export const getInventarioCredocubes = async (): Promise<InventarioCredocube[]> => {
  try {
    const response = await axios.get(`${API_URL}/inventario-credocubes`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener inventario de Credocubes:', error);
    throw new Error('Error al obtener datos del inventario');
  }
};

// Función para refrescar el inventario ejecutando la función SQL
export const refreshInventarioCredocubes = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.post(`${API_URL}/refresh-inventario-credocubes`);
    return response.data;
  } catch (error) {
    console.error('Error al refrescar inventario de Credocubes:', error);
    throw new Error('Error al actualizar el inventario');
  }
};
