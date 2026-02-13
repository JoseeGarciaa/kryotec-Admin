import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, Building2, Clock3, History, RefreshCw, Search } from 'lucide-react';
import { useCentralInventoryController } from '../../controllers/CentralInventoryController';
import { CentralInventoryFilters, CentralInventoryItem, CreateCentralInventoryPayload, fetchCentralInventory } from '../../models/CentralInventoryModel';
import { Tenant } from '../../models/TenantModel';

const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children?: React.ReactNode }> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white">×</button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

const TenantOption: React.FC<{ tenant: Tenant }> = ({ tenant }) => (
  <>{tenant.nombre} {tenant.esquema ? `(${tenant.esquema})` : ''}</>
);

export const CentralInventoryView: React.FC = () => {
  const {
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
    loadHistory
  } = useCentralInventoryController();

  const [search, setSearch] = useState('');
  const [asignadoId, setAsignadoId] = useState('');
  const [modeloId, setModeloId] = useState('');
  const [activo, setActivo] = useState<'all' | 'active' | 'inactive'>('all');
  const [rfidTokens, setRfidTokens] = useState<string[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [unassignConfirmOpen, setUnassignConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'admin'>('all');
  const [forceReassign, setForceReassign] = useState(false);

  const [selectedItem, setSelectedItem] = useState<CentralInventoryItem | null>(null);
  const [createPayload, setCreatePayload] = useState<CreateCentralInventoryPayload>({
    tenant_id: 0,
    asignado_tenant_id: null,
    modelo_id: 0,
    rfid: '',
    estado: 'disponible',
    es_alquiler: false,
    activo: true
  });
  const [reasignarTenantId, setReasignarTenantId] = useState('');
  const [reasignarCambiarDueno, setReasignarCambiarDueno] = useState(false);
  const [reasignarMotivo, setReasignarMotivo] = useState('');
  const [pendingUnassignRfid, setPendingUnassignRfid] = useState('');
  const [selectedRfids, setSelectedRfids] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<'none' | 'reassign' | 'admin'>('none');

  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = total === 0 ? 0 : Math.min(total, startIndex + items.length - 1);
  const activeItems = useMemo(() => items.filter((it: CentralInventoryItem) => it.activo), [items]);

  useEffect(() => {
    loadMetadata().then(() => loadInventory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpia selección si los items seleccionados ya no están activos en el listado
  useEffect(() => {
    setSelectedRfids(prev => {
      const next = new Set<string>();
      const activeSet = new Set(items.filter(it => it.activo).map(it => it.rfid));
      prev.forEach(rfid => { if (activeSet.has(rfid)) next.add(rfid); });
      return next;
    });
  }, [items]);

  // Cambiar pestaña (general vs admin pool)
  const handleTabChange = async (tab: 'all' | 'admin') => {
    setActiveTab(tab);
    setSearch('');
    setRfidTokens([]);
    setAsignadoId('');
    setModeloId('');
    setActivo('all');
    setSelectedRfids(new Set());
    setBulkMode('none');
    const baseFilters: Partial<CentralInventoryFilters> = tab === 'admin' ? { source: 'admin' } : {};
    await loadInventory(baseFilters, { pagination: { page: 1 }, replaceFilters: true });
  };

  const handleApplyFilters = async () => {
    const next: any = {};
    const cleanedSearch = search.trim();
    if (cleanedSearch) next.search = cleanedSearch;
    if (asignadoId) next.asignadoTenantId = Number(asignadoId);
    if (modeloId) next.modeloId = Number(modeloId);
    if (activo === 'active') next.activo = true;
    if (activo === 'inactive') next.activo = false;
    await loadInventory(next, { pagination: { page: 1 }, replaceFilters: true });
  };

  const handleClearFilters = async () => {
    setSearch('');
    setRfidTokens([]);
    setAsignadoId('');
    setModeloId('');
    setActivo('all');
    await loadInventory({}, { pagination: { page: 1 }, replaceFilters: true });
  };

  const checkRfidExists = async (rfid: string): Promise<boolean> => {
    try {
      const res = await fetchCentralInventory({ search: rfid }, { page: 1, pageSize: 1 });
      return res.total > 0;
    } catch (err) {
      console.error('Error validando RFID', rfid, err);
      return false;
    }
  };

  const handleSearchChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.toUpperCase();
    if (!raw) {
      setRfidTokens([]);
      setSearch('');
      return;
    }

    let buffer = raw.replace(/\s+/g, '');
    const nextTokens = [...rfidTokens];

    while (buffer.length >= 24) {
      const chunk = buffer.slice(0, 24);
      if (!nextTokens.includes(chunk)) {
        const exists = await checkRfidExists(chunk);
        if (exists) {
          nextTokens.push(chunk);
        }
      }
      buffer = buffer.slice(24);
    }

    const composed = [...nextTokens, buffer].filter(Boolean).join(' ');
    setRfidTokens(nextTokens);
    setSearch(composed);
  };

  const handleChangePage = async (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    await loadInventory(filters, { pagination: { page: nextPage }, keepPage: true });
  };

  const handlePageSizeChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextSize = Number(event.target.value);
    if (Number.isNaN(nextSize) || nextSize === pageSize) return;
    await loadInventory(filters, { pagination: { page: 1, pageSize: nextSize } });
  };

  const tenantOptions = useMemo(() => tenants.map(t => ({ value: String(t.id), label: t.nombre, tenant: t })), [tenants]);
  const modeloOptions = useMemo(() => modelos.map(m => ({ value: String(m.modelo_id), label: `${m.nombre_modelo}${m.volumen_litros ? ` • ${m.volumen_litros} L` : ''}` })), [modelos]);

  const openReassign = (item: CentralInventoryItem) => {
    setBulkMode('none');
    setSelectedItem(item);
    setReasignarTenantId('');
    setReasignarCambiarDueno(false);
    setReasignarMotivo('');
    setReassignOpen(true);
  };

  const openUnassign = (item: CentralInventoryItem) => {
    setBulkMode('none');
    setSelectedItem(item);
    setPendingUnassignRfid(item.rfid);
    setUnassignConfirmOpen(true);
  };

  const openHistory = async (item: CentralInventoryItem) => {
    setSelectedItem(item);
    setHistoryOpen(true);
    await loadHistory(item.rfid, 100);
  };

  const handleCreateItem = async () => {
    if (!createPayload.tenant_id || !createPayload.modelo_id || !createPayload.rfid) return;
    await createItem(createPayload);
    setCreateOpen(false);
  };

  const handleReassign = async () => {
    if (!selectedItem || !reasignarTenantId) return;
    try {
      await reassignItem(selectedItem.rfid, {
        tenantId: Number(reasignarTenantId),
        cambiarDueno: reasignarCambiarDueno,
        motivo: reasignarMotivo || undefined,
        force: forceReassign
      });
      setReassignOpen(false);
      setForceReassign(false);
    } catch (err: any) {
      const status = err?.response?.status;
      const conflictTenant = err?.response?.data?.conflictTenantNombre;
      if (status === 409 && conflictTenant) {
        const confirmForce = window.confirm(`La pieza está activa en ${conflictTenant}. ¿Quieres inactivarla allí y asignarla al nuevo tenant?`);
        if (confirmForce) {
          setForceReassign(true);
          await reassignItem(selectedItem.rfid, {
            tenantId: Number(reasignarTenantId),
            cambiarDueno: reasignarCambiarDueno,
            motivo: reasignarMotivo || undefined,
            force: true
          });
          setReassignOpen(false);
        }
      } else {
        throw err;
      }
    }
    await loadInventory(filters, { pagination: { page }, keepPage: true });
  };

  const handleBulkReassign = async () => {
    if (!reasignarTenantId || selectedRfids.size === 0) return;
    for (const rfid of Array.from(selectedRfids)) {
      try {
        await reassignItem(rfid, {
          tenantId: Number(reasignarTenantId),
          cambiarDueno: reasignarCambiarDueno,
          motivo: reasignarMotivo || undefined,
          force: forceReassign
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const conflictTenant = err?.response?.data?.conflictTenantNombre;
        if (status === 409 && conflictTenant) {
          const confirmForce = window.confirm(`La pieza ${rfid} está activa en ${conflictTenant}. ¿Inhabilitar allí y asignar al nuevo tenant?`);
          if (confirmForce) {
            await reassignItem(rfid, {
              tenantId: Number(reasignarTenantId),
              cambiarDueno: reasignarCambiarDueno,
              motivo: reasignarMotivo || undefined,
              force: true
            });
          }
        } else {
          console.error('Error reasignando', rfid, err);
        }
      }
    }
    setReassignOpen(false);
    setForceReassign(false);
    setSelectedRfids(new Set());
    setBulkMode('none');
    await loadInventory(filters, { pagination: { page }, keepPage: true });
  };

  const handleUnassign = async () => {
    if (!pendingUnassignRfid) return;
    await unassignItem(pendingUnassignRfid);
    setUnassignConfirmOpen(false);
    setPendingUnassignRfid('');
    setBulkMode('none');
    await loadInventory(filters, { pagination: { page }, keepPage: true });
  };

  const handleBulkUnassign = async () => {
    if (selectedRfids.size === 0) return;
    for (const rfid of Array.from(selectedRfids)) {
      try {
        await unassignItem(rfid);
      } catch (err) {
        console.error('Error al pasar a admin', rfid, err);
      }
    }
    setSelectedRfids(new Set());
    setBulkMode('none');
    await loadInventory(filters, { pagination: { page }, keepPage: true });
  };

  const renderBadge = (text: string, color: string) => (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{text}</span>
  );

  const renderSource = (item: CentralInventoryItem) => {
    const label = item.source === 'admin'
      ? 'Admin'
      : (item.tenant_nombre || item.tenant_schema_name || 'Tenant');
    return (
      <div className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
        {renderBadge(label, item.source === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700')}
        <span className="text-xs text-gray-500 dark:text-gray-400">RFID {item.rfid}</span>
      </div>
    );
  };

  const renderOwner = (item: CentralInventoryItem) => {
    const owner = item.source === 'admin'
      ? (item.asignado_tenant_nombre || 'Admin')
      : (item.tenant_nombre || item.tenant_schema_name || '—');
    return (
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-500" />
          <span className="font-medium">Dueño:</span>
          <span>{owner}</span>
        </div>
      </div>
    );
  };

  const renderModel = (item: CentralInventoryItem) => (
    <div className="text-sm text-gray-800 dark:text-gray-200">
      <div className="font-semibold">{item.nombre_unidad || item.modelo_nombre || 'Sin nombre'}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {item.volumen_litros ? `${item.volumen_litros} L` : '—'} · {item.categoria || item.tipo_modelo || '—'}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Boxes className="text-blue-600" /> Inventario central
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pool global con asignaciones y alquiler.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => loadInventory(filters, { pagination: { page }, keepPage: true })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex gap-3 mt-2">
        <button
          className={`px-3 py-2 rounded-lg text-sm font-semibold border ${activeTab === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700'}`}
          onClick={() => handleTabChange('all')}
        >Inventario global</button>
        <button
          className={`px-3 py-2 rounded-lg text-sm font-semibold border ${activeTab === 'admin' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700'}`}
          onClick={() => handleTabChange('admin')}
        >Inventario en admin</button>
      </div>

      {/* Acciones masivas */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="text-sm text-gray-700 dark:text-gray-300">Seleccionados: {selectedRfids.size}</div>
        <button
          type="button"
          disabled={selectedRfids.size === 0}
          onClick={() => { setBulkMode('reassign'); setSelectedItem(null); setReassignOpen(true); setReasignarTenantId(''); setReasignarCambiarDueno(false); setReasignarMotivo(''); setForceReassign(false); }}
          className={`px-3 py-2 rounded-lg text-white ${selectedRfids.size === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >{activeTab === 'admin' ? 'Asignar seleccionados' : 'Reasignar seleccionados'}</button>
        {activeTab !== 'admin' && (
          <button
            type="button"
            disabled={selectedRfids.size === 0}
            onClick={() => { setBulkMode('admin'); setUnassignConfirmOpen(true); setPendingUnassignRfid(''); }}
            className={`px-3 py-2 rounded-lg text-white ${selectedRfids.size === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'}`}
          >Pasar a admin seleccionados</button>
        )}
        <button
          type="button"
          onClick={() => setSelectedRfids(new Set())}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"
        >Limpiar selección</button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg">{error}</div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        {activeTab !== 'admin' && (
          <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <Search className="w-5 h-5" />
              <span className="font-medium">Filtros</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Buscar por RFID o nombre"
                value={search}
                onChange={handleSearchChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyFilters();
                  }
                }}
              />
              <select
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={asignadoId}
                onChange={(e) => setAsignadoId(e.target.value)}
              >
                <option value="">Asignado: todos</option>
                {tenantOptions.map(opt => (
                  <option key={`a-${opt.value}`} value={opt.value}><TenantOption tenant={opt.tenant} /></option>
                ))}
              </select>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={modeloId}
                onChange={(e) => setModeloId(e.target.value)}
              >
                <option value="">Modelo: todos</option>
                {modeloOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={activo}
                onChange={(e) => setActivo(e.target.value as 'all' | 'active' | 'inactive')}
              >
                <option value="all">Estado lógico</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >Aplicar</button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >Limpiar</button>
              <div className="flex items-center gap-2 ml-auto text-sm text-gray-600 dark:text-gray-300">
                <span>Tamaño página:</span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                >
                  {[10, 20, 50, 100].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={activeItems.length > 0 && selectedRfids.size === activeItems.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRfids(new Set(activeItems.map(it => it.rfid)));
                      } else {
                        setSelectedRfids(new Set());
                      }
                    }}
                    disabled={activeItems.length === 0}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Origen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Modelo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Dueño / Uso</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Actualización</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" /> Cargando inventario...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                    No hay registros para mostrar.
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={`${item.id}-${item.rfid}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <td className="px-4 py-3 align-top">
                      {item.activo ? (
                        <input
                          type="checkbox"
                          checked={selectedRfids.has(item.rfid)}
                          onChange={(e) => {
                            setSelectedRfids(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(item.rfid); else next.delete(item.rfid);
                              return next;
                            });
                          }}
                        />
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">{renderSource(item)}</td>
                    <td className="px-4 py-3 align-top">{renderModel(item)}</td>
                    <td className="px-4 py-3 align-top">{renderOwner(item)}</td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex flex-col gap-1">
                        {renderBadge(item.activo ? 'Activo' : 'Inactivo', item.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}
                        <span className="text-xs text-gray-500 dark:text-gray-400">{item.estado || 'Sin estado'}{item.sub_estado ? ` / ${item.sub_estado}` : ''}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{item.es_alquiler ? 'Alquiler' : 'Propio'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><Clock3 className="w-4 h-4" /> {formatDateTime(item.ultima_actualizacion)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-right text-gray-600 dark:text-gray-300">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {!item.activo ? (
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                            onClick={() => openHistory(item)}
                          >
                            <History className="w-4 h-4 inline mr-1" /> Historial
                          </button>
                        ) : activeTab === 'admin' ? (
                          <>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200"
                              onClick={() => openReassign(item)}
                            >Asignar</button>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                              onClick={() => openHistory(item)}
                            >
                              <History className="w-4 h-4 inline mr-1" /> Historial
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200"
                              onClick={() => openReassign(item)}
                            >Reasignar</button>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-200"
                              onClick={() => openUnassign(item)}
                            >Pasar a admin</button>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                              onClick={() => openHistory(item)}
                            >
                              <History className="w-4 h-4 inline mr-1" /> Historial
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-gray-600 dark:text-gray-300">
          <div>{total === 0 ? 'Sin resultados' : `Mostrando ${startIndex} - ${endIndex} de ${total} registros`}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleChangePage(page - 1)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              disabled={page <= 1 || loading || total === 0}
            >Anterior</button>
            <span className="font-medium">Página {total === 0 ? 0 : page} de {total === 0 ? 0 : totalPages}</span>
            <button
              type="button"
              onClick={() => handleChangePage(page + 1)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              disabled={page >= totalPages || loading || total === 0}
            >Siguiente</button>
          </div>
        </div>
      </div>

      {/* Modal crear */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo inventario central">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-gray-700 dark:text-gray-300">Dueño (tenant)
            <select
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
              value={createPayload.tenant_id || ''}
              onChange={(e) => setCreatePayload(prev => ({ ...prev, tenant_id: Number(e.target.value), asignado_tenant_id: Number(e.target.value) }))}
            >
              <option value="">Selecciona</option>
              {tenantOptions.map(opt => (
                <option key={`c-${opt.value}`} value={opt.value}><TenantOption tenant={opt.tenant} /></option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">Asignado inicialmente
            <select
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
              value={createPayload.asignado_tenant_id ?? ''}
              onChange={(e) => setCreatePayload(prev => ({ ...prev, asignado_tenant_id: e.target.value ? Number(e.target.value) : null }))}
            >
              <option value="">Mismo dueño</option>
              {tenantOptions.map(opt => (
                <option key={`ca-${opt.value}`} value={opt.value}><TenantOption tenant={opt.tenant} /></option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">Modelo
            <select
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
              value={createPayload.modelo_id || ''}
              onChange={(e) => setCreatePayload(prev => ({ ...prev, modelo_id: Number(e.target.value) }))}
            >
              <option value="">Selecciona</option>
              {modeloOptions.map(opt => (
                <option key={`m-${opt.value}`} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">RFID (24 caracteres)
            <input
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
              value={createPayload.rfid}
              onChange={(e) => setCreatePayload(prev => ({ ...prev, rfid: e.target.value.toUpperCase().trim() }))}
              maxLength={24}
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">Nombre / Unidad
            <input
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
              value={createPayload.nombre_unidad || ''}
              onChange={(e) => setCreatePayload(prev => ({ ...prev, nombre_unidad: e.target.value }))}
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">Estado
            <input
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
              value={createPayload.estado || ''}
              onChange={(e) => setCreatePayload(prev => ({ ...prev, estado: e.target.value }))}
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">Categoría
            <input
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
              value={createPayload.categoria || ''}
              onChange={(e) => setCreatePayload(prev => ({ ...prev, categoria: e.target.value }))}
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">Lote
            <input
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
              value={createPayload.lote || ''}
              onChange={(e) => setCreatePayload(prev => ({ ...prev, lote: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={createPayload.es_alquiler || false}
              onChange={(e) => setCreatePayload(prev => ({ ...prev, es_alquiler: e.target.checked }))}
            />
            Es alquiler
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={createPayload.activo !== false}
              onChange={(e) => setCreatePayload(prev => ({ ...prev, activo: e.target.checked }))}
            />
            Activo
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setCreateOpen(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          >Cancelar</button>
          <button
            type="button"
            onClick={handleCreateItem}
            disabled={saving || !createPayload.tenant_id || !createPayload.modelo_id || createPayload.rfid.length !== 24}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >Crear</button>
        </div>
      </Modal>

      {/* Modal reasignar / asignar */}
      <Modal
        open={reassignOpen}
        onClose={() => { setReassignOpen(false); setBulkMode('none'); setForceReassign(false); }}
        title={`${activeTab === 'admin' ? 'Asignar' : 'Reasignar'} ${selectedItem?.rfid || (bulkMode === 'reassign' ? `${selectedRfids.size} seleccionados` : '')}`}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">Selecciona el tenant destino y si cambia la propiedad.</p>
          <select
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
            value={reasignarTenantId}
            onChange={(e) => setReasignarTenantId(e.target.value)}
          >
            <option value="">Selecciona destino</option>
            {tenantOptions.map(opt => (
              <option key={`r-${opt.value}`} value={opt.value}><TenantOption tenant={opt.tenant} /></option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={reasignarCambiarDueno} onChange={(e) => setReasignarCambiarDueno(e.target.checked)} />
            Transferir propiedad
          </label>
          <textarea
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
            placeholder="Motivo (opcional)"
            value={reasignarMotivo}
            onChange={(e) => setReasignarMotivo(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => { setReassignOpen(false); setBulkMode('none'); setForceReassign(false); }}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          >Cancelar</button>
          <button
            type="button"
            onClick={bulkMode === 'reassign' ? handleBulkReassign : handleReassign}
            disabled={saving || !reasignarTenantId}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >{bulkMode === 'reassign'
            ? `${activeTab === 'admin' ? 'Asignar' : 'Reasignar'} seleccionados`
            : (activeTab === 'admin' ? 'Asignar' : 'Reasignar')}
          </button>
        </div>
      </Modal>

      {/* Modal historial */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={`Historial ${selectedItem?.rfid || ''}`}>
        {historyLoading ? (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><RefreshCw className="w-4 h-4 animate-spin" />Cargando...</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Sin movimientos registrados.</div>
        ) : (
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
            {history.map(entry => (
              <div key={entry.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/60">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{entry.from_tenant_nombre || '—'} → {entry.to_tenant_nombre || '—'}</div>
                  <div className="text-xs text-gray-500">{formatDateTime(entry.changed_at)}</div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                  <History className="w-4 h-4" /> {entry.cambiar_dueno ? 'Transferencia de propiedad' : 'Reasignación'}
                </div>
                {entry.motivo && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Motivo: {entry.motivo}</div>
                )}
                {entry.changed_by_correo && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Por: {entry.changed_by_correo}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal retirar a pool */}
      <Modal open={unassignConfirmOpen} onClose={() => { setUnassignConfirmOpen(false); setBulkMode('none'); }} title="Retirar a pool">
        <p className="text-sm text-gray-700 dark:text-gray-300">El item quedará sin asignar en el inventario central.</p>
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => { setUnassignConfirmOpen(false); setBulkMode('none'); }}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          >Cancelar</button>
          <button
            type="button"
            onClick={bulkMode === 'admin' ? handleBulkUnassign : handleUnassign}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50"
          >Retirar</button>
        </div>
      </Modal>
    </div>
  );
};
