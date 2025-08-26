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
          i.descripcion as descripcion_inventario, i.producto, i.cantidad as cantidad_inventario, 
          i.largo_mm, i.ancho_mm, i.alto_mm
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
        RETURNING sugerencia_id
      `;
      const values = [
        data.cliente_id, data.inv_id, data.modelo_sugerido,
        data.cantidad_sugerida, data.modalidad || 'alquiler',
        data.modelo_id, data.estado || 'pendiente'
      ];
      const { rows } = await pool.query(query, values);
      const sugerenciaId = rows[0].sugerencia_id;
      
      // Ahora obtener la sugerencia completa con todos los JOINs
      const selectQuery = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.inv_id, s.modelo_sugerido,
          s.cantidad_sugerida, s.modalidad, s.fecha_sugerencia, 
          s.modelo_id, s.estado,
          c.nombre_cliente,
          m.nombre_modelo, m.volumen_litros,
          i.descripcion as descripcion_inventario, i.producto, i.cantidad as cantidad_inventario, 
          i.largo_mm, i.ancho_mm, i.alto_mm
        FROM admin_platform.sugerencias_reemplazo s
        LEFT JOIN admin_platform.clientes_prospectos c ON s.cliente_id = c.cliente_id
        LEFT JOIN admin_platform.modelos m ON s.modelo_id = m.modelo_id
        LEFT JOIN admin_platform.inventario_prospecto i ON s.inv_id = i.inv_id
        WHERE s.sugerencia_id = $1
      `;
      
      const { rows: completeRows } = await pool.query(selectQuery, [sugerenciaId]);
      return completeRows[0];
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
      
      // Calcular volumen total requerido
      const volumenTotalRequeridoM3 = volumenUnaCaja * cantidadCajas;
      console.log('Volumen total requerido:', volumenTotalRequeridoM3, 'm³');
      
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
      console.log('Modelos encontrados:', modelos.length);
      console.log('Primer modelo:', modelos[0]);
      
      if (modelos.length === 0) {
        console.log('No se encontraron modelos tipo Cube');
        return [];
      }
      
      // Calcular sugerencias para cada modelo
      const sugerencias = modelos.map((modelo, index) => {
        console.log(`Evaluando modelo ${index + 1}/${modelos.length}:`, modelo.nombre_modelo);
        
        // Verificar que el modelo tenga dimensiones internas válidas
        if (!modelo.dim_int_frente || !modelo.dim_int_profundo || !modelo.dim_int_alto) {
          console.log(`Modelo ${modelo.nombre_modelo} descartado: sin dimensiones internas`);
          return null; // Saltar modelos sin dimensiones internas
        }
        
        console.log(`Dimensiones del modelo ${modelo.nombre_modelo}:`, {
          frente: modelo.dim_int_frente,
          profundo: modelo.dim_int_profundo,
          alto: modelo.dim_int_alto
        });
        
        // Convertir dimensiones internas del modelo de mm a metros
        const frenteModelo = modelo.dim_int_frente; // En mm
        const profundoModelo = modelo.dim_int_profundo; // En mm
        const altoModelo = modelo.dim_int_alto; // En mm
        
        // CALCULAR VOLUMEN DEL MODELO USANDO SUS DIMENSIONES INTERNAS
        const volumenModeloM3 = (frenteModelo * profundoModelo * altoModelo) / 1000000000; // mm³ a m³
        
        // Verificar si las dimensiones de la caja coinciden exactamente con el modelo
        const dimensionesExactas = (
          frenteModelo === parseInt(dimensiones_requeridas.frente) &&
          profundoModelo === parseInt(dimensiones_requeridas.profundo) &&
          altoModelo === parseInt(dimensiones_requeridas.alto)
        );
        
        // NUEVA LÓGICA: Filtrar modelos demasiado grandes para volúmenes pequeños
        const factorProporcion = volumenModeloM3 / volumenTotalRequeridoM3;
        console.log(`Modelo ${modelo.nombre_modelo} - Factor proporción:`, factorProporcion);
        console.log(`Volumen modelo: ${volumenModeloM3} m³, Volumen requerido: ${volumenTotalRequeridoM3} m³`);
        
        // Temporalmente comentar estos filtros para diagnosticar
        /*
        // Si el modelo es más de 3 veces el volumen requerido Y el volumen total es pequeño (< 0.1 m³)
        // entonces no lo recomendamos (evita recomendar contenedores gigantes para pocas cajas pequeñas)
        if (factorProporcion > 3 && volumenTotalRequeridoM3 < 0.1) {
          console.log(`Modelo ${modelo.nombre_modelo} descartado: factor > 3 y volumen pequeño`);
          return null; // Modelo demasiado grande para pocas cajas pequeñas
        }
        
        // Si el modelo es más de 10 veces el volumen requerido Y el volumen total es mediano (< 0.5 m³)
        // entonces tampoco lo recomendamos
        if (factorProporcion > 10 && volumenTotalRequeridoM3 < 0.5) {
          console.log(`Modelo ${modelo.nombre_modelo} descartado: factor > 10 y volumen mediano`);
          return null; // Modelo excesivamente grande
        }
        */
        
        // Calcular cuántas cajas caben en un modelo (por volumen)
        const cajasPorModelo = Math.floor(volumenModeloM3 / volumenUnaCaja);
        console.log(`Modelo ${modelo.nombre_modelo}: ${cajasPorModelo} cajas por modelo`);
        
        let modelosNecesarios, cajasQueSeGuardan, eficiencia;
        
        // Calcular cuántos modelos necesitamos para guardar todas las cajas
        if (cajasPorModelo > 0) {
          // Caso normal: las cajas caben en el modelo
          modelosNecesarios = Math.ceil(cantidadCajas / cajasPorModelo);
          cajasQueSeGuardan = cantidadCajas; // Guardamos todas las cajas
          
          // Calcular eficiencia basada en el aprovechamiento del espacio
          const volumenUtilizado = cantidadCajas * volumenUnaCaja;
          const volumenTotalDisponible = modelosNecesarios * volumenModeloM3;
          eficiencia = (volumenUtilizado / volumenTotalDisponible) * 100;
        } else {
          // Caso especial: las cajas son muy pequeñas comparadas con el modelo
          // Calculamos por volumen puro
          modelosNecesarios = Math.ceil(volumenTotalRequeridoM3 / volumenModeloM3);
          cajasQueSeGuardan = cantidadCajas;
          
          // Eficiencia basada en la proximidad de volúmenes
          const volumenTotalDisponible = modelosNecesarios * volumenModeloM3;
          eficiencia = (volumenTotalRequeridoM3 / volumenTotalDisponible) * 100;
        }
        
        console.log(`Modelo ${modelo.nombre_modelo}: ${modelosNecesarios} modelos necesarios, eficiencia: ${eficiencia.toFixed(1)}%`);
        
        // Bonificación por ajuste dimensional perfecto
        if (dimensionesExactas) {
          eficiencia = Math.min(100, eficiencia + 10);
        }
        
        // Redondear a 1 decimal
        eficiencia = Math.round(eficiencia * 10) / 10;
        
        // Determinar mensaje de comparación de tamaño
        let mensajeComparacion;
        const volumenTotalDisponible = modelosNecesarios * volumenModeloM3;
        const diferenciaVolumen = ((volumenTotalDisponible - volumenTotalRequeridoM3) / volumenTotalRequeridoM3) * 100;
        
        if (dimensionesExactas && Math.abs(diferenciaVolumen) < 1) {
          mensajeComparacion = "✅ Ajuste perfecto";
        } else if (diferenciaVolumen > 50) {
          mensajeComparacion = "📦 Modelo más grande (mucho espacio extra)";
        } else if (diferenciaVolumen > 10) {
          mensajeComparacion = "📦 Modelo más grande (espacio extra)";
        } else if (diferenciaVolumen > -10) {
          mensajeComparacion = "🎯 Muy buena aproximación";
        } else {
          mensajeComparacion = "⚠️ Modelo más pequeño (aproximación por volumen)";
        }
        
        return {
          modelo_id: modelo.modelo_id,
          nombre_modelo: modelo.nombre_modelo,
          volumen_litros: modelo.volumen_litros,
          cantidad_sugerida: modelosNecesarios,
          cajas_por_modelo: Math.max(cajasPorModelo, 0),
          total_cajas_guardadas: cajasQueSeGuardan,
          eficiencia: eficiencia,
          mensaje_comparacion: mensajeComparacion,
          dimensiones_internas: {
            frente: frenteModelo, // Mantener en mm
            profundo: profundoModelo, // Mantener en mm
            alto: altoModelo // Mantener en mm
          },
          // Agregar indicador si las cajas no caben físicamente
          nota_dimensional: (frenteModelo < dimensiones_requeridas.frente || 
                           profundoModelo < dimensiones_requeridas.profundo || 
                           altoModelo < dimensiones_requeridas.alto) 
                           ? 'Aproximación por volumen - las cajas exceden las dimensiones del modelo' 
                           : null
        };
      }).filter(sugerencia => sugerencia !== null); // Filtrar modelos excluidos
      
      console.log(`Sugerencias generadas: ${sugerencias.length}`);
      console.log('Primeras 2 sugerencias:', sugerencias.slice(0, 2));
      
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