import { apiClient } from '../services/api';

export interface InventarioProspecto {
  inv_id: number;
  cliente_id: number;
  descripcion?: string;
  producto: string;
  largo_mm: number;
  ancho_mm: number;
  alto_mm: number;
  cantidad: number;
  volumen_total_m3?: number;
  fecha_registro?: Date;
  frecuencia_uso_dia?: string;
  // Campos adicionales para mostrar información del cliente
  nombre_cliente?: string;
}

export type CreateInventarioProspectoData = {
  cliente_id: number;
  descripcion?: string;
  producto: string;
  largo_mm: number;
  ancho_mm: number;
  alto_mm: number;
  cantidad: number;
  frecuencia_uso_dia?: string;
};

export class InventarioProspectoModel {
  static async getAllInventario(): Promise<InventarioProspecto[]> {
    try {
      const response = await apiClient.get('/inventario-prospectos');
      return response.data.map((item: any) => ({
        ...item,
        cliente_id: Number(item.cliente_id),
        largo_mm: Number(item.largo_mm),
        ancho_mm: Number(item.ancho_mm),
        alto_mm: Number(item.alto_mm),
        cantidad: Number(item.cantidad),
        volumen_total_m3: Number(item.volumen_total_m3) || 0,
        fecha_registro: item.fecha_registro ? new Date(item.fecha_registro) : null
      }));
    } catch (error) {
      console.error('Error al obtener inventario de prospectos:', error);
      throw error;
    }
  }

  static async getInventarioById(id: number): Promise<InventarioProspecto | null> {
    try {
      const response = await apiClient.get(`/inventario-prospectos/${id}`);
      const item = response.data;
      return {
        ...item,
        cliente_id: Number(item.cliente_id),
        largo_mm: Number(item.largo_mm),
        ancho_mm: Number(item.ancho_mm),
        alto_mm: Number(item.alto_mm),
        cantidad: Number(item.cantidad),
        volumen_total_m3: Number(item.volumen_total_m3) || 0,
        fecha_registro: item.fecha_registro ? new Date(item.fecha_registro) : null
      };
    } catch (error) {
      console.error(`Error al obtener inventario con ID ${id}:`, error);
      return null;
    }
  }

  static async createInventario(data: CreateInventarioProspectoData): Promise<InventarioProspecto> {
    try {
      const response = await apiClient.post('/inventario-prospectos', data);
      const item = response.data;
      return {
        ...item,
        cliente_id: Number(item.cliente_id),
        largo_mm: Number(item.largo_mm),
        ancho_mm: Number(item.ancho_mm),
        alto_mm: Number(item.alto_mm),
        cantidad: Number(item.cantidad),
        volumen_total_m3: Number(item.volumen_total_m3) || 0,
        fecha_registro: item.fecha_registro ? new Date(item.fecha_registro) : null
      };
    } catch (error) {
      console.error('Error al crear inventario:', error);
      throw error;
    }
  }

  static async updateInventario(id: number, data: Partial<CreateInventarioProspectoData>): Promise<InventarioProspecto | null> {
    try {
      const response = await apiClient.put(`/inventario-prospectos/${id}`, data);
      const item = response.data;
      return {
        ...item,
        cliente_id: Number(item.cliente_id),
        largo_mm: Number(item.largo_mm),
        ancho_mm: Number(item.ancho_mm),
        alto_mm: Number(item.alto_mm),
        cantidad: Number(item.cantidad),
        volumen_total_m3: Number(item.volumen_total_m3) || 0,
        fecha_registro: item.fecha_registro ? new Date(item.fecha_registro) : null
      };
    } catch (error) {
      console.error(`Error al actualizar inventario con ID ${id}:`, error);
      return null;
    }
  }

  static async deleteInventario(id: number): Promise<boolean> {
    try {
      await apiClient.delete(`/inventario-prospectos/${id}`);
      return true;
    } catch (error) {
      console.error(`Error al eliminar inventario con ID ${id}:`, error);
      return false;
    }
  }

  static async getInventarioByCliente(clienteId: number): Promise<InventarioProspecto[]> {
    try {
      const response = await apiClient.get(`/inventario-prospectos/cliente/${clienteId}`);
      return response.data.map((item: any) => ({
        ...item,
        cliente_id: Number(item.cliente_id),
        largo_mm: Number(item.largo_mm),
        ancho_mm: Number(item.ancho_mm),
        alto_mm: Number(item.alto_mm),
        cantidad: Number(item.cantidad),
        volumen_total_m3: Number(item.volumen_total_m3) || 0,
        fecha_registro: item.fecha_registro ? new Date(item.fecha_registro) : null
      }));
    } catch (error) {
      console.error(`Error al obtener inventario del cliente ${clienteId}:`, error);
      throw error;
    }
  }
}