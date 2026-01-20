const pool = require('./config/db');
const format = require('pg-format');

const ADMIN_TABLE = 'admin_platform.inventario_admin';
const HIST_TABLE = 'admin_platform.inventario_admin_hist';
const ADMIN_SCHEMA_PLACEHOLDER = 'admin_pool';

let adminTablesEnsured = false;

const ensureAdminTables = async () => {
  if (adminTablesEnsured) return;

  const ddl = `
    CREATE SCHEMA IF NOT EXISTS admin_platform;

    CREATE TABLE IF NOT EXISTS ${ADMIN_TABLE} (
      id SERIAL PRIMARY KEY,
      modelo_id INT,
      nombre_unidad TEXT,
      rfid VARCHAR(24) NOT NULL UNIQUE,
      lote TEXT,
      estado TEXT,
      sub_estado TEXT,
      categoria TEXT,
      activo BOOLEAN NOT NULL DEFAULT true,
      fecha_ingreso TIMESTAMPTZ,
      ultima_actualizacion TIMESTAMPTZ DEFAULT now(),
      fecha_vencimiento TIMESTAMPTZ,
      asignado_tenant_id INT REFERENCES admin_platform.tenants(id),
      es_alquiler BOOLEAN NOT NULL DEFAULT false,
      fecha_asignacion TIMESTAMPTZ,
      tenant_schema_name TEXT DEFAULT '${ADMIN_SCHEMA_PLACEHOLDER}',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS ${HIST_TABLE} (
      id SERIAL PRIMARY KEY,
      rfid VARCHAR(24) NOT NULL,
      from_tenant_id INT,
      to_tenant_id INT,
      changed_by_admin_user_id INT,
      created_at TIMESTAMPTZ DEFAULT now(),
      motivo TEXT,
      cambiar_dueno BOOLEAN DEFAULT false
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_inventario_admin_rfid ON ${ADMIN_TABLE} (rfid);
    CREATE INDEX IF NOT EXISTS idx_inventario_admin_hist_rfid ON ${HIST_TABLE} (rfid);
  `;

  await pool.query(ddl);
  adminTablesEnsured = true;
};

const clampNumber = (value, { min, max, fallback }) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (min !== undefined && numeric < min) return min;
  if (max !== undefined && numeric > max) return max;
  return numeric;
};

const requireRfid = (rfid) => {
  if (!rfid || typeof rfid !== 'string') {
    throw Object.assign(new Error('RFID requerido'), { status: 400 });
  }
  const value = rfid.trim().toUpperCase();
  if (!/^[A-Z0-9]{24}$/.test(value)) {
    throw Object.assign(new Error('El RFID debe tener 24 caracteres alfanuméricos'), { status: 400 });
  }
  return value;
};

const ensureInt = (value, field) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) {
    throw Object.assign(new Error(`${field} inválido`), { status: 400 });
  }
  return numeric;
};

const ensureOptionalInt = (value, field) => {
  if (value === undefined || value === null) return null;
  return ensureInt(value, field);
};

const mapRow = (row = {}) => ({
  id: row.id,
  rfid: row.rfid,
  modelo_id: row.modelo_id,
  nombre_unidad: row.nombre_unidad,
  tenant_schema_name: row.tenant_schema_name,
  lote: row.lote,
  estado: row.estado,
  sub_estado: row.sub_estado,
  categoria: row.categoria,
  activo: row.activo,
  fecha_ingreso: row.fecha_ingreso,
  ultima_actualizacion: row.ultima_actualizacion,
  fecha_vencimiento: row.fecha_vencimiento,
  source: row.source,
  tenant_id: row.tenant_id,
  asignado_tenant_id: row.asignado_tenant_id,
  es_alquiler: row.es_alquiler,
  fecha_asignacion: row.fecha_asignacion,
  modelo_nombre: row.modelo_nombre,
  volumen_litros: row.volumen_litros,
  tipo_modelo: row.tipo_modelo,
  tenant_nombre: row.tenant_nombre,
  asignado_tenant_nombre: row.asignado_tenant_nombre
});

