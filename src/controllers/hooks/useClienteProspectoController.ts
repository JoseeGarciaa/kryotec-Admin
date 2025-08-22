import { useState, useEffect, useCallback } from 'react';
import { ClienteProspecto, CreateClienteProspectoData } from '../../models/ClienteProspectoModel';
import { ClienteProspectoController } from '../ClienteProspectoController';

export const useClienteProspectoController = () => {
  const [clientes, setClientes] = useState<ClienteProspecto[]>([]);
  const [loading, setLoading] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchClientes = useCallback(async () => {
    setLoading('loading');
    try {
      const data = await ClienteProspectoController.getAllClientes();
      setClientes(data);
      setError(null);
      setLoading('success');
    } catch (err) {
      console.error('Error al cargar clientes:', err);
      setError('Error al cargar los clientes');
      setLoading('error');
    }
  }, []);

  const createCliente = async (data: CreateClienteProspectoData) => {
    try {
      await ClienteProspectoController.createCliente(data);
      await fetchClientes(); // Recargar la lista después de crear
      return true;
    } catch (err) {
      console.error('Error al crear cliente:', err);
      throw err;
    }
  };

  const updateCliente = async (id: number, data: Partial<CreateClienteProspectoData>) => {
    try {
      await ClienteProspectoController.updateCliente(id, data);
      await fetchClientes(); // Recargar la lista después de actualizar
      return true;
    } catch (err) {
      console.error('Error al actualizar cliente:', err);
      throw err;
    }
  };

  const deleteCliente = async (id: number) => {
    try {
      await ClienteProspectoController.deleteCliente(id);
      await fetchClientes(); // Recargar la lista después de eliminar
      return true;
    } catch (err) {
      console.error('Error al eliminar cliente:', err);
      throw err;
    }
  };

  // Cargar clientes al montar el componente
  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  return {
    clientes,
    loading,
    error,
    fetchClientes,
    createCliente,
    updateCliente,
    deleteCliente
  };
};
