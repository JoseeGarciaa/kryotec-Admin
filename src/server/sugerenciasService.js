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
      
      if (modelos.length === 0) {
        return [];
      }
      
      // Calcular sugerencias para cada modelo
      const sugerencias = modelos.map(modelo => {
        // Convertir dimensiones internas del modelo de mm a mm (mantener)
        const frenteModelo = modelo.dim_int_frente; // Ya en mm
        const profundoModelo = modelo.dim_int_profundo; // Ya en mm
        const altoModelo = modelo.dim_int_alto; // Ya en mm
        
        const volumenModeloM3 = modelo.volumen_litros / 1000;
        
        // NUEVA LÓGICA: Filtrar modelos demasiado grandes para volúmenes pequeños
        const factorProporcion = volumenModeloM3 / volumenTotalRequeridoM3;
        
        // Si el modelo es más de 3 veces el volumen requerido Y el volumen total es pequeño (< 0.1 m³)
        // entonces no lo recomendamos (evita recomendar contenedores gigantes para pocas cajas pequeñas)
        if (factorProporcion > 3 && volumenTotalRequeridoM3 < 0.1) {
          return null; // Modelo demasiado grande para pocas cajas pequeñas
        }
        
        // Si el modelo es más de 10 veces el volumen requerido Y el volumen total es mediano (< 0.5 m³)
        // entonces tampoco lo recomendamos
        if (factorProporcion > 10 && volumenTotalRequeridoM3 < 0.5) {
          return null; // Modelo excesivamente grande
        }
        
        // Calcular cuántas cajas caben en un modelo (por volumen)
        const cajasPorModelo = Math.floor(volumenModeloM3 / volumenUnaCaja);
        
        // Verificar si las dimensiones de la caja coinciden exactamente con el modelo
        const dimensionesExactas = (
          frenteModelo === dimensiones_requeridas.frente &&
          profundoModelo === dimensiones_requeridas.profundo &&
          altoModelo === dimensiones_requeridas.alto
        );
        
        let modelosNecesarios, cajasQueSeGuardan, eficiencia;
        
        if (cajasPorModelo === 0) {
          // Si no cabe ni una caja por volumen, calculamos cuántos modelos necesitamos
          modelosNecesarios = Math.ceil(volumenTotalRequeridoM3 / volumenModeloM3);
          cajasQueSeGuardan = cantidadCajas;
          eficiencia = (volumenTotalRequeridoM3 / (modelosNecesarios * volumenModeloM3)) * 100;
        } else {
          // Lógica normal cuando sí caben cajas
          modelosNecesarios = Math.ceil(cantidadCajas / cajasPorModelo);
          cajasQueSeGuardan = Math.min(cantidadCajas, modelosNecesarios * cajasPorModelo);
          
          // LÓGICA DE EFICIENCIA AJUSTADA:
          if (dimensionesExactas && cajasPorModelo === 1) {
            // Dimensiones exactamente iguales = 100%
            eficiencia = 100;
          } else {
            // Calcular eficiencia basada en aprovechamiento del volumen
            const volumenTotalDisponible = modelosNecesarios * volumenModeloM3;
            const volumenRealmenteUsado = cantidadCajas * volumenUnaCaja;
            eficiencia = (volumenRealmenteUsado / volumenTotalDisponible) * 100;
            
            // Si la eficiencia es muy alta (95% o más), aproximarla hacia 100%
            if (eficiencia >= 95) {
              eficiencia = Math.min(99, eficiencia + (100 - eficiencia) * 0.5);
            }
          }
        }
        
        // Redondear a 1 decimal
        eficiencia = Math.round(eficiencia * 10) / 10;
        
        // Determinar mensaje de comparación de tamaño
        let mensajeComparacion;
        if (dimensionesExactas) {
          mensajeComparacion = "✅ Ajuste perfecto";
        } else if (frenteModelo >= dimensiones_requeridas.frente && 
                   profundoModelo >= dimensiones_requeridas.profundo && 
                   altoModelo >= dimensiones_requeridas.alto) {
          // El modelo es más grande en todas las dimensiones
          const volumenModelo = (frenteModelo * profundoModelo * altoModelo) / 1000000000; // mm³ a m³
          const volumenRequerido = volumenUnaCaja;
          if (volumenModelo > volumenRequerido * 1.5) {
            mensajeComparacion = "📦 Modelo más grande (mucho espacio extra)";
          } else {
            mensajeComparacion = "📦 Modelo más grande (espacio extra)";
          }
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