const getTenants = async () => {
  const { rows } = await pool.query(
    `SELECT id, nombre, esquema FROM admin_platform.tenants WHERE esquema IS NOT NULL AND esquema LIKE 'tenant_%'`
  );
  return rows;
};

const fetchTenantInventory = async (tenant) => {
  const buildSql = (useEsAlquilerColumn = true) => format(
    `SELECT
        i.id,
        i.rfid,
        i.modelo_id,
        i.nombre_unidad,
        i.lote,
        i.estado,
        i.sub_estado,
        i.categoria,
        i.activo,
        i.fecha_ingreso,
        i.ultima_actualizacion,
        i.fecha_vencimiento,
        'tenant' AS source,
        %L::int AS tenant_id,
        %L::int AS asignado_tenant_id,
        ${useEsAlquilerColumn ? 'COALESCE(i.es_alquiler, false)' : 'false'} AS es_alquiler,
        NULL::timestamptz AS fecha_asignacion,
        %L::text AS tenant_schema_name,
        %L::text AS tenant_nombre,
        %L::text AS asignado_tenant_nombre,
        m.nombre_modelo,
        m.volumen_litros,
        m.tipo AS tipo_modelo
     FROM %I.inventario_credocubes i
     LEFT JOIN admin_platform.modelos m ON m.modelo_id = i.modelo_id`,
    tenant.id,
    tenant.id,
    tenant.esquema,
    tenant.nombre,
    tenant.nombre,
    tenant.esquema
  );

  try {
    const { rows } = await pool.query(buildSql(true));
    return rows.map(mapRow);
  } catch (error) {
    // Si la columna es_alquiler no existe, reintentar sin ella
    if (error?.code === '42703') {
      console.warn(`Inventario central: ${tenant.esquema} sin columna es_alquiler, usando false por defecto`);
      const { rows } = await pool.query(buildSql(false));
      return rows.map(mapRow);
    }

    console.error(`Inventario central: error leyendo inventario de ${tenant.esquema}:`, error.message);
    return [];
  }
};

const fetchAdminInventory = async () => {
  await ensureAdminTables();

  const sql = `
    SELECT
      i.id,
      i.rfid,
      i.modelo_id,
      i.nombre_unidad,
      i.lote,
      i.estado,
      i.sub_estado,
      i.categoria,
      i.activo,
      i.fecha_ingreso,
      i.ultima_actualizacion,
      i.fecha_vencimiento,
      'admin' AS source,
      NULL::int AS tenant_id,
      i.asignado_tenant_id,
      COALESCE(i.es_alquiler, false) AS es_alquiler,
      i.fecha_asignacion,
      i.tenant_schema_name,
      NULL::text AS tenant_nombre,
      t.nombre AS asignado_tenant_nombre,
      m.nombre_modelo,
      m.volumen_litros,
      m.tipo AS tipo_modelo
    FROM ${ADMIN_TABLE} i
    LEFT JOIN admin_platform.tenants t ON t.id = i.asignado_tenant_id
    LEFT JOIN admin_platform.modelos m ON m.modelo_id = i.modelo_id
  `;

  const { rows } = await pool.query(sql);
  return rows.map(mapRow);
};

