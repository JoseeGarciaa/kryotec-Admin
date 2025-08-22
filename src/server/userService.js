// Importar la configuración de la base de datos centralizada
const pool = require('./config/db');

// Servicio de usuarios
const userService = {
  // Obtener todos los usuarios
  getAllUsers: async () => {
    try {
      const result = await pool.query(
        'SELECT * FROM admin_platform.admin_users ORDER BY id'
      );
      return result.rows;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  },

  // Obtener un usuario por ID
  getUserById: async (id) => {
    try {
      const result = await pool.query(
        'SELECT * FROM admin_platform.admin_users WHERE id = $1',
        [id]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error(`Error al obtener usuario con ID ${id}:`, error);
      throw error;
    }
  },

  // Crear un nuevo usuario
  createUser: async (userData) => {
    try {
      const { nombre, correo, telefono, contraseña, rol, activo } = userData;
      const result = await pool.query(
        `INSERT INTO admin_platform.admin_users 
         (nombre, correo, telefono, contraseña, rol, activo) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [nombre, correo, telefono, contraseña, rol, activo]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  },

  // Actualizar un usuario existente
  updateUser: async (id, userData) => {
    try {
      // Construir la consulta de actualización dinámicamente
      const updates = [];
      const values = [];
      let paramCounter = 1;

      // Añadir cada campo a actualizar
      Object.entries(userData).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = $${paramCounter}`);
          values.push(value);
          paramCounter++;
        }
      });

      // Si no hay campos para actualizar, retornar null
      if (updates.length === 0) return null;

      // Añadir el ID al final de los valores
      values.push(id);

      const query = `
        UPDATE admin_platform.admin_users 
        SET ${updates.join(', ')} 
        WHERE id = $${paramCounter} 
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error(`Error al actualizar usuario con ID ${id}:`, error);
      throw error;
    }
  },

  // Eliminar un usuario (desactivar)
  deleteUser: async (id) => {
    try {
      // En lugar de eliminar, marcamos como inactivo
      const result = await pool.query(
        'UPDATE admin_platform.admin_users SET activo = false WHERE id = $1 RETURNING id',
        [id]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error al eliminar usuario con ID ${id}:`, error);
      throw error;
    }
  },

  // Actualizar último ingreso
  updateLastLogin: async (id) => {
    try {
      const result = await pool.query(
        'UPDATE admin_platform.admin_users SET ultimo_ingreso = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
        [id]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error al actualizar último ingreso del usuario con ID ${id}:`, error);
      throw error;
    }
  }
};

module.exports = userService;
