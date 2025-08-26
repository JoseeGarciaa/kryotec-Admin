import { apiClient } from '../services/api';

export interface InventarioProspecto {
  inv_id: number;
  cliente_id: number;
  descripcion_producto?: string;
  producto: string;
  largo_mm: number;
  ancho_mm: number;
  alto_mm: number;
  cantidad_despachada: number;
  fecha_de_despacho?: Date;
  volumen_total_m3_producto?: number;
  orden_despacho?: string;
  fecha_registro?: Date;
  // Campos adicionales para mostrar información del cliente
  nombre_cliente?: string;
}

export type CreateInventarioProspectoData = {
  cliente_id: number;
  descripcion_producto?: string;
  producto: string;
  largo_mm: number;
  ancho_mm: number;
  alto_mm: number;
  cantidad_despachada: number;
  fecha_de_despacho?: string;
  orden_despacho?: string;
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
        cantidad_despachada: Number(item.cantidad_despachada),
        volumen_total_m3_producto: Number(item.volumen_total_m3_producto) || 0,
        fecha_registro: item.fecha_registro ? new Date(item.fecha_registro) : null,
        fecha_de_despacho: item.fecha_de_despacho ? new Date(item.fecha_de_despacho) : null
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
        cantidad_despachada: Number(item.cantidad_despachada),
        volumen_total_m3_producto: Number(item.volumen_total_m3_producto) || 0,
        fecha_registro: item.fecha_registro ? new Date(item.fecha_registro) : null,
        fecha_de_despacho: item.fecha_de_despacho ? new Date(item.fecha_de_despacho) : null
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
        cantidad_despachada: Number(item.cantidad_despachada),
        volumen_total_m3_producto: Number(item.volumen_total_m3_producto) || 0,
        fecha_registro: item.fecha_registro ? new Date(item.fecha_registro) : null,
        fecha_de_despacho: item.fecha_de_despacho ? new Date(item.fecha_de_despacho) : null
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
        cantidad_despachada: Number(item.cantidad_despachada),
        volumen_total_m3_producto: Number(item.volumen_total_m3_producto) || 0,
        fecha_registro: item.fecha_registro ? new Date(item.fecha_registro) : null,
        fecha_de_despacho: item.fecha_de_despacho ? new Date(item.fecha_de_despacho) : null
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
        cantidad_despachada: Number(item.cantidad_despachada),
        volumen_total_m3_producto: Number(item.volumen_total_m3_producto) || 0,
        fecha_registro: item.fecha_registro ? new Date(item.fecha_registro) : null,
        fecha_de_despacho: item.fecha_de_despacho ? new Date(item.fecha_de_despacho) : null
      }));
    } catch (error) {
      console.error(`Error al obtener inventario del cliente ${clienteId}:`, error);
      throw error;
    }
  }
}