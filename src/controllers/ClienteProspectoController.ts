import { ClienteProspectoModel, ClienteProspecto, CreateClienteProspectoData } from '../models/ClienteProspectoModel';

export class ClienteProspectoController {
  static async getAllClientes(): Promise<ClienteProspecto[]> {
    try {
      return await ClienteProspectoModel.getAllClientes();
    } catch (error) {
      console.error('Error en el controlador al obtener clientes:', error);
      throw error;
    }
  }

  static async getClienteById(id: number): Promise<ClienteProspecto | null> {
    try {
      return await ClienteProspectoModel.getClienteById(id);
    } catch (error) {
      console.error('Error en el controlador al obtener cliente:', error);
      throw error;
    }
  }

  static async createCliente(data: CreateClienteProspectoData): Promise<ClienteProspecto> {
    try {
      return await ClienteProspectoModel.createCliente(data);
    } catch (error) {
      console.error('Error en el controlador al crear cliente:', error);
      throw error;
    }
  }

  static async updateCliente(id: number, data: Partial<CreateClienteProspectoData>): Promise<ClienteProspecto | null> {
    try {
      return await ClienteProspectoModel.updateCliente(id, data);
    } catch (error) {
      console.error('Error en el controlador al actualizar cliente:', error);
      throw error;
    }
  }

  static async deleteCliente(id: number): Promise<boolean> {
    try {
      return await ClienteProspectoModel.deleteCliente(id);
    } catch (error) {
      console.error('Error en el controlador al eliminar cliente:', error);
      throw error;
    }
  }
}
