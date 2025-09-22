import { apiClient } from '../services/api';

export interface Tenant {
  id: number;
  nombre: string;
  nit: string;
  email_contacto: string;
  telefono_contacto: string;
  direccion: string;
  estado: boolean;
  fecha_creacion: string;
  contraseña?: string; // Opcional en la interfaz para no mostrarla en la UI
  ultimo_ingreso: string;
  esquema: string;
  adminCredentials?: {
    usuario: string;
    contraseña: string;
  };
}

// Tipo para crear o actualizar un tenant
export interface TenantInput {
  nombre: string;
  nit: string;
  email_contacto: string;
  telefono_contacto: string;
  direccion: string;
  estado: boolean;
  contraseña?: string;
  esquema: string;
}

// Usar URL relativa en producción o localhost en desarrollo
const API_URL = import.meta.env.PROD ? '/api/tenants' : 'http://localhost:3002/api/tenants';

// Obtener todos los tenants
export const getTenants = async (): Promise<Tenant[]> => {
  try {
  const response = await apiClient.get(API_URL.replace('/api','')); // API_URL ya incluye /api/tenants en prod
    return response.data;
  } catch (error) {
    console.error('Error al obtener tenants:', error);
    throw error;
  }
};

// Obtener un tenant por ID
export const getTenantById = async (id: number): Promise<Tenant> => {
  try {
  const response = await apiClient.get(`${API_URL.replace('/api','')}/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener tenant con ID ${id}:`, error);
    throw error;
  }
};

// Crear un nuevo tenant
export const createTenant = async (tenantData: TenantInput): Promise<Tenant> => {
  try {
  const response = await apiClient.post(API_URL.replace('/api',''), tenantData);
    return response.data;
  } catch (error) {
    console.error('Error al crear tenant:', error);
    throw error;
  }
};

// Actualizar un tenant existente
export const updateTenant = async (id: number, tenantData: Partial<TenantInput>): Promise<Tenant> => {
  try {
  const response = await apiClient.put(`${API_URL.replace('/api','')}/${id}`, tenantData);
    return response.data;
  } catch (error) {
    console.error(`Error al actualizar tenant con ID ${id}:`, error);
    throw error;
  }
};

// Eliminar un tenant
export const deleteTenant = async (id: number): Promise<void> => {
  try {
  await apiClient.delete(`${API_URL.replace('/api','')}/${id}`);
  } catch (error) {
    console.error(`Error al eliminar tenant con ID ${id}:`, error);
    throw error;
  }
};
