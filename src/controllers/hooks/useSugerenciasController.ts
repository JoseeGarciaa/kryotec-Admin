import { useState, useEffect } from 'react';
import { SugerenciasController } from '../SugerenciasController';
import { SugerenciaReemplazo, CreateSugerenciaData, CalculoSugerencia, ResultadoSugerencia } from '../../models/SugerenciasModel';

export const useSugerenciasController = () => {
  const [sugerencias, setSugerencias] = useState<SugerenciaReemplazo[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Cargar todas las sugerencias
  const loadSugerencias = async () => {
    setLoading('loading');
    setError(null);
    try {
      const data = await SugerenciasController.getAllSugerencias();
      setSugerencias(data);
      setLoading('idle');
    } catch (err) {
      setError('Error al cargar las sugerencias');
      setLoading('error');
      console.error('Error loading sugerencias:', err);
    }
  };

  // Cargar sugerencias paginadas
  const loadSugerenciasPaginated = async (opts?: { limit?: number; offset?: number; search?: string; clienteId?: number | null; numero?: string | null }) => {
    setLoading('loading');
    setError(null);
    try {
  const res = await SugerenciasController.getSugerenciasPaginated(opts);
      setSugerencias(res.items);
      setTotal(res.total);
      setLoading('idle');
      return res;
    } catch (err) {
      setError('Error al cargar las sugerencias');
      setLoading('error');
      console.error('Error loading sugerencias paginadas:', err);
      throw err;
    }
  };

  const loadSugerenciasPorNumero = async (numero: string) => {
    setLoading('loading'); setError(null);
    try {
      const items = await SugerenciasController.getSugerenciasPorNumero(numero);
      setSugerencias(items); setTotal(items.length); setLoading('idle');
      return items;
    } catch (err) {
      setError('Error al cargar por número'); setLoading('error'); throw err;
    }
  };

  // Calcular sugerencias
  const calcularSugerencias = async (calculo: CalculoSugerencia): Promise<ResultadoSugerencia[]> => {
    try {
      console.log('Hook: Enviando datos de cálculo:', calculo);
      const resultado = await SugerenciasController.calcularSugerencias(calculo);
      console.log('Hook: Resultado recibido:', resultado);
      return resultado;
    } catch (err) {
      console.error('Hook: Error al calcular sugerencias:', err);
      setError('Error al calcular sugerencias');
      throw err;
    }
  };

  // Crear sugerencia
  const createSugerencia = async (sugerenciaData: CreateSugerenciaData): Promise<SugerenciaReemplazo> => {
    try {
      const newSugerencia = await SugerenciasController.createSugerencia(sugerenciaData);
      setSugerencias(prev => [...prev, newSugerencia]);
      return newSugerencia;
    } catch (err) {
      setError('Error al crear la sugerencia');
      throw err;
    }
  };

  // Actualizar sugerencia
  const updateSugerencia = async (id: number, sugerenciaData: Partial<CreateSugerenciaData>): Promise<SugerenciaReemplazo | null> => {
    try {
      const updatedSugerencia = await SugerenciasController.updateSugerencia(id, sugerenciaData);
      if (updatedSugerencia) {
        setSugerencias(prev => prev.map(s => s.sugerencia_id === id ? updatedSugerencia : s));
      }
      return updatedSugerencia;
    } catch (err) {
      setError('Error al actualizar la sugerencia');
      throw err;
    }
  };

  // Eliminar sugerencia
  const deleteSugerencia = async (id: number): Promise<boolean> => {
    try {
      const success = await SugerenciasController.deleteSugerencia(id);
      if (success) {
        setSugerencias(prev => prev.filter(s => s.sugerencia_id !== id));
      }
      return success;
    } catch (err) {
      setError('Error al eliminar la sugerencia');
      throw err;
    }
  };

  useEffect(() => {
    loadSugerencias();
  }, []);

  return {
    sugerencias,
  total,
    loading,
    error,
    loadSugerencias,
  loadSugerenciasPaginated,
  loadSugerenciasPorNumero,
    calcularSugerencias,
    createSugerencia,
    updateSugerencia,
    deleteSugerencia
  };
};