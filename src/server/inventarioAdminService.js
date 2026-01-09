const pool = require('./config/db');
const format = require('pg-format');

const SCHEMA_PREFIX = 'tenant_';
const BASE_SCHEMAS_TO_SKIP = new Set(['tenant_base']);

const sanitizeSchema = (schema) => {
  if (!schema || typeof schema !== 'string') {
    throw Object.assign(new Error('Schema requerido'), { status: 400 });
  }
  const normalized = schema.trim();
  if (!normalized.startsWith(SCHEMA_PREFIX)) {
    throw Object.assign(new Error('Schema inválido'), { status: 400 });
  }
  if (BASE_SCHEMAS_TO_SKIP.has(normalized)) {
    throw Object.assign(new Error('Schema base no permitido'), { status: 400 });
  }
  // Permitimos letras (incluyendo acentos), números, guiones, puntos y guiones bajos.
  if (!/^tenant_[\p{L}0-9_.-]+$/u.test(normalized)) {
    throw Object.assign(new Error('Schema inválido'), { status: 400 });
  }
  return normalized;
};

const mapInventarioRow = (row) => ({
  id: row.id,
  modelo_id: row.modelo_id,
  nombre_unidad: row.nombre_unidad,
  rfid: row.rfid,
  lote: row.lote,
  estado: row.estado,
  sub_estado: row.sub_estado,
  categoria: row.categoria,
  activo: row.activo,
  numero_orden: row.numero_orden,
  sede_id: row.sede_id,
  zona_id: row.zona_id,
  seccion_id: row.seccion_id,
  validacion_limpieza: row.validacion_limpieza,
  validacion_goteo: row.validacion_goteo,
  validacion_desinfeccion: row.validacion_desinfeccion,
  fecha_ingreso: row.fecha_ingreso,
  ultima_actualizacion: row.ultima_actualizacion,
  fecha_vencimiento: row.fecha_vencimiento,
  temp_salida_c: row.temp_salida_c,
  temp_llegada_c: row.temp_llegada_c,
  sensor_id: row.sensor_id,
  modelo_nombre: row.modelo_nombre,
  volumen_litros: row.volumen_litros,
  tipo_modelo: row.tipo_modelo,
  sede_nombre: row.sede_nombre,
  zona_nombre: row.zona_nombre,
  seccion_nombre: row.seccion_nombre,
});

const buildFilters = (filters = {}) => {
  const clauses = [];
  const params = [];

  if (filters.id !== undefined) {
    const idValue = Number(filters.id);
    if (Number.isNaN(idValue)) {
      throw Object.assign(new Error('Filtro de id inválido'), { status: 400 });
    }
    clauses.push('i.id = $' + (params.length + 1));
    params.push(idValue);
  }

  if (filters.search) {
    const likeValue = `%${filters.search.toLowerCase()}%`;
    clauses.push('(' +
      'LOWER(i.rfid) LIKE $' + (params.length + 1) +
      ' OR LOWER(i.nombre_unidad) LIKE $' + (params.length + 1) +
      ' OR LOWER(coalesce(m.nombre_modelo, \'\')) LIKE $' + (params.length + 1) +
    ')');
    params.push(likeValue);
  }

  if (filters.activo !== undefined) {
    clauses.push('i.activo = $' + (params.length + 1));
    params.push(!!filters.activo);
  }

  if (filters.estado) {
    clauses.push('i.estado = $' + (params.length + 1));
    params.push(filters.estado);
  }

  if (filters.categoria) {
    clauses.push('i.categoria = $' + (params.length + 1));
    params.push(filters.categoria);
  }

  if (filters.sede_id) {
    clauses.push('i.sede_id = $' + (params.length + 1));
    params.push(Number(filters.sede_id));
  }

  if (filters.zona_id) {
    clauses.push('i.zona_id = $' + (params.length + 1));
    params.push(Number(filters.zona_id));
  }

  if (filters.seccion_id) {
    clauses.push('i.seccion_id = $' + (params.length + 1));
    params.push(Number(filters.seccion_id));
  }

  return { clauses, params };
};

const clampNumber = (value, { min, max, fallback }) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
    return fallback;
  }
  if (min !== undefined && numeric < min) return min;
  if (max !== undefined && numeric > max) return max;
  return numeric;
};

