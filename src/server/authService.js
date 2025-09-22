const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Importar la configuración de la base de datos centralizada
const pool = require('./config/db');

// Función para hashear contraseñas con bcrypt
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Función para comparar contraseñas con bcrypt
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Servicio de autenticación
const authService = {
  // Función para hashear contraseñas (expuesta para uso en otros servicios)
  hashPassword,
  
  // Autenticar usuario
  login: async (correo, contraseña) => {
    try {
      console.log('Intentando login con:', { correo });
      
      // Buscar usuario por correo
      const result = await pool.query(
        'SELECT * FROM admin_platform.admin_users WHERE correo = $1',
        [correo]
      );
      
      console.log('Resultado de la consulta:', { encontrado: result.rows.length > 0 });
      
      // Si no se encuentra el usuario
      if (result.rows.length === 0) {
        return { success: false, message: 'Usuario no encontrado' };
      }
      
      const user = result.rows[0];
      console.log('Usuario encontrado:', { id: user.id, activo: user.activo });
      
      // Verificar si el usuario está activo
      if (!user.activo) {
        return { success: false, message: 'Usuario inactivo' };
      }
      
      // Comparar contraseñas usando bcrypt
      console.log('Verificando contraseña con bcrypt...');
      console.log('Hash almacenado:', user.contraseña);
      
      // Verificar si la contraseña coincide usando bcrypt
      const passwordMatches = await comparePassword(contraseña, user.contraseña);
      console.log('Resultado de la comparación:', { passwordMatches });
      
      if (passwordMatches) {
        // Actualizar último ingreso
        await pool.query(
          'UPDATE admin_platform.admin_users SET ultimo_ingreso = CURRENT_TIMESTAMP WHERE id = $1',
          [user.id]
        );
        
        // Devolver usuario sin contraseña
        const { contraseña: _, ...userWithoutPassword } = user;
        // Generar token JWT
        const payload = {
          sub: user.id,
          correo: user.correo,
          rol: user.rol,
          nombre: user.nombre
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', {
          expiresIn: process.env.JWT_EXPIRES_IN || '8h'
        });
        return { 
          success: true, 
          user: userWithoutPassword,
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '8h'
        };
      } else {
        return { success: false, message: 'Contraseña incorrecta' };
      }
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  },
  
  // Registrar un nuevo usuario (para desarrollo)
  register: async (userData) => {
    try {
      const { nombre, correo, telefono, contraseña, rol } = userData;
      
      // Hashear contraseña con bcrypt
      const hashedPassword = await hashPassword(contraseña);
      
      // Insertar usuario
      const result = await pool.query(
        `INSERT INTO admin_platform.admin_users 
         (nombre, correo, telefono, contraseña, rol, activo) 
         VALUES ($1, $2, $3, $4, $5, true) 
         RETURNING *`,
        [nombre, correo, telefono, hashedPassword, rol]
      );
      
      // Devolver usuario sin contraseña
      const { contraseña: _, ...userWithoutPassword } = result.rows[0];
      return userWithoutPassword;
    } catch (error) {
      console.error('Error en registro:', error);
      throw error;
    }
  },
  
  // Cambiar contraseña
  changePassword: async (userId, oldPassword, newPassword) => {
    try {
      // Verificar contraseña actual
      const userResult = await pool.query(
        'SELECT contraseña FROM admin_platform.admin_users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return { success: false, message: 'Usuario no encontrado' };
      }
      
      const currentHashedPassword = userResult.rows[0].contraseña;
      
      // Verificar si la contraseña actual es correcta usando bcrypt
      const passwordMatches = await comparePassword(oldPassword, currentHashedPassword);
      
      if (!passwordMatches) {
        return { success: false, message: 'Contraseña actual incorrecta' };
      }
      
      // Actualizar contraseña con nuevo hash bcrypt
      const newHashedPassword = await hashPassword(newPassword);
      await pool.query(
        'UPDATE admin_platform.admin_users SET contraseña = $1 WHERE id = $2',
        [newHashedPassword, userId]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      throw error;
    }
  }
};

module.exports = authService;
