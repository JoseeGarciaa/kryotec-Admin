const { pool } = require('../db');
const cache = require('./utils/cache');

const CLIENTES_CACHE_KEY = 'clientes_prospectos';

const clientesProspectosService = {
  // Obtener todos los clientes prospectos
  getAllClientes: async () => {
    try {
      const query = `
        SELECT 
          cliente_id,
          tipo_identificacion,
          numero_identificacion,
          nombre_cliente,
          tipo_cliente,
          contacto,
          correo,
          telefono,
          estado,
          fecha_registro
        FROM admin_platform.clientes_prospectos
        ORDER BY fecha_registro DESC
      `;
      
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.error('Error al obtener clientes prospectos:', error);
      throw error;
    }
  },

  // Obtener un cliente prospecto por ID
  getClienteById: async (id) => {
    try {
      const query = `
        SELECT 
          cliente_id,
          tipo_identificacion,
          numero_identificacion,
          nombre_cliente,
          tipo_cliente,
          contacto,
          correo,
          telefono,
          estado,
          fecha_registro
        FROM admin_platform.clientes_prospectos
        WHERE cliente_id = $1
      `;
      
      const { rows } = await pool.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error al obtener cliente prospecto:', error);
      throw error;
    }
  },

  // Crear un nuevo cliente prospecto
  createCliente: async (clienteData) => {
    try {
      const {
        tipo_identificacion,
        numero_identificacion,
        nombre_cliente,
        tipo_cliente,
        contacto,
        correo,
        telefono,
        estado
      } = clienteData;

      const query = `
        INSERT INTO admin_platform.clientes_prospectos (
          tipo_identificacion,
          numero_identificacion,
          nombre_cliente,
          tipo_cliente,
          contacto,
          correo,
          telefono,
          estado,
          fecha_registro
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
        RETURNING *
      `;

      const values = [
        tipo_identificacion,
        numero_identificacion,
        nombre_cliente,
        tipo_cliente,
        contacto,
        correo,
        telefono,
        estado
      ];

      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error al crear cliente prospecto:', error);
      throw error;
    }
  },

  // Actualizar un cliente prospecto
  updateCliente: async (id, clienteData) => {
    try {
      const {
        tipo_identificacion,
        numero_identificacion,
        nombre_cliente,
        tipo_cliente,
        contacto,
        correo,
        telefono,
        estado
      } = clienteData;

      const query = `
        UPDATE admin_platform.clientes_prospectos
        SET 
          tipo_identificacion = $1,
          numero_identificacion = $2,
          nombre_cliente = $3,
          tipo_cliente = $4,
          contacto = $5,
          correo = $6,
          telefono = $7,
          estado = $8
        WHERE cliente_id = $9
        RETURNING *
      `;

      const values = [
        tipo_identificacion,
        numero_identificacion,
        nombre_cliente,
        tipo_cliente,
        contacto,
        correo,
        telefono,
        estado,
        id
      ];

      const { rows } = await pool.query(query, values);
      return rows[0] || null;
    } catch (error) {
      console.error('Error al actualizar cliente prospecto:', error);
      throw error;
    }
  },

  // Eliminar un cliente prospecto
  deleteCliente: async (id) => {
    try {
      const query = `
        DELETE FROM admin_platform.clientes_prospectos
        WHERE cliente_id = $1
        RETURNING *
      `;

      const { rows } = await pool.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error al eliminar cliente prospecto:', error);
      throw error;
    }
  }
};

module.exports = clientesProspectosService;