const getInventario = async (schema, filters = {}, options = {}) => {
  const tenantSchema = sanitizeSchema(schema);
  const { clauses, params } = buildFilters(filters);
  const page = clampNumber(options.page, { min: 1, fallback: 1 });
  const pageSize = clampNumber(options.pageSize, { min: 1, max: 100, fallback: 20 });
  const offset = (page - 1) * pageSize;

  const baseFrom = format(`
    FROM %I.%I i
    LEFT JOIN %I.%I m ON m.modelo_id = i.modelo_id
    LEFT JOIN %I.%I s ON s.sede_id = i.sede_id
    LEFT JOIN %I.%I z ON z.zona_id = i.zona_id
    LEFT JOIN %I.%I se ON se.seccion_id = i.seccion_id
  `,
  tenantSchema, 'inventario_credocubes',
  tenantSchema, 'modelos',
  tenantSchema, 'sedes',
  tenantSchema, 'zonas',
  tenantSchema, 'secciones'
  );

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const dataQuery = `
    SELECT
      i.*,
      m.nombre_modelo AS modelo_nombre,
      m.volumen_litros,
      m.tipo AS tipo_modelo,
      s.nombre AS sede_nombre,
      z.nombre AS zona_nombre,
      se.nombre AS seccion_nombre
    ${baseFrom}
    ${whereClause}
    ORDER BY i.id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    ${baseFrom}
    ${whereClause}
  `;

  const dataParams = [...params, pageSize, offset];
  const [{ rows }, countResult] = await Promise.all([
    pool.query(dataQuery, dataParams),
    pool.query(countQuery, params)
  ]);

  const total = Number(countResult.rows[0]?.total || 0);
  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  let currentPage = page;
  let currentRows = rows;

  if (total > 0 && page > totalPages) {
    currentPage = totalPages;
    const safeOffset = (currentPage - 1) * pageSize;
    const safeParams = [...params, pageSize, safeOffset];
    const safeResult = await pool.query(dataQuery, safeParams);
    currentRows = safeResult.rows;
  }

  return {
    items: currentRows.map(mapInventarioRow),
    total,
    page: currentPage,
    pageSize,
    totalPages
  };
};

const requireRfid = (rfid) => {
  if (!rfid || typeof rfid !== 'string') {
    throw Object.assign(new Error('RFID requerido'), { status: 400 });
  }
  const value = rfid.trim();
  if (!/^\d{24}$/.test(value)) {
    throw Object.assign(new Error('RFID debe tener 24 dígitos numéricos'), { status: 400 });
  }
  return value;
};

const ensureOptionalInt = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Number.isNaN(value) || !Number.isInteger(value)) {
    throw Object.assign(new Error(`${field} inválido`), { status: 400 });
  }
  return value;
};

const ensureOptionalNumber = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    throw Object.assign(new Error(`${field} inválido`), { status: 400 });
  }
  return numeric;
};

const normalizeInventarioPayload = (input = {}) => {
  const toNumber = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const str = String(value).trim();
    if (str === '') return undefined;
    return Number(str);
  };
  const toString = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const str = String(value);
    return str.trim() === '' ? null : str;
  };
  const toTrimmed = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
  };

  return {
    modelo_id: toNumber(input.modelo_id),
    rfid: toTrimmed(input.rfid),
    lote: toString(input.lote),
    estado: input.estado === undefined ? undefined : input.estado,
    sub_estado: input.sub_estado === undefined ? undefined : input.sub_estado,
    categoria: input.categoria === undefined ? undefined : input.categoria,
    activo: input.activo === undefined ? undefined : !!input.activo,
    numero_orden: toString(input.numero_orden),
    sede_id: toNumber(input.sede_id),
    zona_id: toNumber(input.zona_id),
    seccion_id: toNumber(input.seccion_id),
    validacion_limpieza: toString(input.validacion_limpieza),
    validacion_goteo: toString(input.validacion_goteo),
    validacion_desinfeccion: toString(input.validacion_desinfeccion),
    temp_salida_c: toNumber(input.temp_salida_c),
    temp_llegada_c: toNumber(input.temp_llegada_c),
    sensor_id: toString(input.sensor_id),
    fecha_vencimiento: input.fecha_vencimiento === undefined ? undefined : input.fecha_vencimiento
  };
};

