import { useCallback, useState } from 'react';
import axios from 'axios';
import {
  TenantInventoryFilters,
  TenantInventoryItem,
  TenantInventoryModelInfo,
  TenantInventoryPagination,
  TenantInventoryPayload,
  TenantInventorySede,
  TenantInventorySeccion,
  TenantInventoryListResponse,
  TenantInventoryZona,
  createTenantInventoryItem,
  fetchTenantInventory,
  fetchTenantInventoryModels,
  fetchTenantInventorySecciones,
  fetchTenantInventorySedes,
  fetchTenantInventoryZonas,
  updateTenantInventoryItem
} from '../models/TenantInventoryModel';

const extractErrorMessage = (err: unknown) => {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string })?.error || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Error desconocido';
};

export const useTenantInventoryController = () => {
  const [items, setItems] = useState<TenantInventoryItem[]>([]);
  const [filters, setFilters] = useState<TenantInventoryFilters>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelos, setModelos] = useState<TenantInventoryModelInfo[]>([]);
  const [sedes, setSedes] = useState<TenantInventorySede[]>([]);
  const [zonas, setZonas] = useState<TenantInventoryZona[]>([]);
  const [secciones, setSecciones] = useState<TenantInventorySeccion[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const resolvePagination = (pagination?: TenantInventoryPagination) => ({
    page: pagination?.page ?? page,
    pageSize: pagination?.pageSize ?? pageSize
  });

  const loadInventory = useCallback(async (
    schema: string,
    overrideFilters?: Partial<TenantInventoryFilters>,
    options?: { pagination?: TenantInventoryPagination; keepPage?: boolean }
  ) => {
    setLoading(true);
    setError(null);
    try {
      let effectiveFilters = filters;
      let resetPage = false;
      if (overrideFilters) {
        const merged: TenantInventoryFilters = { ...filters };
        let modified = false;

        Object.entries(overrideFilters).forEach(([key, value]) => {
          const typedKey = key as keyof TenantInventoryFilters;
          const shouldRemove = value === undefined || value === null || value === '';
          if (shouldRemove) {
            if (typedKey in merged) {
              delete merged[typedKey];
              modified = true;
            }
          } else if (merged[typedKey] !== value) {
            merged[typedKey] = value as never;
            modified = true;
          }
        });

        if (modified) {
          setFilters(merged);
          effectiveFilters = merged;
          if (!options?.keepPage) {
            resetPage = true;
          }
        }
      }

      const requestedPagination = {
        ...(options?.pagination || {}),
        ...(resetPage && !(options?.pagination && options.pagination.page !== undefined) ? { page: 1 } : {})
      };

      const pagination = resolvePagination(requestedPagination);

      const data: TenantInventoryListResponse = await fetchTenantInventory(schema, effectiveFilters, pagination);
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setPageSize(data.pageSize);
      setTotalPages(data.totalPages);
      return data.items;
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  const loadMetadata = useCallback(async (schema: string) => {
    setError(null);
    try {
      const [modelList, sedeList] = await Promise.all([
        fetchTenantInventoryModels(schema),
        fetchTenantInventorySedes(schema)
      ]);
      setModelos(modelList);
      setSedes(sedeList);
      setZonas([]);
      setSecciones([]);
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  const loadZonas = useCallback(async (schema: string, sedeId?: number) => {
    setError(null);
    try {
      const data = await fetchTenantInventoryZonas(schema, sedeId);
      setZonas(data);
      setSecciones([]);
      return data;
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  const loadSecciones = useCallback(async (schema: string, zonaId?: number) => {
    setError(null);
    try {
      const data = await fetchTenantInventorySecciones(schema, zonaId);
      setSecciones(data);
      return data;
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  const refreshInventory = useCallback(async (schema: string) => {
    await loadInventory(schema, undefined, { pagination: { page }, keepPage: true });
  }, [loadInventory, page]);

  const createItem = useCallback(async (schema: string, payload: TenantInventoryPayload) => {
    setSaving(true);
    setError(null);
    try {
      await createTenantInventoryItem(schema, payload);
      await loadInventory(schema, undefined, { pagination: { page: 1 }, keepPage: false });
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [loadInventory]);

  const updateItem = useCallback(async (schema: string, id: number, payload: Partial<TenantInventoryPayload>) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateTenantInventoryItem(schema, id, payload);
      setItems(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      return updated;
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const toggleActive = useCallback(async (schema: string, id: number, activo: boolean) => {
    await updateItem(schema, id, { activo });
  }, [updateItem]);

  const resetState = useCallback(() => {
    setItems([]);
    setFilters({});
    setError(null);
    setModelos([]);
    setSedes([]);
    setZonas([]);
    setSecciones([]);
    setPage(1);
    setPageSize(20);
    setTotal(0);
    setTotalPages(1);
  }, []);

  return {
    items,
    filters,
    setFilters,
    loading,
    saving,
    error,
    modelos,
    sedes,
    zonas,
    secciones,
    page,
    pageSize,
    total,
    totalPages,
    loadInventory,
    refreshInventory,
    loadMetadata,
    loadZonas,
    loadSecciones,
    createItem,
    updateItem,
    toggleActive,
    resetState
  };
};
