const pool = require('./config/db');

const sugerenciasService = {
  // Obtener todas las sugerencias
  getAllSugerencias: async () => {
    try {
      const query = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.inv_id, s.modelo_sugerido,
          s.cantidad_sugerida, s.modalidad, s.fecha_sugerencia, 
          s.modelo_id, s.estado,
          c.nombre_cliente,
          m.nombre_modelo, m.volumen_litros,
          i.descripcion as item_descripcion, i.largo_mm, i.ancho_mm, i.alto_mm
        FROM admin_platform.sugerencias_reemplazo s
        LEFT JOIN admin_platform.clientes_prospectos c ON s.cliente_id = c.cliente_id
        LEFT JOIN admin_platform.modelos m ON s.modelo_id = m.modelo_id
        LEFT JOIN admin_platform.inventario_prospecto i ON s.inv_id = i.inv_id
        ORDER BY s.fecha_sugerencia DESC
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.error('Error al obtener sugerencias:', error);
      throw error;
    }
  },

  // Crear una nueva sugerencia
  createSugerencia: async (data) => {
    try {
      const query = `
        INSERT INTO admin_platform.sugerencias_reemplazo (
          cliente_id, inv_id, modelo_sugerido, cantidad_sugerida, 
          modalidad, modelo_id, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const values = [
        data.cliente_id, data.inv_id, data.modelo_sugerido,
        data.cantidad_sugerida, data.modalidad || 'alquiler',
        data.modelo_id, data.estado || 'pendiente'
      ];
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error al crear sugerencia:', error);
      throw error;
    }
  },

  // Calcular sugerencias basadas en dimensiones
  calcularSugerencias: async (datos) => {
    try {
      console.log('Datos recibidos:', datos);
      
      // Extraer dimensiones y cantidad del objeto recibido
      const { dimensiones_requeridas, cantidad } = datos;
      
      if (!dimensiones_requeridas || !dimensiones_requeridas.frente || !dimensiones_requeridas.profundo || !dimensiones_requeridas.alto) {
        throw new Error('Faltan dimensiones requeridas: frente, profundo, alto');
      }
      
      const cantidadCajas = cantidad || 1; // Cantidad de cajas del cliente
      
      // Convertir milímetros a metros para las dimensiones de UNA caja
      const frente_m = parseFloat(dimensiones_requeridas.frente) / 1000; // mm a m
      const profundo_m = parseFloat(dimensiones_requeridas.profundo) / 1000; // mm a m
      const alto_m = parseFloat(dimensiones_requeridas.alto) / 1000; // mm a m
      
      // Calcular volumen de UNA caja en metros cúbicos
      const volumenUnaCaja = frente_m * profundo_m * alto_m;
      console.log('Volumen de una caja:', volumenUnaCaja, 'm³');
      console.log('Cantidad de cajas:', cantidadCajas);
      
      // Buscar TODOS los modelos Cube disponibles
      const query = `
        SELECT 
          modelo_id, nombre_modelo, volumen_litros,
          dim_int_frente, dim_int_profundo, dim_int_alto
        FROM admin_platform.modelos
        WHERE tipo = 'Cube'
        ORDER BY volumen_litros ASC
      `;
      
      const { rows: modelos } = await pool.query(query);
      
      if (modelos.length === 0) {
        return [];
      }
      
      // Calcular sugerencias para cada modelo
      const sugerencias = modelos.map(modelo => {
        // Convertir dimensiones internas del modelo de mm a mm (mantener)
        const frenteModelo = modelo.dim_int_frente; // Ya en mm
        const profundoModelo = modelo.dim_int_profundo; // Ya en mm
        const altoModelo = modelo.dim_int_alto; // Ya en mm
        
        // Verificar si UNA caja cabe físicamente en el modelo (comparar mm con mm)
        const frenteRequerido = dimensiones_requeridas.frente;
        const profundoRequerido = dimensiones_requeridas.profundo;
        const altoRequerido = dimensiones_requeridas.alto;
        
        const cabeEnDimensiones = frenteModelo >= frenteRequerido && 
                                 profundoModelo >= profundoRequerido && 
                                 altoModelo >= altoRequerido;
        
        if (!cabeEnDimensiones) {
          return null; // No cabe, excluir este modelo
        }
        
        // ELIMINADO: Filtro de "demasiado grande" - ahora recomendamos cualquier tamaño
        
        // Calcular cuántas cajas caben en un modelo (por volumen)
        const volumenModeloM3 = modelo.volumen_litros / 1000;
        const cajasPorModelo = Math.floor(volumenModeloM3 / volumenUnaCaja);
        
        if (cajasPorModelo === 0) {
          return null; // No cabe ni una caja
        }
        
        // Calcular cuántos modelos se necesitan para todas las cajas
        const modelosNecesarios = Math.ceil(cantidadCajas / cajasPorModelo);
        const cajasQueSeGuardan = Math.min(cantidadCajas, modelosNecesarios * cajasPorModelo);
        const eficiencia = (cantidadCajas / cajasQueSeGuardan) * 100;
        
        return {
          modelo_id: modelo.modelo_id,
          nombre_modelo: modelo.nombre_modelo,
          volumen_litros: modelo.volumen_litros,
          cantidad_sugerida: modelosNecesarios,
          cajas_por_modelo: cajasPorModelo,
          total_cajas_guardadas: cajasQueSeGuardan,
          eficiencia: Math.round(eficiencia * 10) / 10,
          dimensiones_internas: {
            frente: frenteModelo, // Mantener en mm
            profundo: profundoModelo, // Mantener en mm
            alto: altoModelo // Mantener en mm
          }
        };
      }).filter(sugerencia => sugerencia !== null); // Filtrar modelos que no sirven
      
      // Ordenar por eficiencia descendente
      sugerencias.sort((a, b) => b.eficiencia - a.eficiencia);
      
      return sugerencias;
      
    } catch (error) {
      console.error('Error al calcular sugerencias:', error);
      throw error;
    }
  },

  // Eliminar una sugerencia
  deleteSugerencia: async (id) => {
    try {
      const query = 'DELETE FROM admin_platform.sugerencias_reemplazo WHERE sugerencia_id = $1 RETURNING *';
      const { rows } = await pool.query(query, [id]);
      return rows[0];
    } catch (error) {
      console.error('Error al eliminar sugerencia:', error);
      throw error;
    }
  }
};

module.exports = sugerenciasService;