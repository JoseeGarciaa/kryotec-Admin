import { apiClient } from '../services/api';

export interface TenantInventoryItem {
  id: number;
  modelo_id: number;
  nombre_unidad: string;
  rfid: string;
  lote: string | null;
  estado: string;
  sub_estado: string | null;
  categoria: string | null;
  activo: boolean;
  numero_orden: string | null;
  sede_id: number | null;
  zona_id: number | null;
  seccion_id: number | null;
  validacion_limpieza?: string | null;
  validacion_goteo?: string | null;
  validacion_desinfeccion?: string | null;
  fecha_ingreso: string | null;
  ultima_actualizacion: string | null;
  fecha_vencimiento: string | null;
  temp_salida_c?: number | null;
  temp_llegada_c?: number | null;
  sensor_id?: string | null;
  modelo_nombre?: string | null;
  volumen_litros?: number | null;
  tipo_modelo?: string | null;
  sede_nombre?: string | null;
  zona_nombre?: string | null;
  seccion_nombre?: string | null;
}

export interface TenantInventoryFilters {
  search?: string;
  estado?: string;
  categoria?: string;
  activo?: boolean;
  sede_id?: number;
  zona_id?: number;
  seccion_id?: number;
}

export interface TenantInventoryListResponse {
  items: TenantInventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TenantInventoryPagination {
  page?: number;
  pageSize?: number;
}

export interface TenantInventoryPayload {
  modelo_id: number;
  rfid: string;
  lote?: string | null;
  estado?: string;
  sub_estado?: string | null;
  categoria?: string | null;
  activo?: boolean;
  numero_orden?: string | null;
  sede_id?: number | null;
  zona_id?: number | null;
  seccion_id?: number | null;
  validacion_limpieza?: string | null;
  validacion_goteo?: string | null;
  validacion_desinfeccion?: string | null;
  temp_salida_c?: number | null;
  temp_llegada_c?: number | null;
  sensor_id?: string | null;
  fecha_vencimiento?: string | null;
}

export type TenantInventoryRfidStatus =
  | 'accepted'
  | 'duplicate_input'
  | 'duplicate_existing'
  | 'conflict_other_sede'
  | 'already_exists'
  | 'invalid_format';

export interface TenantInventoryRfidValidationEntry {
  index: number;
  original: string;
  normalized: string | null;
  status: TenantInventoryRfidStatus | 'pending';
  message?: string;
  existing?: {
    id?: number | null;
    sede_id?: number | null;
    sede_nombre?: string | null;
    [key: string]: unknown;
  };
}

export interface TenantInventoryRfidValidationResult {
  results: TenantInventoryRfidValidationEntry[];
  accepted: string[];
}

export interface TenantInventoryBulkCreateResult {
  created: Array<{ rfid: string; item: TenantInventoryItem }>;
  failures: Array<{ rfid: string; error: string; status?: number }>;
}

export interface TenantInventoryModelInfo {
  modelo_id: number;
  nombre_modelo: string;
  volumen_litros: number | null;
  descripcion?: string | null;
  tipo?: string | null;
}

export interface TenantInventorySede {
  sede_id: number;
  nombre: string;
  codigo?: string | null;
  activa: boolean;
}

export interface TenantInventoryZona {
  zona_id: number;
  sede_id: number;
  nombre: string;
  activa: boolean;
}

export interface TenantInventorySeccion {
  seccion_id: number;
  zona_id: number;
  nombre: string;
  activa: boolean;
}

const INVENTORY_PATH = '/tenant-inventory';

const buildParams = (schema: string, filters: Record<string, unknown> = {}) => {
  if (!schema) {
    throw new Error('Schema es requerido');
  }
  const params: Record<string, unknown> = { schema };
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params[key] = value;
  });
  return params;
};

export const fetchTenantInventory = async (
  schema: string,
  filters: TenantInventoryFilters = {},
  pagination: TenantInventoryPagination = {}
): Promise<TenantInventoryListResponse> => {
  const params = buildParams(schema, {
    search: filters.search,
    estado: filters.estado,
    categoria: filters.categoria,
    activo: filters.activo,
    sedeId: filters.sede_id,
    zonaId: filters.zona_id,
    seccionId: filters.seccion_id,
    page: pagination.page,
    pageSize: pagination.pageSize
  });
  const response = await apiClient.get(INVENTORY_PATH, { params });
  return response.data;
};

export const createTenantInventoryItem = async (
  schema: string,
  payload: TenantInventoryPayload
): Promise<TenantInventoryItem> => {
  const response = await apiClient.post(INVENTORY_PATH, { schema, item: payload });
  return response.data;
};

export const updateTenantInventoryItem = async (
  schema: string,
  id: number,
  payload: Partial<TenantInventoryPayload>
): Promise<TenantInventoryItem> => {
  const response = await apiClient.put(`${INVENTORY_PATH}/${id}`, { schema, item: payload });
  return response.data;
};

export const validateTenantInventoryRfids = async (
  schema: string,
  rfids: string[],
  options: { sedeId?: number } = {}
): Promise<TenantInventoryRfidValidationResult> => {
  const response = await apiClient.post(`${INVENTORY_PATH}/validate`, {
    schema,
    rfids,
    sedeId: options.sedeId
  });
  return response.data;
};

export const bulkCreateTenantInventoryItems = async (
  schema: string,
  payload: Omit<TenantInventoryPayload, 'rfid'>,
  rfids: string[]
): Promise<TenantInventoryBulkCreateResult> => {
  const response = await apiClient.post(`${INVENTORY_PATH}/bulk`, {
    schema,
    item: payload,
    rfids
  });
  return response.data;
};

export const fetchTenantInventoryModels = async (
  schema: string
): Promise<TenantInventoryModelInfo[]> => {
  const params = buildParams(schema);
  const response = await apiClient.get(`${INVENTORY_PATH}/models`, { params });
  return response.data;
};

export const fetchTenantInventorySedes = async (
  schema: string
): Promise<TenantInventorySede[]> => {
  const params = buildParams(schema);
  const response = await apiClient.get(`${INVENTORY_PATH}/sedes`, { params });
  return response.data;
};

export const fetchTenantInventoryZonas = async (
  schema: string,
  sedeId?: number
): Promise<TenantInventoryZona[]> => {
  const params = buildParams(schema, { sedeId });
  const response = await apiClient.get(`${INVENTORY_PATH}/zonas`, { params });
  return response.data;
};

export const fetchTenantInventorySecciones = async (
  schema: string,
  zonaId?: number
): Promise<TenantInventorySeccion[]> => {
  const params = buildParams(schema, { zonaId });
  const response = await apiClient.get(`${INVENTORY_PATH}/secciones`, { params });
  return response.data;
};