const createInventarioItem = async (schema, payload) => {
  const tenantSchema = sanitizeSchema(schema);
  const data = normalizeInventarioPayload(payload);
  if (data.modelo_id === undefined || data.modelo_id === null || Number.isNaN(data.modelo_id)) {
    throw Object.assign(new Error('Modelo requerido'), { status: 400 });
  }
  if (!Number.isInteger(data.modelo_id)) {
    throw Object.assign(new Error('Modelo inválido'), { status: 400 });
  }
  data.rfid = requireRfid(data.rfid);

  const estado = data.estado ?? 'Pre Acondicionamiento';
  const subEstado = data.sub_estado ?? null;
  const categoria = data.categoria ?? null;
  const activo = data.activo === undefined ? true : data.activo;
  const numeroOrden = data.numero_orden ?? null;
  const sedeId = ensureOptionalInt(data.sede_id, 'sede_id');
  const zonaId = ensureOptionalInt(data.zona_id, 'zona_id');
  const seccionId = ensureOptionalInt(data.seccion_id, 'seccion_id');
  const validacionLimpieza = data.validacion_limpieza ?? null;
  const validacionGoteo = data.validacion_goteo ?? null;
  const validacionDesinfeccion = data.validacion_desinfeccion ?? null;
  const tempSalida = ensureOptionalNumber(data.temp_salida_c, 'temp_salida_c');
  const tempLlegada = ensureOptionalNumber(data.temp_llegada_c, 'temp_llegada_c');
  const sensorId = data.sensor_id ?? null;
  const fechaVencimiento = data.fecha_vencimiento ?? null;

  const query = format(`
    INSERT INTO %I.%I (
      modelo_id,
      nombre_unidad,
      rfid,
      lote,
      estado,
      sub_estado,
      categoria,
      activo,
      numero_orden,
      sede_id,
      zona_id,
      seccion_id,
      validacion_limpieza,
      validacion_goteo,
      validacion_desinfeccion,
      temp_salida_c,
      temp_llegada_c,
      sensor_id,
      fecha_vencimiento
    )
    VALUES (
      $1,
      (SELECT nombre_modelo FROM %I.%I WHERE modelo_id = $1),
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15,
      $16,
      $17,
      $18
    )
    RETURNING *
  `, tenantSchema, 'inventario_credocubes', tenantSchema, 'modelos');

  const params = [
    data.modelo_id,
    data.rfid,
    data.lote ?? null,
    estado,
    subEstado,
    categoria,
    activo,
    numeroOrden,
    sedeId,
    zonaId,
    seccionId,
    validacionLimpieza,
    validacionGoteo,
    validacionDesinfeccion,
    tempSalida,
    tempLlegada,
    sensorId,
    fechaVencimiento
  ];

  const { rows } = await pool.query(query, params);
  if (!rows.length) {
    throw new Error('No se pudo crear el item de inventario');
  }
  const created = rows[0];
  // Recuperar joins para consistencia
  const { items: fullItems } = await getInventario(tenantSchema, { id: created.id }, { page: 1, pageSize: 1 });
  return fullItems[0] || mapInventarioRow(created);
};

