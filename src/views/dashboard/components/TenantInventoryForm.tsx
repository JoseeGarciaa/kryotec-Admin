import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '../../../components/ui/Input';
import {
  TenantInventoryItem,
  TenantInventoryModelInfo,
  TenantInventoryPayload,
  TenantInventorySede,
  TenantInventorySeccion,
  TenantInventoryZona
} from '../../../models/TenantInventoryModel';

interface TenantInventoryFormProps {
  mode: 'create' | 'edit';
  saving: boolean;
  modelos: TenantInventoryModelInfo[];
  sedes: TenantInventorySede[];
  zonas: TenantInventoryZona[];
  secciones: TenantInventorySeccion[];
  item?: TenantInventoryItem | null;
  onSubmit: (payload: TenantInventoryPayload) => Promise<void>;
  onClose: () => void;
  onLoadZonas: (sedeId?: number) => Promise<void>;
  onLoadSecciones: (zonaId?: number) => Promise<void>;
}

interface FormState {
  modelo_id: number | null;
  rfid: string;
  lote: string;
  estado: string;
  sub_estado: string;
  categoria: string;
  activo: boolean;
  numero_orden: string;
  sede_id: number | null;
  zona_id: number | null;
  seccion_id: number | null;
  validacion_limpieza: string;
  validacion_goteo: string;
  validacion_desinfeccion: string;
  temp_salida_c: string;
  temp_llegada_c: string;
  sensor_id: string;
  fecha_vencimiento: string;
}

const DEFAULT_FORM_STATE: FormState = {
  modelo_id: null,
  rfid: '',
  lote: '',
  estado: 'Pre Acondicionamiento',
  sub_estado: '',
  categoria: 'Cube',
  activo: true,
  numero_orden: '',
  sede_id: null,
  zona_id: null,
  seccion_id: null,
  validacion_limpieza: '',
  validacion_goteo: '',
  validacion_desinfeccion: '',
  temp_salida_c: '',
  temp_llegada_c: '',
  sensor_id: '',
  fecha_vencimiento: ''
};

const sanitizeOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const TenantInventoryForm: React.FC<TenantInventoryFormProps> = ({
  mode,
  saving,
  modelos,
  sedes,
  zonas,
  secciones,
  item,
  onSubmit,
  onClose,
  onLoadZonas,
  onLoadSecciones
}) => {
  const [form, setForm] = useState<FormState>(() => {
    if (mode === 'edit' && item) {
      return {
        modelo_id: item.modelo_id,
        rfid: item.rfid,
        lote: item.lote || '',
        estado: item.estado || 'Pre Acondicionamiento',
        sub_estado: item.sub_estado || '',
        categoria: item.categoria || item.tipo_modelo || 'Cube',
        activo: item.activo,
        numero_orden: item.numero_orden || '',
        sede_id: item.sede_id ?? null,
        zona_id: item.zona_id ?? null,
        seccion_id: item.seccion_id ?? null,
        validacion_limpieza: item.validacion_limpieza || '',
        validacion_goteo: item.validacion_goteo || '',
        validacion_desinfeccion: item.validacion_desinfeccion || '',
        temp_salida_c: item.temp_salida_c?.toString() || '',
        temp_llegada_c: item.temp_llegada_c?.toString() || '',
        sensor_id: item.sensor_id || '',
        fecha_vencimiento: item.fecha_vencimiento || ''
      };
    }
    return DEFAULT_FORM_STATE;
  });

  const [selectedTipo, setSelectedTipo] = useState<string>(() => {
    if (mode === 'edit' && item?.tipo_modelo) {
      return item.tipo_modelo;
    }
    return 'Cube';
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tipos = useMemo(() => {
    const values = new Set<string>();
    modelos.forEach(modelo => {
      if (modelo.tipo) {
        values.add(modelo.tipo);
      }
    });
    return Array.from(values).sort();
  }, [modelos]);

  const filteredModelos = useMemo(() => {
    if (!selectedTipo) return modelos;
    return modelos.filter(modelo => modelo.tipo === selectedTipo);
  }, [modelos, selectedTipo]);

  const selectedModelo = useMemo(() => {
    if (!form.modelo_id) return undefined;
    return modelos.find(modelo => modelo.modelo_id === form.modelo_id);
  }, [form.modelo_id, modelos]);

  useEffect(() => {
    if (mode === 'edit' && item?.sede_id) {
      onLoadZonas(item.sede_id).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, item?.sede_id]);

  useEffect(() => {
    if (mode === 'edit' && item?.zona_id) {
      onLoadSecciones(item.zona_id).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, item?.zona_id]);

  useEffect(() => {
    if (selectedModelo?.tipo && form.categoria !== selectedModelo.tipo) {
      setForm(prev => ({ ...prev, categoria: selectedModelo.tipo || prev.categoria }));
    }
  }, [selectedModelo, form.categoria]);

  const handleChange = (field: keyof FormState, value: string | boolean | number | null) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTipoChange = (value: string) => {
    setSelectedTipo(value);
    setForm(prev => ({
      ...prev,
      modelo_id: null,
      categoria: value || prev.categoria
    }));
  };

  const handleModeloChange = (value: string) => {
    const modeloId = Number(value);
    const model = modelos.find(m => m.modelo_id === modeloId);
    setForm(prev => ({
      ...prev,
      modelo_id: Number.isNaN(modeloId) ? null : modeloId,
      categoria: model?.tipo || prev.categoria
    }));
  };

  const handleSedeChange = async (value: string) => {
    const sedeId = value ? Number(value) : null;
    await onLoadZonas(sedeId ?? undefined);
    setForm(prev => ({
      ...prev,
      sede_id: sedeId,
      zona_id: null,
      seccion_id: null
    }));
  };

  const handleZonaChange = async (value: string) => {
    const zonaId = value ? Number(value) : null;
    await onLoadSecciones(zonaId ?? undefined);
    setForm(prev => ({
      ...prev,
      zona_id: zonaId,
      seccion_id: null
    }));
  };

  const validateForm = () => {
    const currentErrors: Record<string, string> = {};
    if (!form.modelo_id) {
      currentErrors.modelo_id = 'Seleccione un modelo';
    }
    if (!form.rfid || form.rfid.length !== 24 || !/^\d{24}$/.test(form.rfid)) {
      currentErrors.rfid = 'El RFID debe tener 24 dígitos';
    }
    if (!selectedTipo) {
      currentErrors.tipo = 'Seleccione el tipo';
    }
    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    const payload: TenantInventoryPayload = {
      modelo_id: form.modelo_id!,
      rfid: form.rfid.trim(),
      lote: sanitizeOptional(form.lote) ?? null,
      estado: form.estado.trim() || 'Pre Acondicionamiento',
      sub_estado: sanitizeOptional(form.sub_estado) ?? null,
      categoria: form.categoria,
      activo: form.activo,
      numero_orden: sanitizeOptional(form.numero_orden) ?? null,
      sede_id: form.sede_id ?? undefined,
      zona_id: form.zona_id ?? undefined,
      seccion_id: form.seccion_id ?? undefined,
      validacion_limpieza: sanitizeOptional(form.validacion_limpieza) ?? null,
      validacion_goteo: sanitizeOptional(form.validacion_goteo) ?? null,
      validacion_desinfeccion: sanitizeOptional(form.validacion_desinfeccion) ?? null,
      temp_salida_c: form.temp_salida_c ? Number(form.temp_salida_c) : undefined,
      temp_llegada_c: form.temp_llegada_c ? Number(form.temp_llegada_c) : undefined,
      sensor_id: sanitizeOptional(form.sensor_id) ?? null,
      fecha_vencimiento: sanitizeOptional(form.fecha_vencimiento) ?? null
    };

    await onSubmit(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === 'create' ? 'Registrar item' : 'Editar item'}
          </h2>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.tipo ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                value={selectedTipo}
                onChange={(event) => handleTipoChange(event.target.value)}
                required
              >
                <option value="">Seleccione el tipo</option>
                {tipos.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
              {errors.tipo && <p className="text-sm text-red-500 mt-1">{errors.tipo}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Modelo</label>
              <select
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.modelo_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                value={form.modelo_id ?? ''}
                onChange={(event) => handleModeloChange(event.target.value)}
                required
              >
                <option value="">Seleccione el modelo / litragem</option>
                {filteredModelos.map(modelo => (
                  <option key={modelo.modelo_id} value={modelo.modelo_id}>
                    {modelo.nombre_modelo}
                  </option>
                ))}
              </select>
              {errors.modelo_id && <p className="text-sm text-red-500 mt-1">{errors.modelo_id}</p>}
            </div>
          </div>

          {selectedModelo && (
            <div className="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
              <span className="font-medium">Detalle del modelo:</span>
              <span>{selectedModelo.nombre_modelo}</span>
              {selectedModelo.volumen_litros && (
                <span>{selectedModelo.volumen_litros} L</span>
              )}
              {selectedModelo.tipo && (
                <span>{selectedModelo.tipo}</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="RFID"
              value={form.rfid}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, '').slice(0, 24);
                handleChange('rfid', value);
              }}
              required
              maxLength={24}
              inputMode="numeric"
              error={errors.rfid}
            />
            <Input
              label="Lote"
              value={form.lote}
              onChange={(event) => handleChange('lote', event.target.value)}
              placeholder="Opcional"
            />
            <Input
              label="Estado"
              value={form.estado}
              onChange={(event) => handleChange('estado', event.target.value)}
            />
            <Input
              label="Sub estado"
              value={form.sub_estado}
              onChange={(event) => handleChange('sub_estado', event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Sede</label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={form.sede_id ?? ''}
                onChange={(event) => handleSedeChange(event.target.value)}
              >
                <option value="">Sin sede</option>
                {sedes.map(sede => (
                  <option key={sede.sede_id} value={sede.sede_id}>{sede.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Zona</label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={form.zona_id ?? ''}
                onChange={(event) => handleZonaChange(event.target.value)}
                disabled={!form.sede_id}
              >
                <option value="">Sin zona</option>
                {zonas.map(zona => (
                  <option key={zona.zona_id} value={zona.zona_id}>{zona.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sección</label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={form.seccion_id ?? ''}
                onChange={(event) => handleChange('seccion_id', event.target.value ? Number(event.target.value) : null)}
                disabled={!form.zona_id}
              >
                <option value="">Sin sección</option>
                {secciones.map(seccion => (
                  <option key={seccion.seccion_id} value={seccion.seccion_id}>{seccion.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Validación limpieza"
              value={form.validacion_limpieza}
              onChange={(event) => handleChange('validacion_limpieza', event.target.value)}
              placeholder="Opcional"
            />
            <Input
              label="Validación goteo"
              value={form.validacion_goteo}
              onChange={(event) => handleChange('validacion_goteo', event.target.value)}
              placeholder="Opcional"
            />
            <Input
              label="Validación desinfección"
              value={form.validacion_desinfeccion}
              onChange={(event) => handleChange('validacion_desinfeccion', event.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Temperatura salida (°C)"
              value={form.temp_salida_c}
              onChange={(event) => handleChange('temp_salida_c', event.target.value)}
              placeholder="Opcional"
            />
            <Input
              label="Temperatura llegada (°C)"
              value={form.temp_llegada_c}
              onChange={(event) => handleChange('temp_llegada_c', event.target.value)}
              placeholder="Opcional"
            />
            <Input
              label="Sensor ID"
              value={form.sensor_id}
              onChange={(event) => handleChange('sensor_id', event.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Número de orden"
              value={form.numero_orden}
              onChange={(event) => handleChange('numero_orden', event.target.value)}
              placeholder="Opcional"
            />
            <Input
              label="Fecha vencimiento"
              type="datetime-local"
              value={form.fecha_vencimiento}
              onChange={(event) => handleChange('fecha_vencimiento', event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Disponibilidad</label>
              <button
                type="button"
                className={`px-3 py-1 rounded-full text-sm font-medium border ${form.activo ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}
                onClick={() => handleChange('activo', !form.activo)}
              >
                {form.activo ? 'Habilitado' : 'Inhabilitado'}
              </button>
            </div>

            <div className="space-x-3">
              <button
                type="button"
                className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
