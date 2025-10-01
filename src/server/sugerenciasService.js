const pool = require('./config/db');

// Debug logger for tracing calculations in the terminal
const DEBUG_SUGERENCIAS = (() => {
  const v = (process.env.DEBUG_SUGERENCIAS || '1').toString().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes'; // default ON so you can see logs now
})();
function dlog(...args) {
  if (DEBUG_SUGERENCIAS) console.log('[SUG]', ...args);
}

// Capacidad desde dimensiones internas: mm^3 -> m^3 y litros (entero DP-safe)
function capacityFromDims(m) {
  const f = parseFloat(m.dim_int_frente) || 0;
  const p = parseFloat(m.dim_int_profundo) || 0;
  const a = parseFloat(m.dim_int_alto) || 0;
  const mm3 = f * p * a; // mm^3
  const cap_m3 = mm3 > 0 ? (mm3 / 1e9) : 0; // 1e9 mm^3 = 1 m^3
  const capL = mm3 > 0 ? Math.max(0, Math.floor(mm3 / 1e6)) : 0; // 1e6 mm^3 = 1 L, floor para no sobreestimar
  return { cap_m3, capL };
}

const sugerenciasService = {
  // Helper: filtrar modelos por lista permitida (si viene)
  _filterModelosPermitidos(modelos, modelos_permitidos) {
    if (!Array.isArray(modelos_permitidos) || modelos_permitidos.length === 0) return modelos;
    const allowed = new Set(modelos_permitidos.map((x) => parseInt(x))); 
    return (modelos || []).filter((m) => allowed.has(parseInt(m.modelo_id)));
  },
  // Obtener todas las sugerencias
  getAllSugerencias: async () => {
    try {
      const query = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.inv_id, s.modelo_sugerido,
          s.cantidad_sugerida, s.fecha_sugerencia,
          s.modelo_id, s.estado,
          COALESCE(s.orden_despacho, i.orden_despacho) AS orden_despacho,
          s.detalle_orden,
          s.cantidad_diaria, s.rango_dias, s.dias_activos, s.numero_de_sugerencia,
          c.nombre_cliente,
          m.nombre_modelo, m.volumen_litros,
          i.descripcion_producto AS descripcion_inventario, i.producto, i.cantidad_despachada AS cantidad_inventario,
          i.largo_mm, i.ancho_mm, i.alto_mm
        FROM admin_platform.sugerencias_reemplazo s
        LEFT JOIN admin_platform.clientes_prospectos c ON s.cliente_id = c.cliente_id
        LEFT JOIN admin_platform.modelos m ON s.modelo_id = m.modelo_id
        LEFT JOIN admin_platform.inventario_prospecto i ON s.inv_id = i.inv_id
        ORDER BY s.fecha_sugerencia DESC NULLS LAST, s.sugerencia_id DESC
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.error('Error al obtener sugerencias:', error);
      throw error;
    }
  },

  // Obtener sugerencias paginadas con filtros
  getSugerenciasPaginated: async ({ limit = 50, offset = 0, search = '', clienteId = null, numero = null } = {}) => {
    try {
      const where = [];
      const params = [];

      if (clienteId) {
        params.push(clienteId);
        where.push(`s.cliente_id = $${params.length}`);
      }
      if (numero) {
        params.push(String(numero));
        where.push(`s.numero_de_sugerencia = $${params.length}`);
      }
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        const idx = params.length;
        where.push(`(
          LOWER(COALESCE(c.nombre_cliente,'')) LIKE $${idx}
          OR LOWER(COALESCE(s.modelo_sugerido,'')) LIKE $${idx}
          OR LOWER(COALESCE(m.nombre_modelo,'')) LIKE $${idx}
          OR LOWER(COALESCE(s.orden_despacho,'')) LIKE $${idx}
        )`);
      }

      const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

      // total
      const countSQL = `
        SELECT COUNT(*)::int AS total
        FROM admin_platform.sugerencias_reemplazo s
        LEFT JOIN admin_platform.clientes_prospectos c ON s.cliente_id = c.cliente_id
        LEFT JOIN admin_platform.modelos m ON s.modelo_id = m.modelo_id
        ${whereSQL}
      `;
      const { rows: countRows } = await pool.query(countSQL, params);
      const total = parseInt(countRows?.[0]?.total || 0);

      // items
      params.push(limit);
      params.push(offset);
      const itemsSQL = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.inv_id, s.modelo_sugerido,
          s.cantidad_sugerida, s.fecha_sugerencia,
          s.modelo_id, s.estado,
          COALESCE(s.orden_despacho, i.orden_despacho) AS orden_despacho,
          s.detalle_orden,
          s.cantidad_diaria, s.rango_dias, s.dias_activos, s.numero_de_sugerencia,
          c.nombre_cliente,
          m.nombre_modelo, m.volumen_litros,
          i.descripcion_producto AS descripcion_inventario, i.producto, i.cantidad_despachada AS cantidad_inventario,
          i.largo_mm, i.ancho_mm, i.alto_mm
        FROM admin_platform.sugerencias_reemplazo s
        LEFT JOIN admin_platform.clientes_prospectos c ON s.cliente_id = c.cliente_id
        LEFT JOIN admin_platform.modelos m ON s.modelo_id = m.modelo_id
        LEFT JOIN admin_platform.inventario_prospecto i ON s.inv_id = i.inv_id
        ${whereSQL}
        ORDER BY s.fecha_sugerencia DESC NULLS LAST, s.sugerencia_id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;
      const { rows } = await pool.query(itemsSQL, params);
      return { total, items: rows };
    } catch (error) {
      console.error('Error al obtener sugerencias paginadas:', error);
      throw error;
    }
  },

  // Distribución REAL por rango: asigna cada línea al modelo mínimo que le cabe por dimensiones y volumen unitario
  calcularDistribucionRealPorRango: async ({ cliente_id, startDate, endDate, modelos_permitidos }) => {
    if (!cliente_id) throw new Error('cliente_id es requerido');
    if (!startDate || !endDate) throw new Error('startDate y endDate son requeridos');

    // Datos del rango
    dlog('== calcularDistribucionRealPorRango ==>', { cliente_id, startDate, endDate, modelos_permitidos });
    const invQuery = `
      SELECT inv_id, producto, descripcion_producto, cantidad_despachada,
             largo_mm, ancho_mm, alto_mm, volumen_total_m3_producto,
             fecha_de_despacho::date AS fecha_de_despacho
      FROM admin_platform.inventario_prospecto
      WHERE cliente_id = $1
        AND fecha_de_despacho::date BETWEEN $2::date AND $3::date
    `;
  const { rows: items } = await pool.query(invQuery, [cliente_id, startDate, endDate]);
  dlog('Items del rango:', items.length);

    // Modelos ordenados asc por capacidad (usando dimensiones internas)
    let modelos = await sugerenciasService.obtenerModelosCubeCached();
    modelos = sugerenciasService._filterModelosPermitidos(modelos, modelos_permitidos);
    // Ordenar por capacidad interna real
    modelos = (modelos || []).sort((a,b) => capacityFromDims(a).cap_m3 - capacityFromDims(b).cap_m3);
    if (!modelos.length) throw new Error('No hay modelos Cube disponibles');
    dlog('Modelos Cube (permitidos) disponibles:', modelos.length);

    // Días activos del rango (fechas únicas con registros)
    const diasActivosSet = new Set(
      (items || []).filter(i => i.fecha_de_despacho).map(i => String(i.fecha_de_despacho))
    );
    const totalDiasActivos = diasActivosSet.size || 1;

    let totalProductosReales = 0;
    let totalVolumenReal = 0;
    let totalProductosAsignados = 0;
    let totalVolumenAsignado = 0;
    let omitidos = 0;
    const accModelos = new Map();

    for (const it of items) {
      const cantidad = parseInt(it.cantidad_despachada) || 0;
      const volLinea = parseFloat(it.volumen_total_m3_producto) || 0;
      const largo = parseFloat(it.largo_mm);
      const ancho = parseFloat(it.ancho_mm);
      const alto = parseFloat(it.alto_mm);

      totalProductosReales += cantidad;
      totalVolumenReal += volLinea;

      if (!cantidad || !volLinea || !largo || !ancho || !alto) { omitidos++; continue; }

      const volUnit = volLinea / cantidad;
      const modeloElegido = modelos.find(m => {
        if (!(largo <= m.dim_int_frente && ancho <= m.dim_int_profundo && alto <= m.dim_int_alto)) return false;
        const { cap_m3 } = capacityFromDims(m);
        return cap_m3 >= volUnit; // capacidad interna basada en dimensiones
      });
      if (!modeloElegido) { omitidos++; continue; }

      const volModeloM3 = capacityFromDims(modeloElegido).cap_m3;
      // Preferir cálculo de unidades por caja basado en dimensiones (packing simple 6 orientaciones)
      const unitsPerBoxForDimsLocal = (m, l, a, h) => {
        if (!(m && m.dim_int_frente && m.dim_int_profundo && m.dim_int_alto)) return 0;
        const dims = [l, a, h];
        const box = [m.dim_int_frente, m.dim_int_profundo, m.dim_int_alto];
        const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
        let best = 0;
        for (const p of perms) {
          const c1 = Math.floor(box[0] / (dims[p[0]] || Infinity));
          const c2 = Math.floor(box[1] / (dims[p[1]] || Infinity));
          const c3 = Math.floor(box[2] /
             (dims[p[2]] || Infinity));
          const cap = (c1>0 && c2>0 && c3>0) ? (c1*c2*c3) : 0;
          if (cap > best) best = cap;
        }
        return best;
      };
      const upb = unitsPerBoxForDimsLocal(modeloElegido, largo, ancho, alto);
      const productosPorContenedor = upb > 0 ? upb : Math.max(1, Math.floor(volModeloM3 / volUnit));
      const esPerfecto = (
        largo === modeloElegido.dim_int_frente &&
        ancho === modeloElegido.dim_int_profundo &&
        alto === modeloElegido.dim_int_alto
      );
      const contenedores = esPerfecto ? cantidad : Math.ceil(cantidad / productosPorContenedor);

      totalProductosAsignados += cantidad;
      totalVolumenAsignado += volLinea;

      const prev = accModelos.get(modeloElegido.modelo_id) || {
        modelo_id: modeloElegido.modelo_id,
        nombre_modelo: modeloElegido.nombre_modelo,
        volumen_litros: modeloElegido.volumen_litros,
        contenedores_total: 0,
        productos_asignados: 0,
        volumen_asignado_m3: 0
      };
      prev.contenedores_total += contenedores;
      prev.productos_asignados += cantidad;
      prev.volumen_asignado_m3 += volLinea;
      accModelos.set(modeloElegido.modelo_id, prev);
    }

    const distribucion = Array.from(accModelos.values()).map(d => ({
      ...d,
      promedio_diario_cajas: d.contenedores_total / totalDiasActivos,
      porcentaje_productos: totalProductosAsignados ? (d.productos_asignados / totalProductosAsignados) * 100 : 0,
      porcentaje_volumen: totalVolumenAsignado ? (d.volumen_asignado_m3 / totalVolumenAsignado) * 100 : 0
    })).sort((a,b) => b.contenedores_total - a.contenedores_total);

    const coberturaProductos = totalProductosReales ? (totalProductosAsignados / totalProductosReales) * 100 : 0;
    const coberturaVolumen = totalVolumenReal ? (totalVolumenAsignado / totalVolumenReal) * 100 : 0;

    const salida = {
      resumen: {
        startDate,
        endDate,
        total_registros: items.length,
        total_productos: totalProductosReales,
        volumen_total_m3: totalVolumenReal,
        total_dias_activos: totalDiasActivos,
        productos_asignados: totalProductosAsignados,
        volumen_asignado_m3: totalVolumenAsignado,
        omitidos,
        cobertura_productos: coberturaProductos,
        cobertura_volumen: coberturaVolumen
      },
      distribucion
    };
    dlog('Resumen real por rango:', salida.resumen);
    return salida;
  },
  
  // Proyección mensual: estima uso diario futuro basado en patrón histórico del rango
  calcularProyeccionMensual: async ({ cliente_id, startDate, endDate, percentil_stock = 0.95, modelos_permitidos }) => {
    if (!cliente_id) throw new Error('cliente_id es requerido');
    if (!startDate || !endDate) throw new Error('startDate y endDate son requeridos');
    if (percentil_stock <= 0 || percentil_stock > 1) percentil_stock = 0.95;

    const invQuery = `
      SELECT inv_id, producto, descripcion_producto, cantidad_despachada,
             largo_mm, ancho_mm, alto_mm, volumen_total_m3_producto,
             fecha_de_despacho::date AS fecha_de_despacho
      FROM admin_platform.inventario_prospecto
      WHERE cliente_id = $1
        AND fecha_de_despacho::date BETWEEN $2::date AND $3::date
    `;
    const { rows: items } = await pool.query(invQuery, [cliente_id, startDate, endDate]);

    // Periodo calendario
    let diasCalendario = 1;
    try {
      const s = new Date(startDate); const e = new Date(endDate);
      const diff = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
      if (diff > 0) diasCalendario = diff;
    } catch {}

    if (!items.length) {
      return {
        resumen: {
          startDate, endDate,
          dias_calendario: diasCalendario,
          dias_activos: 0,
          total_registros: 0,
          total_productos: 0,
          volumen_total_m3: 0,
          cobertura_productos: 0,
          cobertura_volumen: 0,
          percentil_stock
        },
        modelos: [],
        parque_recomendado: { total_promedio_activo: 0, total_promedio_calendario: 0, total_percentil: 0, detalle: [] }
      };
    }

    // Modelos
    const modelosQuery = `
      SELECT modelo_id, nombre_modelo, volumen_litros,
             dim_int_frente, dim_int_profundo, dim_int_alto
      FROM admin_platform.modelos
      WHERE tipo = 'Cube'
    `;
    let { rows: modelos } = await pool.query(modelosQuery);
    modelos = sugerenciasService._filterModelosPermitidos(modelos, modelos_permitidos);
    // Ordenar por capacidad real interna
    modelos = (modelos || []).sort((a,b) => capacityFromDims(a).cap_m3 - capacityFromDims(b).cap_m3);
    if (!modelos.length) throw new Error('No hay modelos Cube disponibles');

    const fechasActivasSet = new Set(items.filter(i => i.fecha_de_despacho).map(i => i.fecha_de_despacho.toISOString().slice(0,10)));
    const diasActivos = fechasActivasSet.size || 1;
    const fechasActivasOrdenadas = Array.from(fechasActivasSet).sort();
    const indiceFecha = new Map(fechasActivasOrdenadas.map((f,i)=>[f,i]));

    let totalProductosReales = 0;
    let totalVolumenReal = 0;
    let totalProductosAsignados = 0;
    let totalVolumenAsignado = 0;
    let omitidos = 0;

    const accModelos = new Map(); // modelo_id -> aggregate
    const dailyMatrix = new Map(); // modelo_id -> Array(diasActivos).fill(0)

    for (const it of items) {
      const cantidad = parseInt(it.cantidad_despachada) || 0;
      const volLinea = parseFloat(it.volumen_total_m3_producto) || 0;
      const largo = parseFloat(it.largo_mm);
      const ancho = parseFloat(it.ancho_mm);
      const alto = parseFloat(it.alto_mm);
      const fecha = it.fecha_de_despacho ? new Date(it.fecha_de_despacho).toISOString().slice(0,10) : null;
      totalProductosReales += cantidad;
      totalVolumenReal += volLinea;
      if (!cantidad || !volLinea || !largo || !ancho || !alto || !fecha) { omitidos++; continue; }
      const volUnit = volLinea / cantidad;
      const modeloElegido = modelos.find(m => {
        if (!(largo <= m.dim_int_frente && ancho <= m.dim_int_profundo && alto <= m.dim_int_alto)) return false;
        const { cap_m3 } = capacityFromDims(m);
        return cap_m3 >= volUnit;
      });
      if (!modeloElegido) { omitidos++; continue; }
      const volModeloM3 = capacityFromDims(modeloElegido).cap_m3;
      const upb = (() => {
        const dims = [largo, ancho, alto];
        const box = [modeloElegido.dim_int_frente, modeloElegido.dim_int_profundo, modeloElegido.dim_int_alto];
        const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
        let best = 0;
        for (const p of perms) {
          const c1 = Math.floor(box[0] / (dims[p[0]] || Infinity));
          const c2 = Math.floor(box[1] / (dims[p[1]] || Infinity));
          const c3 = Math.floor(box[2] / (dims[p[2]] || Infinity));
          const cap = (c1>0 && c2>0 && c3>0) ? (c1*c2*c3) : 0;
          if (cap > best) best = cap;
        }
        return best;
      })();
      const productosPorContenedor = upb > 0 ? upb : Math.max(1, Math.floor(volModeloM3 / volUnit));
      const esPerfecto = largo === modeloElegido.dim_int_frente && ancho === modeloElegido.dim_int_profundo && alto === modeloElegido.dim_int_alto;
      const contenedores = esPerfecto ? cantidad : Math.ceil(cantidad / productosPorContenedor);
      totalProductosAsignados += cantidad;
      totalVolumenAsignado += volLinea;
      const prev = accModelos.get(modeloElegido.modelo_id) || {
        modelo_id: modeloElegido.modelo_id,
        nombre_modelo: modeloElegido.nombre_modelo,
        volumen_litros: modeloElegido.volumen_litros,
        contenedores_total: 0,
        productos_asignados: 0,
        volumen_asignado_m3: 0
      };
      prev.contenedores_total += contenedores;
      prev.productos_asignados += cantidad;
      prev.volumen_asignado_m3 += volLinea;
      accModelos.set(modeloElegido.modelo_id, prev);
      if (!dailyMatrix.has(modeloElegido.modelo_id)) dailyMatrix.set(modeloElegido.modelo_id, Array(diasActivos).fill(0));
      const idx = indiceFecha.get(fecha);
      if (idx != null) dailyMatrix.get(modeloElegido.modelo_id)[idx] += contenedores;
    }

    // Helper percentil
    const calcPercentil = (arr, p) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a,b)=>a-b);
      const k = Math.ceil(p * sorted.length) - 1;
      return sorted[Math.max(0, Math.min(sorted.length-1, k))];
    };

    const modelosResultado = Array.from(accModelos.values()).map(m => {
      const diarios = dailyMatrix.get(m.modelo_id) || [];
      const promedioActivo = m.contenedores_total / diasActivos;
      const promedioCalendario = m.contenedores_total / diasCalendario;
      const p95 = calcPercentil(diarios, percentil_stock);
      const recomendacionDiaria = Math.max(1, Math.round(p95 || promedioActivo));
      return {
        ...m,
        promedio_diario_activo: promedioActivo,
        promedio_diario_calendario: promedioCalendario,
        percentil_diario: p95,
        recomendacion_diaria: recomendacionDiaria,
        porcentaje_productos: totalProductosAsignados ? (m.productos_asignados / totalProductosAsignados) * 100 : 0,
        porcentaje_volumen: totalVolumenAsignado ? (m.volumen_asignado_m3 / totalVolumenAsignado) * 100 : 0
      };
    }).sort((a,b)=> b.contenedores_total - a.contenedores_total);

    const coberturaProductos = totalProductosReales ? (totalProductosAsignados / totalProductosReales) * 100 : 0;
    const coberturaVolumen = totalVolumenReal ? (totalVolumenAsignado / totalVolumenReal) * 100 : 0;

    const totalPromedioActivo = modelosResultado.reduce((s,m)=> s + m.promedio_diario_activo, 0);
    const totalPromedioCalendario = modelosResultado.reduce((s,m)=> s + m.promedio_diario_calendario, 0);
    const totalPercentil = modelosResultado.reduce((s,m)=> s + m.recomendacion_diaria, 0);

    return {
      resumen: {
        startDate,
        endDate,
        dias_calendario: diasCalendario,
        dias_activos: diasActivos,
        total_registros: items.length,
        total_productos: totalProductosReales,
        volumen_total_m3: totalVolumenReal,
        productos_asignados: totalProductosAsignados,
        volumen_asignado_m3: totalVolumenAsignado,
        omitidos,
        cobertura_productos: coberturaProductos,
        cobertura_volumen: coberturaVolumen,
        percentil_stock
      },
      modelos: modelosResultado,
      parque_recomendado: {
        total_promedio_activo: totalPromedioActivo,
        total_promedio_calendario: totalPromedioCalendario,
        total_percentil: totalPercentil,
        detalle: modelosResultado.map(m => ({
          modelo_id: m.modelo_id,
          nombre_modelo: m.nombre_modelo,
          promedio_diario_activo: m.promedio_diario_activo,
          percentil_diario: m.percentil_diario,
          recomendacion_diaria: m.recomendacion_diaria
        }))
      }
    };
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
            modelo_id, estado, orden_despacho, detalle_orden, cantidad_diaria,
            rango_dias, dias_activos, numero_de_sugerencia
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING sugerencia_id
        `;
        const valuesWithOrden = [
          data.cliente_id, data.inv_id ?? null, data.modelo_sugerido,
          data.cantidad_sugerida, data.modelo_id, data.estado || 'pendiente', ordenDespacho, data.detalle_orden || null, data.cantidad_diaria || null,
          data.rango_dias || null, data.dias_activos || null, data.numero_de_sugerencia || null
        ];
        const { rows } = await pool.query(insertWithOrden, valuesWithOrden);
        sugerenciaId = rows[0].sugerencia_id;
      } catch (e) {
        // Compatibilidad si aún no existen columnas nuevas
        console.warn('Insert con orden_despacho + cantidad_diaria falló, reintentando versión reducida:', e?.message);
        try {
          const insertFallback = `
            INSERT INTO admin_platform.sugerencias_reemplazo (
              cliente_id, inv_id, modelo_sugerido, cantidad_sugerida,
              modelo_id, estado, detalle_orden, numero_de_sugerencia
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING sugerencia_id
          `;
          const valuesFallback = [
            data.cliente_id, data.inv_id ?? null, data.modelo_sugerido,
            data.cantidad_sugerida, data.modelo_id, data.estado || 'pendiente', data.detalle_orden || null, data.numero_de_sugerencia || null
          ];
          const { rows } = await pool.query(insertFallback, valuesFallback);
          sugerenciaId = rows[0].sugerencia_id;
        } catch (e2) {
          console.warn('Fallback insert sin columnas nuevas también falló:', e2?.message);
          throw e2;
        }
      }

      // Ahora obtener la sugerencia completa con todos los JOINs
    const selectQuery = `
        SELECT 
          s.sugerencia_id, s.cliente_id, s.inv_id, s.modelo_sugerido,
          s.cantidad_sugerida, s.fecha_sugerencia, 
          s.modelo_id, s.estado,
          COALESCE(s.orden_despacho, i.orden_despacho) AS orden_despacho,
      s.detalle_orden,
      s.cantidad_diaria,
      s.rango_dias, s.dias_activos, s.numero_de_sugerencia,
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

  // Cache simple de modelos Cube para evitar repetir query en cálculos masivos
  obtenerModelosCubeCached: async () => {
    if (!global.__modelosCubeCache || (Date.now() - global.__modelosCubeCache.ts) > 5 * 60 * 1000) {
      const query = `
        SELECT 
          modelo_id, nombre_modelo, volumen_litros,
          dim_int_frente, dim_int_profundo, dim_int_alto
        FROM admin_platform.modelos
        WHERE tipo = 'Cube'
        ORDER BY volumen_litros ASC
      `;
      const { rows } = await pool.query(query);
      global.__modelosCubeCache = { ts: Date.now(), rows };
    }
    return global.__modelosCubeCache.rows;
  },

  calcularSugerenciasPorOrden: async (datos, opts = {}) => {
    try {
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

      // Usar cálculo por volumen total de la orden con validación dimensional (no sumar por producto)
      // Reusar modelos cacheados si se proporcionan
      let modelos = opts.modelos;
      if (!modelos) modelos = await module.exports.obtenerModelosCubeCached();
      // Filtrar por permitidos si se especifica
      const permitidos = (opts && Array.isArray(opts.modelos_permitidos) && opts.modelos_permitidos.length)
        ? opts.modelos_permitidos
        : (Array.isArray(datos.modelos_permitidos) ? datos.modelos_permitidos : []);
      if (permitidos && permitidos.length) {
        const allowed = new Set(permitidos.map((x)=>parseInt(x)));
        modelos = (modelos || []).filter((m) => allowed.has(parseInt(m.modelo_id)));
      }
      if (!modelos || modelos.length === 0) {
        console.log('No se encontraron modelos tipo Cube');
        return [];
      }

      const sugerenciasPorVolumenTotal = modelos.map((modelo) => {
        const volumenModeloM3 = capacityFromDims(modelo).cap_m3;
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
      const sugerencias = sugerenciasPorVolumenTotal;

      // Prioridad: 1) Menor cantidad de cajas 2) Mayor eficiencia 3) Menor volumen total
      sugerencias.sort((a, b) => {
        const ca = a.cantidad_sugerida || 0;
        const cb = b.cantidad_sugerida || 0;
        if (ca !== cb) return ca - cb;
        const ea = a.eficiencia || 0;
        const eb = b.eficiencia || 0;
        if (ea !== eb) return eb - ea;
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

      // Calcular porcentaje de recomendación dando más peso a menos cajas (70%) y eficiencia (30%)
      if (sugerencias.length > 0) {
        const maxEff = Math.max(...sugerencias.map(s => (s.eficiencia || 0)));
        const minCont = Math.min(...sugerencias.map(s => s.cantidad_sugerida || Infinity));
        const composites = sugerencias.map(s => {
          const effNorm = maxEff > 0 ? (s.eficiencia || 0) / maxEff : 0;
          const cont = s.cantidad_sugerida || minCont || 1;
          const contFactor = cont > 0 ? Math.min(1, (minCont || 1) / cont) : 1; // 1 para el mínimo
          return 0.3 * effNorm + 0.7 * contFactor;
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
  calcularConVolumenTotal: async (volumenTotalRequeridoM3, cantidadProductos, cliente_id, orden_despacho, resumenProductos, opts = {}) => {
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
      
      let { rows: modelos } = await pool.query(query);
      // Filtrar por permitidos si vienen
      if (opts && Array.isArray(opts.modelos_permitidos) && opts.modelos_permitidos.length) {
        const allowed = new Set(opts.modelos_permitidos.map((x)=>parseInt(x)));
        modelos = (modelos || []).filter((m) => allowed.has(parseInt(m.modelo_id)));
      }
      console.log('Modelos encontrados:', modelos.length);
      
      if (modelos.length === 0) {
        console.log('No se encontraron modelos tipo Cube');
        return [];
      }
      
      // Calcular sugerencias para cada modelo
      const sugerencias = modelos.map((modelo, index) => {
        console.log(`Evaluando modelo ${index + 1}/${modelos.length}:`, modelo.nombre_modelo);
        
        // Convertir volumen del modelo de litros a metros cúbicos
        const volumenModeloM3 = capacityFromDims(modelo).cap_m3;
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
          volumen_litros: modelo.volumen_litros,
          cantidad_sugerida: modelosNecesarios,
          total_productos_transportados: cantidadProductos,
          volumen_total_productos: volumenTotalRequeridoM3,
          volumen_total_disponible: volumenTotalDisponible,
          eficiencia_porcentaje: eficiencia,
          espacio_sobrante_m3: espacioSobrante,
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
      
      // Prioridad: 1) Menor cantidad de cajas 2) Mayor eficiencia 3) Menor volumen total
      sugerencias.sort((a, b) => {
        const ca = a.cantidad_sugerida || 0;
        const cb = b.cantidad_sugerida || 0;
        if (ca !== cb) return ca - cb;
        const ea = a.eficiencia_porcentaje || 0;
        const eb = b.eficiencia_porcentaje || 0;
        if (ea !== eb) return eb - ea;
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

        // Recomposición ponderando más la menor cantidad de cajas (70%) que la eficiencia (30%)
        const maxEff = Math.max(...sugerencias.map(s => (s.eficiencia_porcentaje || 0)));
        const minCont = Math.min(...sugerencias.map(s => s.cantidad_sugerida || Infinity));
        const composites = sugerencias.map(s => {
          const effNorm = maxEff > 0 ? (s.eficiencia_porcentaje || 0) / maxEff : 0;
          const cont = s.cantidad_sugerida || minCont || 1;
          const contFactor = cont > 0 ? Math.min(1, (minCont || 1) / cont) : 1;
          return 0.3 * effNorm + 0.7 * contFactor;
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
        const volumenModeloM3 = capacityFromDims(modelo).cap_m3;
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
      
      // Ordenar priorizando: 1) Menos cajas 2) Mayor eficiencia 3) Ajuste perfecto 4) Menor volumen total
      const sugerenciasOrdenadas = sugerencias.sort((a, b) => {
        const ca = a.cantidad_sugerida || 0;
        const cb = b.cantidad_sugerida || 0;
        if (ca !== cb) return ca - cb;
        const ea = a.eficiencia || 0;
        const eb = b.eficiencia || 0;
        if (ea !== eb) return eb - ea;
        if (a.es_ajuste_perfecto && !b.es_ajuste_perfecto) return -1;
        if (!a.es_ajuste_perfecto && b.es_ajuste_perfecto) return 1;
        return (a.volumen_total_contenedores || 0) - (b.volumen_total_contenedores || 0);
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

      // Calcular porcentaje de recomendación ponderando cajas (70%) y eficiencia (30%)
      if (sugerenciasOrdenadas.length > 0) {
        const maxEff = Math.max(...sugerenciasOrdenadas.map(s => (s.eficiencia || 0)));
        const minCont = Math.min(...sugerenciasOrdenadas.map(s => s.cantidad_sugerida || Infinity));
        const composites = sugerenciasOrdenadas.map(s => {
          const effNorm = maxEff > 0 ? (s.eficiencia || 0) / maxEff : 0;
          const cont = s.cantidad_sugerida || minCont || 1;
          const contFactor = cont > 0 ? Math.min(1, (minCont || 1) / cont) : 1;
          return 0.3 * effNorm + 0.7 * contFactor;
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

  // Nueva: mejor combinación por orden minimizando cajas y luego desperdicio (solo modelos que ajustan todas las líneas)
  calcularMejorCombinacionPorOrden: async ({ cliente_id, orden_despacho, modelos_permitidos } = {}, opts = {}) => {
    if (!cliente_id) throw new Error('cliente_id es requerido');
    if (!orden_despacho) throw new Error('orden_despacho es requerido');
    dlog('== calcularMejorCombinacionPorOrden ==>', { cliente_id, orden_despacho, modelos_permitidos });
    // Obtener items de la orden
    const invQuery = `
      SELECT cantidad_despachada, volumen_total_m3_producto, largo_mm, ancho_mm, alto_mm
      FROM admin_platform.inventario_prospecto
      WHERE cliente_id = $1 AND orden_despacho = $2
    `;
    const { rows: items } = await pool.query(invQuery, [cliente_id, orden_despacho]);
    dlog('Items en la orden:', items.length);
    if (!items.length) return { orden_despacho, combinacion: [], cajas_minimas: 0, volumen_total_m3: 0, eficiencia: 0, sobrante_m3: 0 };

    // Totales y máximos dimensionales
    let V = 0; // m3 total
    let maxL = 0, maxA = 0, maxH = 0; // mm
    let totalUnits = 0;
    for (const it of items) {
      const cant = parseInt(it.cantidad_despachada) || 0;
      const vol = parseFloat(it.volumen_total_m3_producto) || 0;
      V += vol;
      totalUnits += cant;
      maxL = Math.max(maxL, parseFloat(it.largo_mm) || 0);
      maxA = Math.max(maxA, parseFloat(it.ancho_mm) || 0);
      maxH = Math.max(maxH, parseFloat(it.alto_mm) || 0);
    }
    dlog('Totales de orden:', { volumen_m3: V, max_dim_mm: { frente: maxL, profundo: maxA, alto: maxH } });

    // Modelos
    let modelos = opts.modelos || await sugerenciasService.obtenerModelosCubeCached();
    modelos = sugerenciasService._filterModelosPermitidos(modelos, modelos_permitidos);
    // Filtrar solo los que ajustan todos (por seguridad sin asignación por producto)
    const fitsAll = (modelos || []).filter(m => {
      if (!(maxL <= m.dim_int_frente && maxA <= m.dim_int_profundo && maxH <= m.dim_int_alto)) return false;
      const { cap_m3 } = capacityFromDims(m);
      return cap_m3 > 0;
    });
    dlog('Modelos candidatos que ajustan dimensiones (count):', fitsAll.length);
    dlog('Candidatos (capacidad interna y dims):', fitsAll.map(m => ({
      id: m.modelo_id,
      nombre: m.nombre_modelo,
      cap_m3: Number(capacityFromDims(m).cap_m3.toFixed(6)),
      dims: { frente: m.dim_int_frente, profundo: m.dim_int_profundo, alto: m.dim_int_alto }
    })));
    if (!fitsAll.length) return { orden_despacho, combinacion: [], cajas_minimas: 0, volumen_total_m3: V, eficiencia: 0, sobrante_m3: 0 };

    // Capacidades en unidades de m3 escaladas (1 unidad = 1e-3 m3). Se derivan EXCLUSIVAMENTE de dimensiones internas.
    const caps = fitsAll
      .map(m => {
        const { cap_m3 } = capacityFromDims(m);
        const capU = Math.max(0, Math.round(cap_m3 * 1000)); // unidades m3e-3
        // Log comparativo con campo declarado (solo informativo)
        if (DEBUG_SUGERENCIAS) {
          const litrosCampo = parseFloat(m.volumen_litros) || null;
          dlog('Modelo capacidad (desde dimensiones vs campo declarado):', { id: m.modelo_id, nombre: m.nombre_modelo, cap_u_m3e_3: capU, cap_m3: cap_m3, campo_L: litrosCampo });
        }
        return { m, capU, cap_m3 };
      })
      .filter(c => c.capU > 0)
      .sort((a,b) => a.capU - b.capU); // ascendente

    // Helper: máxima cantidad de unidades (para una sola línea) que caben en una caja del modelo, considerando rotación
    const unitsPerBoxForDims = (m, l, a, h) => {
      if (!(m && m.dim_int_frente && m.dim_int_profundo && m.dim_int_alto)) return 0;
      const dims = [l, a, h];
      const box = [m.dim_int_frente, m.dim_int_profundo, m.dim_int_alto];
      // probar 6 permutaciones de la pieza
      const perms = [
        [0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]
      ];
      let best = 0;
      for (const p of perms) {
        const c1 = Math.floor(box[0] / (dims[p[0]] || Infinity));
        const c2 = Math.floor(box[1] / (dims[p[1]] || Infinity));
        const c3 = Math.floor(box[2] / (dims[p[2]] || Infinity));
        const cap = (c1>0 && c2>0 && c3>0) ? (c1*c2*c3) : 0;
        if (cap > best) best = cap;
      }
      return best;
    };

    // Si la orden tiene una sola línea, intentar caso especial: ¿algún modelo puede llevar TODAS las unidades en 1 caja (packing por dimensiones)?
    if (items.length === 1) {
      const it = items[0];
      const l = parseFloat(it.largo_mm) || 0;
      const a = parseFloat(it.ancho_mm) || 0;
      const h = parseFloat(it.alto_mm) || 0;
      // Fallback: si la cantidad en DB viniera mal (p.ej. 1) pero el volumen total corresponde a varias unidades,
      // inferimos unidades por volumen geométrico (mm^3 -> m^3)
      if (totalUnits <= 1 && l > 0 && a > 0 && h > 0 && V > 0) {
        const unitVolGeomM3 = (l/1000) * (a/1000) * (h/1000);
        if (unitVolGeomM3 > 0) {
          const inferred = Math.max(1, Math.round((V / unitVolGeomM3) + 1e-9));
          if (inferred > totalUnits) {
            dlog('Ajuste de unidades por geometría (fallback):', { totalUnits_old: totalUnits, inferred, unitVolGeomM3, V });
            totalUnits = inferred;
          }
        }
      }
      // filtrar modelos con capacidad unitaria por caja >= totalUnits
      const isAllAxesMultiple = (m, l, a, h) => {
        const unit = [l, a, h];
        const box = [m.dim_int_frente, m.dim_int_profundo, m.dim_int_alto];
        const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
        const eps = 1e-6;
        for (const p of perms) {
          const u0 = unit[p[0]] || 1; const u1 = unit[p[1]] || 1; const u2 = unit[p[2]] || 1;
          const r1 = box[0] % u0;
          const r2 = box[1] % u1;
          const r3 = box[2] % u2;
          if (Math.abs(r1) < eps && Math.abs(r2) < eps && Math.abs(r3) < eps) return true;
        }
        return false;
      };
      const singleBoxCandidates = fitsAll
        .map(x => ({ m: x, upb: unitsPerBoxForDims(x, l, a, h), cap_m3: capacityFromDims(x).cap_m3, allMul: isAllAxesMultiple(x, l, a, h) }))
        .filter(x => x.upb >= totalUnits)
        .sort((x,y) => {
          if (x.allMul !== y.allMul) return y.allMul - x.allMul; // true primero
          return x.cap_m3 - y.cap_m3; // luego menor capacidad
        });

      if (singleBoxCandidates.length) {
        // Log gear: ver top 5 candidatos por upb
  dlog('Candidatos 1-caja (upb >= unidades):', singleBoxCandidates.slice(0,5).map(c => ({ id: c.m.modelo_id, nombre: c.m.nombre_modelo, cap_m3: Number(c.cap_m3.toFixed(6)), upb: c.upb, exact_multiples: c.allMul })));
        const chosen = singleBoxCandidates[0].m;
        const capacidad_m3 = capacityFromDims(chosen).cap_m3;
        const sobrante_m3 = Math.max(0, capacidad_m3 - V);
        const eficiencia = capacidad_m3 > 0 ? (V / capacidad_m3) * 100 : 0;
        dlog('Caso especial: 1 caja puede llevar todas las unidades. Elegido:', {
          modelo_id: chosen.modelo_id, nombre: chosen.nombre_modelo, cap_m3: capacidad_m3
        });
        return {
          orden_despacho,
          cajas_minimas: 1,
          combinacion: [{ modelo_id: chosen.modelo_id, nombre_modelo: chosen.nombre_modelo, volumen_modelo_m3: capacityFromDims(chosen).cap_m3, cantidad: 1 }],
          volumen_total_m3: V,
          capacidad_total_m3: capacidad_m3,
          eficiencia: Math.round(eficiencia * 10) / 10,
          sobrante_m3: Math.round(sobrante_m3 * 1000) / 1000,
          modelos_considerados: caps.length
        };
      }
    }

    // Para generalizar factibilidad por unidades en ordenes con múltiples líneas, usamos una cota conservadora:
    // asumimos que cada unidad tiene el tamaño de la mayor pieza (maxL,maxA,maxH) para calcular upb por modelo.
    const upbByModelId = new Map();
    for (const x of fitsAll) {
      upbByModelId.set(x.modelo_id, unitsPerBoxForDims(x, maxL, maxA, maxH));
    }

  const V_units = Math.round((V * 1000) - 1e-9); // volumen objetivo en unidades (1u = 1e-3 m3)
  const ceil_units = Math.max(0, V_units); // entero mínimo de unidades a cubrir
  const maxCapU = caps[caps.length - 1].capU;
  const M = Math.max(ceil_units + maxCapU * 10, ceil_units + 1); // margen de búsqueda
  dlog('Objetivo (m3 escalado a 1e-3):', { V_units: V_units, ceil_units, maxCapU, M });

    const INF = 1e9;
    const dp = new Array(M + 1).fill(INF); // dp[s] = mínima cantidad de cajas para sumar exactamente s unidades m3_e-3
    const prev = new Array(M + 1).fill(-1); // índice de modelo elegido para llegar a s
    dp[0] = 0;
    for (let s = 1; s <= M; s++) {
      for (let i = 0; i < caps.length; i++) {
        const cap = caps[i].capU;
        if (s - cap >= 0 && dp[s - cap] + 1 < dp[s]) {
          dp[s] = dp[s - cap] + 1;
          prev[s] = i;
        }
      }
    }

    // Buscar la mejor combinación evaluando TODAS las sumas alcanzables (s = 0..M)
    // Criterios: (1) capacidad_precisa_m3 - V mínima, (2) dp[s] mínima, (3) capacidad_precisa_m3 mínima
    let best = null;
    for (let s = 0; s <= M; s++) {
      if (dp[s] >= INF) continue;
      // reconstruir combinación
      const counts = new Map();
      let cur = s;
      while (cur > 0 && prev[cur] !== -1) {
        const idx = prev[cur];
        const id = caps[idx].m.modelo_id;
        counts.set(id, (counts.get(id) || 0) + 1);
  cur -= caps[idx].capU;
      }
      // capacidad total (precisa) y capacidad unitaria
      let preciseCapM3 = 0;
      let unitCapacity = 0;
      for (const [id, c] of counts.entries()) {
        const model = caps.find(x => x.m.modelo_id === id).m;
        preciseCapM3 += capacityFromDims(model).cap_m3 * c;
        unitCapacity += (upbByModelId.get(id) || 0) * c;
      }
      if (preciseCapM3 >= V && unitCapacity >= totalUnits) {
        const over = preciseCapM3 - V;
        const candidate = { s, counts, boxes: dp[s], preciseCapM3, over };
        if (!best) best = candidate;
        else if (over < best.over - 1e-12) best = candidate;
        else if (Math.abs(over - best.over) <= 1e-12 && dp[s] < best.boxes) best = candidate;
        else if (Math.abs(over - best.over) <= 1e-12 && dp[s] === best.boxes && preciseCapM3 < best.preciseCapM3) best = candidate;
      } else {
        // útil para entender por qué no pasa con s inferiores a ceilV
        dlog('Descartada combinación por capacidad (precisa/unidades) insuficiente:', {
          unidades_s: s, cajas: dp[s], preciseCapM3, unitCapacity, totalUnits
        });
      }
    }
    if (!best) {
      // Fallback: una caja del mayor
      const capacidad_m3 = capacityFromDims(caps[caps.length-1].m).cap_m3;
      const sobrante_m3 = Math.max(0, capacidad_m3 - V);
      const eficiencia = capacidad_m3 > 0 ? (V / capacidad_m3) * 100 : 0;
      dlog('DP no pudo cubrir objetivo, fallback a 1 caja del mayor:', { capacidad_m3, eficiencia, sobrante_m3 });
      return {
        orden_despacho,
        cajas_minimas: 1,
  combinacion: [{ modelo_id: caps[caps.length-1].m.modelo_id, nombre_modelo: caps[caps.length-1].m.nombre_modelo, volumen_modelo_m3: capacidad_m3, cantidad: 1 }],
        volumen_total_m3: V,
        capacidad_total_m3: capacidad_m3,
        eficiencia: Math.round(eficiencia * 10) / 10,
        sobrante_m3: Math.round(sobrante_m3 * 1000) / 1000,
        modelos_considerados: caps.length
      };
    }

    // Reconstrucción de la combinación
    const counts = best.counts;
    const combinacion = Array.from(counts.entries()).map(([modelo_id, cantidad]) => {
      const mm = caps.find(x => x.m.modelo_id === modelo_id).m;
      const capDims = capacityFromDims(mm).cap_m3;
      return {
        modelo_id,
        nombre_modelo: mm.nombre_modelo,
        volumen_modelo_m3: capDims,
        cantidad
      };
    }).sort((a,b) => ((b.volumen_modelo_m3||0) - (a.volumen_modelo_m3||0)));

    const capacidad_m3 = best.preciseCapM3;
    const sobrante_m3 = Math.max(0, capacidad_m3 - V);
    const eficiencia = capacidad_m3 > 0 ? (V / capacidad_m3) * 100 : 0;
    dlog('Resultado combinación por orden:', {
      orden_despacho,
      objetivo_unidades_m3e_3: ceil_units,
      capacidad_unidades_m3e_3: best.s,
      cajas_minimas: best.boxes,
      capacidad_m3,
      volumen_total_m3: V,
      sobrante_m3,
      eficiencia: Math.round(eficiencia * 10) / 10,
      combinacion: combinacion.map(c => ({ modelo_id: c.modelo_id, nombre_modelo: c.nombre_modelo, cantidad: c.cantidad, modelo_L: Math.round((c.volumen_modelo_m3||0)*1000) }))
    });

    return {
      orden_despacho,
      cajas_minimas: best.boxes,
      combinacion,
      volumen_total_m3: V,
      capacidad_total_m3: capacidad_m3,
      eficiencia: Math.round(eficiencia * 10) / 10,
      sobrante_m3: Math.round(sobrante_m3 * 1000) / 1000,
      modelos_considerados: caps.length
    };
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
  },

  // Nueva función: calcular una distribucion OPTIMA (heurística) única de mezcla de modelos
  // Objetivo: cubrir el volumen total requerido en el rango con la menor cantidad de desperdicio
  // Estrategia: greedy por volumen descendente + ajuste final con modelos menores; heurística rápida O(n^2)
  calcularDistribucionOptimaRango: async ({ cliente_id, startDate, endDate }) => {
    const t0 = Date.now();
    try {
      if (!cliente_id) throw new Error('cliente_id requerido');
      if (!startDate || !endDate) throw new Error('startDate y endDate requeridos');

      // Obtener totales del rango
      const totQuery = `
        SELECT 
          COALESCE(SUM(cantidad_despachada),0)::bigint AS total_productos,
          COALESCE(SUM(volumen_total_m3_producto),0)::float8 AS volumen_total_m3
        FROM admin_platform.inventario_prospecto
        WHERE cliente_id = $1
          AND fecha_de_despacho::date BETWEEN $2::date AND $3::date
      `;
      const { rows: totRows } = await pool.query(totQuery, [cliente_id, startDate, endDate]);
      const totalProductos = parseInt(totRows[0]?.total_productos || 0);
      const volumenTotalM3 = parseFloat(totRows[0]?.volumen_total_m3 || 0);

      if (volumenTotalM3 <= 0) {
        return {
          parametros: { cliente_id, startDate, endDate },
            resumen: {
              total_productos: 0,
              volumen_total_m3: 0,
              modelos_usados: 0,
              volumen_total_capacidad_m3: 0,
              desperdicio_m3: 0,
              eficiencia_pct: 0
            },
            distribucion: [],
            detalle_algoritmo: { estrategia: 'sin datos', tiempo_ms: Date.now() - t0 }
        };
      }

      // Obtener modelos (cache)
      const modelos = await module.exports.obtenerModelosCubeCached();
      if (!Array.isArray(modelos) || modelos.length === 0) throw new Error('No hay modelos tipo Cube');

      // Trabajar en m3 y en unidades escaladas (1u = 1e-3 m3)
      const V_units = Math.round(volumenTotalM3 * 1000);
      const modelosOrdenados = modelos
        .map(m => {
          const cap_m3 = capacityFromDims(m).cap_m3;
          const capU = Math.max(0, Math.round(cap_m3 * 1000));
          return { modelo_id: m.modelo_id, nombre_modelo: m.nombre_modelo, cap_m3, capU };
        })
        .filter(x => x.capU > 0)
        .sort((a,b) => b.capU - a.capU); // descendente por capacidad real

      // Greedy simple descendente en unidades
      let restante = V_units;
      const uso = [];
      for (const mod of modelosOrdenados) {
        if (restante <= 0) break;
        const cant = Math.floor(restante / mod.capU);
        if (cant > 0) {
          uso.push({ ...mod, cantidad: cant });
          restante -= cant * mod.capU;
        }
      }
      // Si queda restante, usar el modelo más pequeño para cerrar
      if (restante > 0) {
        const menores = [...modelosOrdenados].sort((a,b) => a.capU - b.capU);
        const masPequenio = menores[0];
        if (masPequenio) {
          uso.push({ ...masPequenio, cantidad: 1 });
          restante -= masPequenio.capU; // puede quedar negativo → sobrecapacidad
        }
      }

      // Ajuste local: reemplazar 1 grande por varios menores si reduce sobrecapacidad
      const capacidadTotalU = (arr) => arr.reduce((s,x)=> s + x.cantidad * x.capU, 0);
      const clonar = (arr) => arr.map(x => ({...x}));
      const capacidadInicialU = capacidadTotalU(uso);
      let mejor = clonar(uso);
      let mejorDesperdicioU = Math.max(0, capacidadInicialU - V_units);

      const menoresAsc = [...modelosOrdenados].sort((a,b)=> a.capU - b.capU);
      for (let i = 0; i < uso.length; i++) {
        const u = uso[i];
        if (u.cantidad <= 0) continue;
        const capacidadSinUnoU = capacidadTotalU(uso) - u.capU;
        const deficitU = V_units - capacidadSinUnoU; // >= 0 si falta cubrir
        if (deficitU <= 0) {
          const desperdicioAltU = Math.max(0, capacidadSinUnoU - V_units);
          if (desperdicioAltU < mejorDesperdicioU) {
            const variante = clonar(uso);
            variante[i].cantidad -= 1;
            mejor = variante.filter(x=> x.cantidad>0);
            mejorDesperdicioU = desperdicioAltU;
          }
          continue;
        }
        // Greedy ascendente con menores estrictos
        let acumuladoU = 0;
        const añadidos = [];
        for (const mMenor of menoresAsc) {
          if (mMenor.capU >= u.capU) continue;
          const cantNecesaria = Math.ceil((deficitU - acumuladoU) / mMenor.capU);
          if (cantNecesaria <= 0) break;
          const cantUsar = Math.min(cantNecesaria, 8);
          añadidos.push({ ...mMenor, cantidad: cantUsar });
          acumuladoU += cantUsar * mMenor.capU;
          if (acumuladoU >= deficitU) break;
        }
        if (acumuladoU >= deficitU) {
          const nuevaCapU = capacidadSinUnoU + acumuladoU;
          const desperdicioNuevoU = Math.max(0, nuevaCapU - V_units);
          if (desperdicioNuevoU < mejorDesperdicioU) {
            const variante = clonar(uso);
            variante[i].cantidad -= 1;
            for (const add of añadidos) {
              const idx = variante.findIndex(x => x.modelo_id === add.modelo_id);
              if (idx >= 0) variante[idx].cantidad += add.cantidad; else variante.push(add);
            }
            mejor = variante.filter(x=> x.cantidad>0);
            mejorDesperdicioU = desperdicioNuevoU;
          }
        }
      }

      // Normalizar resultado final
      const capacidadFinalU = capacidadTotalU(mejor);
      const desperdicioFinalU = Math.max(0, capacidadFinalU - V_units);
      const eficienciaPct = capacidadFinalU > 0 ? (V_units / capacidadFinalU) * 100 : 0;

      const distribucion = mejor
        .map(x => ({
          modelo_id: x.modelo_id,
          nombre_modelo: x.nombre_modelo,
          volumen_modelo_m3: x.cap_m3,
          cap_u_m3e_3: x.capU,
          cantidad: x.cantidad,
          volumen_total_m3: x.cantidad * x.cap_m3
        }))
        .sort((a,b) => b.volumen_modelo_m3 - a.volumen_modelo_m3);

      return {
        parametros: { cliente_id, startDate, endDate },
        resumen: {
          total_productos: totalProductos,
          volumen_total_m3: volumenTotalM3,
          modelos_usados: distribucion.length,
          volumen_total_capacidad_m3: capacidadFinalU / 1000,
          desperdicio_m3: desperdicioFinalU / 1000,
          eficiencia_pct: Math.round(eficienciaPct * 100) / 100
        },
        distribucion,
        detalle_algoritmo: {
          estrategia: 'greedy-desc (m3) + ajuste local por m3',
          desperdicio_m3: desperdicioFinalU / 1000,
          tiempo_ms: Date.now() - t0
        }
      };
    } catch (error) {
      console.error('Error en calcularDistribucionOptimaRango:', error);
      throw error;
    }
  },

  // Resumen agregado por rango (totales de órdenes, productos y volumen)
  calcularSugerenciasPorRangoTotal: async ({ cliente_id, startDate, endDate }) => {
    if (!cliente_id) throw new Error('cliente_id es requerido');
    if (!startDate || !endDate) throw new Error('startDate y endDate son requeridos');
    // Total órdenes únicas
    const qOrdenes = `SELECT COUNT(DISTINCT orden_despacho)::int AS total_ordenes
                      FROM admin_platform.inventario_prospecto
                      WHERE cliente_id = $1 AND fecha_de_despacho::date BETWEEN $2::date AND $3::date`;
    // Totales productos y volumen
    const qTotales = `SELECT COALESCE(SUM(cantidad_despachada),0)::bigint AS total_productos,
                             COALESCE(SUM(volumen_total_m3_producto),0)::float8 AS volumen_total_m3
                      FROM admin_platform.inventario_prospecto
                      WHERE cliente_id = $1 AND fecha_de_despacho::date BETWEEN $2::date AND $3::date`;
    const [{ rows: rOrd }, { rows: rTot }] = await Promise.all([
      pool.query(qOrdenes, [cliente_id, startDate, endDate]),
      pool.query(qTotales, [cliente_id, startDate, endDate])
    ]);
    const total_ordenes = parseInt(rOrd?.[0]?.total_ordenes || 0);
    const total_productos = parseInt(rTot?.[0]?.total_productos || 0);
    const volumen_total_m3 = parseFloat(rTot?.[0]?.volumen_total_m3 || 0);
    return { resumen: { total_ordenes, total_productos, volumen_total_m3 } };
  },

  // NUEVA FUNCIÓN: Recomendación mensual REAL basada en movimientos históricos.
  // Usa la distribución real (modelo mínimo por línea) y proyecta uso mensual típico.
  // - base_dias: 'activos' | 'calendario' (default 'activos') define divisor para promedio diario.
  // - mensual_factor: días que consideramos para un mes (default 30).
  calcularRecomendacionMensualReal: async ({ cliente_id, startDate, endDate, base_dias = 'activos', mensual_factor = 30, modelos_permitidos }) => {
    if (!cliente_id) throw new Error('cliente_id es requerido');
    if (!startDate || !endDate) throw new Error('startDate y endDate son requeridos');

    // Obtener distribución real reutilizando lógica existente para no duplicar asignaciones.
  const distReal = await sugerenciasService.calcularDistribucionRealPorRango({ cliente_id, startDate, endDate, modelos_permitidos });

    // Calcular días calendario del rango (inclusivo)
    let diasCalendario = 1;
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diff = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
      if (diff > 0) diasCalendario = diff;
    } catch {}

    const diasActivos = distReal.resumen?.total_dias_activos || 0;
    const divisor = (base_dias === 'calendario') ? diasCalendario : (diasActivos || diasCalendario);
    const factorMensual = mensual_factor && mensual_factor > 0 ? mensual_factor : 30;

    const modelos = (distReal.distribucion || []).map(m => {
      const promedioDiario = divisor > 0 ? (m.contenedores_total / divisor) : 0;
      const promedioMensual = promedioDiario * factorMensual;
      // Reglas de presentación: evitar decimales pequeños confusos
      const recomendacionMensualEntera = Math.ceil(promedioMensual); // preferimos no subestimar
      const recomendacionDiariaEntera = promedioDiario >= 1 ? Math.round(promedioDiario) : 0;
      const frecuenciaCadaDias = (promedioDiario > 0 && promedioDiario < 1) ? Math.round(1 / promedioDiario) : null;
      return {
        modelo_id: m.modelo_id,
        nombre_modelo: m.nombre_modelo,
        volumen_litros: m.volumen_litros,
        cajas_totales_periodo: m.contenedores_total,
        promedio_diario: promedioDiario, // valor técnico
        promedio_mensual_30: promedioMensual,
        recomendacion_mensual: recomendacionMensualEntera,
        recomendacion_diaria: recomendacionDiariaEntera,
        frecuencia_cada_dias: frecuenciaCadaDias,
        porcentaje_productos: m.porcentaje_productos || 0,
        porcentaje_volumen: m.porcentaje_volumen || 0
      };
    }).sort((a,b)=> b.cajas_totales_periodo - a.cajas_totales_periodo);

    const totalCajasPeriodo = modelos.reduce((s,m)=> s + (m.cajas_totales_periodo||0), 0);
    const totalPromedioDiario = modelos.reduce((s,m)=> s + (m.promedio_diario||0), 0);
    const totalPromedioMensual = totalPromedioDiario * factorMensual;
    const totalRecomendacionMensual = modelos.reduce((s,m)=> s + (m.recomendacion_mensual||0), 0);

    return {
      parametros: { cliente_id, startDate, endDate, base_dias, mensual_factor: factorMensual },
      resumen: {
        startDate,
        endDate,
        dias_calendario: diasCalendario,
        dias_activos: diasActivos,
        base_dias_usada: base_dias === 'calendario' ? 'calendario' : 'activos',
        total_cajas_periodo: totalCajasPeriodo,
        promedio_diario_total: totalPromedioDiario,
        promedio_mensual_total: totalPromedioMensual,
        recomendacion_mensual_total: totalRecomendacionMensual,
        cobertura_productos: distReal.resumen?.cobertura_productos || 0,
        cobertura_volumen: distReal.resumen?.cobertura_volumen || 0
      },
      modelos
    };
  },
  saveRecomendacionMensualReal: async ({ cliente_id, startDate, endDate, base_dias = 'activos', mensual_factor = 30, modelos_permitidos }) => {
    const reco = await sugerenciasService.calcularRecomendacionMensualReal({ cliente_id, startDate, endDate, base_dias, mensual_factor, modelos_permitidos });
    const creadas = [];
    // Obtener el siguiente número de sugerencia (grupo)
    let numeroDeSugerencia = null;
    try {
      const { rows: maxRows } = await pool.query("SELECT MAX(CASE WHEN numero_de_sugerencia ~ '^\\d+$' THEN CAST(numero_de_sugerencia AS INTEGER) ELSE NULL END) AS maxnum FROM admin_platform.sugerencias_reemplazo");
      const maxNum = parseInt(maxRows?.[0]?.maxnum || '0', 10) || 0;
      numeroDeSugerencia = String(maxNum + 1);
    } catch (e) {
      console.warn('No se pudo calcular numero_de_sugerencia, quedará null:', e?.message);
    }
    for (const m of (reco.modelos || [])) {
      if (!m.recomendacion_mensual || m.recomendacion_mensual <= 0) continue;
      try {
        const detalle = {
          tipo: 'recomendacion_mensual_real',
          periodo: { startDate, endDate, base_dias_usada: reco.resumen?.base_dias_usada, mensual_factor: reco.parametros?.mensual_factor },
          modelo: {
            cajas_totales_periodo: m.cajas_totales_periodo,
            promedio_diario: m.promedio_diario,
            recomendacion_diaria: m.recomendacion_diaria,
            frecuencia_cada_dias: m.frecuencia_cada_dias
          },
          global: {
            total_cajas_periodo: reco.resumen?.total_cajas_periodo,
            promedio_diario_total: reco.resumen?.promedio_diario_total,
            recomendacion_mensual_total: reco.resumen?.recomendacion_mensual_total
          }
        };
        const row = await sugerenciasService.createSugerencia({
          cliente_id,
            inv_id: null,
          modelo_sugerido: m.nombre_modelo,
          cantidad_sugerida: m.recomendacion_mensual,
          modelo_id: m.modelo_id,
          estado: 'pendiente',
          detalle_orden: JSON.stringify(detalle),
          cantidad_diaria: (m.recomendacion_diaria && m.recomendacion_diaria > 0)
            ? String(m.recomendacion_diaria)
            : (m.frecuencia_cada_dias ? `1 cada ${m.frecuencia_cada_dias} días` : (m.promedio_diario ? m.promedio_diario.toFixed(3) : null))
          ,
          rango_dias: reco.resumen?.dias_calendario != null ? String(reco.resumen.dias_calendario) : null,
          dias_activos: reco.resumen?.dias_activos != null ? String(reco.resumen.dias_activos) : null,
          numero_de_sugerencia: numeroDeSugerencia
        });
        creadas.push(row);
      } catch (e) {
        console.warn('Fallo guardando recomendación modelo', m.nombre_modelo, e?.message);
      }
    }
  return { resumen: reco.resumen, total_creadas: creadas.length, numero_de_sugerencia: numeroDeSugerencia, sugerencias: creadas };
  }
};

module.exports = sugerenciasService;