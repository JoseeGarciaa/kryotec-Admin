const pool = require('./config/db');

const inventarioProspectosService = {
  getAllInventario: async () => {
    try {
      const query = `
        SELECT 
          i.inv_id, i.cliente_id, i.descripcion_producto, i.producto,
          i.largo_mm, i.ancho_mm, i.alto_mm, i.cantidad_despachada,
          i.volumen_total_m3_producto, i.fecha_registro, i.fecha_de_despacho,
          i.orden_despacho, c.nombre_cliente
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
      // Calcular volumen total en m³ (misma fórmula que la calculadora)
      const volumenTotal = (data.largo_mm * data.ancho_mm * data.alto_mm * data.cantidad_despachada) / 1000000000;
      
      const query = `
        INSERT INTO admin_platform.inventario_prospecto (
          cliente_id, descripcion_producto, producto, largo_mm, ancho_mm, 
          alto_mm, cantidad_despachada, fecha_de_despacho, orden_despacho, volumen_total_m3_producto
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      const values = [data.cliente_id, data.descripcion_producto, data.producto, 
                     data.largo_mm, data.ancho_mm, data.alto_mm, 
                     data.cantidad_despachada, data.fecha_de_despacho, data.orden_despacho, volumenTotal];
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error al crear inventario:', error);
      throw error;
    }
  },

  updateInventario: async (id, data) => {
    try {
      // Calcular volumen total en m³ al actualizar
      const volumenTotal = (data.largo_mm * data.ancho_mm * data.alto_mm * data.cantidad_despachada) / 1000000000;
      
      const query = `
        UPDATE admin_platform.inventario_prospecto
        SET cliente_id = $1, descripcion_producto = $2, producto = $3,
            largo_mm = $4, ancho_mm = $5, alto_mm = $6,
            cantidad_despachada = $7, fecha_de_despacho = $8, orden_despacho = $9, volumen_total_m3_producto = $10
        WHERE inv_id = $11 RETURNING *
      `;
      const values = [data.cliente_id, data.descripcion_producto, data.producto,
                     data.largo_mm, data.ancho_mm, data.alto_mm,
                     data.cantidad_despachada, data.fecha_de_despacho, data.orden_despacho, volumenTotal, id];
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
  },

  // Obtener todas las órdenes de despacho únicas
  getOrdenesDespacho: async () => {
    try {
      const query = `
        SELECT DISTINCT orden_despacho, 
               COUNT(*) as cantidad_productos,
               SUM(cantidad_despachada) as total_productos,
               CAST(SUM(volumen_total_m3_producto) AS DECIMAL) as volumen_total
        FROM admin_platform.inventario_prospecto 
        WHERE orden_despacho IS NOT NULL AND orden_despacho != ''
        GROUP BY orden_despacho
        ORDER BY orden_despacho
      `;
      const { rows } = await pool.query(query);
      
      // Asegurar que los números sean números
      const processedRows = rows.map(row => ({
        ...row,
        cantidad_productos: parseInt(row.cantidad_productos),
        total_productos: parseInt(row.total_productos),
        volumen_total: parseFloat(row.volumen_total)
      }));
      
      return processedRows;
    } catch (error) {
      console.error('Error al obtener órdenes de despacho:', error);
      throw error;
    }
  },

  // Obtener productos por orden de despacho
  getProductosPorOrden: async (ordenDespacho) => {
    try {
      const query = `
        SELECT 
          i.inv_id, i.cliente_id, i.descripcion_producto, i.producto,
          i.largo_mm, i.ancho_mm, i.alto_mm, i.cantidad_despachada,
          i.volumen_total_m3_producto, i.fecha_registro, i.fecha_de_despacho,
          i.orden_despacho, c.nombre_cliente
        FROM admin_platform.inventario_prospecto i
        LEFT JOIN admin_platform.clientes_prospectos c ON i.cliente_id = c.cliente_id
        WHERE i.orden_despacho = $1
        ORDER BY i.fecha_registro DESC
      `;
      const { rows } = await pool.query(query, [ordenDespacho]);
      return rows;
    } catch (error) {
      console.error('Error al obtener productos por orden:', error);
      throw error;
    }
  }
};

module.exports = inventarioProspectosService;