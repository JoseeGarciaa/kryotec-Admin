import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Info, Scan, Trash2, X, XCircle } from 'lucide-react';
import { Tenant, getTenants } from '../../models/TenantModel';
import {
  TenantInventoryModelInfo,
  TenantInventorySede,
  TenantInventorySeccion,
  TenantInventoryZona,
  TenantInventoryRfidStatus,
  bulkCreateTenantInventoryItems,
  fetchTenantInventoryModels,
  fetchTenantInventorySedes,
  fetchTenantInventorySecciones,
  fetchTenantInventoryZonas,
  validateTenantInventoryRfids
} from '../../models/TenantInventoryModel';

interface ScannedEntry {
  value: string;
  status: TenantInventoryRfidStatus;
  message?: string;
}

const statusStyles: Record<
  TenantInventoryRfidStatus,
  { chip: string; badge: string; label: string }
> = {
  accepted: {
    chip: 'border-green-300 bg-green-50 text-green-800 dark:border-green-600 dark:bg-green-900/40 dark:text-green-300',
    badge: 'text-green-500',
    label: 'ok'
  },
  duplicate_input: {
    chip: 'border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-200',
    badge: 'text-yellow-500',
    label: 'duplicado'
  },
  duplicate_existing: {
    chip: 'border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-200',
    badge: 'text-yellow-500',
    label: 'registrado'
  },
  conflict_other_sede: {
    chip: 'border-red-300 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-900/40 dark:text-red-300',
    badge: 'text-red-500',
    label: 'otra sede'
  },
  conflict_other_tenant: {
    chip: 'border-red-300 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-900/40 dark:text-red-300',
    badge: 'text-red-500',
    label: 'otro tenant'
  },
  already_exists: {
    chip: 'border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-200',
    badge: 'text-yellow-500',
    label: 'duplicado'
  },
  invalid_format: {
    chip: 'border-red-300 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-900/40 dark:text-red-300',
    badge: 'text-red-500',
    label: 'inválido'
  }
};

