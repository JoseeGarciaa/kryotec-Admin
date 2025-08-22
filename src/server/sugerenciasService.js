const pool = require('./config/db');

const sugerenciasService = {
  // Obtener todas las sugerencias
  getAllSugerencias: async () => {
    try {
      const query = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.inv_id, s.modelo_sugerido,
          s.cantidad_sugerida, s.modalidad, s.fecha_sugerencia, 
          s.modelo_id, s.estado,
          c.nombre_cliente,
          m.nombre_modelo, m.volumen_litros,
          i.descripcion as item_descripcion, i.largo_mm, i.ancho_mm, i.alto_mm
        FROM admin_platform.sugerencias_reemplazo s
        LEFT JOIN admin_platform.clientes_prospectos c ON s.cliente_id = c.cliente_id
        LEFT JOIN admin_platform.modelos m ON s.modelo_id = m.modelo_id
        LEFT JOIN admin_platform.inventario_prospecto i ON s.inv_id = i.inv_id
        ORDER BY s.fecha_sugerencia DESC
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
          cliente_id, inv_id, modelo_sugerido, cantidad_sugerida, 
          modalidad, modelo_id, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const values = [
        data.cliente_id, data.inv_id, data.modelo_sugerido,
        data.cantidad_sugerida, data.modalidad || 'alquiler',
        data.modelo_id, data.estado || 'pendiente'
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
      console.log('Dimensiones recibidas:', dimensiones);
      
      const { frente_m, profundo_m, alto_m } = dimensiones;
      
      if (!frente_m || !profundo_m || !alto_m) {
        throw new Error('Faltan dimensiones requeridas: frente_m, profundo_m, alto_m');
      }
      
      // Calcular volumen requerido en metros cúbicos
      const volumenRequerido = parseFloat(frente_m) * parseFloat(profundo_m) * parseFloat(alto_m);
      console.log('Volumen requerido calculado:', volumenRequerido, 'm³');
      
      // Buscar modelos que puedan satisfacer el volumen requerido
      const query = `
        SELECT 
          modelo_id, nombre_modelo, volumen_litros,
          largo_mm, ancho_mm, alto_mm, precio_alquiler_mes
        FROM admin_platform.modelos
        WHERE volumen_litros >= $1
        ORDER BY volumen_litros ASC
        LIMIT 10
      `;
      
      const volumenRequeridoLitros = volumenRequerido * 1000; // Convertir m³ a litros
      const { rows: modelos } = await pool.query(query, [volumenRequeridoLitros]);
      
      if (modelos.length === 0) {
        return {
          volumen_requerido_m3: volumenRequerido,
          sugerencias: [],
          mensaje: 'No se encontraron modelos que satisfagan el volumen requerido'
        };
      }
      
      // Calcular sugerencias para cada modelo
      const sugerencias = modelos.map(modelo => {
        const volumenModeloM3 = modelo.volumen_litros / 1000;
        const cantidadSugerida = Math.ceil(volumenRequerido / volumenModeloM3);
        const volumenTotalSugerido = cantidadSugerida * volumenModeloM3;
        const eficiencia = ((volumenRequerido / volumenTotalSugerido) * 100).toFixed(2);
        
        return {
          modelo_id: modelo.modelo_id,
          nombre_modelo: modelo.nombre_modelo,
          volumen_unitario_litros: modelo.volumen_litros,
          cantidad_sugerida: cantidadSugerida,
          volumen_total_sugerido_m3: volumenTotalSugerido.toFixed(3),
          eficiencia_porcentaje: parseFloat(eficiencia),
          precio_alquiler_mes: modelo.precio_alquiler_mes,
          dimensiones_mm: {
            largo: modelo.largo_mm,
            ancho: modelo.ancho_mm,
            alto: modelo.alto_mm
          }
        };
      });
      
      return {
        volumen_requerido_m3: volumenRequerido,
        sugerencias: sugerencias
      };
      
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