const pool = require('./config/db');

const sugerenciasService = {
  // Obtener todas las sugerencias
  getAllSugerencias: async () => {
    try {
      const query = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.inv_id, s.modelo_sugerido,
          s.cantidad_sugerida, s.fecha_sugerencia, 
          s.modelo_id, s.estado,
          COALESCE(s.orden_despacho, i.orden_despacho) AS orden_despacho,
          c.nombre_cliente,
          m.nombre_modelo, m.volumen_litros,
          i.descripcion_producto as descripcion_inventario, i.producto, i.cantidad_despachada as cantidad_inventario, 
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

  // Obtener sugerencias con paginación y búsqueda opcional
  getSugerenciasPaginated: async ({ limit = 50, offset = 0, search = '', clienteId = null } = {}) => {
    try {
      const params = [];
      let whereClauses = [];

      if (clienteId) {
        params.push(clienteId);
        whereClauses.push(`s.cliente_id = $${params.length}`);
      }

      if (search && search.trim()) {
        // Búsqueda en varios campos
        params.push(`%${search.trim().toLowerCase()}%`);
        const p = `$${params.length}`;
        whereClauses.push(`(
          LOWER(COALESCE(c.nombre_cliente, '')) ILIKE ${p} OR
          LOWER(COALESCE(i.producto, '')) ILIKE ${p} OR
          LOWER(COALESCE(i.descripcion_producto, '')) ILIKE ${p} OR
          LOWER(COALESCE(m.nombre_modelo, '')) ILIKE ${p} OR
          LOWER(COALESCE(s.estado, '')) ILIKE ${p}
        )`);
      }

      const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Total
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM admin_platform.sugerencias_reemplazo s
        LEFT JOIN admin_platform.clientes_prospectos c ON s.cliente_id = c.cliente_id
        LEFT JOIN admin_platform.modelos m ON s.modelo_id = m.modelo_id
        LEFT JOIN admin_platform.inventario_prospecto i ON s.inv_id = i.inv_id
        ${whereSQL}
      `;
      const { rows: countRows } = await pool.query(countQuery, params);
      const total = parseInt(countRows?.[0]?.total || '0', 10);

      // Items
      const itemsParams = [...params, limit, offset];
      const itemsQuery = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.inv_id, s.modelo_sugerido,
          s.cantidad_sugerida, s.fecha_sugerencia, 
          s.modelo_id, s.estado,
          COALESCE(s.orden_despacho, i.orden_despacho) AS orden_despacho,
          c.nombre_cliente,
          m.nombre_modelo, m.volumen_litros,
          i.descripcion_producto as descripcion_inventario, i.producto, i.cantidad_despachada as cantidad_inventario, 
          i.largo_mm, i.ancho_mm, i.alto_mm
        FROM admin_platform.sugerencias_reemplazo s
        LEFT JOIN admin_platform.clientes_prospectos c ON s.cliente_id = c.cliente_id
        LEFT JOIN admin_platform.modelos m ON s.modelo_id = m.modelo_id
        LEFT JOIN admin_platform.inventario_prospecto i ON s.inv_id = i.inv_id
        ${whereSQL}
        ORDER BY s.fecha_sugerencia DESC
        LIMIT $${itemsParams.length - 1} OFFSET $${itemsParams.length}
      `;
      const { rows } = await pool.query(itemsQuery, itemsParams);
      return { total, items: rows };
    } catch (error) {
      console.error('Error al obtener sugerencias paginadas:', error);
      throw error;
    }
  },

  // Calcular recomendaciones agregadas por rango de fechas (fecha_de_despacho)
  calcularSugerenciasPorRangoTotal: async ({ cliente_id, startDate, endDate }) => {
    try {
      if (!cliente_id) throw new Error('cliente_id es requerido');
      if (!startDate || !endDate) throw new Error('startDate y endDate son requeridos');

      // Traer items del cliente dentro del rango por fecha de despacho (cast a date)
      const q = `
        SELECT inv_id, producto, descripcion_producto, cantidad_despachada, largo_mm, ancho_mm, alto_mm,
               volumen_total_m3_producto, fecha_de_despacho, orden_despacho
        FROM admin_platform.inventario_prospecto
        WHERE cliente_id = $1
          AND fecha_de_despacho::date BETWEEN $2::date AND $3::date
      `;
  const { rows: items } = await pool.query(q, [cliente_id, startDate, endDate]);

      const totalRegistros = items.length;
      const totalProductos = items.reduce((acc, it) => acc + (parseInt(it.cantidad_despachada) || 0), 0);
      const totalM3 = items.reduce((acc, it) => acc + (parseFloat(it.volumen_total_m3_producto) || 0), 0);
  // Contar órdenes incluyendo repetidas (no únicas)
  const totalOrdenes = items.filter(it => !!it.orden_despacho).length;

  // Resumen simple por producto para mostrar (limitado para UI/logs)
  const resumenProductos = items.slice(0, 50).map(it => ({
        inv_id: it.inv_id,
        producto: it.producto,
        descripcion: it.descripcion_producto,
        cantidad: parseInt(it.cantidad_despachada) || 0,
        volumen_individual: (parseFloat(it.volumen_total_m3_producto) || 0) / Math.max(1, parseInt(it.cantidad_despachada) || 1),
        volumen_total_producto: parseFloat(it.volumen_total_m3_producto) || 0,
        dimensiones: { largo_mm: it.largo_mm, ancho_mm: it.ancho_mm, alto_mm: it.alto_mm }
      }));

      // Reusar la lógica basada en volumen total
      let sugerencias = await sugerenciasService.calcularConVolumenTotal(
        totalM3,
        Math.max(1, totalProductos || 1),
        cliente_id,
        `RANGO ${startDate}..${endDate}`,
        resumenProductos
      );

      // Enriquecer cada sugerencia con detalle por producto usando TODOS los items del rango
      if (Array.isArray(sugerencias) && sugerencias.length > 0) {
        sugerencias = sugerencias.map(s => {
          const volumenModeloM3 = Number(s.volumen_modelo_m3 || 0);
          const detalle = items.map(it => {
            const cantidadProducto = parseInt(it.cantidad_despachada) || 0;
            const volumenTotalProducto = parseFloat(it.volumen_total_m3_producto) || 0;
            const volumenUnitario = cantidadProducto > 0 ? (volumenTotalProducto / cantidadProducto) : 0;
            const contenedoresNecesarios = volumenModeloM3 > 0 ? Math.max(1, Math.ceil(volumenTotalProducto / volumenModeloM3)) : 0;
            return {
              inv_id: it.inv_id,
              producto: it.producto,
              descripcion_producto: it.descripcion_producto,
              cantidad_productos: cantidadProducto,
              contenedores_necesarios: contenedoresNecesarios,
              tipo_ajuste: 'volumetrico',
              volumen_unitario: volumenUnitario,
              volumen_total_producto: volumenTotalProducto
            };
          });
          // Para el rango total, la cantidad sugerida debe ser la suma por producto (no por volumen global)
          const cantidadSugeridaSumada = detalle.reduce((acc, d) => acc + (parseInt(d.contenedores_necesarios) || 0), 0);
          return {
            ...s,
            detalle_contenedores_por_producto: detalle,
            cantidad_sugerida: cantidadSugeridaSumada
          };
        });
      }

      return {
        resumen: {
          startDate,
          endDate,
          total_ordenes: totalOrdenes,
          total_registros: totalRegistros,
          total_productos: totalProductos,
          volumen_total_m3: totalM3
        },
  sugerencias
      };
    } catch (error) {
      console.error('Error en calcularSugerenciasPorRangoTotal:', error);
      throw error;
    }
  },

  // Crear una nueva sugerencia
  createSugerencia: async (data) => {
    try {
      // Derivar orden_despacho desde inventario si no viene explícito
      let ordenDespacho = data.orden_despacho || null;
      if (!ordenDespacho && data.inv_id) {
        try {
          const { rows: invRows } = await pool.query(
            'SELECT orden_despacho FROM admin_platform.inventario_prospecto WHERE inv_id = $1',
            [data.inv_id]
          );
          ordenDespacho = invRows?.[0]?.orden_despacho || null;
        } catch (e) {
          console.warn('No se pudo obtener orden_despacho desde inventario:', e?.message);
        }
      }

      // Intentar insertar incluyendo orden_despacho (si la columna existe)
      let sugerenciaId;
      try {
        const insertWithOrden = `
          INSERT INTO admin_platform.sugerencias_reemplazo (
            cliente_id, inv_id, modelo_sugerido, cantidad_sugerida, 
            modelo_id, estado, orden_despacho
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING sugerencia_id
        `;
        const valuesWithOrden = [
          data.cliente_id, data.inv_id, data.modelo_sugerido,
          data.cantidad_sugerida, data.modelo_id, data.estado || 'pendiente', ordenDespacho
        ];
        const { rows } = await pool.query(insertWithOrden, valuesWithOrden);
        sugerenciaId = rows[0].sugerencia_id;
      } catch (e) {
        // Compatibilidad si aún no existe la columna orden_despacho
        console.warn('Insert con orden_despacho falló, reintentando sin esa columna:', e?.message);
        const insertWithoutOrden = `
          INSERT INTO admin_platform.sugerencias_reemplazo (
            cliente_id, inv_id, modelo_sugerido, cantidad_sugerida, 
            modelo_id, estado
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING sugerencia_id
        `;
        const valuesWithoutOrden = [
          data.cliente_id, data.inv_id, data.modelo_sugerido,
          data.cantidad_sugerida, data.modelo_id, data.estado || 'pendiente'
        ];
        const { rows } = await pool.query(insertWithoutOrden, valuesWithoutOrden);
        sugerenciaId = rows[0].sugerencia_id;
      }

      // Ahora obtener la sugerencia completa con todos los JOINs
      const selectQuery = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.inv_id, s.modelo_sugerido,
          s.cantidad_sugerida, s.fecha_sugerencia, 
          s.modelo_id, s.estado,
          COALESCE(s.orden_despacho, i.orden_despacho) AS orden_despacho,
          c.nombre_cliente,
          m.nombre_modelo, m.volumen_litros,
          i.descripcion_producto as descripcion_inventario, i.producto, i.cantidad_despachada as cantidad_inventario, 
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

  calcularSugerenciasPorOrden: async (datos) => {
    try {
      console.log('Datos recibidos para cálculo por orden:', datos);
      
      const { cliente_id, orden_despacho } = datos;
      
      if (!orden_despacho) {
        throw new Error('Orden de despacho es requerida');
      }
      
      // Obtener todos los productos de la orden de despacho específica
      const inventarioQuery = `
        SELECT 
          inv_id, producto, cantidad_despachada, largo_mm, ancho_mm, alto_mm, 
          volumen_total_m3_producto, descripcion_producto
        FROM admin_platform.inventario_prospecto
        WHERE cliente_id = $1 AND orden_despacho = $2
      `;
      
      const { rows: inventarioItems } = await pool.query(inventarioQuery, [cliente_id, orden_despacho]);
      console.log(`Items encontrados para orden ${orden_despacho}:`, inventarioItems.length);
      
      if (inventarioItems.length === 0) {
        console.log('No se encontraron productos para esta orden de despacho');
        return [];
      }
      
      // Calcular el volumen total de toda la orden (ESTE ES EL PUNTO CLAVE)
      const volumenTotalOrden = inventarioItems.reduce((total, item) => {
        return total + (parseFloat(item.volumen_total_m3_producto) || 0);
      }, 0);
      
      // Contar total de productos en la orden
      const cantidadTotalProductos = inventarioItems.reduce((total, item) => {
        return total + (parseInt(item.cantidad_despachada) || 0);
      }, 0);
      
      console.log(`Volumen total de la orden ${orden_despacho}: ${volumenTotalOrden} m³`);
      console.log(`Cantidad total de productos: ${cantidadTotalProductos}`);
      
      // Crear un resumen de productos para mostrar al usuario
      const resumenProductos = inventarioItems.map(item => ({
        producto: item.producto,
        descripcion: item.descripcion_producto,
        cantidad: item.cantidad_despachada,
        volumen_individual: parseFloat(item.volumen_total_m3_producto) || 0,
        dimensiones: {
          largo_mm: item.largo_mm,
          ancho_mm: item.ancho_mm,
          alto_mm: item.alto_mm
        }
      }));

      // CALCULAR POR CADA TIPO DE PRODUCTO Y SUMAR LOS CONTENEDORES
      // Esta es la lógica correcta: cada producto tiene sus propias características
      
      console.log(`Calculando contenedores para cada tipo de producto en la orden ${orden_despacho}`);
      
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
      
  // Calcular sugerencias sumando los contenedores necesarios para cada producto
  const sugerenciasPorProducto = modelos.map((modelo, index) => {
        console.log(`Evaluando modelo ${index + 1}/${modelos.length}:`, modelo.nombre_modelo);
        
        // Convertir volumen del modelo de litros a metros cúbicos
        const volumenModeloM3 = modelo.volumen_litros / 1000;
        console.log(`Modelo ${modelo.nombre_modelo}: ${volumenModeloM3.toFixed(6)} m³`);
        
        let totalContenedoresNecesarios = 0;
        let totalVolumenUtilizado = 0;
        let algunProductoNoCabe = false;
        let detalleContenedoresPorProducto = []; // Agregar array para detalles
        
        // Para cada tipo de producto en la orden, calcular contenedores individualmente
        for (const item of inventarioItems) {
          const cantidadProducto = parseInt(item.cantidad_despachada) || 0;
          const volumenTotalProducto = parseFloat(item.volumen_total_m3_producto) || 0;
          
          if (cantidadProducto > 0 && volumenTotalProducto > 0) {
            // Calcular volumen unitario IGUAL que en el cálculo individual
            const volumenUnitarioProducto = volumenTotalProducto / cantidadProducto;
            
            // Dimensiones del producto individual en mm (IGUAL que en el individual)
            const productoFrente = parseInt(item.largo_mm);
            const productoAncho = parseInt(item.ancho_mm);
            const productoAlto = parseInt(item.alto_mm);
            
            console.log(`Producto ${item.producto}: ${cantidadProducto} unidades`);
            console.log(`Dimensiones: ${productoFrente}×${productoAncho}×${productoAlto} mm`);
            console.log(`Volumen unitario: ${volumenUnitarioProducto.toFixed(9)} m³`);
            console.log(`Volumen total: ${volumenTotalProducto.toFixed(6)} m³`);
            
            // Verificar si el producto cabe físicamente en el contenedor (IGUAL que en el individual)
            const cabeEnContenedor = (
              productoFrente <= modelo.dim_int_frente &&
              productoAncho <= modelo.dim_int_profundo &&
              productoAlto <= modelo.dim_int_alto
            );
            
            if (!cabeEnContenedor) {
              console.log(`Producto ${item.producto} no cabe en ${modelo.nombre_modelo} (${productoFrente}×${productoAncho}×${productoAlto} > ${modelo.dim_int_frente}×${modelo.dim_int_profundo}×${modelo.dim_int_alto})`);
              algunProductoNoCabe = true;
              break;
            }
            
            // Verificar si las dimensiones son exactamente iguales (IGUAL que en el individual)
            const dimensionesExactas = (
              productoFrente === modelo.dim_int_frente &&
              productoAncho === modelo.dim_int_profundo &&
              productoAlto === modelo.dim_int_alto
            );
            
            let contenedoresParaEsteProducto;
            let tipoAjuste;
            
            if (dimensionesExactas) {
              // Caso perfecto: 1 producto = 1 contenedor (IGUAL que en el individual)
              contenedoresParaEsteProducto = cantidadProducto;
              tipoAjuste = "perfecto";
              console.log(`Ajuste perfecto - ${cantidadProducto} contenedores necesarios (1 producto = 1 contenedor)`);
            } else {
              // Calcular por volumen (IGUAL que en el individual)
              const productosPorContenedor = volumenModeloM3 / volumenUnitarioProducto;
              
              // Si no cabe ni un producto por volumen (IGUAL que en el individual)
              if (productosPorContenedor < 1) {
                console.log(`Producto ${item.producto} demasiado grande para ${modelo.nombre_modelo} (volumen: ${volumenUnitarioProducto.toFixed(6)} > ${volumenModeloM3.toFixed(6)})`);
                algunProductoNoCabe = true;
                break;
              }
              
              // Calcular contenedores necesarios (IGUAL que en el individual)
              contenedoresParaEsteProducto = Math.ceil(cantidadProducto / productosPorContenedor);
              tipoAjuste = "volumetrico";
              console.log(`${productosPorContenedor.toFixed(2)} productos por contenedor, ${contenedoresParaEsteProducto} contenedores necesarios`);
            }
            
            // Registrar detalle de este producto
            detalleContenedoresPorProducto.push({
              inv_id: item.inv_id,
              producto: item.producto,
              descripcion_producto: item.descripcion_producto,
              cantidad_productos: cantidadProducto,
              contenedores_necesarios: contenedoresParaEsteProducto,
              tipo_ajuste: tipoAjuste,
              volumen_unitario: volumenUnitarioProducto,
              volumen_total_producto: volumenTotalProducto
            });
            
            // Sumar al total
            totalContenedoresNecesarios += contenedoresParaEsteProducto;
            totalVolumenUtilizado += volumenTotalProducto;
          }
        }
        
        if (algunProductoNoCabe) {
          return null;
        }
        
        const modelosNecesarios = totalContenedoresNecesarios;
        const volumenTotalRequeridoM3 = totalVolumenUtilizado;
        
        console.log(`TOTAL para ${modelo.nombre_modelo}: ${modelosNecesarios} contenedores para toda la orden`);
        
        // Calcular volumen total disponible con estos contenedores
        const volumenTotalDisponible = modelosNecesarios * volumenModeloM3;
        
        // Calcular eficiencia
        let eficiencia = (volumenTotalRequeridoM3 / volumenTotalDisponible) * 100;
        eficiencia = Math.max(0, Math.min(100, eficiencia));
        
        console.log(`Modelo ${modelo.nombre_modelo}: ${modelosNecesarios} contenedores, ${eficiencia.toFixed(1)}% eficiencia`);
        
        // Calcular espacio sobrante
        const espacioSobrante = volumenTotalDisponible - volumenTotalRequeridoM3;
        const porcentajeEspacio = (espacioSobrante / volumenTotalRequeridoM3) * 100;
        
        // Usar la misma lógica de recomendación que el cálculo individual
        let mensajeComparacion;
        let recomendacion = "";
        
        if (eficiencia >= 95) {
          mensajeComparacion = `✅ Aprovechamiento excelente del espacio`;
          recomendacion = "MUY RECOMENDADO - Mínimo desperdicio";
        } else if (eficiencia >= 85) {
          mensajeComparacion = `✅ Buen aprovechamiento del volumen`;
          recomendacion = "RECOMENDADO - Poco espacio desperdiciado";
        } else if (eficiencia >= 70) {
          mensajeComparacion = `📦 Aprovechamiento moderado`;
          recomendacion = "ACEPTABLE - Espacio moderadamente desperdiciado";
        } else if (eficiencia >= 50) {
          mensajeComparacion = `⚠️ Mucho espacio sobrante`;
          recomendacion = "NO RECOMENDADO - Mucho desperdicio";
        } else {
          mensajeComparacion = `❌ Contenedor muy grande para esta orden`;
          recomendacion = "EVITAR - Excesivo desperdicio de espacio";
        }
        
        return {
          modelo_id: modelo.modelo_id,
          nombre_modelo: modelo.nombre_modelo,
          volumen_litros: modelo.volumen_litros,
          cantidad_sugerida: modelosNecesarios,
          total_productos_transportados: cantidadTotalProductos,
          volumen_total_productos: volumenTotalRequeridoM3,
          volumen_total_contenedores: volumenTotalDisponible,
          espacio_sobrante_m3: espacioSobrante,
          porcentaje_espacio_sobrante: Math.round(porcentajeEspacio * 10) / 10,
          eficiencia: Math.round(eficiencia * 10) / 10,
          mensaje_comparacion: mensajeComparacion,
          recomendacion: recomendacion,
          nivel_recomendacion: eficiencia >= 95 ? 'EXCELENTE' : 
                             eficiencia >= 85 ? 'BUENO' : 
                             eficiencia >= 70 ? 'ACEPTABLE' : 
                             eficiencia >= 50 ? 'MALO' : 'EVITAR',
          dimensiones_internas: {
            frente: modelo.dim_int_frente,
            profundo: modelo.dim_int_profundo,
            alto: modelo.dim_int_alto
          },
          orden_despacho: orden_despacho,
          resumen_productos: resumenProductos,
          detalle_contenedores_por_producto: detalleContenedoresPorProducto, // NUEVO: información detallada
          es_calculo_por_orden: true
        };
      }).filter(sugerencia => sugerencia !== null);

      // Alternativa: calcular por volumen total de la orden (una sola vez por modelo) para minimizar el redondeo acumulado
      const sugerenciasPorVolumenTotal = modelos.map((modelo, index) => {
        const volumenModeloM3 = (modelo.volumen_litros || 0) / 1000;
        if (!volumenModeloM3) return null;
        // Validar que TODOS los productos caben por dimensiones en este modelo
        const todosCaben = inventarioItems.every(item => (
          (parseInt(item.largo_mm) <= modelo.dim_int_frente) &&
          (parseInt(item.ancho_mm) <= modelo.dim_int_profundo) &&
          (parseInt(item.alto_mm) <= modelo.dim_int_alto)
        ));
        if (!todosCaben) return null;
        // Construir detalle por producto para soporte de guardado en frontend (fallback)
        const detalleContenedoresPorProducto = inventarioItems.map(item => {
          const cantidadProducto = parseInt(item.cantidad_despachada) || 0;
          const volumenTotalProducto = parseFloat(item.volumen_total_m3_producto) || 0;
          const volumenUnitario = cantidadProducto > 0 ? (volumenTotalProducto / cantidadProducto) : 0;
          const contenedoresNecesarios = volumenModeloM3 > 0 ? Math.max(1, Math.ceil(volumenTotalProducto / volumenModeloM3)) : 0;
          return {
            inv_id: item.inv_id,
            producto: item.producto,
            descripcion_producto: item.descripcion_producto,
            cantidad_productos: cantidadProducto,
            contenedores_necesarios: contenedoresNecesarios,
            tipo_ajuste: 'volumetrico',
            volumen_unitario: volumenUnitario,
            volumen_total_producto: volumenTotalProducto
          };
        });
        const modelosNecesarios = Math.ceil(volumenTotalOrden / volumenModeloM3);
        const volumenTotalDisponible = modelosNecesarios * volumenModeloM3;
        const eficiencia = Math.max(0, Math.min(100, (volumenTotalOrden / volumenTotalDisponible) * 100));
        const espacioSobrante = volumenTotalDisponible - volumenTotalOrden;
        let mensajeComparacion;
        let recomendacion = "";
        if (eficiencia >= 95) {
          mensajeComparacion = `✅ Aprovechamiento excelente del espacio`;
          recomendacion = "MUY RECOMENDADO - Mínimo desperdicio";
        } else if (eficiencia >= 85) {
          mensajeComparacion = `✅ Buen aprovechamiento del volumen`;
          recomendacion = "RECOMENDADO - Poco espacio desperdiciado";
        } else if (eficiencia >= 70) {
          mensajeComparacion = `📦 Aprovechamiento moderado`;
          recomendacion = "ACEPTABLE - Espacio moderadamente desperdiciado";
        } else if (eficiencia >= 50) {
          mensajeComparacion = `⚠️ Mucho espacio sobrante`;
          recomendacion = "NO RECOMENDADO - Mucho desperdicio";
        } else {
          mensajeComparacion = `❌ Contenedor muy grande para esta orden`;
          recomendacion = "EVITAR - Excesivo desperdicio de espacio";
        }
        return {
          modelo_id: modelo.modelo_id,
          nombre_modelo: modelo.nombre_modelo,
          volumen_litros: modelo.volumen_litros,
          cantidad_sugerida: modelosNecesarios,
          total_productos_transportados: cantidadTotalProductos,
          volumen_total_productos: volumenTotalOrden,
          volumen_total_contenedores: volumenTotalDisponible,
          espacio_sobrante_m3: espacioSobrante,
          porcentaje_espacio_sobrante: Math.round(((espacioSobrante / volumenTotalOrden) * 100) * 10) / 10,
          eficiencia: Math.round(eficiencia * 10) / 10,
          mensaje_comparacion: mensajeComparacion,
          recomendacion: recomendacion,
          nivel_recomendacion: eficiencia >= 95 ? 'EXCELENTE' : 
                             eficiencia >= 85 ? 'BUENO' : 
                             eficiencia >= 70 ? 'ACEPTABLE' : 
                             eficiencia >= 50 ? 'MALO' : 'EVITAR',
          dimensiones_internas: {
            frente: modelo.dim_int_frente,
            profundo: modelo.dim_int_profundo,
            alto: modelo.dim_int_alto
          },
          orden_despacho: orden_despacho,
          resumen_productos: resumenProductos,
          volumen_modelo_m3: volumenModeloM3,
          detalle_contenedores_por_producto: detalleContenedoresPorProducto,
          es_calculo_por_orden: true
        };
      }).filter(sugerencia => sugerencia !== null);

      // Fusionar por modelo: quedarnos con la variante de mayor eficiencia; empates -> menos contenedores -> menor volumen
      const porModelo = new Map();
      [...sugerenciasPorProducto, ...sugerenciasPorVolumenTotal].forEach(s => {
        const key = s.modelo_id;
        const prev = porModelo.get(key);
        if (!prev) porModelo.set(key, s);
        else {
          const d = (s.eficiencia || 0) - (prev.eficiencia || 0);
          if (d > 0) porModelo.set(key, s);
          else if (d === 0) {
            if ((s.cantidad_sugerida || 0) < (prev.cantidad_sugerida || 0)) porModelo.set(key, s);
            else if ((s.cantidad_sugerida || 0) === (prev.cantidad_sugerida || 0) && (s.volumen_total_contenedores || 0) < (prev.volumen_total_contenedores || 0)) porModelo.set(key, s);
          }
        }
      });

      const sugerencias = Array.from(porModelo.values());
      
  // Ordenar por eficiencia (mayor a menor); empates -> menos contenedores -> menor volumen total
  sugerencias.sort((a, b) => {
        const d = (b.eficiencia || 0) - (a.eficiencia || 0);
        if (d !== 0) return d;
        if ((a.cantidad_sugerida || 0) !== (b.cantidad_sugerida || 0)) return (a.cantidad_sugerida || 0) - (b.cantidad_sugerida || 0);
        return (a.volumen_total_contenedores || 0) - (b.volumen_total_contenedores || 0);
      });
      
      // Marcar mejor opción por defecto (solo si cumple umbral)
      if (sugerencias.length > 0) {
        const UMBRAL = 80;
        for (const s of sugerencias) {
          const eff = s.eficiencia || 0;
          s.es_recomendable = eff >= UMBRAL;
          if (!s.es_recomendable) s.motivo_no_recomendable = 'Eficiencia baja (<80%)';
        }
        if ((sugerencias[0].eficiencia || 0) >= UMBRAL) {
          sugerencias[0].es_mejor_opcion = true;
          sugerencias[0].etiqueta_recomendacion = '🏆 MEJOR OPCIÓN';
        } else {
          sugerencias[0].es_mejor_opcion = false;
          sugerencias[0].etiqueta_recomendacion = undefined;
        }
      }
      
  // Se deshabilitan combinaciones de modelos: solo recomendaciones de un solo modelo por solicitud

      // Calcular porcentaje de recomendación normalizado (top = 100) con desempate por menos contenedores
      if (sugerencias.length > 0) {
        const maxEff = Math.max(...sugerencias.map(s => (s.eficiencia || 0)));
        const conts = sugerencias.map(s => s.cantidad_sugerida || 0).filter(n => n > 0);
        const minCont = conts.length ? Math.min(...conts) : 1;
        const composites = sugerencias.map(s => {
          const effNorm = maxEff > 0 ? (s.eficiencia || 0) / maxEff : 0;
          const cont = s.cantidad_sugerida || minCont;
          const contFactor = cont > 0 ? Math.min(1, minCont / cont) : 1; // 1 para el mínimo
          return 0.9 * effNorm + 0.1 * contFactor;
        });
        const maxComp = Math.max(...composites);
        sugerencias.forEach((s, i) => {
          s.porcentaje_recomendacion = maxComp > 0 ? Math.round((composites[i] / maxComp) * 1000) / 10 : 0;
        });
        sugerencias[0].porcentaje_recomendacion = 100;
      }

      console.log(`Generadas ${sugerencias.length} sugerencias para orden ${orden_despacho}`);
      return sugerencias;
      
    } catch (error) {
      console.error('Error en calcularSugerenciasPorOrden:', error);
      throw error;
    }
  },

  // Función auxiliar para calcular con volumen total
  calcularConVolumenTotal: async (volumenTotalRequeridoM3, cantidadProductos, cliente_id, orden_despacho, resumenProductos) => {
    try {
      console.log(`Calculando para orden ${orden_despacho}:`);
      console.log(`Volumen total requerido: ${volumenTotalRequeridoM3.toFixed(6)} m³`);
      console.log(`Cantidad total de productos: ${cantidadProductos}`);
      console.log('Resumen de productos:', resumenProductos);
      
      // Para el cálculo por orden de despacho, usaremos el volumen total directamente
      // sin necesidad de dimensiones específicas de producto individual
      const volumenUnitarioPromedio = volumenTotalRequeridoM3 / cantidadProductos;
      
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
        
        // Convertir volumen del modelo de litros a metros cúbicos
        const volumenModeloM3 = modelo.volumen_litros / 1000;
        console.log(`Modelo ${modelo.nombre_modelo}: ${volumenModeloM3.toFixed(6)} m³`);
        
        // Para órdenes de despacho, calculamos basándonos solo en volumen total
        // Calcular cuántos contenedores necesitamos basándonos en volumen
        const modelosNecesarios = Math.ceil(volumenTotalRequeridoM3 / volumenModeloM3);
        
        // Calcular volumen total disponible con estos contenedores
        const volumenTotalDisponible = modelosNecesarios * volumenModeloM3;
        
        // Calcular eficiencia (qué tan bien aprovechamos el espacio)
        const eficiencia = (volumenTotalRequeridoM3 / volumenTotalDisponible) * 100;
        
        console.log(`Modelo ${modelo.nombre_modelo}: ${modelosNecesarios} contenedores, ${eficiencia.toFixed(1)}% eficiencia`);
        
        // Calcular espacio sobrante
        const espacioSobrante = volumenTotalDisponible - volumenTotalRequeridoM3;
        
        // Determinar mensaje de comparación detallado
        let mensajeComparacion;
        let recomendacion = "";
        
        if (eficiencia >= 95) {
          mensajeComparacion = `✅ Aprovechamiento excelente del espacio`;
          recomendacion = "MUY RECOMENDADO - Mínimo desperdicio";
        } else if (eficiencia >= 85) {
          mensajeComparacion = `✅ Buen aprovechamiento del volumen`;
          recomendacion = "RECOMENDADO - Poco espacio desperdiciado";
        } else if (eficiencia >= 70) {
          mensajeComparacion = `📦 Aprovechamiento moderado`;
          recomendacion = "ACEPTABLE - Espacio moderadamente desperdiciado";
        } else if (eficiencia >= 50) {
          mensajeComparacion = `⚠️ Mucho espacio sobrante`;
          recomendacion = "NO RECOMENDADO - Mucho desperdicio";
        } else {
          mensajeComparacion = `❌ Contenedor muy grande para esta orden`;
          recomendacion = "EVITAR - Excesivo desperdicio de espacio";
        }
        
        return {
          modelo_id: modelo.modelo_id,
          nombre_modelo: modelo.nombre_modelo,
          volumen_modelo_m3: volumenModeloM3,
          cantidad_sugerida: modelosNecesarios,
          total_productos_transportados: cantidadProductos,
          volumen_total_productos: volumenTotalRequeridoM3,
          volumen_total_disponible: volumenTotalDisponible,
          eficiencia_porcentaje: eficiencia,
          espacio_sobrante_m3: espacioSobrante,
          mensaje_comparacion: mensajeComparacion,
          recomendacion_nivel: recomendacion,
          orden_despacho: orden_despacho,
          resumen_productos: resumenProductos,
          es_calculo_por_orden: true
        };
      }).filter(sugerencia => sugerencia !== null);
      
  // Ordenar por eficiencia (mayor a menor) para mostrar las mejores opciones primero; empates -> menos contenedores -> menor volumen total
  sugerencias.sort((a, b) => {
        const d = (b.eficiencia_porcentaje || 0) - (a.eficiencia_porcentaje || 0);
        if (d !== 0) return d;
        if ((a.cantidad_sugerida || 0) !== (b.cantidad_sugerida || 0)) return (a.cantidad_sugerida || 0) - (b.cantidad_sugerida || 0);
        return (a.volumen_total_disponible || 0) - (b.volumen_total_disponible || 0);
      });
      
      // Marcar la mejor opción y calcular porcentaje de recomendación
      if (sugerencias.length > 0) {
        const UMBRAL = 80;
        for (const s of sugerencias) {
          const eff = s.eficiencia_porcentaje || 0;
          s.es_recomendable = eff >= UMBRAL;
          if (!s.es_recomendable) s.motivo_no_recomendable = 'Eficiencia baja (<80%)';
        }
        if ((sugerencias[0].eficiencia_porcentaje || 0) >= UMBRAL) {
          sugerencias[0].es_mejor_opcion = true;
          sugerencias[0].etiqueta_recomendacion = '🏆 MEJOR OPCIÓN';
        } else {
          sugerencias[0].es_mejor_opcion = false;
          sugerencias[0].etiqueta_recomendacion = undefined;
        }

        // Recomposición con desempate por menos contenedores
        const maxEff = Math.max(...sugerencias.map(s => (s.eficiencia_porcentaje || 0)));
        const conts = sugerencias.map(s => s.cantidad_sugerida || 0).filter(n => n > 0);
        const minCont = conts.length ? Math.min(...conts) : 1;
        const composites = sugerencias.map(s => {
          const effNorm = maxEff > 0 ? (s.eficiencia_porcentaje || 0) / maxEff : 0;
          const cont = s.cantidad_sugerida || minCont;
          const contFactor = cont > 0 ? Math.min(1, minCont / cont) : 1;
          return 0.9 * effNorm + 0.1 * contFactor;
        });
        const maxComp = Math.max(...composites);
        sugerencias.forEach((s, i) => {
          s.porcentaje_recomendacion = maxComp > 0 ? Math.round((composites[i] / maxComp) * 1000) / 10 : 0;
        });
        sugerencias[0].porcentaje_recomendacion = 100;
      }
      
      console.log(`Generadas ${sugerencias.length} sugerencias para orden ${orden_despacho}`);
      return sugerencias;
      
    } catch (error) {
      console.error('Error en calcularConVolumenTotal:', error);
      throw error;
    }
  },

  // Calcular sugerencias basadas en dimensiones (función original para mantener compatibilidad)
  calcularSugerencias: async (datos) => {
    try {
      console.log('Datos recibidos:', datos);
      
      // Extraer datos del objeto recibido
      const { cliente_id, inv_id, modelo_especifico } = datos;
      
      // Obtener el producto específico del inventario usando inv_id
      const inventarioQuery = `
        SELECT 
          producto, cantidad_despachada, largo_mm, ancho_mm, alto_mm, volumen_total_m3_producto, orden_despacho
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
      
      // Para cálculo individual, siempre usar la lógica dimensional individual
      // independientemente de si tiene orden de despacho
      
      // Usar los datos de la base de datos
      const cantidadProductos = parseInt(producto.cantidad_despachada);
      const volumenTotalRequeridoM3 = parseFloat(producto.volumen_total_m3_producto);
      
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
      
      // Buscar modelos Cube disponibles (filtrar por modelo específico si se proporciona)
      let query = `
        SELECT 
          modelo_id, nombre_modelo, volumen_litros,
          dim_int_frente, dim_int_profundo, dim_int_alto
        FROM admin_platform.modelos
        WHERE tipo = 'Cube'
      `;
      
      let queryParams = [];
      if (modelo_especifico) {
        query += ` AND modelo_id = $1`;
        queryParams.push(modelo_especifico);
      }
      
      query += ` ORDER BY volumen_litros ASC`;
      
      const { rows: modelos } = await pool.query(query, queryParams);
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
          // Calcular cuántos productos caben en un contenedor por volumen de manera más precisa
          const productosPorContenedor = volumenModeloM3 / volumenUnitarioM3;
          
          // Si no cabe ni un producto por volumen, significa que el producto es muy grande para el contenedor
          if (productosPorContenedor < 1) {
            console.log(`Producto demasiado grande para ${modelo.nombre_modelo} (volumen: ${volumenUnitarioM3.toFixed(6)} > ${volumenModeloM3.toFixed(6)})`);
            return null;
          }
          
          // Calcular contenedores necesarios de manera más precisa
          modelosNecesarios = Math.ceil(cantidadProductos / productosPorContenedor);
          volumenTotalUtilizado = volumenTotalRequeridoM3;
          console.log(`${productosPorContenedor} productos por contenedor, ${modelosNecesarios} contenedores necesarios`);
        }
        
        // Calcular volumen total disponible con estos contenedores
        const volumenTotalDisponible = modelosNecesarios * volumenModeloM3;
        
        // Calcular eficiencia (qué tan bien aprovechamos el espacio)
        // Eficiencia = volumen utilizado / volumen disponible * 100
        let eficiencia = (volumenTotalUtilizado / volumenTotalDisponible) * 100;
        
        // Asegurar que la eficiencia no sea mayor a 100% ni menor a 0%
        eficiencia = Math.max(0, Math.min(100, eficiencia));
        
        console.log(`Modelo ${modelo.nombre_modelo}: ${modelosNecesarios} contenedores, ${eficiencia.toFixed(1)}% eficiencia`);
        
  // Calcular espacio sobrante o faltante
        const espacioSobrante = volumenTotalDisponible - volumenTotalUtilizado;
        const porcentajeEspacio = (espacioSobrante / volumenTotalUtilizado) * 100;
        
        // Determinar mensaje de comparación detallado
        let mensajeComparacion;
        let recomendacion = "";
        
        if (eficiencia >= 95) {
          mensajeComparacion = `✅ Aprovechamiento excelente`;
          recomendacion = "MUY RECOMENDADO - Mínimo desperdicio";
        } else if (eficiencia >= 85) {
          mensajeComparacion = `✅ Buen aprovechamiento`;
          recomendacion = "RECOMENDADO - Poco espacio desperdiciado";
        } else if (eficiencia >= 70) {
          mensajeComparacion = `📦 Aprovechamiento moderado`;
          recomendacion = "ACEPTABLE - Espacio moderadamente desperdiciado";
        } else if (eficiencia >= 50) {
          mensajeComparacion = `⚠️ Mucho espacio sobrante`;
          recomendacion = "NO RECOMENDADO - Mucho desperdicio";
        } else {
          mensajeComparacion = `❌ Contenedor muy grande`;
          recomendacion = "EVITAR - Excesivo desperdicio de espacio";
        }
        
        // Agregar información especial para ajuste dimensional perfecto
        if (dimensionesExactas) {
          mensajeComparacion = `🎯 Ajuste dimensional con espacio mínimo`;
          if (eficiencia >= 95) {
            recomendacion = "IDEAL - Dimensiones exactas con alta eficiencia";
          } else {
            recomendacion = "Excelente opción, dimensiones exactas";
          }
        }
        
        // Agregar información sobre la proporción y dejar claro el sobrante
        let detalleEspacio = "";
        if (porcentajeEspacio < 1) {
          detalleEspacio = `Se ajusta casi perfectamente. Sobra ${(espacioSobrante * 1000).toFixed(1)} litros (${(Math.max(0, porcentajeEspacio)).toFixed(1)}%)`;
        } else if (porcentajeEspacio <= 10) {
          detalleEspacio = `Sobra muy poco espacio: ${(espacioSobrante * 1000).toFixed(1)} litros (${(Math.max(0, porcentajeEspacio)).toFixed(1)}%)`;
        } else if (porcentajeEspacio <= 25) {
          detalleEspacio = `Sobra poco espacio: ${(espacioSobrante * 1000).toFixed(1)} litros (${(Math.max(0, porcentajeEspacio)).toFixed(1)}%)`;
        } else if (porcentajeEspacio <= 50) {
          detalleEspacio = `Sobra espacio moderado: ${(espacioSobrante * 1000).toFixed(1)} litros (${(Math.max(0, porcentajeEspacio)).toFixed(1)}%)`;
        } else if (porcentajeEspacio <= 100) {
          detalleEspacio = `Sobra mucho espacio: ${(espacioSobrante * 1000).toFixed(1)} litros (${(Math.max(0, porcentajeEspacio)).toFixed(1)}%)`;
        } else {
          detalleEspacio = `Sobra demasiado espacio: ${(espacioSobrante * 1000).toFixed(1)} litros (${(Math.max(0, porcentajeEspacio)).toFixed(1)}%)`;
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
      
      // Ordenar por mejor recomendación (PRIORIZAR EFICIENCIA)
      const sugerenciasOrdenadas = sugerencias.sort((a, b) => {
        // Prioridad 1: EFICIENCIA (mayor eficiencia = mejor)
        if (a.eficiencia !== b.eficiencia) {
          return b.eficiencia - a.eficiencia;
        }
        
        // Prioridad 2: Si tienen la misma eficiencia, preferir ajuste perfecto dimensional
        if (a.es_ajuste_perfecto && !b.es_ajuste_perfecto) return -1;
        if (!a.es_ajuste_perfecto && b.es_ajuste_perfecto) return 1;
        
        // Prioridad 3: Menor cantidad de contenedores (más económico)
        if (a.cantidad_sugerida !== b.cantidad_sugerida) {
          return a.cantidad_sugerida - b.cantidad_sugerida;
        }
        
        // Prioridad 4: Menor volumen total (contenedores más pequeños)
        return a.volumen_total_contenedores - b.volumen_total_contenedores;
      });
      
      // Por defecto, marcar mejor single-model solo si cumple umbral
      if (sugerenciasOrdenadas.length > 0) {
        const UMBRAL = 80;
        if ((sugerenciasOrdenadas[0].eficiencia || 0) >= UMBRAL) {
          sugerenciasOrdenadas[0].es_mejor_opcion = true;
          sugerenciasOrdenadas[0].etiqueta_recomendacion = '🏆 MEJOR OPCIÓN';
        } else {
          sugerenciasOrdenadas[0].es_mejor_opcion = false;
          sugerenciasOrdenadas[0].etiqueta_recomendacion = undefined;
        }
      }
      
  // Se deshabilitan combinaciones de modelos en modo individual: solo single-model

      // Calcular porcentaje de recomendación normalizado (top = 100) con desempate por menos contenedores
      if (sugerenciasOrdenadas.length > 0) {
        const maxEff = Math.max(...sugerenciasOrdenadas.map(s => (s.eficiencia || 0)));
        const conts = sugerenciasOrdenadas.map(s => s.cantidad_sugerida || 0).filter(n => n > 0);
        const minCont = conts.length ? Math.min(...conts) : 1;
        const composites = sugerenciasOrdenadas.map(s => {
          const effNorm = maxEff > 0 ? (s.eficiencia || 0) / maxEff : 0;
          const cont = s.cantidad_sugerida || minCont;
          const contFactor = cont > 0 ? Math.min(1, minCont / cont) : 1;
          return 0.9 * effNorm + 0.1 * contFactor;
        });
        const maxComp = Math.max(...composites);
        sugerenciasOrdenadas.forEach((s, i) => {
          s.porcentaje_recomendacion = maxComp > 0 ? Math.round((composites[i] / maxComp) * 1000) / 10 : 0;
        });
        sugerenciasOrdenadas[0].porcentaje_recomendacion = 100;
      }

      console.log('Sugerencias calculadas y ordenadas exitosamente');
      console.log(`Mejor opción: ${sugerenciasOrdenadas[0]?.nombre_modelo} (${sugerenciasOrdenadas[0]?.porcentaje_recomendacion}% recomendación)`);
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