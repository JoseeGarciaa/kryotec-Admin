const express = require('express');
const router = express.Router();
const clientesProspectosService = require('./clientesProspectosService');

// Obtener todos los clientes prospectos
router.get('/', async (req, res) => {
  try {
    const clientes = await clientesProspectosService.getAllClientes();
    res.json(clientes);
  } catch (error) {
    console.error('Error en la ruta GET /clientes-prospectos:', error);
    res.status(500).json({ error: 'Error al obtener los clientes prospectos' });
  }
});

// Obtener un cliente prospecto por ID
router.get('/:id', async (req, res) => {
  try {
    const cliente = await clientesProspectosService.getClienteById(req.params.id);
    if (cliente) {
      res.json(cliente);
    } else {
      res.status(404).json({ error: 'Cliente prospecto no encontrado' });
    }
  } catch (error) {
    console.error('Error en la ruta GET /clientes-prospectos/:id:', error);
    res.status(500).json({ error: 'Error al obtener el cliente prospecto' });
  }
});

// Crear un nuevo cliente prospecto
router.post('/', async (req, res) => {
  try {
    const nuevoCliente = await clientesProspectosService.createCliente(req.body);
    res.status(201).json(nuevoCliente);
  } catch (error) {
    console.error('Error en la ruta POST /clientes-prospectos:', error);
    res.status(500).json({ error: 'Error al crear el cliente prospecto' });
  }
});

// Actualizar un cliente prospecto
router.put('/:id', async (req, res) => {
  try {
    const clienteActualizado = await clientesProspectosService.updateCliente(req.params.id, req.body);
    if (clienteActualizado) {
      res.json(clienteActualizado);
    } else {
      res.status(404).json({ error: 'Cliente prospecto no encontrado' });
    }
  } catch (error) {
    console.error('Error en la ruta PUT /clientes-prospectos/:id:', error);
    res.status(500).json({ error: 'Error al actualizar el cliente prospecto' });
  }
});

// Eliminar un cliente prospecto
router.delete('/:id', async (req, res) => {
  try {
    const clienteEliminado = await clientesProspectosService.deleteCliente(req.params.id);
    if (clienteEliminado) {
      res.json({ message: 'Cliente prospecto eliminado correctamente' });
    } else {
      res.status(404).json({ error: 'Cliente prospecto no encontrado' });
    }
  } catch (error) {
    console.error('Error en la ruta DELETE /clientes-prospectos/:id:', error);
    res.status(500).json({ error: 'Error al eliminar el cliente prospecto' });
  }
});

module.exports = router;