export const TenantInventoryRegisterView: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<string>('');

  const [models, setModels] = useState<TenantInventoryModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  const [sedes, setSedes] = useState<TenantInventorySede[]>([]);
  const [zonas, setZonas] = useState<TenantInventoryZona[]>([]);
  const [secciones, setSecciones] = useState<TenantInventorySeccion[]>([]);
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [selectedZona, setSelectedZona] = useState<string>('');
  const [selectedSeccion, setSelectedSeccion] = useState<string>('');

  const [scanInput, setScanInput] = useState('');
  const [scanned, setScanned] = useState<ScannedEntry[]>([]);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllTenants = async () => {
      setTenantsLoading(true);
      setTenantsError(null);
      try {
        const data = await getTenants();
        const filtered = data
          .filter(tenant => tenant.esquema?.startsWith('tenant_') && tenant.esquema !== 'tenant_base')
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        setTenants(filtered);
        if (filtered.length) {
          setSelectedSchema(filtered[0].esquema);
        }
      } catch (err) {
        setTenantsError(err instanceof Error ? err.message : 'Error al cargar empresas');
      } finally {
        setTenantsLoading(false);
      }
    };

    fetchAllTenants();
  }, []);

  const modelTypes = useMemo(() => {
    const grouped = new Map<string, TenantInventoryModelInfo[]>();
    models.forEach(model => {
      const type = model.tipo || 'Sin tipo';
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(model);
    });
    return Array.from(grouped.entries())
      .map(([type, list]) => ({ type, list: list.sort((a, b) => a.nombre_modelo.localeCompare(b.nombre_modelo)) }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [models]);

  const selectedTypeModels = useMemo(() => {
    if (!selectedType) return [];
    const entry = modelTypes.find(item => item.type === selectedType);
    return entry ? entry.list : [];
  }, [modelTypes, selectedType]);

  useEffect(() => {
    if (!selectedSchema) {
      setModels([]);
      setSelectedType('');
      setSelectedModelId('');
      setSedes([]);
      setZonas([]);
      setSecciones([]);
      setScanned([]);
      return;
    }

    const loadMetadata = async () => {
      setModelsLoading(true);
      setModelsError(null);
      setScanned([]);
      setSelectedType('');
      setSelectedModelId('');
      setSuccessMessage(null);
      setErrorMessage(null);
      try {
        const [modelList, sedeList] = await Promise.all([
          fetchTenantInventoryModels(selectedSchema),
          fetchTenantInventorySedes(selectedSchema)
        ]);
        setModels(modelList);
        setSedes(sedeList);
        setZonas([]);
        setSecciones([]);
        if (modelList.length) {
          const firstType = modelList[0].tipo || 'Sin tipo';
          setSelectedType(firstType);
          const firstModel = modelList.find(model => (model.tipo || 'Sin tipo') === firstType);
          if (firstModel) {
            setSelectedModelId(String(firstModel.modelo_id));
          }
        }
      } catch (err) {
        setModelsError(err instanceof Error ? err.message : 'Error al cargar metadatos del tenant');
      } finally {
        setModelsLoading(false);
      }
    };

    loadMetadata();
  }, [selectedSchema]);

  useEffect(() => {
    if (!selectedSchema || !selectedSede) {
      setZonas([]);
      setSelectedZona('');
      setSecciones([]);
      setSelectedSeccion('');
      return;
    }

    const loadZonas = async () => {
      try {
        const data = await fetchTenantInventoryZonas(selectedSchema, Number(selectedSede));
        setZonas(data);
        setSelectedZona('');
        setSecciones([]);
        setSelectedSeccion('');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Error al cargar zonas');
      }
    };

    loadZonas();
  }, [selectedSchema, selectedSede]);

  useEffect(() => {
    if (!selectedSchema || !selectedZona) {
      setSecciones([]);
      setSelectedSeccion('');
      return;
    }

    const loadSecciones = async () => {
      try {
        const data = await fetchTenantInventorySecciones(selectedSchema, Number(selectedZona));
        setSecciones(data);
        setSelectedSeccion('');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Error al cargar secciones');
      }
    };

    loadSecciones();
  }, [selectedSchema, selectedZona]);

  const selectedTenant = useMemo(
    () => tenants.find(tenant => tenant.esquema === selectedSchema) || null,
    [tenants, selectedSchema]
  );

  const acceptedCount = useMemo(
    () => scanned.filter(entry => entry.status === 'accepted').length,
    [scanned]
  );

  const handleScanChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.toUpperCase().replace(/\s+/g, '');
    if (raw.length < 24) {
      setScanInput(raw);
      return;
    }

    let buffer = raw;
    setScanInput('');
    while (buffer.length >= 24) {
      const chunk = buffer.slice(0, 24);
      buffer = buffer.slice(24);
      await processScan(chunk);
    }
    if (buffer.length > 0) {
      setScanInput(buffer);
    }
  };

  const processScan = async (raw: string) => {
    const rfid = raw.slice(0, 24).toUpperCase();
    if (!selectedSchema || !selectedModelId) {
      setErrorMessage('Selecciona empresa, tipo y modelo antes de escanear.');
      return;
    }

    const alreadyScanned = scanned.find(entry => entry.value === rfid);
    if (alreadyScanned) {
      return;
    }

    setSuccessMessage(null);
    setErrorMessage(null);

    setValidating(true);
    try {
      const result = await validateTenantInventoryRfids(
        selectedSchema,
        [rfid],
        selectedSede ? { sedeId: Number(selectedSede) } : {}
      );
      const entry = result.results[0];
      const status = (entry?.status as TenantInventoryRfidStatus) || 'invalid_format';
      setScanned(prev => [
        ...prev,
        {
          value: entry?.normalized || rfid,
          status,
          message: entry?.message
        }
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al validar RFID';
      setErrorMessage(message);
      setScanned(prev => [...prev, { value: rfid, status: 'invalid_format', message }]);
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveEntry = (value: string) => {
    setScanned(prev => prev.filter(entry => entry.value !== value));
  };

  const handleClear = () => {
    setScanned([]);
    setScanInput('');
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleRegister = async () => {
    if (!selectedSchema || !selectedModelId) {
      setErrorMessage('Selecciona empresa y modelo antes de registrar.');
      return;
    }

    const acceptedRfids = scanned.filter(entry => entry.status === 'accepted').map(entry => entry.value);
    if (acceptedRfids.length === 0) {
      setErrorMessage('Agrega al menos un RFID válido antes de registrar.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const payload = {
        modelo_id: Number(selectedModelId),
        estado: 'En Bodega',
        sede_id: selectedSede ? Number(selectedSede) : null,
        zona_id: selectedZona ? Number(selectedZona) : null,
        seccion_id: selectedSeccion ? Number(selectedSeccion) : null
      } as const;

      const result = await bulkCreateTenantInventoryItems(selectedSchema, payload, acceptedRfids);

      const createdSet = new Set(result.created.map(item => item.rfid));
      const failuresMap = new Map(result.failures.map(failure => [failure.rfid, failure.error]));

      setScanned(prev => prev
        .filter(entry => !createdSet.has(entry.value))
        .map(entry => {
          if (failuresMap.has(entry.value) && entry.status === 'accepted') {
            const message = failuresMap.get(entry.value) || 'Error al registrar RFID';
            return {
              value: entry.value,
              status: 'already_exists' as TenantInventoryRfidStatus,
              message
            };
          }
          return entry;
        })
      );

      const createdCount = result.created.length;
      const failureCount = result.failures.length;

      if (createdCount > 0) {
        setSuccessMessage(`Se registraron ${createdCount} item(s) correctamente.`);
      }
      if (failureCount > 0) {
        setErrorMessage(`No se pudieron registrar ${failureCount} item(s). Revisa los detalles en la lista.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrar items';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Scan className="text-blue-600" />
            Registro masivo de items
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Escanea RFIDs para cargarlos al inventario del tenant con validación inmediata.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 w-full xl:w-auto">
          <select
            className="w-full sm:w-64 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={selectedSchema}
            onChange={(event) => setSelectedSchema(event.target.value)}
            disabled={tenantsLoading || tenants.length === 0}
          >
            {tenantsLoading && <option>Cargando empresas...</option>}
            {!tenantsLoading && tenants.length === 0 && <option>No hay tenants disponibles</option>}
            {!tenantsLoading && tenants.map(tenant => (
              <option key={tenant.id} value={tenant.esquema}>
                {tenant.nombre} ({tenant.esquema})
              </option>
            ))}
          </select>
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
          {selectedTenant.email_contacto && (
            <div>
              <span className="font-medium mr-1">Contacto:</span>
              <span>{selectedTenant.email_contacto}</span>
            </div>
          )}
        </div>
      )}

      {(tenantsError || modelsError || errorMessage) && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg flex items-start gap-2">
          <XCircle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-medium">{errorMessage || tenantsError || modelsError}</p>
            <p className="text-xs text-red-600">Corrige y vuelve a intentar.</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-2 rounded-lg flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. Selecciona el modelo</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                El input de escaneo se habilita cuando hay un modelo seleccionado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  value={selectedType}
                  onChange={(event) => {
                    setSelectedType(event.target.value);
                    const firstModel = models.find(model => (model.tipo || 'Sin tipo') === event.target.value);
                    setSelectedModelId(firstModel ? String(firstModel.modelo_id) : '');
                  }}
                  disabled={modelsLoading || models.length === 0}
                >
                  {modelTypes.length === 0 && <option value="">Sin modelos disponibles</option>}
                  {modelTypes.map(item => (
                    <option key={item.type} value={item.type}>{item.type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Litraje / Modelo</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  value={selectedModelId}
                  onChange={(event) => setSelectedModelId(event.target.value)}
                  disabled={selectedTypeModels.length === 0}
                >
                  {selectedTypeModels.length === 0 && <option value="">Selecciona tipo primero</option>}
                  {selectedTypeModels.map(model => (
                    <option key={model.modelo_id} value={model.modelo_id}>
                      {model.nombre_modelo}{model.volumen_litros ? ` · ${model.volumen_litros} L` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sede (opcional)</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  value={selectedSede}
                  onChange={(event) => setSelectedSede(event.target.value)}
                  disabled={sedes.length === 0}
                >
                  <option value="">Sin sede</option>
                  {sedes.map(sede => (
                    <option key={sede.sede_id} value={sede.sede_id}>{sede.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zona</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  value={selectedZona}
                  onChange={(event) => setSelectedZona(event.target.value)}
                  disabled={zonas.length === 0}
                >
                  <option value="">Sin zona</option>
                  {zonas.map(zona => (
                    <option key={zona.zona_id} value={zona.zona_id}>{zona.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sección</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  value={selectedSeccion}
                  onChange={(event) => setSelectedSeccion(event.target.value)}
                  disabled={secciones.length === 0}
                >
                  <option value="">Sin sección</option>
                  {secciones.map(seccion => (
                    <option key={seccion.seccion_id} value={seccion.seccion_id}>{seccion.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Escanea RFIDs</h2>
              {validating && <span className="text-xs text-blue-500">Validando...</span>}
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <input
                type="text"
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={selectedModelId ? 'Listo para escanear...' : 'Selecciona un modelo para habilitar el escaneo'}
                value={scanInput}
                onChange={handleScanChange}
                disabled={!selectedModelId || modelsLoading}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Escaneados: <strong>{scanned.length}</strong></span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
                  onClick={handleClear}
                  disabled={scanned.length === 0}
                >
                  <Trash2 className="w-4 h-4" />
                  Limpiar
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {scanned.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Escanea un RFID para verlo aquí.</p>
              )}
              {scanned.map(entry => {
                const styles = statusStyles[entry.status] || statusStyles.accepted;
                return (
                  <div
                    key={entry.value}
                    className={`flex flex-col items-start gap-1 px-3 py-2 border rounded-lg text-sm ${styles.chip}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono tracking-wide text-xs sm:text-sm">{entry.value}</span>
                      <button
                        type="button"
                        className="text-xs opacity-60 hover:opacity-100"
                        onClick={() => handleRemoveEntry(entry.value)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <span className={`text-xs font-medium uppercase ${styles.badge}`}>{styles.label}</span>
                    {entry.message && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 max-w-[16rem] break-words">{entry.message}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 space-y-4">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Info className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold">Resumen</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>Modelo seleccionado: <strong>{selectedModelId ? selectedTypeModels.find(model => String(model.modelo_id) === selectedModelId)?.nombre_modelo || '—' : '—'}</strong></li>
              <li>RFIDs válidos listos: <strong>{acceptedCount}</strong></li>
              <li>Total escaneados: <strong>{scanned.length}</strong></li>
            </ul>
            <button
              type="button"
              onClick={handleRegister}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={acceptedCount === 0 || saving}
            >
              Registrar {acceptedCount > 0 ? `${acceptedCount} item(s)` : 'items'}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Se registrarán solo los RFIDs validados como disponibles.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Tips de uso</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>La pistola RFID envía 24 caracteres por lectura; se procesa automáticamente.</li>
              <li>Duplicados o conflictos se muestran en amarillo/rojo y no se envían.</li>
              <li>El estado inicial se registra como “En Bodega”.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
