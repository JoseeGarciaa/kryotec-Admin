const pool = require('./config/db');
const format = require('pg-format');

// Helper: redondea a 2 decimales números válidos
const fix2 = (n) => Math.round(Number(n || 0) * 100) / 100;

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
    // Asegurar hasta 2 decimales en dimensiones para evitar acumulación de ruido
  const largo = fix2(data.largo_mm);
  const ancho = fix2(data.ancho_mm);
  const alto = fix2(data.alto_mm);
  const cantidad = Math.round(Number(data.cantidad_despachada || 0));
  const volumenTotal = (largo * ancho * alto * cantidad) / 1000000000;
      
      const query = `
        INSERT INTO admin_platform.inventario_prospecto (
          cliente_id, descripcion_producto, producto, largo_mm, ancho_mm, 
          alto_mm, cantidad_despachada, fecha_de_despacho, orden_despacho, volumen_total_m3_producto, fecha_registro
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, (now() at time zone 'America/Bogota'))
        RETURNING *
      `;
  const values = [data.cliente_id, data.descripcion_producto, data.producto, 
    largo, ancho, alto, 
    cantidad, (data.fecha_de_despacho || null), data.orden_despacho, volumenTotal];
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
  const largoU = fix2(data.largo_mm);
  const anchoU = fix2(data.ancho_mm);
  const altoU = fix2(data.alto_mm);
  const cantidadU = Math.round(Number(data.cantidad_despachada || 0));
  const volumenTotal = (largoU * anchoU * altoU * cantidadU) / 1000000000;
      
      const query = `
        UPDATE admin_platform.inventario_prospecto
        SET cliente_id = $1, descripcion_producto = $2, producto = $3,
            largo_mm = $4, ancho_mm = $5, alto_mm = $6,
            cantidad_despachada = $7, fecha_de_despacho = $8, orden_despacho = $9, volumen_total_m3_producto = $10
        WHERE inv_id = $11 RETURNING *
      `;
  const values = [data.cliente_id, data.descripcion_producto, data.producto,
    largoU, anchoU, altoU,
    cantidadU, (data.fecha_de_despacho || null), data.orden_despacho, volumenTotal, id];
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

  // Obtener inventario por cliente (para deduplicación en importaciones)
  getInventarioByCliente: async (clienteId, options = {}) => {
    try {
      const { limit = 200, offset = 0, search = '' } = options;
      const params = [clienteId];
      let where = `WHERE i.cliente_id = $1`;
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (LOWER(i.producto) LIKE LOWER($${params.length}) OR LOWER(i.descripcion_producto) LIKE LOWER($${params.length}))`;
      }
      const countQuery = `SELECT COUNT(*)::int as total FROM admin_platform.inventario_prospecto i ${where}`;
      const dataQuery = `
        SELECT 
          i.inv_id, i.cliente_id, i.descripcion_producto, i.producto,
          i.largo_mm, i.ancho_mm, i.alto_mm, i.cantidad_despachada,
          i.volumen_total_m3_producto, i.fecha_registro, i.fecha_de_despacho,
          i.orden_despacho, c.nombre_cliente
        FROM admin_platform.inventario_prospecto i
        LEFT JOIN admin_platform.clientes_prospectos c ON i.cliente_id = c.cliente_id
        ${where}
        ORDER BY i.fecha_registro DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      const { rows: countRows } = await pool.query(countQuery, params);
      const total = countRows[0]?.total || 0;
      const { rows } = await pool.query(dataQuery, [...params, limit, offset]);
      return { total, items: rows };
    } catch (error) {
      console.error('Error al obtener inventario por cliente:', error);
      throw error;
    }
  },

  // Inserción masiva para importaciones
  bulkInsertInventario: async (items) => {
    if (!items || items.length === 0) return [];
    try {
      const rows = items.map(it => [
        it.cliente_id,
        it.descripcion_producto || null,
        it.producto,
        it.largo_mm,
        it.ancho_mm,
        it.alto_mm,
        it.cantidad_despachada,
        it.fecha_de_despacho || null,
        it.orden_despacho || null,
        // volumen total calculado
        (it.largo_mm * it.ancho_mm * it.alto_mm * it.cantidad_despachada) / 1000000000
      ]);

      // Insertar y fijar fecha_registro en hora de Bogotá para todas las filas, casteando tipos explícitamente
      const query = format(`
        INSERT INTO admin_platform.inventario_prospecto (
          cliente_id, descripcion_producto, producto, largo_mm, ancho_mm, alto_mm,
          cantidad_despachada, fecha_de_despacho, orden_despacho, volumen_total_m3_producto, fecha_registro
        )
        SELECT 
          (v.cliente_id)::int,
          (v.descripcion_producto)::text,
          (v.producto)::text,
          (v.largo_mm)::numeric,
          (v.ancho_mm)::numeric,
          (v.alto_mm)::numeric,
          (v.cantidad_despachada)::int,
          NULLIF(v.fecha_de_despacho, '')::date,
          (v.orden_despacho)::text,
          (v.volumen_total_m3_producto)::numeric,
          (now() at time zone 'America/Bogota')
        FROM (VALUES %L) AS v (
          cliente_id, descripcion_producto, producto, largo_mm, ancho_mm, alto_mm,
          cantidad_despachada, fecha_de_despacho, orden_despacho, volumen_total_m3_producto
        )
        RETURNING *
      `, rows);

      const { rows: inserted } = await pool.query(query);
      return inserted;
    } catch (error) {
      console.error('Error en inserción masiva de inventario:', error);
      throw error;
    }
  },

  // Obtener órdenes de despacho con paginación, búsqueda y filtro por rango de fechas
  getOrdenesDespacho: async (clienteId = null, options = {}) => {
    try {
      const { limit = 200, offset = 0, search = '', startDate = null, endDate = null } = options;
      const params = [];
      let where = `WHERE orden_despacho IS NOT NULL AND orden_despacho != ''`;
      if (clienteId) {
        params.push(clienteId);
        where += ` AND cliente_id = $${params.length}`;
      }
      // Filtro por rango de fechas (fecha_de_despacho)
      if (startDate && endDate) {
        params.push(startDate);
        params.push(endDate);
        where += ` AND fecha_de_despacho::date BETWEEN $${params.length - 1}::date AND $${params.length}::date`;
      } else if (startDate) {
        params.push(startDate);
        where += ` AND fecha_de_despacho::date >= $${params.length}::date`;
      } else if (endDate) {
        params.push(endDate);
        where += ` AND fecha_de_despacho::date <= $${params.length}::date`;
      }
      if (search) {
        params.push(`%${search}%`);
        where += ` AND LOWER(orden_despacho) LIKE LOWER($${params.length})`;
      }
      // total de órdenes únicas
      const countQuery = `SELECT COUNT(DISTINCT orden_despacho)::int as total FROM admin_platform.inventario_prospecto ${where}`;
      const { rows: countRows } = await pool.query(countQuery, params);
      const total = countRows[0]?.total || 0;

      // datos agregados por orden
      const dataQuery = `
        SELECT orden_despacho, 
               COUNT(*) as cantidad_productos,
               SUM(cantidad_despachada) as total_productos,
               CAST(SUM(volumen_total_m3_producto) AS DECIMAL) as volumen_total
        FROM admin_platform.inventario_prospecto 
        ${where}
        GROUP BY orden_despacho
        ORDER BY orden_despacho
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      const { rows } = await pool.query(dataQuery, [...params, limit, offset]);

      const items = rows.map(row => ({
        ...row,
        cantidad_productos: parseInt(row.cantidad_productos),
        total_productos: parseInt(row.total_productos),
        volumen_total: parseFloat(row.volumen_total)
      }));

      return { total, items };
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