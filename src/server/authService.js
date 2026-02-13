const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Importar la configuración de la base de datos centralizada
const pool = require('./config/db');
const { securityPolicy, isPasswordComplex, calculatePasswordExpiry, parseNumber } = require('./utils/securityPolicy');

// Expiración absoluta del token (independiente del timer de inactividad en frontend)
const ABSOLUTE_SESSION_MINUTES = Math.max(
  parseNumber(process.env.SESSION_ABSOLUTE_MINUTES, 720), // 12h por defecto
  securityPolicy.SESSION_TIMEOUT_MINUTES_DEFAULT
);

// Función para hashear contraseñas con bcrypt
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Función para comparar contraseñas con bcrypt
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const normalizeSessionTimeout = (rawTimeout) => {
  const value = Number(rawTimeout);
  if (!Number.isFinite(value) || value <= 0) {
    return securityPolicy.SESSION_TIMEOUT_MINUTES_DEFAULT;
  }
  return Math.max(
    securityPolicy.SESSION_TIMEOUT_MINUTES_MIN,
    Math.min(value, securityPolicy.SESSION_TIMEOUT_MINUTES_MAX)
  );
};

const getPasswordHistory = async (userId, limit = securityPolicy.PASSWORD_HISTORY_LIMIT) => {
  const { rows } = await pool.query(
    `SELECT password_hash, created_at
     FROM admin_platform.admin_user_password_history
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows || [];
};

const recordPasswordHistory = async (userId, role, passwordHash) => {
  if (!userId || !passwordHash) return;
  try {
    await pool.query(
      `INSERT INTO admin_platform.admin_user_password_history (user_id, rol, password_hash)
       VALUES ($1, $2, $3)`,
      [userId, role || null, passwordHash]
    );
  } catch (error) {
    console.error('No se pudo registrar el historial de contraseña:', error);
  }
};

const trimPasswordHistory = async (userId) => {
  try {
    await pool.query(
      `DELETE FROM admin_platform.admin_user_password_history
       WHERE id IN (
         SELECT id
         FROM admin_platform.admin_user_password_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         OFFSET $2
       )`,
      [userId, securityPolicy.PASSWORD_HISTORY_LIMIT]
    );
  } catch (error) {
    console.error('No se pudo depurar el historial de contraseñas:', error);
  }
};

const buildSecurityMetadata = (userRow) => {
  const lockoutUntil = userRow.bloqueado_hasta ? new Date(userRow.bloqueado_hasta) : null;
  const passwordExpiresAt = userRow.contraseña_expira_el ? new Date(userRow.contraseña_expira_el) : null;
  const passwordChangedAt = userRow.ultimo_cambio_contraseña ? new Date(userRow.ultimo_cambio_contraseña) : null;
  const now = new Date();
  let mustChangePassword = Boolean(userRow.debe_cambiar_contraseña);
  let passwordExpired = false;

  if (!mustChangePassword && passwordExpiresAt) {
    passwordExpired = passwordExpiresAt.getTime() <= now.getTime();
    if (passwordExpired) {
      mustChangePassword = true;
    }
  }

  const failedAttempts = userRow.intentos_fallidos || 0;
  const maxFailedAttempts = securityPolicy.MAX_FAILED_ATTEMPTS;
  const remainingAttempts = Math.max(maxFailedAttempts - failedAttempts, 0);

  return {
    failedAttempts,
    maxFailedAttempts,
    remainingAttempts,
    isLocked: Boolean(userRow.bloqueado) || (lockoutUntil ? lockoutUntil > now : false),
    lockoutUntil: lockoutUntil ? lockoutUntil.toISOString() : null,
    mustChangePassword,
    passwordChangedAt: passwordChangedAt ? passwordChangedAt.toISOString() : null,
    passwordExpiresAt: passwordExpiresAt ? passwordExpiresAt.toISOString() : null,
    passwordExpired,
    sessionTimeoutMinutes: normalizeSessionTimeout(userRow.session_timeout_minutos)
  };
};

// Servicio de autenticación
const authService = {
  // Función para hashear contraseñas (expuesta para uso en otros servicios)
  hashPassword,
  buildSecurityMetadata,
  normalizeSessionTimeout,
  
  // Autenticar usuario
  login: async (correo, contraseña) => {
    try {
      console.log('Intentando login con:', { correo });

      const result = await pool.query(
        'SELECT * FROM admin_platform.admin_users WHERE correo = $1',
        [correo]
      );

      if (result.rows.length === 0) {
        return { success: false, message: 'Usuario no encontrado' };
      }

      const user = result.rows[0];

      if (!user.activo) {
        return { success: false, message: 'Usuario inactivo' };
      }

      const now = new Date();
      let isLocked = Boolean(user.bloqueado);
      let lockoutUntil = user.bloqueado_hasta ? new Date(user.bloqueado_hasta) : null;

      if (isLocked && lockoutUntil && lockoutUntil <= now) {
        // Auto desbloqueo al expirar el bloqueo temporal
        await pool.query(
          `UPDATE admin_platform.admin_users
           SET bloqueado = false, bloqueado_hasta = NULL, intentos_fallidos = 0
           WHERE id = $1`,
          [user.id]
        );
        user.bloqueado = false;
        user.bloqueado_hasta = null;
        user.intentos_fallidos = 0;
        isLocked = false;
        lockoutUntil = null;
      }

      if (isLocked) {
        return {
          success: false,
          message: 'Usuario bloqueado por múltiples intentos fallidos. Contacta al administrador.',
          security: buildSecurityMetadata(user)
        };
      }

      const passwordMatches = await comparePassword(contraseña, user.contraseña);

      if (!passwordMatches) {
        const failedAttempts = (user.intentos_fallidos || 0) + 1;
        let locked = false;
        let lockedUntil = lockoutUntil;
        const updates = ['intentos_fallidos = $1'];
        const values = [failedAttempts];

        if (failedAttempts >= securityPolicy.MAX_FAILED_ATTEMPTS) {
          locked = true;
          updates.push('bloqueado = true');
          if (securityPolicy.LOCKOUT_MINUTES > 0) {
            lockedUntil = new Date(now.getTime() + securityPolicy.LOCKOUT_MINUTES * 60000);
            updates.push('bloqueado_hasta = $2');
            values.push(lockedUntil);
          } else {
            updates.push('bloqueado_hasta = NULL');
          }
        }

        await pool.query(
          `UPDATE admin_platform.admin_users
           SET ${updates.join(', ')}
           WHERE id = $${values.length + 1}`,
          [...values, user.id]
        );

        const securityInfo = buildSecurityMetadata({
          ...user,
          intentos_fallidos: failedAttempts,
          bloqueado: locked,
          bloqueado_hasta: lockedUntil
        });

        return {
          success: false,
          message: 'Contraseña incorrecta',
          security: securityInfo
        };
      }

      // Contraseña válida → resetear estado de bloqueo
      const sessionTimeoutMinutes = normalizeSessionTimeout(user.session_timeout_minutos);
      // El token debe durar bastante más que el timeout de inactividad para no expulsar al usuario activo
      // Se fuerza un mínimo amplio (ABSOLUTE_SESSION_MINUTES, por defecto 12h) y al menos +60 min sobre la inactividad
      const absoluteMinutes = Math.max(ABSOLUTE_SESSION_MINUTES, sessionTimeoutMinutes + 60);
      const expiresInCfg = `${absoluteMinutes}m`;
      const expiresAtDate = calculatePasswordExpiry(
        user.ultimo_cambio_contraseña || now
      );

      const updateValues = [user.id];
      let setClause = `ultimo_ingreso = (now() AT TIME ZONE 'America/Bogota'), intentos_fallidos = 0, bloqueado = false, bloqueado_hasta = NULL`;

      if (!user.contraseña_expira_el) {
        setClause += ', contraseña_expira_el = $2';
        updateValues.push(expiresAtDate);
        user.contraseña_expira_el = expiresAtDate;
      }

      await pool.query(
        `UPDATE admin_platform.admin_users SET ${setClause} WHERE id = $1`,
        updateValues
      );

      const { contraseña: _, ...userWithoutPassword } = user;

      const payload = {
        sub: user.id,
        correo: user.correo,
        rol: user.rol,
        nombre: user.nombre
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', {
        expiresIn: expiresInCfg
      });

      const securityMeta = buildSecurityMetadata({
        ...user,
        intentos_fallidos: 0,
        bloqueado: false,
        bloqueado_hasta: null,
        contraseña_expira_el: user.contraseña_expira_el || expiresAtDate
      });

      return {
        success: true,
        user: userWithoutPassword,
        token,
        expiresIn: expiresInCfg,
        security: {
          ...securityMeta,
          sessionTimeoutMinutes
        }
      };
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  },
  
  // Registrar un nuevo usuario (para desarrollo)
  register: async (userData) => {
    try {
      const {
        nombre,
        correo,
        telefono,
        contraseña,
        rol,
        activo = true,
        session_timeout_minutos
      } = userData;

      const storedRole = rol === 'comercial' ? 'soporte' : rol;

      if (!isPasswordComplex(contraseña)) {
        const message = `La contraseña debe tener al menos ${securityPolicy.MIN_PASSWORD_LENGTH} caracteres, incluir mayúsculas, minúsculas, números y caracteres especiales.`;
        const error = new Error(message);
        error.code = 'PASSWORD_WEAK';
        throw error;
      }

      if (storedRole === 'admin') {
        const { rows } = await pool.query(
          "SELECT COUNT(*)::int AS count FROM admin_platform.admin_users WHERE rol = 'admin'"
        );
        const activeAdmins = rows?.[0]?.count ?? 0;
        if (activeAdmins >= 2) {
          const error = new Error('Solo se permiten 2 administradores activos.');
          error.code = 'ADMIN_LIMIT';
          throw error;
        }
      }

      const hashedPassword = await hashPassword(contraseña);
      const sessionTimeout = normalizeSessionTimeout(session_timeout_minutos);
      const passwordExpiresAt = calculatePasswordExpiry();

      const result = await pool.query(
        `INSERT INTO admin_platform.admin_users 
         (nombre, correo, telefono, contraseña, rol, activo, fecha_creacion, intentos_fallidos, bloqueado, bloqueado_hasta, debe_cambiar_contraseña, ultimo_cambio_contraseña, contraseña_expira_el, session_timeout_minutos) 
         VALUES ($1, $2, $3, $4, $5, $6, (now() AT TIME ZONE 'America/Bogota'), 0, false, NULL, true, NULL, $7, $8) 
         RETURNING *`,
        [nombre, correo, telefono, hashedPassword, storedRole, activo, passwordExpiresAt, sessionTimeout]
      );

      const newUser = result.rows[0];
      await recordPasswordHistory(newUser.id, storedRole, hashedPassword);
      await trimPasswordHistory(newUser.id);

      const { contraseña: _, ...userWithoutPassword } = newUser;
      if (userWithoutPassword.rol === 'soporte') {
        userWithoutPassword.rol = 'comercial';
      }
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
        'SELECT contraseña, rol FROM admin_platform.admin_users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return { success: false, message: 'Usuario no encontrado' };
      }
      
      const currentHashedPassword = userResult.rows[0].contraseña;
      const currentRole = userResult.rows[0].rol;

      if (!isPasswordComplex(newPassword)) {
        return {
          success: false,
          message: `La contraseña debe tener al menos ${securityPolicy.MIN_PASSWORD_LENGTH} caracteres e incluir mayúsculas, minúsculas, números y caracteres especiales.`
        };
      }
      
      // Verificar si la contraseña actual es correcta usando bcrypt
      const passwordMatches = await comparePassword(oldPassword, currentHashedPassword);
      
      if (!passwordMatches) {
        return { success: false, message: 'Contraseña actual incorrecta' };
      }

      const isSameAsCurrent = await comparePassword(newPassword, currentHashedPassword);
      if (isSameAsCurrent) {
        return { success: false, message: 'La nueva contraseña no puede ser igual a la actual.' };
      }

      const history = await getPasswordHistory(userId);
      for (const entry of history) {
        const wasUsed = await comparePassword(newPassword, entry.password_hash);
        if (wasUsed) {
          return { success: false, message: 'La nueva contraseña no puede ser igual a las utilizadas recientemente.' };
        }
      }
      
      // Actualizar contraseña con nuevo hash bcrypt
      const newHashedPassword = await hashPassword(newPassword);
      const passwordExpiresAt = calculatePasswordExpiry();
      await pool.query(
        `UPDATE admin_platform.admin_users
         SET contraseña = $1,
             ultimo_cambio_contraseña = (now() AT TIME ZONE 'America/Bogota'),
             contraseña_expira_el = $2,
             debe_cambiar_contraseña = false,
             intentos_fallidos = 0,
             bloqueado = false,
             bloqueado_hasta = NULL
         WHERE id = $3`,
        [newHashedPassword, passwordExpiresAt, userId]
      );

      await recordPasswordHistory(userId, currentRole, newHashedPassword);
      await trimPasswordHistory(userId);
      
      return {
        success: true,
        security: {
          mustChangePassword: false,
          passwordExpiresAt: passwordExpiresAt.toISOString(),
          passwordExpired: false
        }
      };
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      throw error;
    }
  }
  ,
  adminResetPassword: async (userId, newPassword) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, rol FROM admin_platform.admin_users WHERE id = $1',
        [userId]
      );

      if (!rows.length) {
        return { success: false, message: 'Usuario no encontrado' };
      }

      if (!isPasswordComplex(newPassword)) {
        return {
          success: false,
          message: `La contraseña debe tener al menos ${securityPolicy.MIN_PASSWORD_LENGTH} caracteres e incluir mayúsculas, minúsculas, números y caracteres especiales.`
        };
      }

      const hashedPassword = await hashPassword(newPassword);
      const passwordExpiresAt = calculatePasswordExpiry();

      await pool.query(
        `UPDATE admin_platform.admin_users
         SET contraseña = $1,
             ultimo_cambio_contraseña = NULL,
             debe_cambiar_contraseña = true,
             contraseña_expira_el = $2,
             intentos_fallidos = 0,
             bloqueado = false,
             bloqueado_hasta = NULL
         WHERE id = $3`,
        [hashedPassword, passwordExpiresAt, userId]
      );

      await recordPasswordHistory(userId, rows[0].rol, hashedPassword);
      await trimPasswordHistory(userId);

      return {
        success: true,
        security: {
          mustChangePassword: true,
          passwordExpiresAt: passwordExpiresAt.toISOString(),
          passwordExpired: false
        }
      };
    } catch (error) {
      console.error('Error al restablecer contraseña (admin):', error);
      throw error;
    }
  }
};

module.exports = authService;
