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
          tenant_schema_name,    -- Nombre del esquema del tenant de origen
          nombre_unidad,         -- Nombre de la unidad de inventario
          fecha_ingreso,         -- Fecha en que el registro fue ingresado
          ultima_actualizacion,  -- Ultima fecha en que el registro fue actualizado
          activo                 -- Estado de actividad del registro (true/false)
      FROM
          admin_platform.inventario_credocubes
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
      res.status(409).json({ error: 'Ya existe una empresa con ese nombre, NIT, email o esquema' });
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
      res.status(409).json({ error: 'Ya existe una empresa con ese nombre, NIT, email o esquema' });
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
    const ordenes = await inventarioProspectosService.getOrdenesDespacho(clienteId);
    res.json(ordenes);
  } catch (error) {
    console.error('Error al obtener órdenes de despacho:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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

// Rutas para sugerencias - MOVER AQUÍ ANTES DEL app.listen()
app.get('/api/sugerencias', async (req, res) => {
  try {
    const sugerencias = await sugerenciasService.getAllSugerencias();
    res.json(sugerencias);
  } catch (error) {
    console.error('Error en GET /api/sugerencias:', error);
    res.status(500).json({ error: 'Error al obtener sugerencias' });
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
