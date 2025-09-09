const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./config/db');
const userService = require('./userService');
const authService = require('./authService');
const credocubeService = require('./credocubeService');
const tenantService = require('./tenantService');
const clientesProspectosService = require('./clientesProspectosService');
const clientesProspectosRoutes = require('./routes/clientesProspectosRoutes'); // Agregar esta línea
const inventarioProspectosService = require('./inventarioProspectosService');
const sugerenciasService = require('./sugerenciasService');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3002; // Cambiado a 3002 para evitar conflictos

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || '*'] 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());

// Multer setup for Excel uploads (in-memory)
const upload = multer({ storage: multer.memoryStorage() });

// Registrar las rutas de clientes-prospectos
app.use('/api/clientes-prospectos', clientesProspectosRoutes); // Agregar esta línea

// Endpoint de verificación de salud para Railway
app.get('/api/health', async (req, res) => {
  try {
    // Verificar conexión a la base de datos
    const dbResult = await pool.query('SELECT NOW()');
    res.status(200).json({ 
      status: 'ok', 
      message: 'Kryotec API is running', 
      database: 'connected',
      timestamp: dbResult.rows[0].now
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Kryotec API is running but database connection failed',
      error: error.message
    });
  }
});

// Rutas para usuarios
app.get('/api/users', async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error en GET /api/users:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await userService.getUserById(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error(`Error en GET /api/users/${req.params.id}:`, error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    // Usar el servicio de autenticación para crear usuarios con hash bcrypt
    const newUser = await authService.register(req.body);
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error en POST /api/users:', error);
    if (error.code === '23505') { // Código de error de PostgreSQL para violación de clave única
      res.status(409).json({ error: 'El correo electrónico ya está registrado' });
    } else {
      res.status(500).json({ error: 'Error al crear usuario' });
    }
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let userData = req.body;
    
    // Si hay contraseña, usar authService para hashearla
    if (userData.contraseña) {
      // Hashear la contraseña con bcrypt
      userData.contraseña = await authService.hashPassword(userData.contraseña);
    }
    
    const updatedUser = await userService.updateUser(parseInt(id), userData);
    if (updatedUser) {
      res.json(updatedUser);
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  } catch (error) {
    console.error(`Error en PUT /api/users/${req.params.id}:`, error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const success = await userService.deleteUser(parseInt(req.params.id));
    if (!success) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(`Error en DELETE /api/users/${req.params.id}:`, error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Endpoint para obtener el inventario de Credocubes
app.get('/api/inventario-credocubes', async (req, res) => {
  try {
    const query = `
    SELECT
      i.tenant_schema_name,      -- Esquema del tenant
      i.nombre_unidad,           -- Nombre de la unidad
      i.fecha_ingreso,           -- Fecha de ingreso
      i.ultima_actualizacion,    -- Última actualización
      i.activo,                  -- Activo/inactivo
      i.categoria,               -- Categoría registrada en inventario
      i.modelo_id,               -- FK al modelo
      m.volumen_litros,          -- Volumen del modelo (para agrupar por litros)
      m.nombre_modelo AS modelo_nombre, -- Nombre del modelo
      m.tipo AS tipo_modelo      -- Tipo de modelo (esperado 'Cube')
    FROM admin_platform.inventario_credocubes i
    LEFT JOIN admin_platform.modelos m ON m.modelo_id = i.modelo_id
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener inventario de Credocubes:', error);
    res.status(500).json({ error: 'Error al obtener datos del inventario' });
  }
});

// Endpoint para refrescar el inventario de Credocubes
app.post('/api/refresh-inventario-credocubes', async (req, res) => {
  try {
    console.log('Ejecutando función para refrescar inventario de Credocubes');
    const query = `SELECT admin_platform.refresh_inventario_credocubes_global()`;
    await pool.query(query);
    console.log('Inventario de Credocubes actualizado correctamente');
    res.json({ success: true, message: 'Inventario actualizado correctamente' });
  } catch (error) {
    console.error('Error al refrescar inventario de Credocubes:', error);
    res.status(500).json({ error: 'Error al actualizar el inventario' });
  }
});

// Endpoint alternativo para refrescar el inventario de Credocubes (para compatibilidad)
app.get('/api/refresh-inventario-credocubes', async (req, res) => {
  try {
    console.log('Ejecutando función para refrescar inventario de Credocubes (GET)');
    const query = `SELECT admin_platform.refresh_inventario_credocubes_global()`;
    await pool.query(query);
    console.log('Inventario de Credocubes actualizado correctamente (GET)');
    res.json({ success: true, message: 'Inventario actualizado correctamente' });
  } catch (error) {
    console.error('Error al refrescar inventario de Credocubes (GET):', error);
    res.status(500).json({ error: 'Error al actualizar el inventario' });
  }
});

app.put('/api/users/:id/login', async (req, res) => {
  try {
    const success = await userService.updateLastLogin(parseInt(req.params.id));
    if (!success) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(`Error en PUT /api/users/${req.params.id}/login:`, error);
    res.status(500).json({ error: 'Error al actualizar último ingreso' });
  }
});

// Rutas de autenticación
app.post('/api/auth/login', async (req, res) => {
  try {
    const { correo, contraseña } = req.body;
    
    if (!correo || !contraseña) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }
    
    const result = await authService.login(correo, contraseña);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error en POST /api/auth/login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;
    
    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    const result = await authService.changePassword(userId, oldPassword, newPassword);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error en POST /api/auth/change-password:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// Rutas para Credocubes
app.get('/api/credocubes', async (req, res) => {
  try {
    const credocubes = await credocubeService.getAllCredocubes();
    res.json(credocubes);
  } catch (error) {
    console.error('Error en GET /api/credocubes:', error);
    res.status(500).json({ error: 'Error al obtener modelos de Credocube' });
  }
});

app.get('/api/credocubes/:id', async (req, res) => {
  try {
    const credocube = await credocubeService.getCredocubeById(parseInt(req.params.id));
    if (!credocube) {
      return res.status(404).json({ error: 'Modelo de Credocube no encontrado' });
    }
    res.json(credocube);
  } catch (error) {
    console.error(`Error en GET /api/credocubes/${req.params.id}:`, error);
    res.status(500).json({ error: 'Error al obtener modelo de Credocube' });
  }
});

app.post('/api/credocubes', async (req, res) => {
  try {
    const newCredocube = await credocubeService.createCredocube(req.body);
    res.status(201).json(newCredocube);
  } catch (error) {
    console.error('Error en POST /api/credocubes:', error);
    res.status(500).json({ error: 'Error al crear modelo de Credocube' });
  }
});

app.put('/api/credocubes/:id', async (req, res) => {
  try {
    const updatedCredocube = await credocubeService.updateCredocube(parseInt(req.params.id), req.body);
    if (!updatedCredocube) {
      return res.status(404).json({ error: 'Modelo de Credocube no encontrado' });
    }
    res.json(updatedCredocube);
  } catch (error) {
    console.error(`Error en PUT /api/credocubes/${req.params.id}:`, error);
    res.status(500).json({ error: 'Error al actualizar modelo de Credocube' });
  }
});

app.delete('/api/credocubes/:id', async (req, res) => {
  try {
    const success = await credocubeService.deleteCredocube(parseInt(req.params.id));
    if (!success) {
      return res.status(404).json({ error: 'Modelo de Credocube no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(`Error en DELETE /api/credocubes/${req.params.id}:`, error);
    res.status(500).json({ error: 'Error al eliminar modelo de Credocube' });
  }
});

// Rutas para tenants (empresas)
app.get('/api/tenants', async (req, res) => {
  try {
    const tenants = await tenantService.getAllTenants();
    res.json(tenants);
  } catch (error) {
    console.error('Error en GET /api/tenants:', error);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

app.get('/api/tenants/:id', async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(parseInt(req.params.id));
    res.json(tenant);
  } catch (error) {
    console.error(`Error en GET /api/tenants/${req.params.id}:`, error);
    if (error.message === 'Empresa no encontrada') {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    res.status(500).json({ error: 'Error al obtener empresa' });
  }
});

app.post('/api/tenants', async (req, res) => {
  try {
    const newTenant = await tenantService.createTenant(req.body);
    res.status(201).json(newTenant);
  } catch (error) {
    console.error('Error en POST /api/tenants:', error);
    if (error.code === '23505') { // Código de error de PostgreSQL para violación de clave única
      res.status(409).json({ error: error.message || 'Ya existe una empresa con ese nombre, NIT, email o esquema' });
    } else {
      res.status(500).json({ error: 'Error al crear empresa' });
    }
  }
});

app.put('/api/tenants/:id', async (req, res) => {
  try {
    const updatedTenant = await tenantService.updateTenant(parseInt(req.params.id), req.body);
    res.json(updatedTenant);
  } catch (error) {
    console.error(`Error en PUT /api/tenants/${req.params.id}:`, error);
    if (error.message === 'Empresa no encontrada') {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    } else if (error.code === '23505') {
      res.status(409).json({ error: error.message || 'Ya existe una empresa con ese nombre, NIT, email o esquema' });
    } else {
      res.status(500).json({ error: 'Error al actualizar empresa' });
    }
  }
});

app.delete('/api/tenants/:id', async (req, res) => {
  try {
    const success = await tenantService.deleteTenant(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error(`Error en DELETE /api/tenants/${req.params.id}:`, error);
    if (error.message === 'Empresa no encontrada') {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    res.status(500).json({ error: 'Error al eliminar empresa' });
  }
});

// Rutas para prospectos
app.get('/api/prospectos', async (req, res) => {
  try {
    const prospectos = await clientesProspectosService.getAllProspectos();
    res.json(prospectos);
  } catch (error) {
    console.error('Error en GET /api/prospectos:', error);
    res.status(500).json({ error: 'Error al obtener prospectos' });
  }
});

app.get('/api/prospectos/:id', async (req, res) => {
  try {
    const prospecto = await clientesProspectosService.getProspectoById(parseInt(req.params.id));
    if (!prospecto) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }
    res.json(prospecto);
  } catch (error) {
    console.error(`Error en GET /api/prospectos/${req.params.id}:`, error);
    res.status(500).json({ error: 'Error al obtener prospecto' });
  }
});

app.post('/api/prospectos', async (req, res) => {
  try {
    const newProspecto = await clientesProspectosService.createProspecto(req.body);
    res.status(201).json(newProspecto);
  } catch (error) {
    console.error('Error en POST /api/prospectos:', error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'Ya existe un prospecto con ese documento o email' });
    } else {
      res.status(500).json({ error: 'Error al crear prospecto' });
    }
  }
});

app.put('/api/prospectos/:id', async (req, res) => {
  try {
    const updatedProspecto = await clientesProspectosService.updateProspecto(parseInt(req.params.id), req.body);
    if (!updatedProspecto) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }
    res.json(updatedProspecto);
  } catch (error) {
    console.error(`Error en PUT /api/prospectos/${req.params.id}:`, error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'Ya existe un prospecto con ese documento o email' });
    } else {
      res.status(500).json({ error: 'Error al actualizar prospecto' });
    }
  }
});

app.delete('/api/prospectos/:id', async (req, res) => {
  try {
    const success = await clientesProspectosService.deleteProspecto(parseInt(req.params.id));
    if (!success) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(`Error en DELETE /api/prospectos/${req.params.id}:`, error);
    res.status(500).json({ error: 'Error al eliminar prospecto' });
  }
});

// Rutas de inventario prospectos
app.get('/api/inventario-prospectos', async (req, res) => {
  try {
    const inventario = await inventarioProspectosService.getAllInventario();
    res.json(inventario);
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Inventario por cliente con paginación opcional
app.get('/api/inventario-prospectos/cliente/:clienteId', async (req, res) => {
  try {
    const clienteId = parseInt(req.params.clienteId);
    if (!clienteId) return res.status(400).json({ error: 'clienteId inválido' });
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 1000) : 200; // límite por defecto 200
    const offset = req.query.offset ? Math.max(parseInt(req.query.offset), 0) : 0;
    const search = req.query.search ? String(req.query.search) : '';
    const result = await inventarioProspectosService.getInventarioByCliente(clienteId, { limit, offset, search });
    res.json(result);
  } catch (error) {
    console.error('Error al obtener inventario por cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/inventario-prospectos', async (req, res) => {
  try {
    const nuevoItem = await inventarioProspectosService.createInventario(req.body);
    res.status(201).json(nuevoItem);
  } catch (error) {
    console.error('Error al crear item de inventario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/api/inventario-prospectos/:id', async (req, res) => {
  try {
    const itemActualizado = await inventarioProspectosService.updateInventario(req.params.id, req.body);
    if (itemActualizado) {
      res.json(itemActualizado);
    } else {
      res.status(404).json({ error: 'Item no encontrado' });
    }
  } catch (error) {
    console.error('Error al actualizar item de inventario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar sugerencia
app.delete('/api/inventario-prospectos/:id', async (req, res) => {
  try {
    const inventarioEliminado = await inventarioProspectosService.deleteInventario(req.params.id);
    if (inventarioEliminado) {
      res.json({ message: 'Inventario eliminado exitosamente' });
    } else {
      res.status(404).json({ error: 'Inventario no encontrado' });
    }
  } catch (error) {
    console.error('Error en DELETE /api/inventario-prospectos/:id:', error);
    res.status(500).json({ error: 'Error al eliminar inventario' });
  }
});

// Nuevas rutas para órdenes de despacho
app.get('/api/inventario-prospectos/ordenes-despacho', async (req, res) => {
  try {
  const clienteId = req.query.cliente_id ? parseInt(req.query.cliente_id) : null;
  const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 1000) : 200;
  const offset = req.query.offset ? Math.max(parseInt(req.query.offset), 0) : 0;
  const search = req.query.search ? String(req.query.search) : '';
  const startDate = req.query.startDate ? String(req.query.startDate) : null;
  const endDate = req.query.endDate ? String(req.query.endDate) : null;
  const ordenes = await inventarioProspectosService.getOrdenesDespacho(clienteId, { limit, offset, search, startDate, endDate });
  res.json(ordenes);
  } catch (error) {
    console.error('Error al obtener órdenes de despacho:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Nueva ruta: recomendaciones por rango de fechas, agrupadas por orden
app.post('/api/sugerencias/calcular-por-rango', async (req, res) => {
  try {
    const { cliente_id, startDate, endDate } = req.body || {};
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id es requerido' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos (YYYY-MM-DD)' });

    // Traer órdenes en el rango
    const { items: ordenes } = await inventarioProspectosService.getOrdenesDespacho(parseInt(cliente_id), {
      limit: 1000,
      offset: 0,
      search: '',
      startDate,
      endDate
    });

    const resultados = [];
    for (const ord of ordenes) {
      const orden = ord.orden_despacho;
      const sugerencias = await sugerenciasService.calcularSugerenciasPorOrden({ cliente_id: parseInt(cliente_id), orden_despacho: orden });
      resultados.push({ orden_despacho: orden, resumen: ord, sugerencias });
    }
    res.json({ total_ordenes: ordenes.length, resultados });
  } catch (error) {
    console.error('Error en POST /api/sugerencias/calcular-por-rango:', error);
    res.status(500).json({ error: 'Error al calcular sugerencias por rango de fechas' });
  }
});

// Nueva ruta: recomendaciones agregadas por rango (suma total de m3 en el rango)
app.post('/api/sugerencias/calcular-por-rango-total', async (req, res) => {
  try {
    const { cliente_id, startDate, endDate } = req.body || {};
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id es requerido' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos (YYYY-MM-DD)' });

    const result = await sugerenciasService.calcularSugerenciasPorRangoTotal({
      cliente_id: parseInt(cliente_id),
      startDate,
      endDate
    });
    res.json(result);
  } catch (error) {
    console.error('Error en POST /api/sugerencias/calcular-por-rango-total:', error);
    res.status(500).json({ error: 'Error al calcular sugerencias por rango total' });
  }
});

// Nueva ruta: distribución real (100%) por rango (asigna modelo mínimo por línea)
app.post('/api/sugerencias/distribucion-real-rango', async (req, res) => {
  try {
    const { cliente_id, startDate, endDate } = req.body || {};
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id es requerido' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos (YYYY-MM-DD)' });

    const result = await sugerenciasService.calcularDistribucionRealPorRango({
      cliente_id: parseInt(cliente_id),
      startDate,
      endDate
    });
    res.json(result);
  } catch (error) {
    console.error('Error en POST /api/sugerencias/distribucion-real-rango:', error);
    res.status(500).json({ error: 'Error al calcular distribución real por rango' });
  }
});

// Nueva ruta: proyección mensual (estimado diario futuro)
app.post('/api/sugerencias/proyeccion-mensual', async (req, res) => {
  try {
    const { cliente_id, startDate, endDate, percentil_stock } = req.body || {};
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id es requerido' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos (YYYY-MM-DD)' });
    const result = await sugerenciasService.calcularProyeccionMensual({
      cliente_id: parseInt(cliente_id),
      startDate,
      endDate,
      percentil_stock: percentil_stock || 0.95
    });
    res.json(result);
  } catch (error) {
    console.error('Error en POST /api/sugerencias/proyeccion-mensual:', error);
    res.status(500).json({ error: 'Error al calcular proyección mensual' });
  }
});

// Nueva ruta: agregado orden a orden (toma la mejor opción de cada orden y suma por modelo)
app.post('/api/sugerencias/calcular-por-rango-orden-a-orden', async (req, res) => {
  try {
    const { cliente_id, startDate, endDate } = req.body || {};
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id es requerido' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos (YYYY-MM-DD)' });

    // Calcular días inclusivos
    let totalDias = 1;
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diffMs = e.getTime() - s.getTime();
      const d = Math.floor(diffMs / (1000*60*60*24)) + 1;
      if (d > 0 && Number.isFinite(d)) totalDias = d;
    } catch (e) {
      console.warn('Fallo calculando días, usando 1', e?.message);
    }

    // Traer órdenes (únicas) del rango
    const { items: ordenes } = await inventarioProspectosService.getOrdenesDespacho(parseInt(cliente_id), {
      limit: 10000,
      offset: 0,
      search: '',
      startDate,
      endDate
    });

    // Traer todos los movimientos (filas) para totales reales (independientes de si un modelo cabe o no)
    let totalProductosReales = 0;
    let volumenTotalReales = 0;
    try {
      const movQuery = `
        SELECT cantidad_despachada, volumen_total_m3_producto
        FROM admin_platform.inventario_prospecto
        WHERE cliente_id = $1
          AND fecha_de_despacho::date BETWEEN $2::date AND $3::date
      `;
      const { rows: movs } = await pool.query(movQuery, [parseInt(cliente_id), startDate, endDate]);
      for (const m of movs) {
        totalProductosReales += (parseInt(m.cantidad_despachada) || 0);
        volumenTotalReales += (parseFloat(m.volumen_total_m3_producto) || 0);
      }
    } catch (e) {
      console.warn('No se pudieron obtener totales reales:', e?.message);
    }

    // Contar registros (movimientos) por orden (repetidas) para coincidir con conteo previo
    let totalOrdenesRepetidas = 0;
    let diasActivos = 1;
    const fechasSet = new Set();
    try {
      const repQuery = `
        SELECT orden_despacho
             , fecha_de_despacho::date AS fecha
        FROM admin_platform.inventario_prospecto
        WHERE cliente_id = $1
          AND fecha_de_despacho::date BETWEEN $2::date AND $3::date
          AND orden_despacho IS NOT NULL
      `;
      const { rows: repRows } = await pool.query(repQuery, [parseInt(cliente_id), startDate, endDate]);
      totalOrdenesRepetidas = repRows.length;
      for (const r of repRows) {
        if (r.fecha) fechasSet.add(new Date(r.fecha).toISOString().slice(0,10));
      }
      diasActivos = fechasSet.size || 1;
    } catch (e) {
      console.warn('No se pudo contar órdenes repetidas:', e?.message);
    }

    const agregados = new Map(); // modelo_id -> { modelo_id, nombre_modelo, total_cajas }
  let totalProductosModelados = 0; // suma de productos desde las órdenes procesadas (puede ser < reales)
  let totalVolumenM3Modelado = 0;

    // Optimización: obtener modelos una sola vez y procesar órdenes en paralelo controlado
    const modelosCache = await sugerenciasService.obtenerModelosCubeCached();
    const CONCURRENCY = 32; // ajustar según CPU / carga DB
    let index = 0;
    const ordenesArr = ordenes.slice();

    async function procesarLote() {
      const lote = ordenesArr.slice(index, index + CONCURRENCY);
      index += CONCURRENCY;
      await Promise.all(lote.map(async (ord) => {
        const orden = ord.orden_despacho;
        try {
          const sugerencias = await sugerenciasService.calcularSugerenciasPorOrden({ cliente_id: parseInt(cliente_id), orden_despacho: orden }, { modelos: modelosCache });
          if (Array.isArray(sugerencias) && sugerencias.length) {
            const best = sugerencias.find(s => s.es_mejor_opcion) || sugerencias[0];
            if (best && best.modelo_id != null) {
              const key = best.modelo_id;
              const prev = agregados.get(key) || { modelo_id: key, nombre_modelo: best.nombre_modelo, total_cajas: 0 };
              prev.total_cajas += (best.cantidad_sugerida || 0);
              agregados.set(key, prev);
              totalProductosModelados += (best.total_productos_transportados || 0);
              totalVolumenM3Modelado += (best.volumen_total_productos || 0);
            }
          }
        } catch (e) {
          console.warn('No se pudo procesar orden', orden, e?.message);
        }
      }));
      if (index < ordenesArr.length) return procesarLote();
    }

    await procesarLote();

    const divisorDias = diasActivos || totalDias;
    const modelos_agregados = Array.from(agregados.values())
      .map(m => ({
        ...m,
        promedio_diario_cajas: divisorDias > 0 ? m.total_cajas / divisorDias : m.total_cajas
      }))
      .sort((a,b) => b.total_cajas - a.total_cajas);

    res.json({
      resumen: {
        startDate,
        endDate,
        total_dias: totalDias,
        total_ordenes_unicas: ordenes.length,
        total_ordenes_repetidas: totalOrdenesRepetidas,
        total_ordenes: totalOrdenesRepetidas || ordenes.length, // compat
  total_productos_reales: totalProductosReales,
  volumen_total_m3_reales: volumenTotalReales,
  total_productos_modelados: totalProductosModelados,
  volumen_total_m3_modelados: totalVolumenM3Modelado,
  cobertura_productos_pct: totalProductosReales > 0 ? (totalProductosModelados / totalProductosReales) * 100 : 0,
  cobertura_volumen_pct: volumenTotalReales > 0 ? (totalVolumenM3Modelado / volumenTotalReales) * 100 : 0,
  total_dias_activos: diasActivos
      },
      modelos_agregados
    });
  } catch (error) {
    console.error('Error en POST /api/sugerencias/calcular-por-rango-orden-a-orden:', error);
    res.status(500).json({ error: 'Error al calcular agregado orden a orden' });
  }
});

// Nueva ruta: distribución OPTIMA (mezcla única) por rango
app.post('/api/sugerencias/distribucion-optima-rango', async (req, res) => {
  try {
    const { cliente_id, startDate, endDate } = req.body || {};
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id es requerido' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos (YYYY-MM-DD)' });
    const result = await sugerenciasService.calcularDistribucionOptimaRango({
      cliente_id: parseInt(cliente_id),
      startDate,
      endDate
    });
    res.json(result);
  } catch (error) {
    console.error('Error en POST /api/sugerencias/distribucion-optima-rango:', error);
    res.status(500).json({ error: 'Error al calcular distribución óptima por rango' });
  }
});

// Nueva ruta: recomendación mensual REAL (basada en distribución real por línea)
app.post('/api/sugerencias/recomendacion-mensual-real', async (req, res) => {
  try {
    const { cliente_id, startDate, endDate, base_dias, mensual_factor } = req.body || {};
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id es requerido' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos (YYYY-MM-DD)' });
    const result = await sugerenciasService.calcularRecomendacionMensualReal({
      cliente_id: parseInt(cliente_id),
      startDate,
      endDate,
      base_dias: base_dias || 'activos',
      mensual_factor: mensual_factor || 30
    });
    res.json(result);
  } catch (error) {
    console.error('Error en POST /api/sugerencias/recomendacion-mensual-real:', error);
    res.status(500).json({ error: 'Error al calcular recomendación mensual real' });
  }
});

// Guardar recomendación mensual real en la tabla sugerencias_reemplazo (una fila por modelo)
app.post('/api/sugerencias/recomendacion-mensual-real/guardar', async (req, res) => {
  try {
    const { cliente_id, startDate, endDate, base_dias, mensual_factor } = req.body || {};
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id es requerido' });
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos (YYYY-MM-DD)' });
    const result = await sugerenciasService.saveRecomendacionMensualReal({
      cliente_id: parseInt(cliente_id),
      startDate,
      endDate,
      base_dias: base_dias || 'activos',
      mensual_factor: mensual_factor || 30
    });
    res.status(201).json(result);
  } catch (error) {
    console.error('Error en POST /api/sugerencias/recomendacion-mensual-real/guardar:', error);
    res.status(500).json({ error: 'Error al guardar recomendación mensual real' });
  }
});

app.get('/api/inventario-prospectos/orden/:ordenDespacho', async (req, res) => {
  try {
    const productos = await inventarioProspectosService.getProductosPorOrden(req.params.ordenDespacho);
    res.json(productos);
  } catch (error) {
    console.error('Error al obtener productos por orden:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Importación de inventario desde Excel
app.post('/api/inventario-prospectos/import', upload.single('file'), async (req, res) => {
  try {
    const { cliente_id } = req.body;
    const clienteIdNum = parseInt(cliente_id);
    if (!clienteIdNum || !req.file) {
      return res.status(400).json({ error: 'cliente_id y archivo son requeridos' });
    }

    // Parse workbook
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true, raw: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Helpers
    const normalize = (s) => String(s || '').trim().toLowerCase();
    const toNumber = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      const n = Number(String(v).toString().replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const toInt = (v) => {
      const n = toNumber(v);
      return Math.round(n);
    };
    const toDateString = (v) => {
      if (!v) return null;
      if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
      if (typeof v === 'number') {
        try {
          const d = XLSX.SSF && XLSX.SSF.parse_date_code ? XLSX.SSF.parse_date_code(v) : null;
          if (d && d.y && d.m && d.d) {
            const yyyy = String(d.y).padStart(4, '0');
            const mm = String(d.m).padStart(2, '0');
            const dd = String(d.d).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }
        } catch (_) {}
      }
      const s = String(v).trim();
      // Accept YYYY-MM-DD or YYYY/MM/DD
      let m = s.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})$/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      // Accept DD-MM-YYYY or DD/MM/YYYY (common in Colombia)
      m = s.match(/^(\d{2})[-\/]?(\d{2})[-\/]?(\d{4})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      return null;
    };

    // Detect header row dynamically (supports templates with title rows)
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(30, aoa.length); i++) {
      const row = (aoa[i] || []).map(normalize);
      if (
        row.includes('producto') &&
        (row.includes('orden_despacho') || row.includes('orden despacho') || row.includes('orden')) &&
        (row.includes('largo_mm') || row.includes('largo')) &&
        (row.includes('ancho_mm') || row.includes('ancho')) &&
        (row.includes('alto_mm') || row.includes('alto'))
      ) {
        headerRowIdx = i;
        break;
      }
    }

  // Parse rows starting from detected header
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', range: headerRowIdx });
    if (!rows || rows.length === 0) {
      return res.status(400).json({
        error: 'No se encontraron datos para importar. Verifica que la hoja "Inventario" tenga los encabezados esperados (Descripcion, Producto, Largo_mm, Ancho_mm, Alto_mm, Cantidad, Fecha_Despacho (YYYY-MM-DD), Orden_Despacho).'
      });
    }

    // Expected headers mapping (case-insensitive)
    const results = { inserted: 0, skipped: 0, errors: 0, details: [] };

    // Units handling
    const unitsParam = (req.query && req.query.units) || (req.body && req.body.units) || 'mm';
    const units = typeof unitsParam === 'string' ? unitsParam.toLowerCase() : 'mm';
    const scale = units === 'cm' ? 10 : 1; // convert cm->mm

    // Try to auto-detect units from data (based on raw values before scaling)
    let dimCount = 0, smallLE100 = 0, veryLargeGT1000 = 0;
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
      const r = rows[i] || {};
      const rawDims = [
        toNumber(r['Largo_mm'] ?? r['Largo'] ?? r['largo_mm'] ?? r['largo']),
        toNumber(r['Ancho_mm'] ?? r['Ancho'] ?? r['ancho_mm'] ?? r['ancho']),
        toNumber(r['Alto_mm'] ?? r['Alto'] ?? r['alto_mm'] ?? r['alto'])
      ].filter((n) => Number.isFinite(n) && n > 0);
      rawDims.forEach((n) => {
        dimCount++;
        if (n <= 100) smallLE100++;
        if (n >= 1000) veryLargeGT1000++;
      });
    }
    let unitGuess = 'mm';
    let unitGuessReason = '';
    if (dimCount > 0) {
      const fracSmall = smallLE100 / dimCount;
      if (fracSmall >= 0.6 && veryLargeGT1000 === 0) {
        unitGuess = 'cm';
        unitGuessReason = `~${Math.round(fracSmall * 100)}% de dimensiones ≤ 100 y ninguna ≥ 1000`;
      } else {
        unitGuess = 'mm';
        unitGuessReason = `Valores grandes detectados o pocas dimensiones ≤ 100`;
      }
    }

    // Fetch existing items for de-duplication
    // NOTE: getInventarioByCliente returns an object { total, items } NOT a plain array.
    // Previous code assumed an array and caused a runtime error (existing.map is not a function) -> 500.
    const existingResult = await inventarioProspectosService.getInventarioByCliente(clienteIdNum, { limit: 5000 });
    const existingArray = Array.isArray(existingResult) ? existingResult : (existingResult.items || []);
    const existingSet = new Set(
      existingArray.map(e => [
        normalize(e.descripcion_producto), normalize(e.producto), e.largo_mm, e.ancho_mm, e.alto_mm,
        e.cantidad_despachada, normalize(e.orden_despacho)
      ].join('|'))
    );

  const toInsert = [];
  const previews = [];
  const dryRun = (req.query && (req.query.dryRun === '1' || req.query.dryRun === 'true')) ||
           (req.body && (req.body.dryRun === '1' || req.body.dryRun === true));
  const baseExcelRow = (headerRowIdx + 2); // fila Excel donde inicia el primer dato (headerIdx es 0-based; +1 header, +1 primera data)
  for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      // Leer dimensiones crudas
      const rawL = toNumber(r['Largo_mm'] ?? r['Largo'] ?? r['largo_mm'] ?? r['largo']);
      const rawA = toNumber(r['Ancho_mm'] ?? r['Ancho'] ?? r['ancho_mm'] ?? r['ancho']);
      const rawH = toNumber(r['Alto_mm'] ?? r['Alto'] ?? r['alto_mm'] ?? r['alto']);
      // Convertir a mm según unidades
      const largoMM = Math.round(rawL * scale);
      const anchoMM = Math.round(rawA * scale);
      const altoMM = Math.round(rawH * scale);

      const record = {
        cliente_id: clienteIdNum,
        descripcion_producto: r['Descripcion'] || r['DESCRIPCION'] || r['descripcion'] || '',
        producto: r['Producto'] || r['PRODUCTO'] || r['producto'] || '',
        largo_mm: largoMM,
        ancho_mm: anchoMM,
        alto_mm: altoMM,
        cantidad_despachada: toInt(r['Cantidad'] ?? r['cantidad'] ?? r['CANTIDAD']),
        fecha_de_despacho: (toDateString(
          r['Fecha_Despacho (YYYY-MM-DD)'] ?? r['Fecha_Despacho'] ?? r['fecha_despacho'] ?? r['Fecha despacho']
        ) || null),
        orden_despacho: r['Orden_Despacho'] || r['orden_despacho'] || r['Orden'] || r['ORDEN'] || ''
      };

      // Basic validation
      const errors = [];
      if (!record.producto) errors.push('Producto requerido');
      if (!(record.largo_mm > 0 && record.ancho_mm > 0 && record.alto_mm > 0)) errors.push('Dimensiones inválidas');
      if (!(record.cantidad_despachada > 0)) errors.push('Cantidad inválida');
      if (record.fecha_de_despacho && !/^\d{4}-\d{2}-\d{2}$/.test(record.fecha_de_despacho)) errors.push('Fecha inválida');
      if (!record.orden_despacho) errors.push('Orden_Despacho requerido');

      if (errors.length) {
        results.errors++;
        const detail = { row: baseExcelRow + idx, status: 'error', errors };
        results.details.push(detail);
        previews.push({ ...detail, record });
        continue;
      }

      // Dedup key per cliente
      const key = [
        normalize(record.descripcion_producto), normalize(record.producto), record.largo_mm, record.ancho_mm, record.alto_mm,
        record.cantidad_despachada, normalize(record.orden_despacho)
      ].join('|');
      if (existingSet.has(key)) {
        results.skipped++;
        const detail = { row: baseExcelRow + idx, status: 'skipped', reason: 'Duplicado existente' };
        results.details.push(detail);
        previews.push({ ...detail, record });
        continue;
      }
      existingSet.add(key);
      toInsert.push(record);
      previews.push({ row: baseExcelRow + idx, status: 'ok', record });
    }

    if (dryRun) {
      return res.json({
        results,
        preview: previews,
        totalRows: rows.length,
        canInsert: toInsert.length,
        unitsUsed: units,
        unitGuess,
        unitGuessReason
      });
    }

    if (toInsert.length > 0) {
      await inventarioProspectosService.bulkInsertInventario(toInsert);
      results.inserted = toInsert.length;
    }

  return res.json({ ...results, unitsUsed: units });
  } catch (error) {
    console.error('Error en importación de inventario:', error);
  res.status(500).json({ error: 'Error al importar inventario', details: error?.message });
  }
});

// Rutas para sugerencias - MOVER AQUÍ ANTES DEL app.listen()
app.get('/api/sugerencias', async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 1000) : null;
    const offset = req.query.offset ? Math.max(parseInt(req.query.offset), 0) : 0;
    const search = req.query.search ? String(req.query.search) : '';
    const clienteId = req.query.cliente_id ? parseInt(req.query.cliente_id) : null;
  const numero = req.query.numero ? String(req.query.numero) : null;

    // Si se especifica limit, usar la versión paginada; de lo contrario devolver todo (compatibilidad)
    if (limit !== null) {
      const result = await sugerenciasService.getSugerenciasPaginated({ limit, offset, search, clienteId, numero });
      return res.json(result);
    }

    const sugerencias = await sugerenciasService.getAllSugerencias();
    res.json(sugerencias);
  } catch (error) {
    console.error('Error en GET /api/sugerencias:', error);
    res.status(500).json({ error: 'Error al obtener sugerencias' });
  }
});

// Obtener sugerencias por numero_de_sugerencia (grupo)
app.get('/api/sugerencias/numero/:numero', async (req, res) => {
  try {
    const numero = String(req.params.numero);
    const { items } = await sugerenciasService.getSugerenciasPaginated({ limit: 1000, offset: 0, search: '', clienteId: null, numero });
    res.json(items);
  } catch (error) {
    console.error('Error en GET /api/sugerencias/numero/:numero:', error);
    res.status(500).json({ error: 'Error al obtener sugerencias por número' });
  }
});

app.post('/api/sugerencias/calcular', async (req, res) => {
  try {
    const sugerencias = await sugerenciasService.calcularSugerencias(req.body);
    res.json(sugerencias);
  } catch (error) {
    console.error('Error en POST /api/sugerencias/calcular:', error);
    res.status(500).json({ error: 'Error al calcular sugerencias' });
  }
});

// Nueva ruta para calcular sugerencias por orden de despacho
app.post('/api/sugerencias/calcular-por-orden', async (req, res) => {
  try {
    const sugerencias = await sugerenciasService.calcularSugerenciasPorOrden(req.body);
    res.json(sugerencias);
  } catch (error) {
    console.error('Error en POST /api/sugerencias/calcular-por-orden:', error);
    res.status(500).json({ error: 'Error al calcular sugerencias por orden de despacho' });
  }
});

app.post('/api/sugerencias', async (req, res) => {
  try {
    const nuevaSugerencia = await sugerenciasService.createSugerencia(req.body);
    res.status(201).json(nuevaSugerencia);
  } catch (error) {
    console.error('Error en POST /api/sugerencias:', error);
    res.status(500).json({ error: 'Error al crear sugerencia' });
  }
});

app.delete('/api/sugerencias/:id', async (req, res) => {
  try {
    const sugerenciaEliminada = await sugerenciasService.deleteSugerencia(req.params.id);
    if (sugerenciaEliminada) {
      res.json({ message: 'Sugerencia eliminada exitosamente' });
    } else {
      res.status(404).json({ error: 'Sugerencia no encontrada' });
    }
  } catch (error) {
    console.error('Error en DELETE /api/sugerencias/:id:', error);
    res.status(500).json({ error: 'Error al eliminar sugerencia' });
  }
});

// Servir archivos estáticos en producción
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  
  app.use(express.static(path.join(__dirname, '../../dist')));
  
  // Catch all handler: send back React's index.html file.
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
  });
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

module.exports = app;

// ELIMINAR ESTAS LÍNEAS QUE ESTÁN DESPUÉS DEL app.listen() - YA NO SON NECESARIAS
