import { InventarioProspectoModel, InventarioProspecto, CreateInventarioProspectoData } from '../models/InventarioProspectoModel';

export class InventarioProspectoController {
  static async getAllInventario(): Promise<InventarioProspecto[]> {
    try {
      return await InventarioProspectoModel.getAllInventario();
    } catch (error) {
      console.error('Error en el controlador al obtener inventario:', error);
      throw error;
    }
  }

  static async getInventarioById(id: number): Promise<InventarioProspecto | null> {
    try {
      return await InventarioProspectoModel.getInventarioById(id);
    } catch (error) {
      console.error('Error en el controlador al obtener inventario:', error);
      throw error;
    }
  }

  static async createInventario(data: CreateInventarioProspectoData): Promise<InventarioProspecto> {
    try {
      return await InventarioProspectoModel.createInventario(data);
    } catch (error) {
      console.error('Error en el controlador al crear inventario:', error);
      throw error;
    }
  }

  static async updateInventario(id: number, data: Partial<CreateInventarioProspectoData>): Promise<InventarioProspecto | null> {
    try {
      return await InventarioProspectoModel.updateInventario(id, data);
    } catch (error) {
      console.error('Error en el controlador al actualizar inventario:', error);
      throw error;
    }
  }

  static async deleteInventario(id: number): Promise<boolean> {
    try {
      return await InventarioProspectoModel.deleteInventario(id);
    } catch (error) {
      console.error('Error en el controlador al eliminar inventario:', error);
      throw error;
    }
  }

  static async getInventarioByCliente(clienteId: number): Promise<InventarioProspecto[]> {
    try {
      return await InventarioProspectoModel.getInventarioByCliente(clienteId);
    } catch (error) {
      console.error('Error en el controlador al obtener inventario por cliente:', error);
      throw error;
    }
  }
}