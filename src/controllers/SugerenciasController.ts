import { SugerenciasModel, SugerenciaReemplazo, CreateSugerenciaData, CalculoSugerencia, ResultadoSugerencia } from '../models/SugerenciasModel';

export class SugerenciasController {
  // Obtener todas las sugerencias
  static async getAllSugerencias(): Promise<SugerenciaReemplazo[]> {
    return await SugerenciasModel.getAllSugerencias();
  }

  // Obtener sugerencias por cliente
  static async getSugerenciasByCliente(clienteId: number): Promise<SugerenciaReemplazo[]> {
    return await SugerenciasModel.getSugerenciasByCliente(clienteId);
  }

  // Calcular sugerencias
  static async calcularSugerencias(calculo: CalculoSugerencia): Promise<ResultadoSugerencia[]> {
    return await SugerenciasModel.calcularSugerencias(calculo);
  }

  // Crear sugerencia
  static async createSugerencia(sugerenciaData: CreateSugerenciaData): Promise<SugerenciaReemplazo> {
    return await SugerenciasModel.createSugerencia(sugerenciaData);
  }

  // Actualizar sugerencia
  static async updateSugerencia(id: number, sugerenciaData: Partial<CreateSugerenciaData>): Promise<SugerenciaReemplazo | null> {
    return await SugerenciasModel.updateSugerencia(id, sugerenciaData);
  }

  // Eliminar sugerencia
  static async deleteSugerencia(id: number): Promise<boolean> {
    return await SugerenciasModel.deleteSugerencia(id);
  }

  // Paginado
  static async getSugerenciasPaginated(opts?: { limit?: number; offset?: number; search?: string; clienteId?: number | null }): Promise<{ total: number; items: SugerenciaReemplazo[] }> {
    return await SugerenciasModel.getSugerenciasPaginated(opts);
  }
}