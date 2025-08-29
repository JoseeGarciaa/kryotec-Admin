import React, { useState } from 'react';
import { useCredocubeController } from '../../controllers/CredocubeController';
import { Credocube, CreateCredocubeData } from '../../models/CredocubeModel';
import { CredocubeForm } from './components/CredocubeForm';
import { Edit, Trash2, Plus, Search, Eye, Box, LayoutGrid, List } from 'lucide-react';

export const CredocubesView: React.FC = () => {
  const { credocubes, loading, error, fetchCredocubes, createCredocube, updateCredocube, deleteCredocube } = useCredocubeController();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCredocube, setEditingCredocube] = useState<Credocube | null>(null);
  const [viewingCredocube, setViewingCredocube] = useState<Credocube | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Obtener todos los tipos únicos para el filtro
  const tiposUnicos = Array.from(new Set(credocubes.map(credocube => credocube.tipo || '').filter(tipo => tipo !== '')));

  // Filtrar modelos por término de búsqueda y tipo seleccionado
  const filteredCredocubes = credocubes.filter(credocube => {
    // Filtro por término de búsqueda
    const matchesSearchTerm = 
      credocube.nombre_modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      credocube.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      credocube.tipo?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro por tipo seleccionado
    const matchesTipo = selectedTipo === '' || credocube.tipo === selectedTipo;
    
    return matchesSearchTerm && matchesTipo;
  });

  // Manejar envío del formulario de creación
  const handleCreateSubmit = async (data: CreateCredocubeData) => {
    try {
      await createCredocube(data);
      setShowCreateForm(false);
      fetchCredocubes(); // Recargar la lista
    } catch (err) {
      console.error('Error al crear modelo de Credocube:', err);
    }
  };

  // Manejar envío del formulario de edición
  const handleEditSubmit = async (data: CreateCredocubeData) => {
    if (!editingCredocube) return;
    
    try {
      await updateCredocube(editingCredocube.modelo_id, data);
      setEditingCredocube(null);
      fetchCredocubes(); // Recargar la lista
    } catch (err) {
      console.error('Error al actualizar modelo de Credocube:', err);
    }
  };

  // Manejar eliminación de modelo
  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este modelo de Credocube?')) {
      try {
        await deleteCredocube(id);
        fetchCredocubes(); // Recargar la lista
      } catch (err) {
        console.error('Error al eliminar modelo de Credocube:', err);
      }
    }
  };

  // Renderizar detalles del modelo
  const renderCredocubeDetails = () => {
    if (!viewingCredocube) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto text-gray-900 dark:text-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{viewingCredocube.nombre_modelo}</h2>
            <button 
              onClick={() => setViewingCredocube(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Información Básica</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Volumen:</span> {viewingCredocube.volumen_litros} litros</p>
                <p><span className="font-medium">Tipo:</span> {viewingCredocube.tipo}</p>
                <p><span className="font-medium">Descripción:</span> {viewingCredocube.descripcion}</p>
                <p><span className="font-medium">Peso total:</span> {viewingCredocube.peso_total_kg} kg</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Dimensiones</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Dimensiones externas:</span> {viewingCredocube.dim_ext_frente} x {viewingCredocube.dim_ext_profundo} x {viewingCredocube.dim_ext_alto} mm</p>
                <p><span className="font-medium">Dimensiones internas:</span> {viewingCredocube.dim_int_frente} x {viewingCredocube.dim_int_profundo} x {viewingCredocube.dim_int_alto} mm</p>
                <p><span className="font-medium">Dimensiones TIC:</span> {viewingCredocube.tic_frente} x {viewingCredocube.tic_alto} mm</p>
              </div>
            </div>
          </div>
          
          {/* Sección de precios eliminada */}
          
          <div className="mt-6 flex justify-end">
            <button 
              onClick={() => setViewingCredocube(null)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar formulario de creación o edición
  const renderForm = () => {
    if (showCreateForm || editingCredocube) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto text-gray-900 dark:text-white">
            <CredocubeForm
              initialData={editingCredocube || undefined}
              onSubmit={editingCredocube ? handleEditSubmit : handleCreateSubmit}
              onCancel={() => {
                setShowCreateForm(false);
                setEditingCredocube(null);
              }}
              isEditing={!!editingCredocube}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Gestión de Credocubes</h1>
        <div className="flex items-center gap-4 self-stretch sm:self-auto">
          {/* Botones para cambiar el modo de vista */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
              title="Vista de tarjetas"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
              title="Vista de tabla"
            >
              <List size={18} />
            </button>
          </div>
          
          <button 
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Modelo</span>
          </button>
        </div>
      </div>
      
      {/* Barra de búsqueda y filtros */}
  <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar modelos de Credocube..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
          />
        </div>
        
        {/* Selector de tipo */}
    <div className="relative w-full md:min-w-[200px]">
          <select
            value={selectedTipo}
            onChange={(e) => setSelectedTipo(e.target.value)}
      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 appearance-none"
          >
            <option value="">Todos los tipos</option>
            {tiposUnicos.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <Box size={18} className="text-gray-400" />
          </div>
        </div>
      </div>
      
      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {/* Estado de carga */}
      {loading === 'loading' && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {/* Tabla de modelos */}
      {loading !== 'loading' && (
        <>
          {filteredCredocubes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No se encontraron modelos de Credocube.</p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCredocubes.map((credocube) => (
                <div 
                  key={credocube.modelo_id} 
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                >
                  {/* Cabecera de la tarjeta con gradiente */}
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 relative">
                    <div className="absolute top-4 right-4 bg-white/20 p-2 rounded-full">
                      <Box size={20} className="text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white truncate pr-8">{credocube.nombre_modelo}</h3>
                  </div>
                  
                  {/* Contenido principal */}
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-200">
                        {credocube.volumen_litros} L
                      </div>
                      <div className="bg-purple-100 dark:bg-purple-900 rounded-full px-3 py-1 text-sm font-medium text-purple-800 dark:text-purple-200">
                        {credocube.tipo}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">Descripción:</span>
                        <p className="text-gray-900 dark:text-white text-sm line-clamp-2">
                          {credocube.descripcion || 'Sin descripción'}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400 text-sm">Peso total:</span>
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {credocube.peso_total_kg ? `${credocube.peso_total_kg} kg` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pie de tarjeta con acciones */}
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3 flex justify-between">
                    <button
                      onClick={() => setViewingCredocube(credocube)}
                      className="p-2 rounded-full bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                      title="Ver detalles"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => setEditingCredocube(credocube)}
                      className="p-2 rounded-full bg-yellow-50 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800 transition-colors"
                      title="Editar"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(credocube.modelo_id)}
                      className="p-2 rounded-full bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Volumen</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-white">
                  {filteredCredocubes.map((credocube) => (
                    <tr key={credocube.modelo_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{credocube.nombre_modelo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{credocube.volumen_litros} L</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{credocube.tipo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setViewingCredocube(credocube)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Ver detalles"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => setEditingCredocube(credocube)}
                            className="p-1 text-yellow-600 hover:text-yellow-800"
                            title="Editar"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(credocube.modelo_id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      
      {/* Formulario modal */}
      {renderForm()}
      
      {/* Modal de detalles */}
      {renderCredocubeDetails()}
    </div>
  );
};
