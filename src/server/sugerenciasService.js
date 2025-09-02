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

  // Crear una nueva sugerencia
  createSugerencia: async (data) => {
    try {
      const query = `
        INSERT INTO admin_platform.sugerencias_reemplazo (
          cliente_id, inv_id, modelo_sugerido, cantidad_sugerida, 
          modelo_id, estado
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING sugerencia_id
      `;
      const values = [
        data.cliente_id, data.inv_id, data.modelo_sugerido,
        data.cantidad_sugerida, data.modelo_id, data.estado || 'pendiente'
      ];
      const { rows } = await pool.query(query, values);
      const sugerenciaId = rows[0].sugerencia_id;
      
      // Ahora obtener la sugerencia completa con todos los JOINs
      const selectQuery = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.inv_id, s.modelo_sugerido,
          s.cantidad_sugerida, s.fecha_sugerencia, 
          s.modelo_id, s.estado,
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
      
      // Combinaciones alternativas (pares de modelos) para la orden completa
      try {
        // Modelos donde TODOS los productos caben por dimensiones
        const modelosViables = modelos.filter(m => {
          return inventarioItems.every(item => (
            (parseInt(item.largo_mm) <= m.dim_int_frente) &&
            (parseInt(item.ancho_mm) <= m.dim_int_profundo) &&
            (parseInt(item.alto_mm) <= m.dim_int_alto)
          ));
        }).map(m => ({
          modelo_id: m.modelo_id,
          nombre_modelo: m.nombre_modelo,
          volumen_m3: (m.volumen_litros || 0) / 1000
        })).filter(m => m.volumen_m3 > 0);

        const topModelos = modelosViables.slice(0, Math.min(5, modelosViables.length));
        const combos = [];
        for (let i = 0; i < topModelos.length; i++) {
          for (let j = i; j < topModelos.length; j++) {
            const A = topModelos[i];
            const B = topModelos[j];
            const maxA = Math.ceil(volumenTotalOrden / A.volumen_m3) + 2;
            const maxB = Math.ceil(volumenTotalOrden / B.volumen_m3) + 2;
            for (let a = 0; a <= maxA; a++) {
              for (let b = 0; b <= maxB; b++) {
                if (a + b === 0) continue;
                const volumenTotal = a * A.volumen_m3 + b * B.volumen_m3;
                if (volumenTotal + 1e-9 < volumenTotalOrden) continue;
                const eficienciaCombo = (volumenTotalOrden / volumenTotal) * 100;
                const sobrante = volumenTotal - volumenTotalOrden;
                combos.push({
                  items: [
                    ...(a > 0 ? [{ modelo_id: A.modelo_id, nombre_modelo: A.nombre_modelo, cantidad: a, volumen_m3: A.volumen_m3 }] : []),
                    ...(b > 0 ? [{ modelo_id: B.modelo_id, nombre_modelo: B.nombre_modelo, cantidad: b, volumen_m3: B.volumen_m3 }] : []),
                  ],
                  total_contenedores: a + b,
                  volumen_total_disponible: volumenTotal,
                  eficiencia_porcentaje: Math.max(0, Math.min(100, eficienciaCombo)),
                  espacio_sobrante_m3: sobrante
                });
              }
            }
          }
        }

        combos.sort((x, y) => {
          if (y.eficiencia_porcentaje !== x.eficiencia_porcentaje) return y.eficiencia_porcentaje - x.eficiencia_porcentaje;
          if (x.total_contenedores !== y.total_contenedores) return x.total_contenedores - y.total_contenedores;
          return x.volumen_total_disponible - y.volumen_total_disponible;
        });

        const seen = new Set();
        const unicos = [];
        for (const c of combos) {
          const key = c.items
            .slice()
            .sort((a, b) => a.modelo_id - b.modelo_id)
            .map(it => `${it.modelo_id}x${it.cantidad}`)
            .join('+');
          if (!seen.has(key) && c.items.length >= 2) {
            seen.add(key);
            unicos.push(c);
          }
        }
        const top3 = unicos.slice(0, 3).map(c => ({
          ...c,
          etiqueta: c.eficiencia_porcentaje >= 90 ? 'ALTA EFICIENCIA' : c.eficiencia_porcentaje >= 80 ? 'RECOMENDADA' : 'ALTERNATIVA'
        }));
        if (sugerencias.length > 0 && top3.length > 0) {
          const bestSingle = sugerencias[0];
          const bestCombo = top3[0];
          const UMBRAL = 80;
      if ((bestCombo.eficiencia_porcentaje || 0) >= UMBRAL && (bestCombo.eficiencia_porcentaje || 0) >= (bestSingle.eficiencia || 0)) {
            const sugerenciaCombinada = {
              modelo_id: null,
              nombre_modelo: 'Combinación de modelos',
              cantidad_sugerida: bestCombo.total_contenedores,
              total_productos_transportados: cantidadTotalProductos,
              volumen_total_productos: volumenTotalOrden,
              volumen_total_contenedores: bestCombo.volumen_total_disponible,
              espacio_sobrante_m3: bestCombo.espacio_sobrante_m3,
              porcentaje_espacio_sobrante: Math.max(0, ((bestCombo.espacio_sobrante_m3 || 0) / volumenTotalOrden) * 100),
              eficiencia: Math.max(0, Math.min(100, bestCombo.eficiencia_porcentaje)),
              mensaje_comparacion: '✅ Combinación con alto aprovechamiento',
              recomendacion: bestCombo.eficiencia_porcentaje >= 95 ? 'MUY RECOMENDADO - Mínimo desperdicio' : 'RECOMENDADO - Buen aprovechamiento',
              nivel_recomendacion: bestCombo.eficiencia_porcentaje >= 95 ? 'EXCELENTE' : bestCombo.eficiencia_porcentaje >= 85 ? 'BUENO' : 'ACEPTABLE',
              es_mejor_opcion: true,
              etiqueta_recomendacion: '🏆 MEJOR OPCIÓN (COMBINACIÓN)',
              es_combinacion: true,
              combinacion_items: bestCombo.items,
              combinaciones_alternativas: top3,
        es_recomendable: (bestCombo.eficiencia_porcentaje || 0) >= UMBRAL,
        motivo_no_recomendable: (bestCombo.eficiencia_porcentaje || 0) >= UMBRAL ? undefined : 'Eficiencia baja (<80%)',
              es_calculo_por_orden: true
            };
            sugerencias[0].es_mejor_opcion = false;
            sugerencias.unshift(sugerenciaCombinada);
          } else {
            sugerencias[0].combinaciones_alternativas = top3;
          }
        }
      } catch (e) {
        console.warn('No se pudieron generar combinaciones alternativas para orden:', e.message || e);
      }

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
      
      // Generar combinaciones alternativas (mezcla de 2 modelos) para cubrir el volumen con mejor aprovechamiento
      try {
        const volumenRequerido = parseFloat(producto.volumen_total_m3_producto);

        // Filtrar solo modelos en los que el producto cabe
        const modelosViables = modelos.filter((m) => (
          productoFrente <= m.dim_int_frente &&
          productoAncho <= m.dim_int_profundo &&
          productoAlto <= m.dim_int_alto
        ));

        const combos = [];
        // Precalcular volúmenes m3 de modelos
        const modelosVol = modelosViables.map(m => ({
          modelo_id: m.modelo_id,
          nombre_modelo: m.nombre_modelo,
          volumen_m3: (m.volumen_litros || 0) / 1000
        })).filter(m => m.volumen_m3 > 0);

        // Limitar pares para rendimiento: tomar hasta 5 modelos más cercanos al volumen unitario
        const topModelos = modelosVol.slice(0, Math.min(5, modelosVol.length));

        // Explorar pares (incluyendo mismo modelo dos veces) con búsqueda acotada
        for (let i = 0; i < topModelos.length; i++) {
          for (let j = i; j < topModelos.length; j++) {
            const A = topModelos[i];
            const B = topModelos[j];
            const maxA = Math.ceil(volumenRequerido / A.volumen_m3) + 2;
            const maxB = Math.ceil(volumenRequerido / B.volumen_m3) + 2;

            for (let a = 0; a <= maxA; a++) {
              for (let b = 0; b <= maxB; b++) {
                if (a + b === 0) continue; // al menos un contenedor
                // Evitar combos que usen un solo modelo si ya evaluamos como sugerencia individual
                if (i === j && b > 0 && a === 0) continue;
                const volumenTotal = a * A.volumen_m3 + b * B.volumen_m3;
                if (volumenTotal <= 0) continue;
                if (volumenTotal + 1e-9 < volumenRequerido) continue; // no alcanza

                const eficienciaCombo = (volumenRequerido / volumenTotal) * 100;
                const sobrante = volumenTotal - volumenRequerido;

                combos.push({
                  items: [
                    ...(a > 0 ? [{ modelo_id: A.modelo_id, nombre_modelo: A.nombre_modelo, cantidad: a, volumen_m3: A.volumen_m3 }] : []),
                    ...(b > 0 ? [{ modelo_id: B.modelo_id, nombre_modelo: B.nombre_modelo, cantidad: b, volumen_m3: B.volumen_m3 }] : []),
                  ],
                  total_contenedores: a + b,
                  volumen_total_disponible: volumenTotal,
                  eficiencia_porcentaje: Math.max(0, Math.min(100, eficienciaCombo)),
                  espacio_sobrante_m3: sobrante
                });
              }
            }
          }
        }

        // Ordenar combos: mayor eficiencia, luego menos contenedores, luego menor volumen total
        combos.sort((x, y) => {
          if (y.eficiencia_porcentaje !== x.eficiencia_porcentaje) return y.eficiencia_porcentaje - x.eficiencia_porcentaje;
          if (x.total_contenedores !== y.total_contenedores) return x.total_contenedores - y.total_contenedores;
          return x.volumen_total_disponible - y.volumen_total_disponible;
        });

        // Quitar duplicados equivalentes (mismos modelos y cantidades)
        const seen = new Set();
        const unicos = [];
        for (const c of combos) {
          const key = c.items
            .slice()
            .sort((a, b) => a.modelo_id - b.modelo_id)
            .map(it => `${it.modelo_id}x${it.cantidad}`)
            .join('+');
          if (!seen.has(key) && c.items.length >= 2) { // mantener solo combinaciones (>=2 modelos)
            seen.add(key);
            unicos.push(c);
          }
        }

        const top3 = unicos.slice(0, 3).map(c => ({
          ...c,
          etiqueta: c.eficiencia_porcentaje >= 90 ? 'ALTA EFICIENCIA' : c.eficiencia_porcentaje >= 80 ? 'RECOMENDADA' : 'ALTERNATIVA'
        }));
        // Promocionar combinación si supera a la mejor single-model y cumple umbral
        if (sugerenciasOrdenadas.length > 0 && top3.length > 0) {
          const bestSingle = sugerenciasOrdenadas[0];
          const bestCombo = top3[0];
          const UMBRAL = 80; // mínimo 80% para recomendar
          if ((bestCombo.eficiencia_porcentaje || 0) >= UMBRAL && (bestCombo.eficiencia_porcentaje || 0) >= (bestSingle.eficiencia || 0)) {
            // Crear sugerencia sintética de combinación
            const sugerenciaCombinada = {
              modelo_id: null,
              nombre_modelo: 'Combinación de modelos',
              cantidad_sugerida: bestCombo.total_contenedores,
              total_productos_transportados: cantidadProductos,
              volumen_total_productos: volumenTotalRequeridoM3,
              volumen_total_contenedores: bestCombo.volumen_total_disponible,
              espacio_sobrante_m3: bestCombo.espacio_sobrante_m3,
              porcentaje_espacio_sobrante: Math.max(0, ((bestCombo.espacio_sobrante_m3 || 0) / volumenTotalRequeridoM3) * 100),
              eficiencia: Math.max(0, Math.min(100, bestCombo.eficiencia_porcentaje)),
              mensaje_comparacion: '✅ Combinación con alto aprovechamiento',
              recomendacion: bestCombo.eficiencia_porcentaje >= 95 ? 'MUY RECOMENDADO - Mínimo desperdicio' : 'RECOMENDADO - Buen aprovechamiento',
              nivel_recomendacion: bestCombo.eficiencia_porcentaje >= 95 ? 'EXCELENTE' : bestCombo.eficiencia_porcentaje >= 85 ? 'BUENO' : 'ACEPTABLE',
              es_mejor_opcion: true,
              etiqueta_recomendacion: '🏆 MEJOR OPCIÓN (COMBINACIÓN)',
              es_combinacion: true,
              combinacion_items: bestCombo.items,
              combinaciones_alternativas: top3,
            };
            // Quitar la marca de mejor opción al single-model y anteponer combinación
            if (sugerenciasOrdenadas[0]) sugerenciasOrdenadas[0].es_mejor_opcion = false;
            sugerenciasOrdenadas.unshift(sugerenciaCombinada);
          } else {
            // Si no se promociona, igualmente adjuntar las alternativas al primero
            sugerenciasOrdenadas[0].combinaciones_alternativas = top3;
          }
        }
      } catch (e) {
        console.warn('No se pudieron generar combinaciones alternativas:', e.message || e);
      }

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