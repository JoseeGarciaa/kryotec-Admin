const pool = require('../config/db');
const { securityPolicy } = require('./securityPolicy');

const ensureSecurityInfrastructure = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE admin_platform.admin_users
      ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS debe_cambiar_contraseña BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS ultimo_cambio_contraseña TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS contraseña_expira_el TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS session_timeout_minutos INTEGER NULL,
      ADD COLUMN IF NOT EXISTS ultimo_recordatorio_expiracion TIMESTAMPTZ NULL
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_platform.admin_user_password_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES admin_platform.admin_users(id) ON DELETE CASCADE,
        rol TEXT,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota')
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_user_password_history_user
      ON admin_platform.admin_user_password_history(user_id, created_at DESC)
    `);

    await client.query(`
      UPDATE admin_platform.admin_users
      SET session_timeout_minutos = $1
      WHERE session_timeout_minutos IS NULL
    `, [securityPolicy.SESSION_TIMEOUT_MINUTES_DEFAULT]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('No se pudo aplicar la infraestructura de seguridad requerida:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { ensureSecurityInfrastructure };