const updateInventarioItem = async (schema, itemId, payload) => {
  const tenantSchema = sanitizeSchema(schema);
  const id = Number(itemId);
  if (!id) {
    throw Object.assign(new Error('ID inválido'), { status: 400 });
  }
  const data = normalizeInventarioPayload(payload);
  if (data.modelo_id !== undefined) {
    if (data.modelo_id === null || Number.isNaN(data.modelo_id) || !Number.isInteger(data.modelo_id)) {
      throw Object.assign(new Error('Modelo inválido'), { status: 400 });
    }
  }

  if (data.rfid !== undefined) {
    if (data.rfid === null) {
      throw Object.assign(new Error('RFID requerido'), { status: 400 });
    }
    data.rfid = requireRfid(data.rfid);
  }

  const fields = [];
  const params = [];

  let modeloParamIndex = null;

  const assign = (column, value) => {
    fields.push(`${column} = $${params.length + 1}`);
    params.push(value);
    if (column === 'modelo_id') {
      modeloParamIndex = params.length; // guardar índice 1-based
    }
  };

  const simpleFields = {
    modelo_id: data.modelo_id,
    rfid: data.rfid,
    lote: data.lote,
    estado: data.estado,
    sub_estado: data.sub_estado,
    categoria: data.categoria,
    activo: data.activo,
    numero_orden: data.numero_orden,
    sede_id: ensureOptionalInt(data.sede_id, 'sede_id'),
    zona_id: ensureOptionalInt(data.zona_id, 'zona_id'),
    seccion_id: ensureOptionalInt(data.seccion_id, 'seccion_id'),
    validacion_limpieza: data.validacion_limpieza,
    validacion_goteo: data.validacion_goteo,
    validacion_desinfeccion: data.validacion_desinfeccion,
    temp_salida_c: ensureOptionalNumber(data.temp_salida_c, 'temp_salida_c'),
    temp_llegada_c: ensureOptionalNumber(data.temp_llegada_c, 'temp_llegada_c'),
    sensor_id: data.sensor_id,
    fecha_vencimiento: data.fecha_vencimiento
  };

  Object.entries(simpleFields).forEach(([column, value]) => {
    if (value !== undefined) {
      assign(column, value);
    }
  });

  if (fields.length === 0) {
    throw Object.assign(new Error('Sin datos para actualizar'), { status: 400 });
  }

  // Forzar update de nombre_unidad cuando cambia el modelo
  if (modeloParamIndex !== null) {
    const modelosTable = format('%I.%I', tenantSchema, 'modelos');
    fields.push(`nombre_unidad = (SELECT nombre_modelo FROM ${modelosTable} WHERE modelo_id = $${modeloParamIndex})`);
  }

  const query = format(`
    UPDATE %I.%I
    SET %s,
        ultima_actualizacion = CURRENT_TIMESTAMP
    WHERE id = $%d
    RETURNING *
  `,
  tenantSchema, 'inventario_credocubes',
  fields.join(', '),
  params.length + 1
  );

  params.push(id);

  const { rows } = await pool.query(query, params);
  if (!rows.length) {
    throw Object.assign(new Error('Item no encontrado'), { status: 404 });
  }
  const updated = rows[0];
  const { items: fullItems } = await getInventario(tenantSchema, { id }, { page: 1, pageSize: 1 });
  return fullItems[0] || mapInventarioRow(updated);
};

const getModelos = async (schema) => {
  const tenantSchema = sanitizeSchema(schema);
  const query = format(`
    SELECT modelo_id, nombre_modelo, volumen_litros, descripcion, tipo
    FROM %I.%I
    ORDER BY LOWER(nombre_modelo) ASC
  `, tenantSchema, 'modelos');
  const { rows } = await pool.query(query);
  return rows;
};

const getSedes = async (schema) => {
  const tenantSchema = sanitizeSchema(schema);
  const query = format(`
    SELECT sede_id, nombre, codigo, activa
    FROM %I.%I
    ORDER BY LOWER(nombre) ASC
  `, tenantSchema, 'sedes');
  const { rows } = await pool.query(query);
  return rows;
};

const getZonas = async (schema, sedeId) => {
  const tenantSchema = sanitizeSchema(schema);
  const base = format(`
    SELECT zona_id, sede_id, nombre, activa
    FROM %I.%I
    %s
    ORDER BY LOWER(nombre) ASC
  `, tenantSchema, 'zonas', sedeId ? 'WHERE sede_id = $1' : '');
  const { rows } = await pool.query(base, sedeId ? [Number(sedeId)] : []);
  return rows;
};

const getSecciones = async (schema, zonaId) => {
  const tenantSchema = sanitizeSchema(schema);
  const base = format(`
    SELECT seccion_id, zona_id, nombre, activa
    FROM %I.%I
    %s
    ORDER BY LOWER(nombre) ASC
  `, tenantSchema, 'secciones', zonaId ? 'WHERE zona_id = $1' : '');
  const { rows } = await pool.query(base, zonaId ? [Number(zonaId)] : []);
  return rows;
};

module.exports = {
  sanitizeSchema,
  getInventario,
  createInventarioItem,
  updateInventarioItem,
  getModelos,
  getSedes,
  getZonas,
  getSecciones
};
