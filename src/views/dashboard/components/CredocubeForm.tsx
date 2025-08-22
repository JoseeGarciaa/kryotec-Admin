import React, { useState, useEffect } from 'react';
import { Credocube, CreateCredocubeData } from '../../../models/CredocubeModel';
import { Input } from '../../../components/ui/Input';

interface CredocubeFormProps {
  initialData?: Partial<Credocube>;
  onSubmit: (data: CreateCredocubeData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export const CredocubeForm: React.FC<CredocubeFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isEditing = false
}) => {
  // Estado para el formulario
  const [formData, setFormData] = useState<CreateCredocubeData>({
    nombre_modelo: '',
    volumen_litros: null,
    tipo: 'Cube',
    descripcion: '',
    dim_ext_frente: null,
    dim_ext_profundo: null,
    dim_ext_alto: null,
    dim_int_frente: null,
    dim_int_profundo: null,
    dim_int_alto: null,
    tic_frente: null,
    tic_alto: null,
    peso_total_kg: null
  });

  // Estado para errores de validación
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cargar datos iniciales si estamos editando
  useEffect(() => {
    if (initialData) {
      setFormData(prevData => ({
        ...prevData,
        ...initialData
      }));
    }
  }, [initialData]);

  // Manejar cambios en los campos del formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Convertir valores numéricos
    let parsedValue: string | number | null = value;
    if (type === 'number' && value !== '') {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) parsedValue = null;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: parsedValue
    }));
    
    // Limpiar error del campo si existe
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validar campos requeridos
    if (!formData.nombre_modelo?.trim()) {
      newErrors.nombre_modelo = 'El nombre del modelo es requerido';
    }
    
    if (!formData.tipo?.trim()) {
      newErrors.tipo = 'El tipo es requerido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-semibold">
        {isEditing ? 'Editar Modelo de Credocube' : 'Nuevo Modelo de Credocube'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Información básica */}
        <div className="space-y-4">
          <h3 className="font-medium">Información Básica</h3>
          
          <div>
            <Input
              label="Nombre del Modelo"
              name="nombre_modelo"
              value={formData.nombre_modelo || ''}
              onChange={handleInputChange}
              error={errors.nombre_modelo}
              required
            />
          </div>
          
          <div>
            <Input
              label="Volumen (litros)"
              name="volumen_litros"
              type="number"
              step="0.01"
              value={formData.volumen_litros?.toString() || ''}
              onChange={handleInputChange}
              error={errors.volumen_litros}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Tipo <span className="text-red-500">*</span>
            </label>
            <select
              name="tipo"
              value={formData.tipo || ''}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Cube">Cube</option>
              <option value="VIP">VIP</option>
              <option value="TIC">TIC</option>
            </select>
          </div>
          {errors.tipo && (
              <p className="text-red-500 text-sm mt-1">{errors.tipo}</p>
            )}
          <div>
            <label className="block text-sm font-medium mb-1">
              Descripción
            </label>
            <textarea
              name="descripcion"
              value={formData.descripcion || ''}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            {errors.descripcion && (
              <p className="text-red-500 text-sm mt-1">{errors.descripcion}</p>
            )}
          </div>
        </div>
        
        {/* Dimensiones */}
        <div className="space-y-4">
          <h3 className="font-medium">Dimensiones</h3>
          
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Ext. Frente (mm)"
              name="dim_ext_frente"
              type="number"
              value={formData.dim_ext_frente?.toString() || ''}
              onChange={handleInputChange}
              error={errors.dim_ext_frente}
            />
            <Input
              label="Ext. Profundo (mm)"
              name="dim_ext_profundo"
              type="number"
              value={formData.dim_ext_profundo?.toString() || ''}
              onChange={handleInputChange}
              error={errors.dim_ext_profundo}
            />
            <Input
              label="Ext. Alto (mm)"
              name="dim_ext_alto"
              type="number"
              value={formData.dim_ext_alto?.toString() || ''}
              onChange={handleInputChange}
              error={errors.dim_ext_alto}
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Int. Frente (mm)"
              name="dim_int_frente"
              type="number"
              value={formData.dim_int_frente?.toString() || ''}
              onChange={handleInputChange}
              error={errors.dim_int_frente}
            />
            <Input
              label="Int. Profundo (mm)"
              name="dim_int_profundo"
              type="number"
              value={formData.dim_int_profundo?.toString() || ''}
              onChange={handleInputChange}
              error={errors.dim_int_profundo}
            />
            <Input
              label="Int. Alto (mm)"
              name="dim_int_alto"
              type="number"
              value={formData.dim_int_alto?.toString() || ''}
              onChange={handleInputChange}
              error={errors.dim_int_alto}
            />
          </div>
          
          <h3 className="font-medium mt-4">Características TIC</h3>
          
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="TIC Frente (mm)"
              name="tic_frente"
              type="number"
              value={formData.tic_frente?.toString() || ''}
              onChange={handleInputChange}
              error={errors.tic_frente}
            />
            <Input
              label="TIC Alto (mm)"
              name="tic_alto"
              type="number"
              value={formData.tic_alto?.toString() || ''}
              onChange={handleInputChange}
              error={errors.tic_alto}
            />
          </div>
        </div>
      </div>
      
      {/* Información adicional */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <Input
          label="Peso Total (kg)"
          name="peso_total_kg"
          type="number"
          step="0.01"
          value={formData.peso_total_kg?.toString() || ''}
          onChange={handleInputChange}
          error={errors.peso_total_kg}
        />
      </div>
      
      {/* Botones de acción */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg hover:bg-gray-100 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isEditing ? 'Actualizar' : 'Crear'}
        </button>
      </div>
    </form>
  );
};
