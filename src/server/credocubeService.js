// Importar la configuración de la base de datos
const pool = require('./config/db');
const cache = require('./utils/cache');

// Constantes para la caché
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const CREDOCUBES_CACHE_KEY = 'all_credocubes';

// Servicio para gestionar modelos de Credocube
const credocubeService = {
  // Obtener todos los modelos de Credocube
  getAllCredocubes: async () => {
    try {
      // Intentar obtener de la caché primero
      return await cache.getOrSet(CREDOCUBES_CACHE_KEY, async () => {
        console.log('Caché miss para credocubes, consultando base de datos');
        const result = await pool.query(
          "SELECT * FROM admin_platform.modelos WHERE tipo = 'Cube' ORDER BY nombre_modelo"
        );
        return result.rows;
      }, CACHE_TTL);
    } catch (error) {
      console.error('Error al obtener modelos de Credocube:', error);
      throw error;
    }
  },

  // Obtener un modelo de Credocube por ID
  getCredocubeById: async (id) => {
    try {
      const result = await pool.query(
        'SELECT * FROM admin_platform.modelos WHERE modelo_id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error(`Error al obtener modelo de Credocube con ID ${id}:`, error);
      throw error;
    }
  },

  // Crear un nuevo modelo de Credocube
  createCredocube: async (credocubeData) => {
    // Verificar que todos los campos requeridos estén presentes
    const requiredFields = [
      'nombre_modelo',
      'volumen_litros'
      // Añade aquí otros campos que sean obligatorios
    ];
    
    const missingFields = requiredFields.filter(field => !credocubeData[field]);
    if (missingFields.length > 0) {
      const error = new Error(`Faltan campos obligatorios: ${missingFields.join(', ')}`);
      console.error('Error de validación:', error.message);
      throw error;
    }

    // Extraer todos los campos del objeto credocubeData
    const {
      nombre_modelo,
      volumen_litros,
      descripcion,
      dim_ext_frente,
      dim_ext_profundo,
      dim_ext_alto,
      dim_int_frente,
      dim_int_profundo,
      dim_int_alto,
      tic_frente,
      tic_alto,
      peso_total_kg,
      tipo
    } = credocubeData;

    // Registrar los datos que se intentan insertar para depuración
    console.log('Intentando crear credocube con datos:', {
      nombre_modelo,
      volumen_litros,
      descripcion: descripcion ? 'presente' : 'ausente',
      dimensiones_ext: `${dim_ext_frente}x${dim_ext_profundo}x${dim_ext_alto}`,
      dimensiones_int: `${dim_int_frente}x${dim_int_profundo}x${dim_int_alto}`,
      tics: `${tic_frente}x${tic_alto}`,
      peso_total_kg,
      tipo
    });

    try {
      const result = await pool.query(
        `INSERT INTO admin_platform.modelos (
          nombre_modelo, volumen_litros, descripcion,
          dim_ext_frente, dim_ext_profundo, dim_ext_alto,
          dim_int_frente, dim_int_profundo, dim_int_alto,
          tic_frente, tic_alto,
          peso_total_kg, tipo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          nombre_modelo, volumen_litros, descripcion,
          dim_ext_frente, dim_ext_profundo, dim_ext_alto,
          dim_int_frente, dim_int_profundo, dim_int_alto,
          tic_frente, tic_alto,
          peso_total_kg, tipo
        ]
      );
      
      console.log('Credocube creado exitosamente:', result.rows[0]);
      
      // Invalidar la caché de credocubes
      cache.del(CREDOCUBES_CACHE_KEY);
      console.log('Caché de credocubes invalidada tras crear nuevo credocube');
      
      return result.rows[0];
    } catch (error) {
      console.error('Error al crear modelo de Credocube:', error);
      console.error('Detalle del error:', error.detail || 'No hay detalles adicionales');
      console.error('Código del error:', error.code || 'No hay código de error');
      console.error('Restricción violada:', error.constraint || 'No hay información sobre restricciones');
      
      // Crear un mensaje de error más descriptivo
      let errorMessage = 'Error al crear modelo de Credocube';
      if (error.code === '23505') {
        errorMessage = 'Ya existe un modelo con ese nombre o identificador';
      } else if (error.code === '23502') {
        errorMessage = 'Falta un campo obligatorio';
      } else if (error.code === '22P02') {
        errorMessage = 'Tipo de dato incorrecto en uno de los campos';
      }
      
      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      throw enhancedError;
    }
  },

  // Actualizar un modelo de Credocube existente
  updateCredocube: async (id, credocubeData) => {
    // Construir la consulta dinámicamente basada en los campos proporcionados
    const fields = Object.keys(credocubeData);
    if (fields.length === 0) {
      throw new Error('No se proporcionaron campos para actualizar');
    }
    
    // Crear la parte SET de la consulta SQL
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = fields.map(field => credocubeData[field]);
    
    // Añadir el ID al final de los valores
    values.push(id);
    
    try {
      const result = await pool.query(
        `UPDATE admin_platform.modelos
         SET ${setClause}
         WHERE modelo_id = $${values.length}
         RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Invalidar la caché de credocubes
      cache.del(CREDOCUBES_CACHE_KEY);
      console.log('Caché de credocubes invalidada tras actualizar credocube');
      
      return result.rows[0];
    } catch (error) {
      console.error(`Error al actualizar modelo de Credocube con ID ${id}:`, error);
      throw error;
    }
  },

  // Eliminar un modelo de Credocube
  deleteCredocube: async (id) => {
    try {
      const result = await pool.query(
        'DELETE FROM admin_platform.modelos WHERE modelo_id = $1 RETURNING *',
        [id]
      );
      
      // Invalidar la caché de credocubes si se eliminó correctamente
      if (result.rows.length > 0) {
        cache.del(CREDOCUBES_CACHE_KEY);
        console.log('Caché de credocubes invalidada tras eliminar credocube');
      }
      
      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error al eliminar modelo de Credocube con ID ${id}:`, error);
      throw error;
    }
  }
};

module.exports = credocubeService;
