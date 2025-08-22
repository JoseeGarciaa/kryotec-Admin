const pool = require('./config/db');

const inventarioProspectosService = {
  getAllInventario: async () => {
    try {
      const query = `
        SELECT 
          i.inv_id, i.cliente_id, i.descripcion, i.material,
          i.largo_mm, i.ancho_mm, i.alto_mm, i.cantidad,
          i.volumen_total_m3, i.fecha_registro, i.frecuencia_uso_dia,
          c.nombre_cliente
        FROM admin_platform.inventario_prospecto i
        LEFT JOIN admin_platform.clientes_prospectos c ON i.cliente_id = c.cliente_id
        ORDER BY i.fecha_registro DESC
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.error('Error al obtener inventario:', error);
      throw error;
    }
  },

  createInventario: async (data) => {
    try {
      // Calcular volumen total en m³
      const volumen_total_m3 = (data.largo_mm * data.ancho_mm * data.alto_mm * data.cantidad) / 1000000000;
      
      const query = `
        INSERT INTO admin_platform.inventario_prospecto (
          cliente_id, descripcion, material, largo_mm, ancho_mm, 
          alto_mm, cantidad, volumen_total_m3, frecuencia_uso_dia
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const values = [data.cliente_id, data.descripcion, data.material, 
                     data.largo_mm, data.ancho_mm, data.alto_mm, 
                     data.cantidad, volumen_total_m3, data.frecuencia_uso_dia];
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error al crear inventario:', error);
      throw error;
    }
  },

  updateInventario: async (id, data) => {
    try {
      const query = `
        UPDATE admin_platform.inventario_prospecto
        SET cliente_id = $1, descripcion = $2, material = $3,
            largo_mm = $4, ancho_mm = $5, alto_mm = $6,
            cantidad = $7, frecuencia_uso_dia = $8
        WHERE inv_id = $9 RETURNING *
      `;
      const values = [data.cliente_id, data.descripcion, data.material,
                     data.largo_mm, data.ancho_mm, data.alto_mm,
                     data.cantidad, data.frecuencia_uso_dia, id];
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error al actualizar inventario:', error);
      throw error;
    }
  },

  deleteInventario: async (id) => {
    try {
      const query = 'DELETE FROM admin_platform.inventario_prospecto WHERE inv_id = $1 RETURNING *';
      const { rows } = await pool.query(query, [id]);
      return rows[0];
    } catch (error) {
      console.error('Error al eliminar inventario:', error);
      throw error;
    }
  }
};

module.exports = inventarioProspectosService;