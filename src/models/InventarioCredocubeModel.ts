import { apiClient } from '../services/api';
import { CentralInventoryItem, CentralInventoryListResponse } from './CentralInventoryModel';

export type InventarioCredocube = CentralInventoryItem;

const INVENTORY_PATH = '/inventario-central';
const PAGE_SIZE = 200;

const fetchPage = async (page: number): Promise<CentralInventoryListResponse> => {
  const response = await apiClient.get(INVENTORY_PATH, {
    params: { page, pageSize: PAGE_SIZE }
  });
  return response.data;
};

// Cargar todo el inventario central (admin + tenants), paginando hasta el final
export const getInventarioCredocubes = async (): Promise<InventarioCredocube[]> => {
  let page = 1;
  const items: InventarioCredocube[] = [];
  let totalPages = 1;

  do {
    const data = await fetchPage(page);
    items.push(...data.items);
    totalPages = data.totalPages;
    page += 1;
  } while (page <= totalPages);

  return items;
};

// Compatibilidad: solo vuelve a obtener los datos; no hay endpoint de "refresh"
export const refreshInventarioCredocubes = async (): Promise<{ success: boolean; message: string }> => {
  await getInventarioCredocubes();
  return { success: true, message: 'Inventario actualizado' };
};
