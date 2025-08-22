const pool = require('./config/db');

const sugerenciasService = {
  // Obtener todas las sugerencias
  getAllSugerencias: async () => {
    try {
      const query = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.volumen_requerido_m3,
          s.frente_m, s.profundo_m, s.alto_m, s.fecha_calculo,
          s.modelo_sugerido_id, s.cantidad_sugerida, s.eficiencia_porcentaje,
          c.nombre_cliente,
          m.nombre_modelo, m.volumen_litros
        FROM admin_platform.sugerencias_reemplazo s
        LEFT JOIN admin_platform.clientes_prospectos c ON s.cliente_id = c.cliente_id
        LEFT JOIN admin_platform.modelos m ON s.modelo_sugerido_id = m.modelo_id
        ORDER BY s.fecha_calculo DESC
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.error('Error al obtener sugerencias:', error);
      throw error;
    }
  },

  // Crear una nueva sugerencia
  createSugerencia: async (data) => {
    try {
      const query = `
        INSERT INTO admin_platform.sugerencias_reemplazo (
          cliente_id, volumen_requerido_m3, frente_m, profundo_m, alto_m,
          modelo_sugerido_id, cantidad_sugerida, eficiencia_porcentaje
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const values = [
        data.cliente_id, data.volumen_requerido_m3, data.frente_m,
        data.profundo_m, data.alto_m, data.modelo_sugerido_id,
        data.cantidad_sugerida, data.eficiencia_porcentaje
      ];
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error al crear sugerencia:', error);
      throw error;
    }
  },

  // Calcular sugerencias basadas en dimensiones
  calcularSugerencias: async (dimensiones) => {
    try {
      const volumenRequerido = dimensiones.frente_m * dimensiones.profundo_m * dimensiones.alto_m;
      
      // Buscar modelos que puedan satisfacer el volumen requerido
      const query = `
        SELECT 
          modelo_id, nombre_modelo, volumen_litros,
          largo_exterior_mm, ancho_exterior_mm, alto_exterior_mm
        FROM admin_platform.modelos
        WHERE volumen_litros >= $1
        ORDER BY volumen_litros ASC
        LIMIT 10
      `;
      
      const { rows } = await pool.query(query, [volumenRequerido * 1000]); // Convertir m3 a litros
      
      // Calcular eficiencia y cantidad sugerida para cada modelo
      const sugerencias = rows.map(modelo => {
        const volumenModeloM3 = modelo.volumen_litros / 1000;
        const cantidadSugerida = Math.ceil(volumenRequerido / volumenModeloM3);
        const volumenTotalSugerido = cantidadSugerida * volumenModeloM3;
        const eficiencia = (volumenRequerido / volumenTotalSugerido) * 100;
        
        return {
          ...modelo,
          cantidad_sugerida: cantidadSugerida,
          eficiencia_porcentaje: Math.round(eficiencia * 100) / 100,
          volumen_total_sugerido_m3: volumenTotalSugerido
        };
      });
      
      return sugerencias;
    } catch (error) {
      console.error('Error al calcular sugerencias:', error);
      throw error;
    }
  },

  // Eliminar una sugerencia
  deleteSugerencia: async (id) => {
    try {
      const query = 'DELETE FROM admin_platform.sugerencias_reemplazo WHERE sugerencia_id = $1 RETURNING *';
      const { rows } = await pool.query(query, [id]);
      return rows[0];
    } catch (error) {
      console.error('Error al eliminar sugerencia:', error);
      throw error;
    }
  }
};

module.exports = sugerenciasService;