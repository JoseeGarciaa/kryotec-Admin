const pool = require('./config/db'); // Importación directa del pool
const { hashPassword } = require('./authService');
const cache = require('./utils/cache');

// Constantes para la caché
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const TENANTS_CACHE_KEY = 'all_tenants';

/**
 * Obtiene todos los tenants de la base de datos
 * @returns {Promise<Array>} Lista de tenants
 */
const getAllTenants = async () => {
  try {
    // Intentar obtener de la caché primero
    return await cache.getOrSet(TENANTS_CACHE_KEY, async () => {
      console.log('Caché miss para tenants, consultando base de datos');
      const result = await pool.query(`
        SELECT id, nombre, nit, email_contacto, telefono_contacto, direccion, 
               estado, fecha_creacion, ultimo_ingreso, esquema
        FROM admin_platform.tenants
        ORDER BY nombre ASC
      `);
      return result.rows;
    }, CACHE_TTL);
  } catch (error) {
    console.error('Error al obtener tenants:', error);
    throw error;
  }
};

/**
 * Obtiene un tenant por su ID
 * @param {number} id - ID del tenant
 * @returns {Promise<Object>} Datos del tenant
 */
const getTenantById = async (id) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre, nit, email_contacto, telefono_contacto, direccion, 
             estado, fecha_creacion, ultimo_ingreso, esquema
      FROM admin_platform.tenants
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Empresa no encontrada');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error(`Error al obtener tenant con ID ${id}:`, error);
    throw error;
  }
};

/**
 * Crea un nuevo tenant
 * @param {Object} tenantData - Datos del tenant a crear
 * @returns {Promise<Object>} Tenant creado
 */
