import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Edit3, Package, Plus, Power, RefreshCw, Search } from 'lucide-react';
import { Tenant, getTenants } from '../../models/TenantModel';
import { useTenantInventoryController } from '../../controllers/TenantInventoryController';
import { TenantInventoryItem, TenantInventoryPayload } from '../../models/TenantInventoryModel';
import { TenantInventoryForm } from './components/TenantInventoryForm';

export const TenantInventoryView: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activoFilter, setActivoFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingItem, setEditingItem] = useState<TenantInventoryItem | null>(null);

  const {
    items,
    filters,
    loading,
    saving,
    error,
    modelos,
    sedes,
    zonas,
    secciones,
    loadInventory,
    loadMetadata,
    loadZonas,
    loadSecciones,
    createItem,
    updateItem,
    toggleActive,
    resetState,
    page,
    pageSize,
    total,
    totalPages
  } = useTenantInventoryController();

  useEffect(() => {
    const fetchTenants = async () => {
      setTenantsLoading(true);
      setTenantsError(null);
      try {
        const data = await getTenants();
        const filtered = data
          .filter(tenant => tenant.esquema?.startsWith('tenant_') && tenant.esquema !== 'tenant_base')
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        setTenants(filtered);
        if (filtered.length && !selectedSchema) {
          setSelectedSchema(filtered[0].esquema);
        }
      } catch (err) {
        setTenantsError(err instanceof Error ? err.message : 'Error al cargar empresas');
      } finally {
        setTenantsLoading(false);
      }
    };

    fetchTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSchema) {
      resetState();
      return;
    }
    setSearchTerm('');
    setActivoFilter('all');

    const initialize = async () => {
      try {
        await loadMetadata(selectedSchema);
        await loadInventory(selectedSchema, { search: undefined, activo: undefined }, { pagination: { page: 1 } });
      } catch (err) {
        console.error('Error inicializando inventario de tenant:', err);
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchema]);

  const selectedTenant = useMemo(
    () => tenants.find(tenant => tenant.esquema === selectedSchema) || null,
    [tenants, selectedSchema]
  );

  const handleSearch = async () => {
    const value = searchTerm.trim();
    if (!selectedSchema) return;
    await loadInventory(selectedSchema, { search: value || undefined }, { pagination: { page: 1 } });
  };

  const handleClearSearch = async () => {
    setSearchTerm('');
    if (!selectedSchema) return;
    await loadInventory(selectedSchema, { search: undefined }, { pagination: { page: 1 } });
  };

  const handleActivoChange = async (value: 'all' | 'active' | 'inactive') => {
    setActivoFilter(value);
    if (!selectedSchema) return;
    const nextActivo = value === 'active' ? true : value === 'inactive' ? false : undefined;
    await loadInventory(selectedSchema, { activo: nextActivo }, { pagination: { page: 1 } });
  };

  const handleCreate = async (payload: TenantInventoryPayload) => {
    if (!selectedSchema) return;
    await createItem(selectedSchema, payload);
  };

  const handleUpdate = async (payload: TenantInventoryPayload) => {
    if (!selectedSchema || !editingItem) return;
    await updateItem(selectedSchema, editingItem.id, payload);
  };

  const handleToggleActive = async (item: TenantInventoryItem) => {
    if (!selectedSchema) return;
    const nextState = !item.activo;
    await toggleActive(selectedSchema, item.id, nextState);
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingItem(null);
  };

  const handleOpenEdit = async (item: TenantInventoryItem) => {
    setEditingItem(item);
    setFormMode('edit');
    if (item.sede_id) {
      await loadZonas(selectedSchema, item.sede_id);
    }
    if (item.zona_id) {
      await loadSecciones(selectedSchema, item.zona_id);
    }
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingItem(null);
  };

  const handleChangePage = async (nextPage: number) => {
    if (!selectedSchema) return;
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    await loadInventory(selectedSchema, undefined, { pagination: { page: nextPage }, keepPage: true });
  };

  const handlePageSizeChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedSchema) return;
    const nextSize = Number(event.target.value);
    if (Number.isNaN(nextSize) || nextSize === pageSize) return;
    await loadInventory(selectedSchema, undefined, { pagination: { page: 1, pageSize: nextSize } });
  };

  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = total === 0 ? 0 : Math.min(total, startIndex + items.length - 1);

  const renderStatusBadge = (activo: boolean) => (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {activo ? 'Habilitado' : 'Inhabilitado'}
    </span>
  );

  const renderLocation = (item: TenantInventoryItem) => {
    if (!item.sede_nombre) return '—';
    const parts = [item.sede_nombre];
    if (item.zona_nombre) parts.push(item.zona_nombre);
    if (item.seccion_nombre) parts.push(item.seccion_nombre);
    return parts.join(' / ');
  };

  const tenantOptions = tenantsLoading ? (
    <option>Cargando empresas...</option>
  ) : tenants.length === 0 ? (
    <option>No hay tenants disponibles</option>
  ) : (
    tenants.map(tenant => (
      <option key={tenant.id} value={tenant.esquema}>
        {tenant.nombre} ({tenant.esquema})
      </option>
    ))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <div>
              {total === 0
                ? 'Sin resultados'
                : `Mostrando ${startIndex} - ${endIndex} de ${total} registros`}
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span>Tamaño página:</span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {[10, 20, 50, 100].map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                  onClick={() => handleChangePage(page - 1)}
                  disabled={page <= 1 || loading || total === 0}
                >
                  Anterior
                </button>
                <span className="font-medium">Página {total === 0 ? 0 : page} de {total === 0 ? 0 : totalPages}</span>
                <button
                  type="button"
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                  onClick={() => handleChangePage(page + 1)}
                  disabled={page >= totalPages || loading || total === 0}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="text-blue-600" />
              Inventario por empresa
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Selecciona una empresa (schema) para administrar sus piezas.</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 w-full xl:w-auto">
            <select
              className="w-full sm:w-64 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={selectedSchema}
              onChange={(event) => setSelectedSchema(event.target.value)}
              disabled={tenantsLoading || tenants.length === 0}
            >
              {tenantOptions}
            </select>
            <button
              type="button"
              onClick={() => selectedSchema && loadInventory(selectedSchema, undefined, { pagination: { page }, keepPage: true })}
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              disabled={!selectedSchema || loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={!selectedSchema}
            >
              <Plus className="w-4 h-4 mr-2" />
              Registrar item
            </button>
          </div>
        </div>
      </div>

      {selectedTenant && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            <span className="font-medium">Empresa:</span>
            <span>{selectedTenant.nombre}</span>
          </div>
          <div>
            <span className="font-medium mr-1">Schema:</span>
            <span>{selectedTenant.esquema}</span>
          </div>
          <div>
            <span className="font-medium mr-1">Contacto:</span>
            <span>{selectedTenant.email_contacto}</span>
          </div>
          {selectedTenant.telefono_contacto && (
            <div>
              <span className="font-medium mr-1">Teléfono:</span>
              <span>{selectedTenant.telefono_contacto}</span>
            </div>
          )}
        </div>
      )}

      {(tenantsError || error) && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg">
          {tenantsError || error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <Search className="w-5 h-5" />
            <span className="font-medium">Filtros</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1">
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Buscar por RFID, nombre..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                  disabled={!selectedSchema}
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={!selectedSchema || loading}
              >
                Buscar
              </button>
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                disabled={!selectedSchema || (!filters.search && searchTerm === '')}
              >
                Limpiar
              </button>
            </div>
            <select
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={activoFilter}
              onChange={(event) => handleActivoChange(event.target.value as 'all' | 'active' | 'inactive')}
              disabled={!selectedSchema}
            >
              <option value="all">Todos</option>
              <option value="active">Solo habilitados</option>
              <option value="inactive">Solo inhabilitados</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">RFID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Modelo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Ubicación</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Actualización</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Cargando inventario...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                    No hay registros para mostrar. Ajusta los filtros o registra un nuevo item.
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{item.rfid}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">{item.modelo_nombre || '—'}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.volumen_litros ? `${item.volumen_litros} L` : 'Sin datos'} · {item.categoria || item.tipo_modelo || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex flex-col gap-1">
                        {renderStatusBadge(item.activo)}
                        <span className="text-xs text-gray-500 dark:text-gray-400">{item.estado || 'Sin estado'}{item.sub_estado ? ` / ${item.sub_estado}` : ''}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{renderLocation(item)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {item.ultima_actualizacion
                        ? new Date(item.ultima_actualizacion).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg ${item.activo ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                          onClick={() => handleToggleActive(item)}
                        >
                          <Power className="w-4 h-4 mr-1" />
                          {item.activo ? 'Inhabilitar' : 'Habilitar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <div>
              {total === 0
                ? 'Sin resultados'
                : `Mostrando ${startIndex} - ${endIndex} de ${total} registros`}
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span>Tamaño página:</span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {[10, 20, 50, 100].map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                  onClick={() => handleChangePage(page - 1)}
                  disabled={page <= 1 || loading || total === 0}
                >
                  Anterior
                </button>
                <span className="font-medium">Página {total === 0 ? 0 : page} de {total === 0 ? 0 : totalPages}</span>
                <button
                  type="button"
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                  onClick={() => handleChangePage(page + 1)}
                  disabled={page >= totalPages || loading || total === 0}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {formMode !== null && selectedSchema && (
        <TenantInventoryForm
          mode={formMode}
          saving={saving}
          modelos={modelos}
          sedes={sedes}
          zonas={zonas}
          secciones={secciones}
          item={formMode === 'edit' ? editingItem : null}
          onSubmit={formMode === 'create' ? handleCreate : handleUpdate}
          onClose={closeForm}
          onLoadZonas={(sedeId) => loadZonas(selectedSchema, sedeId).then(() => undefined)}
          onLoadSecciones={(zonaId) => loadSecciones(selectedSchema, zonaId).then(() => undefined)}
        />
      )}
    </div>
  );
};
