import { apiClient } from '../services/api';

export interface CentralInventoryItem {
  id: number;
  rfid: string;
  modelo_id: number;
  nombre_unidad: string | null;
  tenant_schema_name: string | null;
  lote: string | null;
  estado: string | null;
  sub_estado: string | null;
  categoria: string | null;
  activo: boolean;
  fecha_ingreso: string | null;
  ultima_actualizacion: string | null;
  fecha_vencimiento: string | null;
  source: 'admin' | 'tenant';
  tenant_id: number | null;
  asignado_tenant_id: number | null;
  es_alquiler: boolean;
  fecha_asignacion: string | null;
  modelo_nombre?: string | null;
  volumen_litros?: number | null;
  tipo_modelo?: string | null;
  tenant_nombre?: string | null;
  asignado_tenant_nombre?: string | null;
}

export interface CentralInventoryFilters {
  search?: string;
  source?: 'admin' | 'tenant';
  tenantId?: number;
  asignadoTenantId?: number;
  modeloId?: number;
  estado?: string;
  categoria?: string;
  es_alquiler?: boolean;
  activo?: boolean;
  rfid?: string;
}

export interface CentralInventoryListResponse {
  items: CentralInventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CentralInventoryPagination {
  page?: number;
  pageSize?: number;
}

export interface CreateCentralInventoryPayload {
  tenant_id: number;
  asignado_tenant_id?: number | null;
  modelo_id: number;
  rfid: string;
  nombre_unidad?: string | null;
  lote?: string | null;
  estado?: string | null;
  sub_estado?: string | null;
  categoria?: string | null;
  activo?: boolean;
  es_alquiler?: boolean;
}

export interface ReassignPayload {
  tenantId: number;
  cambiarDueno?: boolean;
  motivo?: string;
  force?: boolean;
}

export interface HistoryEntry {
  id: number;
  rfid: string;
  source: string;
  from_tenant_id: number | null;
  to_tenant_id: number | null;
  changed_by_admin_user_id: number | null;
  changed_at: string;
  motivo: string | null;
  cambiar_dueno: boolean;
  from_tenant_nombre?: string | null;
  to_tenant_nombre?: string | null;
  changed_by_correo?: string | null;
}

const INVENTORY_PATH = '/inventario-central';

const buildParams = (filters: Record<string, unknown> = {}) => {
  const params: Record<string, unknown> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = value;
  });
  return params;
};

export const fetchCentralInventory = async (
  filters: CentralInventoryFilters = {},
  pagination: CentralInventoryPagination = {}
): Promise<CentralInventoryListResponse> => {
  const params = buildParams({
    ...filters,
    page: pagination.page,
    pageSize: pagination.pageSize
  });
  const response = await apiClient.get(INVENTORY_PATH, { params });
  return response.data;
};

export const createCentralInventoryItem = async (
  payload: CreateCentralInventoryPayload
): Promise<CentralInventoryItem> => {
  const response = await apiClient.post(INVENTORY_PATH, payload);
  return response.data;
};

export const reassignCentralInventoryItem = async (
  rfid: string,
  payload: ReassignPayload
): Promise<CentralInventoryItem | null> => {
  const response = await apiClient.post(`${INVENTORY_PATH}/${rfid}/reasignar`, payload);
  return response.data;
};

export const unassignCentralInventoryItem = async (
  rfid: string
): Promise<CentralInventoryItem | null> => {
  const response = await apiClient.post(`${INVENTORY_PATH}/${rfid}/desasignar`);
  return response.data;
};

export const fetchCentralInventoryHistory = async (
  rfid: string,
  limit = 50
): Promise<HistoryEntry[]> => {
  const response = await apiClient.get(`${INVENTORY_PATH}/${rfid}/historial`, { params: { limit } });
  return response.data;
};
