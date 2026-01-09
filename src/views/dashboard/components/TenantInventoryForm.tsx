import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '../../../components/ui/Input';
import {
  TenantInventoryItem,
  TenantInventoryModelInfo,
  TenantInventoryPayload
} from '../../../models/TenantInventoryModel';

interface TenantInventoryFormProps {
  mode: 'create' | 'edit';
  saving: boolean;
  modelos: TenantInventoryModelInfo[];
  item?: TenantInventoryItem | null;
  onSubmit: (payload: TenantInventoryPayload) => Promise<void>;
  onClose: () => void;
}

interface FormState {
  modelo_id: number | null;
  rfid: string;
  activo: boolean;
}

const DEFAULT_FORM_STATE: FormState = {
  modelo_id: null,
  rfid: '',
  activo: true
};

export const TenantInventoryForm: React.FC<TenantInventoryFormProps> = ({
  mode,
  saving,
  modelos,
  item,
  onSubmit,
  onClose
}) => {
  const [form, setForm] = useState<FormState>(() => {
    if (mode === 'edit' && item) {
      return {
        modelo_id: item.modelo_id,
        rfid: item.rfid,
        activo: item.activo
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
    if (!tipos.length) return;
    if (!selectedTipo || !tipos.includes(selectedTipo)) {
      setSelectedTipo((prev) => (prev && tipos.includes(prev) ? prev : tipos[0]));
    }
  }, [tipos, selectedTipo]);

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
      modelo_id: null
    }));
  };

  const handleModeloChange = (value: string) => {
    const modeloId = Number(value);
    setForm(prev => ({
      ...prev,
      modelo_id: Number.isNaN(modeloId) ? null : modeloId
    }));
    const model = modelos.find(m => m.modelo_id === modeloId);
    if (model?.tipo) {
      setSelectedTipo(model.tipo);
    }
  };

  const validateForm = () => {
    const currentErrors: Record<string, string> = {};
    if (!form.modelo_id) {
      currentErrors.modelo_id = 'Seleccione un modelo';
    }
    if (!form.rfid || form.rfid.length !== 24 || !/^[A-Za-z0-9]{24}$/.test(form.rfid)) {
      currentErrors.rfid = 'El RFID debe tener 24 caracteres alfanuméricos';
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
      estado: item?.estado?.trim() || 'En Bodega',
      categoria: selectedModelo?.tipo || selectedTipo || item?.categoria || undefined,
      activo: form.activo
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

          <div className="grid grid-cols-1 gap-4">
            <Input
              label="RFID"
              value={form.rfid}
              onChange={(event) => {
                const value = event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 24);
                handleChange('rfid', value);
              }}
              required
              maxLength={24}
              error={errors.rfid}
              placeholder="24 caracteres alfanuméricos"
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
