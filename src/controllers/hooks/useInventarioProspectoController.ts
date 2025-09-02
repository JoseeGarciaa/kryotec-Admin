import { useState } from 'react';
import { InventarioProspectoController } from '../InventarioProspectoController';
import { InventarioProspecto, CreateInventarioProspectoData } from '../../models/InventarioProspectoModel';

export const useInventarioProspectoController = () => {
  const [inventario, setInventario] = useState<InventarioProspecto[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Cargar todo el inventario (evitar usar con datasets enormes)
  const loadInventario = async () => {
    setLoading('loading');
    setError(null);
    try {
      const data = await InventarioProspectoController.getAllInventario();
      setInventario(data);
      setTotal(data.length);
      setLoading('idle');
    } catch (err) {
      setError('Error al cargar el inventario');
      setLoading('error');
      console.error('Error loading inventario:', err);
    }
  };

  // Crear inventario
  const createInventario = async (inventarioData: CreateInventarioProspectoData): Promise<InventarioProspecto> => {
    try {
      const newInventario = await InventarioProspectoController.createInventario(inventarioData);
      setInventario(prev => [...prev, newInventario]);
      return newInventario;
    } catch (err) {
      setError('Error al crear el inventario');
      throw err;
    }
  };

  // Actualizar inventario
  const updateInventario = async (id: number, inventarioData: Partial<CreateInventarioProspectoData>): Promise<InventarioProspecto | null> => {
    try {
      const updatedInventario = await InventarioProspectoController.updateInventario(id, inventarioData);
      if (updatedInventario) {
        setInventario(prev => prev.map(inv => inv.inv_id === id ? updatedInventario : inv));
      }
      return updatedInventario;
    } catch (err) {
      setError('Error al actualizar el inventario');
      throw err;
    }
  };

  // Eliminar inventario
  const deleteInventario = async (id: number): Promise<boolean> => {
    try {
      const success = await InventarioProspectoController.deleteInventario(id);
      if (success) {
        setInventario(prev => prev.filter(inv => inv.inv_id !== id));
      }
      return success;
    } catch (err) {
      setError('Error al eliminar el inventario');
      throw err;
    }
  };

  // Obtener inventario por cliente (paginado)
  const getInventarioByCliente = async (clienteId: number, opts?: { limit?: number; offset?: number; search?: string }): Promise<{ total: number; items: InventarioProspecto[] }> => {
    try {
      const res = await InventarioProspectoController.getInventarioByCliente(clienteId, opts);
      // Estado interno opcional si se quiere almacenar en caché la página actual
      setInventario(res.items);
      setTotal(res.total);
      return res;
    } catch (err) {
      setError('Error al obtener inventario del cliente');
      throw err;
    }
  };

  // Nota: ya no cargamos automáticamente todo el inventario al montar para evitar traer 13k filas

  return {
    inventario,
  total,
    loading,
    error,
    loadInventario,
    createInventario,
    updateInventario,
    deleteInventario,
    getInventarioByCliente
  };
};