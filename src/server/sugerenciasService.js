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
      
      // Extraer datos del objeto recibido
      const { cliente_id, inv_id } = datos;
      
      // Obtener el producto específico del inventario usando inv_id
      const inventarioQuery = `
        SELECT 
          producto, cantidad, largo_mm, ancho_mm, alto_mm, volumen_total_m3
        FROM admin_platform.inventario_prospecto
        WHERE inv_id = $1 AND cliente_id = $2
      `;
      
      const { rows: inventarioItems } = await pool.query(inventarioQuery, [inv_id, cliente_id]);
      console.log('Items de inventario encontrados:', inventarioItems.length);
      
      if (inventarioItems.length === 0) {
        console.log('No se encontró el producto en el inventario');
        return [];
      }
      
      const producto = inventarioItems[0];
      console.log('Producto encontrado:', producto);
      
      // Usar los datos de la base de datos
      const cantidadProductos = parseInt(producto.cantidad);
      const volumenTotalRequeridoM3 = parseFloat(producto.volumen_total_m3);
      
      // Dimensiones del producto individual en mm
      const productoFrente = parseInt(producto.largo_mm);
      const productoAncho = parseInt(producto.ancho_mm);
      const productoAlto = parseInt(producto.alto_mm);
      
      // Calcular volumen unitario del producto
      const volumenUnitarioM3 = volumenTotalRequeridoM3 / cantidadProductos;
      
      console.log(`Producto: ${producto.producto}`);
      console.log(`Dimensiones individuales: ${productoFrente}×${productoAncho}×${productoAlto} mm`);
      console.log(`Cantidad: ${cantidadProductos} unidades`);
      console.log(`Volumen unitario: ${volumenUnitarioM3.toFixed(9)} m³`);
      console.log(`Volumen total: ${volumenTotalRequeridoM3.toFixed(6)} m³`);
      
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
        
        // Verificar si el producto cabe físicamente en el contenedor
        const cabeEnContenedor = (
          productoFrente <= modelo.dim_int_frente &&
          productoAncho <= modelo.dim_int_profundo &&
          productoAlto <= modelo.dim_int_alto
        );
        
        if (!cabeEnContenedor) {
          console.log(`Producto no cabe en ${modelo.nombre_modelo} (${productoFrente}×${productoAncho}×${productoAlto} > ${modelo.dim_int_frente}×${modelo.dim_int_profundo}×${modelo.dim_int_alto})`);
          return null;
        }
        
        // Verificar si las dimensiones son exactamente iguales
        const dimensionesExactas = (
          productoFrente === modelo.dim_int_frente &&
          productoAncho === modelo.dim_int_profundo &&
          productoAlto === modelo.dim_int_alto
        );
        
        let modelosNecesarios, volumenTotalUtilizado;
        
        if (dimensionesExactas) {
          // Caso perfecto: 1 producto = 1 contenedor
          modelosNecesarios = cantidadProductos;
          volumenTotalUtilizado = volumenTotalRequeridoM3;
          console.log(`Ajuste perfecto - ${cantidadProductos} contenedores necesarios (1 producto = 1 contenedor)`);
        } else {
          // Calcular cuántos productos caben en un contenedor por volumen
          const productosPorContenedor = Math.floor(volumenModeloM3 / volumenUnitarioM3);
          modelosNecesarios = Math.ceil(cantidadProductos / productosPorContenedor);
          volumenTotalUtilizado = volumenTotalRequeridoM3;
          console.log(`${productosPorContenedor} productos por contenedor, ${modelosNecesarios} contenedores necesarios`);
        }
        
        // Calcular volumen total disponible con estos contenedores
        const volumenTotalDisponible = modelosNecesarios * volumenModeloM3;
        
        // Calcular eficiencia (qué tan bien aprovechamos el espacio)
        const eficiencia = (volumenTotalUtilizado / volumenTotalDisponible) * 100;
        
        console.log(`Modelo ${modelo.nombre_modelo}: ${modelosNecesarios} contenedores, ${eficiencia.toFixed(1)}% eficiencia`);
        
        // Calcular espacio sobrante o faltante
        const espacioSobrante = volumenTotalDisponible - volumenTotalUtilizado;
        const porcentajeEspacio = (espacioSobrante / volumenTotalUtilizado) * 100;
        
        // Determinar mensaje de comparación detallado
        let mensajeComparacion;
        let recomendacion = "";
        
        if (dimensionesExactas) {
          if (eficiencia >= 99) {
            mensajeComparacion = "🎯 Ajuste perfecto dimensional";
            recomendacion = "¡OPCIÓN IDEAL! Dimensiones exactas, sin desperdicio";
          } else {
            mensajeComparacion = "🎯 Ajuste dimensional con espacio mínimo";
            recomendacion = "Excelente opción, dimensiones exactas";
          }
        } else if (eficiencia >= 95) {
          mensajeComparacion = `✅ Aprovechamiento excelente (${espacioSobrante.toFixed(6)} m³ sobrante)`;
          recomendacion = "MUY RECOMENDADO - Mínimo desperdicio";
        } else if (eficiencia >= 85) {
          mensajeComparacion = `✅ Buen aprovechamiento (${espacioSobrante.toFixed(6)} m³ sobrante)`;
          recomendacion = "RECOMENDADO - Poco espacio desperdiciado";
        } else if (eficiencia >= 70) {
          mensajeComparacion = `📦 Aprovechamiento moderado (${espacioSobrante.toFixed(6)} m³ sobrante)`;
          recomendacion = "ACEPTABLE - Espacio moderadamente desperdiciado";
        } else if (eficiencia >= 50) {
          mensajeComparacion = `⚠️ Mucho espacio sobrante (${espacioSobrante.toFixed(6)} m³ desperdiciado)`;
          recomendacion = "NO RECOMENDADO - Mucho desperdicio";
        } else {
          mensajeComparacion = `❌ Contenedor muy grande (${espacioSobrante.toFixed(6)} m³ desperdiciado)`;
          recomendacion = "EVITAR - Excesivo desperdicio de espacio";
        }
        
        // Agregar información sobre la proporción
        let detalleEspacio = "";
        if (porcentajeEspacio < 1) {
          detalleEspacio = "Se ajusta casi perfectamente";
        } else if (porcentajeEspacio <= 10) {
          detalleEspacio = "Sobra muy poco espacio";
        } else if (porcentajeEspacio <= 25) {
          detalleEspacio = "Sobra poco espacio";
        } else if (porcentajeEspacio <= 50) {
          detalleEspacio = "Sobra espacio moderado";
        } else if (porcentajeEspacio <= 100) {
          detalleEspacio = "Sobra mucho espacio";
        } else {
          detalleEspacio = "Sobra demasiado espacio";
        }
        
        return {
          modelo_id: modelo.modelo_id,
          nombre_modelo: modelo.nombre_modelo,
          volumen_litros: modelo.volumen_litros,
          cantidad_sugerida: modelosNecesarios,
          total_productos_transportados: cantidadProductos,
          volumen_total_productos: volumenTotalUtilizado,
          volumen_total_contenedores: volumenTotalDisponible,
          espacio_sobrante_m3: espacioSobrante,
          porcentaje_espacio_sobrante: Math.round(porcentajeEspacio * 10) / 10,
          eficiencia: Math.round(eficiencia * 10) / 10,
          mensaje_comparacion: mensajeComparacion,
          recomendacion: recomendacion,
          detalle_espacio: detalleEspacio,
          es_ajuste_perfecto: dimensionesExactas,
          nivel_recomendacion: eficiencia >= 95 ? 'EXCELENTE' : 
                             eficiencia >= 85 ? 'BUENO' : 
                             eficiencia >= 70 ? 'ACEPTABLE' : 
                             eficiencia >= 50 ? 'MALO' : 'EVITAR',
          dimensiones_internas: {
            frente: modelo.dim_int_frente, // mm
            profundo: modelo.dim_int_profundo, // mm
            alto: modelo.dim_int_alto // mm
          }
        };
      }).filter(sugerencia => sugerencia !== null);
      
      console.log(`Sugerencias generadas: ${sugerencias.length}`);
      console.log('Primeras 2 sugerencias:', sugerencias.slice(0, 2));
      
      // Ordenar por mejor recomendación (priorizar ajuste perfecto, luego eficiencia)
      const sugerenciasOrdenadas = sugerencias.sort((a, b) => {
        // Prioridad 1: Ajuste perfecto dimensional
        if (a.es_ajuste_perfecto && !b.es_ajuste_perfecto) return -1;
        if (!a.es_ajuste_perfecto && b.es_ajuste_perfecto) return 1;
        
        // Prioridad 2: Eficiencia alta (mayor eficiencia = mejor)
        if (a.eficiencia !== b.eficiencia) {
          return b.eficiencia - a.eficiencia;
        }
        
        // Prioridad 3: Menor cantidad de contenedores (más económico)
        if (a.cantidad_sugerida !== b.cantidad_sugerida) {
          return a.cantidad_sugerida - b.cantidad_sugerida;
        }
        
        // Prioridad 4: Menor volumen total (contenedores más pequeños)
        return a.volumen_total_contenedores - b.volumen_total_contenedores;
      });
      
      // Marcar la mejor opción
      if (sugerenciasOrdenadas.length > 0) {
        sugerenciasOrdenadas[0].es_mejor_opcion = true;
        sugerenciasOrdenadas[0].etiqueta_recomendacion = "🏆 MEJOR OPCIÓN";
      }
      
      console.log('Sugerencias calculadas y ordenadas exitosamente');
      console.log(`Mejor opción: ${sugerenciasOrdenadas[0]?.nombre_modelo} (${sugerenciasOrdenadas[0]?.eficiencia}% eficiencia)`);
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