import { apiClient } from '../services/api';

export interface ClienteProspecto {
  cliente_id: number;
  tipo_identificacion: string;
  numero_identificacion: string;
  nombre_cliente: string;
  tipo_cliente: string;
  contacto: string;
  correo: string;
  telefono: string;
  estado: string;
  fecha_registro: Date;
}

export type CreateClienteProspectoData = {
  tipo_identificacion: string;
  numero_identificacion: string;
  nombre_cliente: string;
  tipo_cliente: string;
  contacto: string;
  correo: string;
  telefono: string;
  estado: string;
};

export class ClienteProspectoModel {
  static async getAllClientes(): Promise<ClienteProspecto[]> {
    try {
      const response = await apiClient.get('/clientes-prospectos');
      return response.data.map((cliente: any) => ({
        ...cliente,
        fecha_registro: cliente.fecha_registro ? new Date(cliente.fecha_registro) : null
      }));
    } catch (error) {
      console.error('Error al obtener clientes prospectos:', error);
      throw error;
    }
  }

  static async getClienteById(id: number): Promise<ClienteProspecto | null> {
    try {
      const response = await apiClient.get(`/clientes-prospectos/${id}`);
      const cliente = response.data;
      return {
        ...cliente,
        fecha_registro: cliente.fecha_registro ? new Date(cliente.fecha_registro) : null
      };
    } catch (error) {
      console.error(`Error al obtener cliente prospecto con ID ${id}:`, error);
      return null;
    }
  }

  static async createCliente(clienteData: CreateClienteProspectoData): Promise<ClienteProspecto> {
    try {
      const response = await apiClient.post('/clientes-prospectos', clienteData);
      const cliente = response.data;
      return {
        ...cliente,
        fecha_registro: cliente.fecha_registro ? new Date(cliente.fecha_registro) : null
      };
    } catch (error) {
      console.error('Error al crear cliente prospecto:', error);
      throw error;
    }
  }

  static async updateCliente(id: number, clienteData: Partial<CreateClienteProspectoData>): Promise<ClienteProspecto | null> {
    try {
      const response = await apiClient.put(`/clientes-prospectos/${id}`, clienteData);
      const cliente = response.data;
      return {
        ...cliente,
        fecha_registro: cliente.fecha_registro ? new Date(cliente.fecha_registro) : null
      };
    } catch (error) {
      console.error(`Error al actualizar cliente prospecto con ID ${id}:`, error);
      return null;
    }
  }

  static async deleteCliente(id: number): Promise<boolean> {
    try {
      await apiClient.delete(`/clientes-prospectos/${id}`);
      return true;
    } catch (error) {
      console.error(`Error al eliminar cliente prospecto con ID ${id}:`, error);
      return false;
    }
  }
}