const applyFilters = (items, filters = {}) => {
  const normalized = filters || {};
  return items.filter((it) => {
    if (normalized.rfid) {
      if (requireRfid(normalized.rfid) !== it.rfid) return false;
    }
    if (normalized.search) {
      const term = String(normalized.search).trim().toLowerCase();
      const haystack = `${it.rfid || ''} ${it.nombre_unidad || ''} ${it.modelo_nombre || ''}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (normalized.source && normalized.source !== 'all') {
      if (it.source !== normalized.source) return false;
    }
    if (normalized.tenantId !== undefined && normalized.tenantId !== null) {
      if (it.tenant_id !== ensureInt(normalized.tenantId, 'tenantId')) return false;
    }
    if (normalized.asignadoTenantId !== undefined && normalized.asignadoTenantId !== null) {
      if (it.asignado_tenant_id !== ensureInt(normalized.asignadoTenantId, 'asignadoTenantId')) return false;
    }
    if (normalized.modeloId !== undefined && normalized.modeloId !== null) {
      if (it.modelo_id !== ensureInt(normalized.modeloId, 'modeloId')) return false;
    }
    if (normalized.estado && it.estado !== normalized.estado) return false;
    if (normalized.categoria && it.categoria !== normalized.categoria) return false;
    if (normalized.es_alquiler !== undefined && normalized.es_alquiler !== null) {
      if (Boolean(it.es_alquiler) !== Boolean(normalized.es_alquiler)) return false;
    }
    if (normalized.activo !== undefined && normalized.activo !== null) {
      if (Boolean(it.activo) !== Boolean(normalized.activo)) return false;
    }
    return true;
  });
};

const paginate = (items, { page = 1, pageSize = 20 } = {}) => {
  const safePage = clampNumber(page, { min: 1, fallback: 1 });
  const safeSize = clampNumber(pageSize, { min: 1, max: 200, fallback: 20 });
  const total = items.length;
  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / safeSize));
  const start = (safePage - 1) * safeSize;
  const slice = items.slice(start, start + safeSize);
  return { items: slice, total, page: safePage, pageSize: safeSize, totalPages };
};

const getInventarioCentral = async (filters = {}, options = {}) => {
  const tenants = await getTenants();

  const tenantPromise = Promise.all(tenants.map(fetchTenantInventory));
  const shouldLoadAdmin = filters?.source === 'admin';
  const adminPromise = shouldLoadAdmin ? fetchAdminInventory() : Promise.resolve([]);

  const [tenantItemLists, adminItems] = await Promise.all([tenantPromise, adminPromise]);

  const baseItems = shouldLoadAdmin ? adminItems : tenantItemLists.flat();
  const filtered = applyFilters(baseItems, filters);

  filtered.sort((a, b) => {
    const d1 = new Date(a.fecha_ingreso || a.ultima_actualizacion || 0).getTime();
    const d2 = new Date(b.fecha_ingreso || b.ultima_actualizacion || 0).getTime();
    return d2 - d1 || (b.id || 0) - (a.id || 0);
  });

  return paginate(filtered, options);
};

const upsertAdmin = async (client, payload) => {
  await ensureAdminTables();

  const sql = `
    INSERT INTO ${ADMIN_TABLE} (
      modelo_id, nombre_unidad, rfid, lote, estado, sub_estado, categoria,
      fecha_ingreso, ultima_actualizacion, fecha_vencimiento, activo,
      asignado_tenant_id, es_alquiler, fecha_asignacion, tenant_schema_name
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, now()), now(), $9,$10,$11,$12, now(), $13)
    ON CONFLICT (rfid) DO UPDATE SET
      modelo_id = EXCLUDED.modelo_id,
      nombre_unidad = EXCLUDED.nombre_unidad,
      lote = EXCLUDED.lote,
      estado = EXCLUDED.estado,
      sub_estado = EXCLUDED.sub_estado,
      categoria = EXCLUDED.categoria,
      fecha_ingreso = COALESCE(${ADMIN_TABLE}.fecha_ingreso, EXCLUDED.fecha_ingreso),
      ultima_actualizacion = now(),
      fecha_vencimiento = EXCLUDED.fecha_vencimiento,
      activo = EXCLUDED.activo,
      asignado_tenant_id = EXCLUDED.asignado_tenant_id,
      es_alquiler = EXCLUDED.es_alquiler,
      fecha_asignacion = now(),
      tenant_schema_name = EXCLUDED.tenant_schema_name
    RETURNING *
  `;

  const { rows } = await client.query(sql, [
    payload.modelo_id,
    payload.nombre_unidad,
    payload.rfid,
    payload.lote,
    payload.estado,
    payload.sub_estado,
    payload.categoria,
    payload.fecha_ingreso,
    payload.fecha_vencimiento,
    payload.activo ?? true,
    payload.asignado_tenant_id ?? null,
    payload.es_alquiler ?? false,
    payload.tenant_schema_name || ADMIN_SCHEMA_PLACEHOLDER
  ]);
  return rows[0];
};

const findItemLocation = async (rfid, tenants) => {
  await ensureAdminTables();

  const normalizedRfid = requireRfid(rfid);

  // Primero busca un registro activo en cualquier tenant
  for (const tenant of tenants) {
    const sqlActive = format('SELECT * FROM %I.inventario_credocubes WHERE rfid = $1 AND activo = true LIMIT 1', tenant.esquema);
    const { rows } = await pool.query(sqlActive, [normalizedRfid]);
    if (rows.length) {
      const row = rows[0];
      return {
        location: 'tenant',
        item: mapRow({
          ...row,
          source: 'tenant',
          tenant_id: tenant.id,
          asignado_tenant_id: tenant.id,
          tenant_schema_name: tenant.esquema,
          tenant_nombre: tenant.nombre
        }),
        tenantId: tenant.id,
        schema: tenant.esquema
      };
    }
  }

  // Si no hay activos, toma el primero que exista (inactivo)
  for (const tenant of tenants) {
    const sqlAny = format('SELECT * FROM %I.inventario_credocubes WHERE rfid = $1 LIMIT 1', tenant.esquema);
    const { rows } = await pool.query(sqlAny, [normalizedRfid]);
    if (rows.length) {
      const row = rows[0];
      return {
        location: 'tenant',
        item: mapRow({
          ...row,
          source: 'tenant',
          tenant_id: tenant.id,
          asignado_tenant_id: tenant.id,
          tenant_schema_name: tenant.esquema,
          tenant_nombre: tenant.nombre
        }),
        tenantId: tenant.id,
        schema: tenant.esquema
      };
    }
  }

  // Por último, admin
  const adminQuery = `
    SELECT i.*, t.nombre AS asignado_tenant_nombre
    FROM ${ADMIN_TABLE} i
    LEFT JOIN admin_platform.tenants t ON t.id = i.asignado_tenant_id
    WHERE i.rfid = $1
    LIMIT 1`;
  const { rows: adminRows } = await pool.query(adminQuery, [normalizedRfid]);
  if (adminRows.length) {
    return { location: 'admin', item: mapRow({ ...adminRows[0], source: 'admin', tenant_schema_name: ADMIN_SCHEMA_PLACEHOLDER }), tenantId: adminRows[0].asignado_tenant_id || null, schema: null };
  }
  return null;
};

const findActiveTenantsForRfid = async (rfid, tenants) => {
  const normalized = requireRfid(rfid);
  const actives = [];
  for (const tenant of tenants) {
    if (!tenant.esquema) continue;
    const sql = format('SELECT 1 FROM %I.inventario_credocubes WHERE rfid = $1 AND activo = true LIMIT 1', tenant.esquema);
    const { rows } = await pool.query(sql, [normalized]);
    if (rows.length) {
      actives.push({ tenant, schema: tenant.esquema });
    }
  }
  return actives;
};

const createInventarioCentral = async (payload = {}) => {
  const modeloId = ensureInt(payload.modelo_id, 'modelo_id');
  const rfid = requireRfid(payload.rfid);
  const tenantId = ensureOptionalInt(payload.asignado_tenant_id ?? payload.tenant_id, 'asignado_tenant_id');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const adminRow = await upsertAdmin(client, {
      modelo_id: modeloId,
      nombre_unidad: payload.nombre_unidad || null,
      rfid,
      lote: payload.lote || null,
      estado: payload.estado || null,
      sub_estado: payload.sub_estado || null,
      categoria: payload.categoria || null,
      fecha_ingreso: payload.fecha_ingreso || null,
      fecha_vencimiento: payload.fecha_vencimiento || null,
      activo: payload.activo !== false,
      asignado_tenant_id: tenantId,
      es_alquiler: payload.es_alquiler || false,
      tenant_schema_name: ADMIN_SCHEMA_PLACEHOLDER
    });
    await client.query('COMMIT');
    return mapRow({ ...adminRow, source: 'admin' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const reassignInventarioCentral = async (rfid, { tenantId, cambiarDueno = false, adminUserId, motivo, force = false } = {}) => {
  await ensureAdminTables();

  const normalizedRfid = requireRfid(rfid);
  const targetTenant = ensureInt(tenantId, 'tenantId');
  const tenants = await getTenants();
  const target = tenants.find(t => t.id === targetTenant);
  if (!target) {
    const err = new Error('Tenant destino no existe');
    err.status = 404;
    throw err;
  }

  // Saber si existe registro en admin (caso asignación desde admin)
  const { rows: adminRows } = await pool.query(`SELECT 1 FROM ${ADMIN_TABLE} WHERE rfid = $1 LIMIT 1`, [normalizedRfid]);
  const hasAdminRecord = adminRows.length > 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await findItemLocation(normalizedRfid, tenants);
    if (!found) {
      const err = new Error('RFID no encontrado en ningún tenant ni en admin');
      err.status = 404;
      throw err;
    }

    // Detectar si está activo en otros tenants distintos del destino
    const activeTenants = await findActiveTenantsForRfid(normalizedRfid, tenants);
    const originTenantIdNum = found.tenantId === undefined || found.tenantId === null ? null : Number(found.tenantId);

    const conflicting = hasAdminRecord
      ? activeTenants.filter(({ tenant }) => tenant.id !== targetTenant)
      : activeTenants.filter(({ tenant }) => tenant.id !== originTenantIdNum && tenant.id !== targetTenant);
    if (conflicting.length && !force) {
      const conflict = conflicting[0];
      const conflictName = conflict.tenant.nombre || conflict.schema;
      const conflictError = Object.assign(new Error(`La pieza está activa en otro tenant: ${conflictName}`), {
        status: 409,
        conflictTenantId: conflict.tenant.id,
        conflictTenantNombre: conflictName
      });
      throw conflictError;
    }

    const originSchema = found.schema;
    const originTenantId = found.tenantId || null;
    const baseItem = found.item;

    if (originSchema) {
      const deactivateSql = format('UPDATE %I.inventario_credocubes SET activo = false, ultima_actualizacion = now() WHERE rfid = $1', originSchema);
      await client.query(deactivateSql, [normalizedRfid]);
    }

    // Si se fuerza, desactivar cualquier otro tenant que tuviera el RFID activo (evita duplicados)
    if (force && conflicting.length) {
      for (const { schema } of conflicting) {
        const deactivateSql = format('UPDATE %I.inventario_credocubes SET activo = false, ultima_actualizacion = now() WHERE rfid = $1', schema);
        await client.query(deactivateSql, [normalizedRfid]);
      }
    }

    if (target.esquema) {
      const upsertSql = format(
        `INSERT INTO %I.inventario_credocubes (
          modelo_id, nombre_unidad, rfid, lote, estado, sub_estado, categoria, activo, fecha_ingreso, ultima_actualizacion
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,true,COALESCE($8, now()), now())
        ON CONFLICT (rfid) DO UPDATE SET
          activo = true,
          estado = EXCLUDED.estado,
          sub_estado = EXCLUDED.sub_estado,
          categoria = EXCLUDED.categoria,
          ultima_actualizacion = now()`,
        target.esquema
      );
      await client.query(upsertSql, [
        baseItem.modelo_id,
        baseItem.nombre_unidad,
        normalizedRfid,
        baseItem.lote,
        baseItem.estado,
        baseItem.sub_estado,
        baseItem.categoria,
        baseItem.fecha_ingreso
      ]);
    }

    // Siempre eliminar cualquier registro en admin para este RFID al asignar a un tenant
    await client.query(`DELETE FROM ${ADMIN_TABLE} WHERE rfid = $1`, [normalizedRfid]);

    await client.query(
      `INSERT INTO ${HIST_TABLE} (rfid, from_tenant_id, to_tenant_id, changed_by_admin_user_id, motivo, cambiar_dueno)
       VALUES ($1, $2, $3, $4, $5, $6)` ,
      [normalizedRfid, originTenantId, targetTenant, adminUserId || null, motivo || null, !!cambiarDueno]
    );

    await client.query('COMMIT');
    return mapRow({ ...baseItem, source: 'tenant', tenant_id: targetTenant, asignado_tenant_id: null });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const desasignarInventarioCentral = async (rfid) => {
  await ensureAdminTables();

  const normalizedRfid = requireRfid(rfid);
  const tenants = await getTenants();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await findItemLocation(normalizedRfid, tenants);
    if (!found) {
      const err = new Error('RFID no encontrado en ningún tenant ni en admin');
      err.status = 404;
      throw err;
    }

    // Inhabilitar en todos los tenants donde esté activo antes de pasarlo a admin
    const activeTenants = await findActiveTenantsForRfid(normalizedRfid, tenants);
    for (const { schema } of activeTenants) {
      const deactivateSql = format('UPDATE %I.inventario_credocubes SET activo = false, ultima_actualizacion = now() WHERE rfid = $1', schema);
      await client.query(deactivateSql, [normalizedRfid]);
    }

    const adminRow = await upsertAdmin(client, {
      ...found.item,
      rfid: normalizedRfid,
      activo: true,
      asignado_tenant_id: null,
      tenant_schema_name: ADMIN_SCHEMA_PLACEHOLDER
    });

    await client.query(
      `INSERT INTO ${HIST_TABLE} (rfid, from_tenant_id, to_tenant_id, changed_by_admin_user_id, motivo, cambiar_dueno)
       VALUES ($1, $2, NULL, $3, $4, false)` ,
      [normalizedRfid, found.tenantId || null, null, 'Pasar a admin']
    );

    await client.query('COMMIT');
    return mapRow({ ...adminRow, source: 'admin' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getHistorialAsignaciones = async (rfid, options = {}) => {
  await ensureAdminTables();

  const normalizedRfid = requireRfid(rfid);
  const limit = clampNumber(options.limit, { min: 1, max: 200, fallback: 50 });
  const query = `
    SELECT
      h.id,
      h.rfid,
      h.from_tenant_id,
      h.to_tenant_id,
      h.changed_by_admin_user_id,
      h.created_at AS changed_at,
      h.motivo,
      h.cambiar_dueno,
      t_from.nombre AS from_tenant_nombre,
      t_to.nombre AS to_tenant_nombre,
      au.correo AS changed_by_correo
    FROM ${HIST_TABLE} h
    LEFT JOIN admin_platform.tenants t_from ON t_from.id = h.from_tenant_id
    LEFT JOIN admin_platform.tenants t_to ON t_to.id = h.to_tenant_id
    LEFT JOIN admin_platform.admin_users au ON au.id = h.changed_by_admin_user_id
    WHERE h.rfid = $1
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT $2
  `;

  const { rows } = await pool.query(query, [normalizedRfid, limit]);
  return rows;
};

module.exports = {
  getInventarioCentral,
  createInventarioCentral,
  reassignInventarioCentral,
  desasignarInventarioCentral,
  getHistorialAsignaciones
};
