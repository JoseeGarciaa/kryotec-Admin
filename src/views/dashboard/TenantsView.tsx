import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Plus, Eye, Edit, Trash2, X, Building2, LayoutGrid, List } from 'lucide-react';
import { useTenantController } from '../../controllers/TenantController';
import { TenantForm } from './components/TenantForm';
import { formatDate } from '../../utils/dateUtils';
import CredentialsModal from '../../components/CredentialsModal';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { useBreakpoint } from '../../utils/responsive';
import { MainLayout } from '../../components/layout/MainLayout';

export const TenantsView: React.FC = () => {
  const location = useLocation();
  const isStandalone = location.pathname.startsWith('/tenants');
  const { isMobile } = useBreakpoint();
  const {
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
    handleCloseCredentialsModal
  } = useTenantController();
  
  // Estado para alternar entre vista de tarjetas y tabla
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  const { loading, error } = state;
  const filteredTenants = getFilteredTenants();

  // Componente para mostrar detalles de un tenant
  const TenantDetailsModal = () => {
    if (!viewingTenant) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto text-gray-900 dark:text-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{viewingTenant.nombre}</h2>
            <button 
              onClick={() => setViewingTenant(null)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">NIT</p>
              <p>{viewingTenant.nit || 'No especificado'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email de Contacto</p>
              <p>{viewingTenant.email_contacto}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Teléfono</p>
              <p>{viewingTenant.telefono_contacto || 'No especificado'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Dirección</p>
              <p>{viewingTenant.direccion || 'No especificada'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Estado</p>
              <p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  viewingTenant.estado 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {viewingTenant.estado ? 'Activo' : 'Inactivo'}
                </span>
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Esquema</p>
              <p>{viewingTenant.esquema}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Fecha de Creación</p>
              <p>{formatDate(viewingTenant.fecha_creacion)}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Último Ingreso</p>
              <p>{viewingTenant.ultimo_ingreso ? formatDate(viewingTenant.ultimo_ingreso) : 'Nunca'}</p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setViewingTenant(null);
                setEditingTenant(viewingTenant);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Editar
            </button>
            <button
              onClick={() => setViewingTenant(null)}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Componente para el formulario de creación/edición
  const FormModal = () => {
    if (showCreateForm || editingTenant) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto text-gray-900 dark:text-white">
            <TenantForm
              initialData={editingTenant || undefined}
              onSubmit={editingTenant ? handleEditSubmit : handleCreateSubmit}
              onCancel={() => {
                setShowCreateForm(false);
                setEditingTenant(null);
              }}
              errors={formErrors}
              setErrors={() => {/* No necesitamos esta función */}}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  // Definimos el encabezado para el MainLayout
  const header = (
    <div className="px-3 pt-6 pb-3 sm:px-6 sm:pt-8 sm:pb-4">
      <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent text-left tracking-tight">
        Bienvenido a KryoSense
      </h2>
    </div>
  );

  // Contenido principal
  const content = (
    <div className="px-4 sm:px-6 py-4">
      {/* Título de la vista + acciones (debajo del header sticky) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Gestión de Empresas</h1>
        <div className="flex items-center gap-4 self-stretch sm:self-auto">
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 sm:p-2 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
              title="Vista de tarjetas"
              aria-label="Vista de tarjetas"
            >
              <LayoutGrid size={isMobile ? 16 : 18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 sm:p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
              title="Vista de tabla"
              aria-label="Vista de tabla"
            >
              <List size={isMobile ? 16 : 18} />
            </button>
          </div>
          
          <button 
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center"
            aria-label="Crear nueva empresa"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>
  {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 dark:bg-red-900 dark:text-red-200">
          <p>{error}</p>
        </div>
      )}
      
      {/* Modal de credenciales */}
      {showCredentialsModal && newTenantCredentials && (
        <CredentialsModal
          open={showCredentialsModal}
          onClose={handleCloseCredentialsModal}
          credentials={{
            usuario: newTenantCredentials.usuario,
            contraseña: newTenantCredentials.contraseña
          }}
          tenantName={newTenantCredentials.tenantName}
        />
      )}
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 sm:mb-6 space-y-3 md:space-y-0">
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar empresas..."
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-3 sm:px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm sm:text-base"
          />
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">No se encontraron empresas.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredTenants.map((tenant) => (
            <div 
              key={tenant.id} 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300"
            >
              {/* Cabecera de la tarjeta con gradiente */}
              <div className="bg-gradient-to-r from-indigo-500 to-blue-600 p-4 relative">
                <div className="absolute top-4 right-4 bg-white/20 p-2 rounded-full">
                  <Building2 size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-white truncate pr-8">{tenant.nombre}</h3>
              </div>
              
              {/* Contenido principal */}
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                    {tenant.nit || 'Sin NIT'}
                  </div>
                  <div className={`rounded-full px-3 py-1 text-sm font-medium ${
                    tenant.estado 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {tenant.estado ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Email:</span>
                    <span className="font-medium text-gray-900 dark:text-white truncate max-w-full sm:max-w-[150px] text-sm">
                      {tenant.email_contacto}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Esquema:</span>
                    <span className="font-medium text-gray-900 dark:text-white truncate max-w-full sm:max-w-[150px] text-sm">
                      {tenant.esquema}
                    </span>
                  </div>
                  {tenant.telefono_contacto && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Teléfono:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {tenant.telefono_contacto}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Pie de tarjeta con acciones */}
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3 flex justify-between">
                <button
                  onClick={() => setViewingTenant(tenant)}
                  className="p-2 rounded-full bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                  title="Ver detalles"
                  aria-label="Ver detalles"
                >
                  <Eye size={18} />
                </button>
                <button
                  onClick={() => setEditingTenant(tenant)}
                  className="p-2 rounded-full bg-yellow-50 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800 transition-colors"
                  title="Editar"
                  aria-label="Editar empresa"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Está seguro que desea eliminar la empresa ${tenant.nombre}?`)) {
                      handleDelete(tenant.id);
                    }
                  }}
                  className="p-2 rounded-full bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
                  title="Eliminar"
                  aria-label="Eliminar empresa"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ResponsiveTable
          data={filteredTenants}
          keyExtractor={(tenant) => tenant.id.toString()}
          columns={[
            {
              header: 'Nombre',
              accessor: 'nombre',
              className: 'font-medium text-gray-900 dark:text-white',
              priority: 1
            },
            {
              header: 'NIT',
              accessor: 'nit',
              priority: 2
            },
            {
              header: 'Email',
              accessor: 'email_contacto',
              priority: 2
            },
            {
              header: 'Estado',
              accessor: (tenant) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  tenant.estado 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {tenant.estado ? 'Activo' : 'Inactivo'}
                </span>
              ),
              priority: 1
            },
            {
              header: 'Esquema',
              accessor: 'esquema',
              priority: 3
            },
            {
              header: 'Acciones',
              accessor: (tenant) => (
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setViewingTenant(tenant)}
                    className="p-1 text-blue-600 hover:text-blue-800"
                    title="Ver detalles"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => setEditingTenant(tenant)}
                    className="p-1 text-yellow-600 hover:text-yellow-800"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`¿Está seguro que desea eliminar la empresa ${tenant.nombre}?`)) {
                        handleDelete(tenant.id);
                      }
                    }}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ),
              className: 'text-right',
              priority: 1
            },
          ]}
          onRowClick={(tenant) => setViewingTenant(tenant)}
          emptyMessage="No se encontraron empresas."
          className="shadow-sm"
        />
      )}
      
      {/* Modales */}
      <TenantDetailsModal />
      <FormModal />
    </div>
  );
  
  // Retornamos el componente MainLayout con el header y content
  return (
    <MainLayout header={isStandalone ? header : undefined}>
      {content}
    </MainLayout>
  );
};
