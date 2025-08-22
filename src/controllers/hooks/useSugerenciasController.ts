import { useState, useEffect } from 'react';
import { SugerenciasController } from '../SugerenciasController';
import { SugerenciaReemplazo, CreateSugerenciaData, CalculoSugerencia, ResultadoSugerencia } from '../../models/SugerenciasModel';

export const useSugerenciasController = () => {
  const [sugerencias, setSugerencias] = useState<SugerenciaReemplazo[]>([]);
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

  // Calcular sugerencias
  const calcularSugerencias = async (calculo: CalculoSugerencia): Promise<ResultadoSugerencia[]> => {
    try {
      return await SugerenciasController.calcularSugerencias(calculo);
    } catch (err) {
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
    loading,
    error,
    loadSugerencias,
    calcularSugerencias,
    createSugerencia,
    updateSugerencia,
    deleteSugerencia
  };
};