import { apiClient } from '../services/api';

export interface Prospecto {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  estado: 'activo' | 'inactivo';
  fecha_creacion: Date;
  ultima_actualizacion: Date;
}

export class ProspectoModel {
  static async getProspectos(): Promise<Prospecto[]> {
    try {
      const response = await apiClient.get('/prospectos');
      return response.data.map((prospecto: any) => ({
        ...prospecto,
        fecha_creacion: new Date(prospecto.fecha_creacion),
        ultima_actualizacion: new Date(prospecto.ultima_actualizacion)
      }));
    } catch (error) {
      console.error('Error fetching prospectos:', error);
      return [];
    }
  }

  static async getProspectoById(id: string): Promise<Prospecto | null> {
    try {
      const response = await apiClient.get(`/prospectos/${id}`);
      const prospecto = response.data;
      return {
        ...prospecto,
        fecha_creacion: new Date(prospecto.fecha_creacion),
        ultima_actualizacion: new Date(prospecto.ultima_actualizacion)
      };
    } catch (error) {
      console.error(`Error fetching prospecto with ID ${id}:`, error);
      return null;
    }
  }

  static async createProspecto(data: Omit<Prospecto, 'id' | 'fecha_creacion' | 'ultima_actualizacion'>): Promise<Prospecto> {
    try {
      const response = await apiClient.post('/prospectos', data);
      const prospecto = response.data;
      return {
        ...prospecto,
        fecha_creacion: new Date(prospecto.fecha_creacion),
        ultima_actualizacion: new Date(prospecto.ultima_actualizacion)
      };
    } catch (error) {
      console.error('Error creating prospecto:', error);
      throw error;
    }
  }

  static async updateProspecto(id: string, data: Partial<Omit<Prospecto, 'id' | 'fecha_creacion'>>): Promise<Prospecto | null> {
    try {
      const response = await apiClient.put(`/prospectos/${id}`, data);
      const prospecto = response.data;
      return {
        ...prospecto,
        fecha_creacion: new Date(prospecto.fecha_creacion),
        ultima_actualizacion: new Date(prospecto.ultima_actualizacion)
      };
    } catch (error) {
      console.error(`Error updating prospecto with ID ${id}:`, error);
      return null;
    }
  }

  static async deleteProspecto(id: string): Promise<boolean> {
    try {
      await apiClient.delete(`/prospectos/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting prospecto with ID ${id}:`, error);
      return false;
    }
  }
}
