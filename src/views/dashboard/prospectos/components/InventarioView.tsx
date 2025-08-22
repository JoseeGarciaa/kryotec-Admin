import React, { useState, useEffect, useMemo } from 'react';
import { InventarioProspecto, CreateInventarioProspectoData } from '../../../../models/InventarioProspectoModel';
import { InventarioProspectoController } from '../../../../controllers/InventarioProspectoController';
import { ClienteProspectoController } from '../../../../controllers/ClienteProspectoController';
import { ClienteProspecto } from '../../../../models/ClienteProspectoModel';
import { Plus, Edit2, Trash2, Search, Package, Box, Thermometer } from 'lucide-react';
import { toast } from 'react-toastify';

const InventarioView: React.FC = () => {
  const [inventario, setInventario] = useState<InventarioProspecto[]>([]);
  const [clientes, setClientes] = useState<ClienteProspecto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteFilter, setClienteFilter] = useState('todos');
  const [materialFilter, setMaterialFilter] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventarioProspecto | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateInventarioProspectoData>({
    cliente_id: 0,
    descripcion: '',
    material: 'ICOPOR',
    largo_mm: 0,
    ancho_mm: 0,
    alto_mm: 0,
    cantidad: 0,
    frecuencia_uso_dia: ''
  });

  // Cargar datos iniciales
  useEffect(() => {
    fetchInventario();
    fetchClientes();
  }, []);

  const fetchInventario = async () => {
    try {
      setLoading(true);
      const data = await InventarioProspectoController.getAllInventario();
      setInventario(data);
    } catch (error) {
      console.error('Error al cargar inventario:', error);
      toast.error('Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const data = await ClienteProspectoController.getAllClientes();
      setClientes(data);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    }
  };

  // Calcular estadísticas
  const stats = useMemo(() => {
    const totalItems = inventario.reduce((sum, item) => sum + item.cantidad, 0);
    const volumenTotal = inventario.reduce((sum, item) => sum + (item.volumen_total_m3 || 0), 0);
    const icoporItems = inventario.filter(item => item.material === 'ICOPOR').reduce((sum, item) => sum + item.cantidad, 0);
    const termicoItems = inventario.filter(item => item.material === 'TERMICO').reduce((sum, item) => sum + item.cantidad, 0);

    return { totalItems, volumenTotal, icoporItems, termicoItems };
  }, [inventario]);

  // Filtrar inventario
  const filteredInventario = useMemo(() => {
    return inventario.filter(item => {
      const matchesSearch = item.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCliente = clienteFilter === 'todos' || item.cliente_id.toString() === clienteFilter;
      const matchesMaterial = materialFilter === 'todos' || item.material === materialFilter;
      
      return matchesSearch && matchesCliente && matchesMaterial;
    });
  }, [inventario, searchTerm, clienteFilter, materialFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (selectedItem) {
        const updated = await InventarioProspectoController.updateInventario(selectedItem.inv_id, formData);
        if (updated) {
          setInventario(prev => prev.map(item => item.inv_id === selectedItem.inv_id ? updated : item));
          toast.success('Item actualizado exitosamente');
        }
      } else {
        const newItem = await InventarioProspectoController.createInventario(formData);
        setInventario(prev => [newItem, ...prev]);
        toast.success('Item creado exitosamente');
      }
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Error al guardar el item');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de que desea eliminar este item?')) {
      try {
        const success = await InventarioProspectoController.deleteInventario(id);
        if (success) {
          setInventario(prev => prev.filter(item => item.inv_id !== id));
          toast.success('Item eliminado exitosamente');
        }
      } catch (error) {
        console.error('Error al eliminar:', error);
        toast.error('Error al eliminar el item');
      }
    }
  };

  const handleEdit = (item: InventarioProspecto) => {
    setSelectedItem(item);
    setFormData({
      cliente_id: item.cliente_id,
      descripcion: item.descripcion || '',
      material: item.material,
      largo_mm: item.largo_mm,
      ancho_mm: item.ancho_mm,
      alto_mm: item.alto_mm,
      cantidad: item.cantidad,
      frecuencia_uso_dia: item.frecuencia_uso_dia || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setSelectedItem(null);
    setFormData({
      cliente_id: 0,
      descripcion: '',
      material: 'ICOPOR',
      largo_mm: 0,
      ancho_mm: 0,
      alto_mm: 0,
      cantidad: 0,
      frecuencia_uso_dia: ''
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-2">Inventario Prospectos</h1>
        <p className="text-gray-400 text-center mb-6">Gestiona el inventario de elementos de los clientes prospectos</p>
        
        <div className="flex justify-center mb-6">
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Nuevo Item
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg flex items-center">
          <div className="bg-blue-600 p-3 rounded-lg mr-4">
            <Package size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Items</p>
            <p className="text-2xl font-bold">{stats.totalItems}</p>
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg flex items-center">
          <div className="bg-green-600 p-3 rounded-lg mr-4">
            <Box size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Volumen Total</p>
            <p className="text-2xl font-bold text-green-400">{stats.volumenTotal.toFixed(6)}</p>
            <p className="text-xs text-gray-400">m³</p>
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg flex items-center">
          <div className="bg-blue-600 p-3 rounded-lg mr-4">
            <Package size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">ICOPOR</p>
            <p className="text-2xl font-bold">{stats.icoporItems}</p>
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg flex items-center">
          <div className="bg-red-600 p-3 rounded-lg mr-4">
            <Thermometer size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">TÉRMICO</p>
            <p className="text-2xl font-bold">{stats.termicoItems}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar en inventario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
        
        <select
          value={clienteFilter}
          onChange={(e) => setClienteFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="todos">Todos los clientes</option>
          {clientes.map(cliente => (
            <option key={cliente.cliente_id} value={cliente.cliente_id.toString()}>
              {cliente.nombre_cliente}
            </option>
          ))}
        </select>
        
        <select
          value={materialFilter}
          onChange={(e) => setMaterialFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="todos">Todos los materiales</option>
          <option value="ICOPOR">ICOPOR</option>
          <option value="TERMICO">TÉRMICO</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Cliente</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Descripción</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Material</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Dimensiones (mm)</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Cantidad</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Volumen (m³)</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              ) : filteredInventario.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron items de inventario
                  </td>
                </tr>
              ) : (
                filteredInventario.map((item) => (
                  <tr key={item.inv_id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-3 text-sm">{item.nombre_cliente || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">{item.descripcion || 'Sin descripción'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.material === 'ICOPOR' ? 'bg-blue-600 text-blue-100' : 'bg-red-600 text-red-100'
                      }`}>
                        {item.material}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.largo_mm} × {item.ancho_mm} × {item.alto_mm}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{item.cantidad}</td>
                    <td className="px-4 py-3 text-sm">{item.volumen_total_m3?.toFixed(6) || '0.000000'}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.inv_id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {selectedItem ? 'Editar Item' : 'Nuevo Item'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
                <select
                  value={formData.cliente_id}
                  onChange={(e) => setFormData({...formData, cliente_id: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value={0}>Seleccionar cliente</option>
                  {clientes.map(cliente => (
                    <option key={cliente.cliente_id} value={cliente.cliente_id}>
                      {cliente.nombre_cliente}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Descripción del item"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Material</label>
                <select
                  value={formData.material}
                  onChange={(e) => setFormData({...formData, material: e.target.value as 'ICOPOR' | 'TERMICO'})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="ICOPOR">ICOPOR</option>
                  <option value="TERMICO">TÉRMICO</option>
                </select>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Largo (mm)</label>
                  <input
                    type="number"
                    value={formData.largo_mm}
                    onChange={(e) => setFormData({...formData, largo_mm: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Ancho (mm)</label>
                  <input
                    type="number"
                    value={formData.ancho_mm}
                    onChange={(e) => setFormData({...formData, ancho_mm: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Alto (mm)</label>
                  <input
                    type="number"
                    value={formData.alto_mm}
                    onChange={(e) => setFormData({...formData, alto_mm: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                    min="1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Cantidad</label>
                <input
                  type="number"
                  value={formData.cantidad}
                  onChange={(e) => setFormData({...formData, cantidad: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Frecuencia de uso por día</label>
                <input
                  type="text"
                  value={formData.frecuencia_uso_dia}
                  onChange={(e) => setFormData({...formData, frecuencia_uso_dia: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ej: 2-3 veces"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  {loading ? 'Guardando...' : (selectedItem ? 'Actualizar' : 'Crear')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventarioView;