const createTenant = async (tenantData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Hashear la contraseña
    const hashedPassword = await hashPassword(tenantData.contraseña);
    
    console.log('Datos del tenant a crear:', {
      nombre: tenantData.nombre,
      nit: tenantData.nit,
      email: tenantData.email_contacto,
      telefono: tenantData.telefono_contacto,
      esquema: tenantData.esquema
    });
    
    // Primero insertamos el registro en la tabla tenants
    const result = await client.query(`
      INSERT INTO admin_platform.tenants (
        nombre, nit, email_contacto, telefono_contacto, direccion, 
        estado, contraseña, esquema
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, nombre, nit, email_contacto, telefono_contacto, direccion, 
                estado, fecha_creacion, ultimo_ingreso, esquema
    `, [
      tenantData.nombre,
      tenantData.nit,
      tenantData.email_contacto,
      tenantData.telefono_contacto,
      tenantData.direccion,
      tenantData.estado,
      hashedPassword,
      tenantData.esquema
    ]);
    
    // Luego llamamos a la función para crear el esquema del tenant
    console.log(`Ejecutando función admin_platform.crear_tenant con parámetros:`);
    console.log(`- Esquema: ${tenantData.esquema}`);
    console.log(`- Nombre: ${tenantData.nombre}`);
    console.log(`- Email: ${tenantData.email_contacto}`);
    console.log(`- Teléfono: ${tenantData.telefono_contacto}`);
    
    // Ejecutar la función de base de datos directamente
    const createSchemaResult = await client.query(
      'SELECT admin_platform.crear_tenant($1, $2, $3, $4, $5)',
      [
        tenantData.esquema,
        tenantData.nombre,
        tenantData.email_contacto,
        tenantData.telefono_contacto || '',  // Aseguramos que no sea null
        hashedPassword
      ]
    );
    
    console.log('Resultado de crear_tenant:', createSchemaResult.rows[0]);
    
    // Preparamos las credenciales del usuario administrador para devolverlas
    const adminCredentials = {
      usuario: tenantData.email_contacto,
      contraseña: tenantData.contraseña // Devolvemos la contraseña sin hashear
    };
    
    // Añadimos las credenciales al resultado
    const tenantWithCredentials = {
      ...result.rows[0],
      adminCredentials
    };
    
    await client.query('COMMIT');
    
    // Invalidar la caché de tenants
    cache.del(TENANTS_CACHE_KEY);
    console.log('Caché de tenants invalidada tras crear nuevo tenant');
    
    return tenantWithCredentials;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear tenant:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Actualiza un tenant existente
 * @param {number} id - ID del tenant a actualizar
 * @param {Object} tenantData - Datos actualizados del tenant
 * @returns {Promise<Object>} Tenant actualizado
 */
const updateTenant = async (id, tenantData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Obtener el tenant actual antes de actualizarlo para tener el esquema original
    const currentTenantResult = await client.query(
      'SELECT esquema, nombre FROM admin_platform.tenants WHERE id = $1',
      [id]
    );
    
    if (currentTenantResult.rows.length === 0) {
      throw new Error('Empresa no encontrada');
    }
    
    const currentTenant = currentTenantResult.rows[0];
    const originalSchema = currentTenant.esquema;
    
    // Construir la consulta dinámicamente basada en los campos proporcionados
    let updateFields = [];
    let queryParams = [];
    let paramIndex = 1;
    
    // Guardar el esquema original y el nuevo esquema para usarlos más tarde
    let newSchema = originalSchema; // Por defecto, asumimos que no cambia
    
    // Si se está actualizando el nombre, generamos un nuevo nombre de esquema
    if (tenantData.nombre !== undefined) {
      // Generar el nuevo nombre de esquema basado en el nuevo nombre
      newSchema = `tenant_${tenantData.nombre.toLowerCase().replace(/\s+/g, '_')}`;
      console.log(`Nombre cambiado de "${currentTenant.nombre}" a "${tenantData.nombre}"`);  
      console.log(`Esquema cambiado de "${originalSchema}" a "${newSchema}"`);  
    }
    
    // Mapeo de campos a actualizar
    const fieldMap = {
      nombre: 'nombre',
      nit: 'nit',
      email_contacto: 'email_contacto',
      telefono_contacto: 'telefono_contacto',
      direccion: 'direccion',
      estado: 'estado'
    };
    
    // Agregar campos a la consulta si están presentes
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (tenantData[key] !== undefined) {
        updateFields.push(`${dbField} = $${paramIndex}`);
        queryParams.push(tenantData[key]);
        paramIndex++;
      }
    }
    
    // Si el esquema ha cambiado, actualizamos el campo esquema en la base de datos
    if (originalSchema !== newSchema) {
      updateFields.push(`esquema = $${paramIndex}`);
      queryParams.push(newSchema);
      paramIndex++;
    }
    
    // Si se proporciona una nueva contraseña, hashearla y agregarla a la consulta
    if (tenantData.contraseña) {
      const hashedPassword = await hashPassword(tenantData.contraseña);
      updateFields.push(`contraseña = $${paramIndex}`);
      queryParams.push(hashedPassword);
      paramIndex++;
    }
    
    // Si no hay campos para actualizar, retornar el tenant sin cambios
    if (updateFields.length === 0) {
      const result = await client.query(`
        SELECT id, nombre, nit, email_contacto, telefono_contacto, direccion, 
               estado, fecha_creacion, ultimo_ingreso, esquema
        FROM admin_platform.tenants
        WHERE id = $1
      `, [id]);
      
      await client.query('COMMIT');
      return result.rows[0];
    }
    
    // Agregar el ID como último parámetro
    queryParams.push(id);
    
    const result = await client.query(`
      UPDATE admin_platform.tenants
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, nombre, nit, email_contacto, telefono_contacto, direccion, 
                estado, fecha_creacion, ultimo_ingreso, esquema
    `, queryParams);
    
    if (result.rows.length === 0) {
      throw new Error('Empresa no encontrada');
    }
    
    // Llamar a la función para actualizar el esquema del tenant
    const updatedTenant = result.rows[0];
    console.log(`Ejecutando función admin_platform.actualizar_tenant con parámetros:`);
    console.log(`- Esquema actual: ${updatedTenant.esquema}`);
    console.log(`- Esquema nuevo: ${updatedTenant.esquema}`);
    console.log(`- Nombre: ${updatedTenant.nombre}`);
    console.log(`- Email: ${updatedTenant.email_contacto}`);
    console.log(`- Teléfono: ${updatedTenant.telefono_contacto}`);
    
    // Obtener la contraseña hasheada (si se proporcionó una nueva) o la actual
    let hashedPassword;
    if (tenantData.contraseña) {
      hashedPassword = queryParams.find((param, index) => {
        return updateFields[index] && updateFields[index].startsWith('contraseña');
      });
    } else {
      // Si no se proporcionó una nueva contraseña, obtenemos la actual de la base de datos
      const passwordResult = await client.query(
        'SELECT contraseña FROM admin_platform.tenants WHERE id = $1',
        [id]
      );
      hashedPassword = passwordResult.rows[0].contraseña;
    }
    
    // Verificar si el esquema original existe en la base de datos
    const schemaExistsResult = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = $1
      ) AS schema_exists`,
      [originalSchema]
    );
    
    const schemaExists = schemaExistsResult.rows[0].schema_exists;
    
    if (!schemaExists) {
      console.log(`El esquema original ${originalSchema} no existe en la base de datos.`);
      console.log(`Se creará un nuevo esquema con el nombre ${newSchema}.`);
      
      try {
        // Si el esquema original no existe, creamos uno nuevo con el nombre actualizado
        const createSchemaResult = await client.query(
          'SELECT admin_platform.crear_tenant($1, $2, $3, $4, $5)',
          [
            newSchema,
            updatedTenant.nombre,
            updatedTenant.email_contacto,
            updatedTenant.telefono_contacto || '',
            hashedPassword
          ]
        );
        console.log('Resultado de crear_tenant:', createSchemaResult.rows[0]);
      } catch (createError) {
        console.error(`Error al crear esquema ${newSchema}:`, createError);
      }
    } else {
      // El esquema original existe, procedemos a actualizarlo
      console.log(`Actualizando esquema de ${originalSchema} a ${newSchema}`);
      console.log(`Parámetros de actualización:`);
      console.log(`- Esquema original: ${originalSchema}`);
      console.log(`- Esquema nuevo: ${newSchema}`);
      console.log(`- Nombre: ${updatedTenant.nombre}`);
      console.log(`- Email: ${updatedTenant.email_contacto}`);
      console.log(`- Teléfono: ${updatedTenant.telefono_contacto}`);
      
      try {
        // Verificamos si el nombre del esquema ha cambiado
        if (originalSchema !== newSchema) {
          console.log(`El nombre del esquema ha cambiado de ${originalSchema} a ${newSchema}. Renombrando esquema...`);
          
          // Llamamos a la función para renombrar el esquema
          const updateSchemaResult = await client.query(
            'SELECT admin_platform.actualizar_tenant($1, $2, $3, $4, $5, $6)',
            [
              originalSchema,                  // esquema original
              newSchema,                      // esquema nuevo
              updatedTenant.nombre,
              updatedTenant.email_contacto,
              updatedTenant.telefono_contacto || '',  // Aseguramos que no sea null
              hashedPassword
            ]
          );
          console.log('Resultado de actualizar_tenant (renombrar esquema):', updateSchemaResult.rows[0]);
        } else {
          // Si el nombre del esquema no ha cambiado, solo actualizamos los datos
          console.log(`El nombre del esquema no ha cambiado. Actualizando datos del esquema ${originalSchema}...`);
          
          const updateSchemaResult = await client.query(
            'SELECT admin_platform.actualizar_tenant($1, $2, $3, $4, $5, $6)',
            [
              originalSchema,                  // esquema original
              originalSchema,                  // esquema nuevo (igual al original)
              updatedTenant.nombre,
              updatedTenant.email_contacto,
              updatedTenant.telefono_contacto || '',  // Aseguramos que no sea null
              hashedPassword
            ]
          );
          console.log('Resultado de actualizar_tenant (actualizar datos):', updateSchemaResult.rows[0]);
        }
      } catch (schemaError) {
        console.error(`Error al actualizar esquema de ${originalSchema} a ${newSchema}:`, schemaError);
        // Continuamos con la transacción aunque falle la actualización del esquema
        // para no perder los cambios en la tabla de tenants
      }
    }
    
    await client.query('COMMIT');
    
    // Invalidar la caché de tenants
    cache.del(TENANTS_CACHE_KEY);
    console.log('Caché de tenants invalidada tras actualizar tenant');
    
    return updatedTenant;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error al actualizar tenant con ID ${id}:`, error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Elimina un tenant por su ID
 * @param {number} id - ID del tenant a eliminar
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
const deleteTenant = async (id) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Primero obtenemos el esquema del tenant que vamos a eliminar
    const tenantResult = await client.query(
      'SELECT esquema, nombre FROM admin_platform.tenants WHERE id = $1',
      [id]
    );
    
    if (tenantResult.rows.length === 0) {
      throw new Error('Empresa no encontrada');
    }
    
    const tenantSchema = tenantResult.rows[0].esquema;
    const tenantNombre = tenantResult.rows[0].nombre;
    
    console.log(`Eliminando tenant ${tenantNombre} (ID: ${id}) con esquema: ${tenantSchema}`);
    
    try {
      // Intentamos eliminar el esquema usando la función admin_platform.eliminar_tenant
      console.log(`Ejecutando función admin_platform.eliminar_tenant('${tenantSchema}')`);
      await client.query('SELECT admin_platform.eliminar_tenant($1)', [tenantSchema]);
      console.log(`Esquema ${tenantSchema} eliminado correctamente`);
    } catch (schemaError) {
      // Si falla la eliminación del esquema, registramos el error pero continuamos
      console.error(`Error al eliminar esquema ${tenantSchema}:`, schemaError);
      console.log('Continuando con la eliminación del registro del tenant...');
    }
    
    // Eliminamos el registro del tenant de la tabla admin_platform.tenants
    const result = await client.query(`
      DELETE FROM admin_platform.tenants
      WHERE id = $1
      RETURNING id
    `, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('No se pudo eliminar el registro de la empresa');
    }
    
    console.log(`Registro del tenant con ID ${id} eliminado correctamente`);
    
    await client.query('COMMIT');
    
    // Invalidar la caché de tenants
    cache.del(TENANTS_CACHE_KEY);
    console.log('Caché de tenants invalidada tras eliminar tenant');
    
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error al eliminar tenant con ID ${id}:`, error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant
};
