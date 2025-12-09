import React, { useState, useEffect } from 'react';
import { Tenant } from '../../../models/TenantModel';
import { TenantFormData } from '../../../controllers/TenantController';
import { Input } from '../../../components/ui/Input';

// Importamos la función para generar el esquema
const generateSchemaFromName = (name: string): string => {
  return `tenant_${name.toLowerCase().replace(/\s+/g, '_')}`;
};

interface TenantFormProps {
  initialData?: Tenant;
  onSubmit: (data: TenantFormData) => void;
  onCancel: () => void;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export const TenantForm: React.FC<TenantFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  errors,
  setErrors
}) => {
  const [formData, setFormData] = useState<TenantFormData>({
    nombre: '',
    nit: '',
    email_contacto: '',
    telefono_contacto: '',
    direccion: '',
    estado: true,
    contraseña: '',
    esquema: ''
  });

  // Cargar datos iniciales si estamos editando
  useEffect(() => {
    if (initialData) {
      setFormData({
        nombre: initialData.nombre || '',
        nit: initialData.nit || '',
        email_contacto: initialData.email_contacto || '',
        telefono_contacto: initialData.telefono_contacto || '',
        direccion: initialData.direccion || '',
        estado: initialData.estado,
        esquema: initialData.esquema || '',
        // No incluimos contraseña al editar
      });
    }
  }, [initialData]);

  // Efecto para actualizar el esquema cuando cambia el nombre
  useEffect(() => {
    if (formData.nombre) {
      setFormData(prev => ({
        ...prev,
        esquema: generateSchemaFromName(formData.nombre)
      }));
    }
  }, [formData.nombre]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    // Manejar checkbox para estado
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Limpiar error del campo si existe
    if (errors[name]) {
      setErrors((prev: Record<string, string>) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">
        {initialData ? 'Editar Empresa' : 'Nueva Empresa'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Input
            label="Nombre de la Empresa"
            name="nombre"
            type="text"
            value={formData.nombre}
            onChange={handleInputChange}
            error={errors.nombre}
            required
          />
        </div>
        
        <div>
          <Input
            label="NIT"
            name="nit"
            type="text"
            value={formData.nit}
            onChange={handleInputChange}
            error={errors.nit}
            required
          />
        </div>
        
        <div>
          <Input
            label="Email de Contacto"
            name="email_contacto"
            type="email"
            value={formData.email_contacto}
            onChange={handleInputChange}
            error={errors.email_contacto}
            required
          />
        </div>
        
        <div>
          <Input
            label="Teléfono de Contacto"
            name="telefono_contacto"
            type="tel"
            value={formData.telefono_contacto}
            onChange={handleInputChange}
            error={errors.telefono_contacto}
          />
        </div>
        
        <div>
          <Input
            label="Dirección"
            name="direccion"
            type="text"
            value={formData.direccion}
            onChange={handleInputChange}
            error={errors.direccion}
          />
        </div>
        
        <div>
          <Input
            label="Esquema"
            name="esquema"
            type="text"
            value={formData.esquema}
            onChange={handleInputChange}
            error={errors.esquema}
            required
            disabled={true}
            className="bg-gray-100 dark:bg-gray-700"
          />
        </div>
        
        {!initialData && (
          <div>
            <Input
              label="Contraseña"
              name="contraseña"
              type="password"
              value={formData.contraseña || ''}
              onChange={handleInputChange}
              error={errors.contraseña}
              required={!initialData}
              enablePasswordToggle
            />
          </div>
        )}
        
        {initialData && (
          <div>
            <Input
              label="Nueva Contraseña (dejar en blanco para mantener la actual)"
              name="contraseña"
              type="password"
              value={formData.contraseña || ''}
              onChange={handleInputChange}
              error={errors.contraseña}
              enablePasswordToggle
            />
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="estado"
            name="estado"
            checked={formData.estado}
            onChange={handleInputChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="estado" className="text-sm font-medium">
            Activo
          </label>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {initialData ? 'Actualizar' : 'Crear'}
        </button>
      </div>
    </form>
  );
};
