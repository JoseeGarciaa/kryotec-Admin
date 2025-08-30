import React, { useState, useMemo } from 'react';
import { ClienteProspecto, CreateClienteProspectoData } from '../../../../models/ClienteProspectoModel';
import { useClienteProspectoController } from '../../../../controllers/hooks/useClienteProspectoController';
import { Plus, Edit2, Trash2, Search, Users, Calendar, LayoutGrid, List, User } from 'lucide-react';

const ClientesView: React.FC = () => {
  const { clientes, loading, error, createCliente, updateCliente, deleteCliente } = useClienteProspectoController();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<ClienteProspecto | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Helpers
  const normalize = (v?: string) => (v || '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

  // Form state
  const [formData, setFormData] = useState<CreateClienteProspectoData>({
    tipo_identificacion: '',
    numero_identificacion: '',
    nombre_cliente: '',
    tipo_cliente: '',
    contacto: '',
    correo: '',
    telefono: '',
    estado: 'Activo'
  });

  // Calcular estadísticas
  const stats = useMemo(() => {
    const total = clientes.length;
    
    // Clientes de este mes (asumiendo que tienes fecha_registro)
    const thisMonth = new Date();
    const esteMes = clientes.filter(c => {
      if (c.fecha_registro) {
        const clienteDate = new Date(c.fecha_registro);
        return clienteDate.getMonth() === thisMonth.getMonth() && 
               clienteDate.getFullYear() === thisMonth.getFullYear();
      }
      return false;
    }).length;

    return { total, esteMes };
  }, [clientes]);

  // Opciones dinámicas para filtros (estados y tipos reales en datos)
  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach(c => { if (c.estado && c.estado.trim()) set.add(c.estado.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clientes]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach(c => { if (c.tipo_cliente && c.tipo_cliente.trim()) set.add(c.tipo_cliente.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clientes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCliente) {
        await updateCliente(selectedCliente.cliente_id, formData);
      } else {
        await createCliente(formData);
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Error al guardar el cliente:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de que desea eliminar este cliente?')) {
      try {
        await deleteCliente(id);
      } catch (err) {
        console.error('Error al eliminar el cliente:', err);
      }
    }
  };

  const handleEdit = (cliente: ClienteProspecto) => {
    setSelectedCliente(cliente);
    setFormData({
      tipo_identificacion: cliente.tipo_identificacion || '',
      numero_identificacion: cliente.numero_identificacion || '',
      nombre_cliente: cliente.nombre_cliente,
      tipo_cliente: cliente.tipo_cliente || '',
      contacto: cliente.contacto || '',
      correo: cliente.correo || '',
      telefono: cliente.telefono || '',
      estado: cliente.estado || 'Activo'
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setSelectedCliente(null);
    setFormData({
      tipo_identificacion: '',
      numero_identificacion: '',
      nombre_cliente: '',
      tipo_cliente: '',
      contacto: '',
      correo: '',
      telefono: '',
      estado: 'Activo'
    });
  };

  const filteredClientes = clientes.filter(cliente => {
    const q = normalize(searchTerm);
    const matchesSearch = q === '' || [
      cliente.nombre_cliente,
      cliente.numero_identificacion,
      cliente.tipo_identificacion,
      cliente.correo,
      cliente.contacto,
      cliente.telefono,
      cliente.tipo_cliente,
      cliente.estado
    ].some(val => normalize(val).includes(q));

    const matchesStatus = statusFilter === 'todos' || normalize(cliente.estado) === normalize(statusFilter);
    const matchesType = typeFilter === 'todos' || normalize(cliente.tipo_cliente) === normalize(typeFilter);

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="text-center flex-1">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Clientes Prospectos</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Gestiona los clientes potenciales y existentes</p>
        </div>
        
  <div className="flex items-center gap-4 self-stretch sm:self-auto">
          {/* Botones para cambiar el modo de vista */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}
              title="Vista de tarjetas"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}
              title="Vista de tabla"
            >
              <List size={18} />
            </button>
          </div>
          
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <Plus size={20} />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Stats Cards */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-blue-500 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Clientes</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Users size={40} className="text-blue-200" />
          </div>
        </div>
        
        <div className="bg-orange-500 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Este Mes</p>
              <p className="text-2xl font-bold">{stats.esteMes}</p>
            </div>
            <Calendar size={40} className="text-orange-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
          <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-3 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="todos">Todos los estados</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="p-3 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="todos">Todos los tipos</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading === 'loading' ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {filteredClientes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No se encontraron clientes.</p>
            </div>
          ) : viewMode === 'cards' ? (
            /* Vista de tarjetas */
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredClientes.map((cliente) => (
                <div 
                  key={cliente.cliente_id} 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                >
                  {/* Cabecera de la tarjeta con gradiente */}
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 relative">
                    <div className="absolute top-3 right-3 bg-white/20 p-2 rounded-full">
                      <User size={18} className="text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white truncate pr-8">{cliente.nombre_cliente}</h3>
                    <p className="text-blue-100 text-sm">{cliente.contacto || 'Sin contacto'}</p>
                  </div>
                  
                  {/* Contenido principal */}
                  <div className="p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-200">
                        {cliente.tipo_cliente || 'N/A'}
                      </div>
                      <div className={`rounded-full px-3 py-1 text-sm font-medium ${
                        cliente.estado === 'Activo' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                        cliente.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {cliente.estado}
                      </div>
                    </div>
                    
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Identificación:</span>
                        <span className="text-gray-900 dark:text-white text-sm">
                          {cliente.tipo_identificacion}: {cliente.numero_identificacion}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Email:</span>
                        <span className="text-gray-900 dark:text-white text-sm truncate">
                          {cliente.correo || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Teléfono:</span>
                        <span className="text-gray-900 dark:text-white text-sm">
                          {cliente.telefono || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Registro:</span>
                        <span className="text-gray-900 dark:text-white text-sm">
                          {cliente.fecha_registro ? new Date(cliente.fecha_registro).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pie de tarjeta con acciones */}
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 flex justify-between">
                    <button
                      onClick={() => handleEdit(cliente)}
                      className="p-2 rounded-full bg-yellow-50 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800 transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(cliente.cliente_id)}
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
            /* Vista de tabla */
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">CLIENTE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IDENTIFICACIÓN</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">CONTACTO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">TIPO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ESTADO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">FECHA REGISTRO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredClientes.map((cliente) => (
                    <tr key={cliente.cliente_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{cliente.nombre_cliente}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{cliente.contacto}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{cliente.tipo_identificacion}: {cliente.numero_identificacion}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{cliente.correo}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{cliente.telefono}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{cliente.tipo_cliente}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          cliente.estado === 'Activo' ? 'bg-green-100 text-green-800' : 
                          cliente.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {cliente.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {cliente.fecha_registro ? new Date(cliente.fecha_registro).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(cliente)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(cliente.cliente_id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal de creación/edición */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl p-4 sm:p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {selectedCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de Identificación
                  </label>
                  <select
                    value={formData.tipo_identificacion}
                    onChange={(e) => setFormData({ ...formData, tipo_identificacion: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Seleccione...</option>
                    <option value="CC">Cédula de Ciudadanía</option>
                    <option value="NIT">NIT</option>
                    <option value="CE">Cédula de Extranjería</option>
                    <option value="PASS">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Número de Identificación
                  </label>
                  <input
                    type="text"
                    value={formData.numero_identificacion}
                    onChange={(e) => setFormData({ ...formData, numero_identificacion: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  value={formData.nombre_cliente}
                  onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
                  required
                  className="w-full p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Cliente
                </label>
                <select
                  value={formData.tipo_cliente}
                  onChange={(e) => setFormData({ ...formData, tipo_cliente: e.target.value })}
                  className="w-full p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Seleccione...</option>
                  <option value="Empresa">Empresa</option>
                  <option value="Personal">Personal</option>
                  <option value="Gobierno">Gobierno</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contacto
                  </label>
                  <input
                    type="text"
                    value={formData.contacto}
                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Correo
                  </label>
                  <input
                    type="email"
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  {selectedCliente ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientesView;
