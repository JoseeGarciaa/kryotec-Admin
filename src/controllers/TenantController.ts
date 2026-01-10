import { useState, useEffect } from 'react';
import { 
  getTenants, 
  createTenant, 
  updateTenant, 
  deleteTenant,
  Tenant
} from '../models/TenantModel';

// Función para generar el esquema a partir del nombre de la empresa
const generateSchemaFromName = (name: string): string => {
  // Convertir a minúsculas, reemplazar espacios por guiones bajos y añadir prefijo tenant_
  return `tenant_${name.toLowerCase().replace(/\s+/g, '_')}`;
};

export interface TenantFormData {
  nombre: string;
  nit: string;
  email_contacto: string;
  telefono_contacto: string;
  direccion: string;
  estado: boolean;
  contraseña?: string;
  esquema: string;
}

export interface TenantState {
  loading: boolean;
  error: string | null;
  tenants: Tenant[];
  searchTerm: string;
}

export const useTenantController = () => {
  const [state, setState] = useState<TenantState>({
    loading: true,
    error: null,
    tenants: [],
    searchTerm: ''
  });

  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Estado para el modal de credenciales
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [newTenantCredentials, setNewTenantCredentials] = useState<{
    usuario: string;
    contraseña: string;
    tenantName: string;
  } | null>(null);

  // Cargar tenants al iniciar
  useEffect(() => {
    loadTenants();
  }, []);

  // Cargar todos los tenants
  const loadTenants = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getTenants();
      setState(prev => ({ ...prev, tenants: data, loading: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Error al cargar empresas. Por favor, intente nuevamente.' 
      }));
      console.error('Error al cargar tenants:', error);
    }
  };

  // Filtrar tenants según término de búsqueda
  const getFilteredTenants = () => state.tenants.filter(tenant => 
    tenant.nombre.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
    tenant.nit.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
    tenant.email_contacto.toLowerCase().includes(state.searchTerm.toLowerCase())
  );

  // Actualizar término de búsqueda
  const setSearchTerm = (term: string) => {
    setState(prev => ({ ...prev, searchTerm: term }));
  };

  // Validar formulario
  const validateForm = (data: TenantFormData): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!data.nombre) errors.nombre = 'El nombre es obligatorio';
    if (!data.nit) errors.nit = 'El NIT es obligatorio';
    if (!data.email_contacto) {
      errors.email_contacto = 'El email es obligatorio';
    } else if (!/\S+@\S+\.\S+/.test(data.email_contacto)) {
      errors.email_contacto = 'El email no es válido';
    }
    // Eliminamos la validación de esquema ya que se generará automáticamente
    if (!data.contraseña && !editingTenant) errors.contraseña = 'La contraseña es obligatoria';
    
    return errors;
  };

  // Crear un nuevo tenant
  const handleCreateSubmit = async (formData: TenantFormData) => {
    // Generar esquema automáticamente a partir del nombre
    formData.esquema = generateSchemaFromName(formData.nombre);
    
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Construir por adelantado las credenciales para mostrarlas cuando exista éxito.
    const pendingCredentials = {
      usuario: formData.email_contacto,
      contraseña: formData.contraseña || '',
      tenantName: formData.nombre
    };

    // Proceder con la creación en el backend
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await createTenant(formData);
      await loadTenants();
      setShowCreateForm(false);
      setFormErrors({});
      setNewTenantCredentials(pendingCredentials);
      setShowCredentialsModal(true);
    } catch (error: any) {
      const backendMsg = error?.response?.data?.error as string | undefined;
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: backendMsg || 'Error al crear empresa. Por favor, intente nuevamente.' 
      }));
      console.error('Error al crear tenant:', error);
    }
  };

  // Actualizar un tenant existente
  const handleEditSubmit = async (formData: TenantFormData) => {
    if (!editingTenant) return;
    
    // Generar esquema automáticamente a partir del nombre si ha cambiado el nombre
    if (formData.nombre !== editingTenant.nombre) {
      formData.esquema = generateSchemaFromName(formData.nombre);
    }
    
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Si no se proporciona una nueva contraseña, no la enviamos en la actualización
      if (!formData.contraseña) {
        delete formData.contraseña;
      }
      
      await updateTenant(editingTenant.id, formData);
      await loadTenants();
      setEditingTenant(null);
      setFormErrors({});
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Error al actualizar empresa. Por favor, intente nuevamente.' 
      }));
      console.error('Error al actualizar tenant:', error);
    }
  };

  // Eliminar un tenant
  const handleDelete = async (id: number) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await deleteTenant(id);
      await loadTenants();
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: 'Error al inhabilitar empresa. Por favor, intente nuevamente.' 
      }));
      console.error('Error al inhabilitar tenant:', error);
    }
  };

  // Función para cerrar el modal de credenciales
  const handleCloseCredentialsModal = () => {
    setShowCredentialsModal(false);
  };

  return {
    state,
    viewingTenant,
    editingTenant,
    showCreateForm,
    formErrors,
    showCredentialsModal,
    newTenantCredentials,
    getFilteredTenants,
    setSearchTerm,
    handleCreateSubmit,
    handleEditSubmit,
    handleDelete,
    setShowCreateForm,
    setEditingTenant,
    setViewingTenant,
    handleCloseCredentialsModal,
    loadTenants
  };
};
