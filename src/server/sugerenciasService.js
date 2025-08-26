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
      const { cliente_id, inv_id } = datos;
      
      // Obtener el inventario completo del cliente para calcular volumen total
      const inventarioQuery = `
        SELECT 
          producto, cantidad, largo_mm, ancho_mm, alto_mm,
          (largo_mm * ancho_mm * alto_mm) / 1000000000.0 as volumen_unitario_m3
        FROM admin_platform.inventario_prospecto
        WHERE cliente_id = $1
      `;
      
      const { rows: inventarioItemsRaw } = await pool.query(inventarioQuery, [cliente_id]);
      console.log('Items de inventario encontrados:', inventarioItemsRaw.length);
      
      if (inventarioItemsRaw.length === 0) {
        console.log('No se encontró inventario para el cliente');
        return [];
      }
      
      // Limpiar y consolidar productos duplicados (por nombre similar)
      const inventarioMap = new Map();
      inventarioItemsRaw.forEach(item => {
        const nombreLimpio = item.producto.toLowerCase().trim();
        
        if (inventarioMap.has(nombreLimpio)) {
          // Sumar cantidades si ya existe
          const existing = inventarioMap.get(nombreLimpio);
          existing.cantidad += item.cantidad;
        } else {
          // Agregar nuevo item
          inventarioMap.set(nombreLimpio, {
            producto: item.producto, // Mantener el nombre original del primero
            cantidad: item.cantidad,
            largo_mm: item.largo_mm,
            ancho_mm: item.ancho_mm,
            alto_mm: item.alto_mm,
            volumen_unitario_m3: item.volumen_unitario_m3
          });
        }
      });
      
      const inventarioItems = Array.from(inventarioMap.values());
      console.log('Items de inventario después de consolidar:', inventarioItems.length);
      
      // Calcular volumen total de todos los productos del cliente
      let volumenTotalRequeridoM3 = 0;
      let totalProductos = 0;
      
      inventarioItems.forEach(item => {
        const volumenTotalItem = item.volumen_unitario_m3 * item.cantidad;
        volumenTotalRequeridoM3 += volumenTotalItem;
        totalProductos += item.cantidad;
        console.log(`${item.producto}: ${item.cantidad} unidades, ${volumenTotalItem.toFixed(6)} m³`);
      });
      
      console.log(`Volumen total a transportar: ${volumenTotalRequeridoM3.toFixed(6)} m³`);
      console.log(`Total productos: ${totalProductos} unidades`);
      
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
          return null;
        }
        
        // Convertir volumen del modelo de litros a metros cúbicos
        const volumenModeloM3 = modelo.volumen_litros / 1000;
        console.log(`Modelo ${modelo.nombre_modelo}: ${volumenModeloM3.toFixed(6)} m³`);
        
        // NUEVA LÓGICA: Calcular basándose en productos individuales
        let modelosNecesarios = 0;
        let productosTransportados = 0;
        let volumenTotalUtilizado = 0;
        
        // Para cada tipo de producto en el inventario
        inventarioItems.forEach(item => {
          const productoFrente = item.largo_mm;
          const productoAncho = item.ancho_mm;
          const productoAlto = item.alto_mm;
          
          // Verificar si el producto cabe físicamente en el contenedor
          const cabeEnContenedor = (
            productoFrente <= modelo.dim_int_frente &&
            productoAncho <= modelo.dim_int_profundo &&
            productoAlto <= modelo.dim_int_alto
          );
          
          if (cabeEnContenedor) {
            // Si las dimensiones son exactamente iguales, 1 producto = 1 contenedor
            const dimensionesExactas = (
              productoFrente === modelo.dim_int_frente &&
              productoAncho === modelo.dim_int_profundo &&
              productoAlto === modelo.dim_int_alto
            );
            
            if (dimensionesExactas) {
              // Caso perfecto: 1 producto = 1 contenedor
              modelosNecesarios += item.cantidad;
              productosTransportados += item.cantidad;
              volumenTotalUtilizado += item.cantidad * item.volumen_unitario_m3;
              console.log(`${item.producto}: Ajuste perfecto - ${item.cantidad} contenedores necesarios`);
            } else {
              // Calcular cuántos productos caben en un contenedor
              const volumenProducto = item.volumen_unitario_m3;
              const productosPorContenedor = Math.floor(volumenModeloM3 / volumenProducto);
              const contenedoresNecesarios = Math.ceil(item.cantidad / productosPorContenedor);
              
              modelosNecesarios += contenedoresNecesarios;
              productosTransportados += item.cantidad;
              volumenTotalUtilizado += item.cantidad * volumenProducto;
              console.log(`${item.producto}: ${productosPorContenedor} por contenedor, ${contenedoresNecesarios} contenedores necesarios`);
            }
          } else {
            // El producto no cabe en este modelo de contenedor
            console.log(`${item.producto}: No cabe en ${modelo.nombre_modelo} (${productoFrente}×${productoAncho}×${productoAlto} > ${modelo.dim_int_frente}×${modelo.dim_int_profundo}×${modelo.dim_int_alto})`);
            return null; // Este modelo no sirve para estos productos
          }
        });
        
        if (modelosNecesarios === 0) {
          console.log(`Modelo ${modelo.nombre_modelo} descartado: ningún producto cabe`);
          return null;
        }
        
        // Calcular volumen total disponible con estos contenedores
        const volumenTotalDisponible = modelosNecesarios * volumenModeloM3;
        
        // Calcular eficiencia (qué tan bien aprovechamos el espacio)
        const eficiencia = (volumenTotalUtilizado / volumenTotalDisponible) * 100;
        
        console.log(`Modelo ${modelo.nombre_modelo}: ${modelosNecesarios} contenedores, ${eficiencia.toFixed(1)}% eficiencia`);
        
        // Determinar mensaje de comparación
        let mensajeComparacion;
        if (eficiencia >= 90) {
          mensajeComparacion = "🎯 Excelente aprovechamiento";
        } else if (eficiencia >= 75) {
          mensajeComparacion = "✅ Buen aprovechamiento";
        } else if (eficiencia >= 50) {
          mensajeComparacion = "📦 Aprovechamiento moderado";
        } else {
          mensajeComparacion = "⚠️ Mucho espacio desperdiciado";
        }
        
        return {
          modelo_id: modelo.modelo_id,
          nombre_modelo: modelo.nombre_modelo,
          volumen_litros: modelo.volumen_litros,
          cantidad_sugerida: modelosNecesarios,
          total_productos_transportados: productosTransportados,
          volumen_total_productos: volumenTotalUtilizado,
          volumen_total_contenedores: volumenTotalDisponible,
          eficiencia: Math.round(eficiencia * 10) / 10,
          mensaje_comparacion: mensajeComparacion,
          dimensiones_internas: {
            frente: modelo.dim_int_frente, // mm
            profundo: modelo.dim_int_profundo, // mm
            alto: modelo.dim_int_alto // mm
          }
        };
      }).filter(sugerencia => sugerencia !== null);
      
      console.log(`Sugerencias generadas: ${sugerencias.length}`);
      console.log('Primeras 2 sugerencias:', sugerencias.slice(0, 2));
      
      // Ordenar por eficiencia descendente
      const sugerenciasOrdenadas = sugerencias.sort((a, b) => b.eficiencia - a.eficiencia);
      
      console.log('Sugerencias calculadas exitosamente');
      return sugerenciasOrdenadas;
      
    } catch (error) {
      console.error('Error en calcularSugerencias:', error);
      throw new Error(`Error al calcular sugerencias: ${error.message}`);
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