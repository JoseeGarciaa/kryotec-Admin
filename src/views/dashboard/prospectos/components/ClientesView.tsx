import React, { useState, useMemo } from 'react';
import { ClienteProspecto, CreateClienteProspectoData } from '../../../../models/ClienteProspectoModel';
import { useClienteProspectoController } from '../../../../controllers/hooks/useClienteProspectoController';
import { Plus, Edit2, Trash2, Search, Users, UserCheck, UserPlus, Calendar } from 'lucide-react';

const ClientesView: React.FC = () => {
  const { clientes, loading, error, createCliente, updateCliente, deleteCliente } = useClienteProspectoController();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<ClienteProspecto | null>(null);

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
    const activos = clientes.filter(c => c.estado === 'Activo').length;
    const prospectos = clientes.filter(c => c.estado === 'Pendiente').length;
    
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

    return { total, activos, prospectos, esteMes };
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
    const matchesSearch = cliente.nombre_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.numero_identificacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.correo?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'todos' || cliente.estado === statusFilter;
    const matchesType = typeFilter === 'todos' || cliente.tipo_cliente === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Clientes Prospectos</h1>
        <p className="text-gray-400 mb-6">Gestiona los clientes potenciales y existentes</p>
        
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto"
        >
          <Plus size={20} />
          Nuevo Cliente
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-500 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Clientes</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Users size={40} className="text-blue-200" />
          </div>
        </div>
        
        <div className="bg-green-500 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Activos</p>
              <p className="text-2xl font-bold">{stats.activos}</p>
            </div>
            <UserCheck size={40} className="text-green-200" />
          </div>
        </div>
        
        <div className="bg-purple-500 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Prospectos</p>
              <p className="text-2xl font-bold">{stats.prospectos}</p>
            </div>
            <UserPlus size={40} className="text-purple-200" />
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
            className="w-full p-3 pl-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white bg-gray-800 border-gray-600 text-white"
          />
          <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white bg-gray-800 border-gray-600 text-white"
        >
          <option value="todos">Todos los estados</option>
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
          <option value="Pendiente">Pendiente</option>
        </select>
        
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white bg-gray-800 border-gray-600 text-white"
        >
          <option value="todos">Todos los tipos</option>
          <option value="Empresa">Empresa</option>
          <option value="Personal">Personal</option>
          <option value="Gobierno">Gobierno</option>
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
        /* Table */
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
                    <div className="text-sm text-gray-500 dark:text-gray-400">{cliente.contacto}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{cliente.tipo_identificacion}: {cliente.numero_identificacion}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{cliente.correo}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{cliente.telefono}</div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
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

      {/* Modal de creación/edición */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {selectedCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de Identificación
                  </label>
                  <select
                    value={formData.tipo_identificacion}
                    onChange={(e) => setFormData({ ...formData, tipo_identificacion: e.target.value })}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Cliente
                </label>
                <select
                  value={formData.tipo_cliente}
                  onChange={(e) => setFormData({ ...formData, tipo_cliente: e.target.value })}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Seleccione...</option>
                  <option value="Empresa">Empresa</option>
                  <option value="Personal">Personal</option>
                  <option value="Gobierno">Gobierno</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contacto
                  </label>
                  <input
                    type="text"
                    value={formData.contacto}
                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
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
