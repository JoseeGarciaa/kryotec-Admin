import { useCallback, useState } from 'react';
import axios from 'axios';
import {
  CentralInventoryFilters,
  CentralInventoryItem,
  CentralInventoryPagination,
  CentralInventoryListResponse,
  CreateCentralInventoryPayload,
  HistoryEntry,
  ReassignPayload,
  createCentralInventoryItem,
  fetchCentralInventory,
  fetchCentralInventoryHistory,
  unassignCentralInventoryItem,
  reassignCentralInventoryItem
} from '../models/CentralInventoryModel';
import { Credocube, CredocubeModel } from '../models/CredocubeModel';
import { Tenant, getTenants } from '../models/TenantModel';

const extractErrorMessage = (err: unknown) => {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string })?.error || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Error desconocido';
};

export const useCentralInventoryController = () => {
  const [items, setItems] = useState<CentralInventoryItem[]>([]);
  const [filters, setFilters] = useState<CentralInventoryFilters>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [modelos, setModelos] = useState<Credocube[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadMetadata = useCallback(async () => {
    setError(null);
    try {
      const [tenantList, modeloList] = await Promise.all([
        getTenants(),
        CredocubeModel.getAllCredocubes()
      ]);
      const orderedTenants = tenantList
        .filter(t => t.esquema?.startsWith('tenant_') || t.esquema === null)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      setTenants(orderedTenants);
      setModelos(modeloList);
    } catch (err) {
      setError(extractErrorMessage(err));
      throw err;
    }
  }, []);

  const resolvePagination = (pagination?: CentralInventoryPagination) => ({
    page: pagination?.page ?? page,
    pageSize: pagination?.pageSize ?? pageSize
  });

  const loadInventory = useCallback(async (
    overrideFilters?: Partial<CentralInventoryFilters>,
    options?: { pagination?: CentralInventoryPagination; keepPage?: boolean; replaceFilters?: boolean }
  ) => {
    setLoading(true);
    setError(null);
    try {
      let effectiveFilters = filters;
      let resetPage = false;

      if (overrideFilters) {
        const merged: CentralInventoryFilters = options?.replaceFilters ? {} : { ...filters };
        let modified = !!options?.replaceFilters;

        Object.entries(overrideFilters).forEach(([key, value]) => {
          const typedKey = key as keyof CentralInventoryFilters;
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
          if (!options?.keepPage) resetPage = true;
        }
      }

      const requestedPagination = {
        ...(options?.pagination || {}),
        ...(resetPage && !(options?.pagination && options.pagination.page !== undefined) ? { page: 1 } : {})
      };

      const pagination = resolvePagination(requestedPagination);

      const data: CentralInventoryListResponse = await fetchCentralInventory(effectiveFilters, pagination);
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

  const createItem = useCallback(async (payload: CreateCentralInventoryPayload) => {
    setSaving(true);
    setError(null);
    try {
      await createCentralInventoryItem(payload);
      await loadInventory(undefined, { pagination: { page: 1 }, keepPage: false });
    } catch (err) {
      setError(extractErrorMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [loadInventory]);

  const reassignItem = useCallback(async (rfid: string, payload: ReassignPayload) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await reassignCentralInventoryItem(rfid, payload);
      if (updated) {
        setItems(prev => prev.map(item => item.rfid === rfid ? updated : item));
      }
      await loadInventory(filters, { pagination: { page }, keepPage: true });
      return updated;
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [filters, loadInventory, page]);

  const unassignItem = useCallback(async (rfid: string) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await unassignCentralInventoryItem(rfid);
      if (updated) {
        setItems(prev => prev.map(item => item.rfid === rfid ? updated : item));
      }
      return updated;
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const loadHistory = useCallback(async (rfid: string, limit = 50) => {
    setHistoryLoading(true);
    setError(null);
    try {
      const data = await fetchCentralInventoryHistory(rfid, limit);
      setHistory(data);
      return data;
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const resetState = useCallback(() => {
    setItems([]);
    setFilters({});
    setError(null);
    setPage(1);
    setPageSize(20);
    setTotal(0);
    setTotalPages(1);
    setHistory([]);
  }, []);

  return {
    items,
    filters,
    loading,
    saving,
    error,
    tenants,
    modelos,
    page,
    pageSize,
    total,
    totalPages,
    history,
    historyLoading,
    loadMetadata,
    loadInventory,
    createItem,
    reassignItem,
    unassignItem,
    loadHistory,
    resetState,
    setFilters
  };
};
