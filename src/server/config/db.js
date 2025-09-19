const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la conexión a PostgreSQL usando variables de entorno
let dbConfig;

// Si existe DATABASE_URL (proporcionado por Railway), usarlo
if (process.env.DATABASE_URL) {
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Necesario para conexiones SSL en Railway
  };
} else {
  // Configuración manual para desarrollo local
  dbConfig = {
    host: process.env.DB_HOST || '31.97.218.31',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'kryosenseadmin',
    password: process.env.DB_PASSWORD || 'kryosense2025',
  // En rama main apuntamos al esquema/productivo 'kryosense'. En rama DEV se mantiene 'kryosense_test'.
  database: process.env.DB_NAME || 'kryosense',
    ssl: process.env.DB_SSL === 'true' ? true : false,
  };
}

// Añadir configuraciones de rendimiento
dbConfig = {
  ...dbConfig,
  // Optimizaciones para mejorar el rendimiento
  max: 20, // máximo de conexiones en el pool
  idleTimeoutMillis: 30000, // tiempo máximo que una conexión puede estar inactiva (30 segundos)
  connectionTimeoutMillis: 5000, // tiempo máximo para establecer conexión (5 segundos)
  keepAlive: true // mantener conexiones activas para reducir la latencia de reconexiones
};

// Crear el pool con la configuración
const pool = new Pool(dbConfig);

// Aplicar zona horaria por sesión y probar conexión
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'America/Bogota'").catch((e) => {
    console.error('No se pudo establecer zona horaria en la sesión de PostgreSQL:', e);
  });
});

pool.query('SHOW TIMEZONE', (err, res) => {
  if (err) {
    console.error('Error al verificar zona horaria de PostgreSQL:', err);
  } else {
    console.log('Zona horaria de PostgreSQL activa:', res.rows[0]);
  }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error al conectar a PostgreSQL:', err);
  } else {
    console.log('Conexión a PostgreSQL establecida:', res.rows[0]);
  }
});

module.exports = pool;
