import React, { useState, useEffect, useMemo } from 'react';
import { InventarioProspecto, CreateInventarioProspectoData } from '../../../../models/InventarioProspectoModel';
import { InventarioProspectoController } from '../../../../controllers/InventarioProspectoController';
import { ClienteProspectoController } from '../../../../controllers/ClienteProspectoController';
import { ClienteProspecto } from '../../../../models/ClienteProspectoModel';
import { Plus, Edit2, Trash2, Search, Package, Box, Save, ShoppingCart, User, LayoutGrid, List, Thermometer } from 'lucide-react';
import { toast } from 'react-toastify';

// Interface para productos pendientes (locales)
interface PendingProduct extends CreateInventarioProspectoData {
  tempId: string; // ID temporal para identificar productos locales
  nombre_cliente?: string; // Para mostrar el nombre del cliente
}

const InventarioView: React.FC = () => {
  const [inventario, setInventario] = useState<InventarioProspecto[]>([]);
  const [clientes, setClientes] = useState<ClienteProspecto[]>([]);
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]); // Productos pendientes de enviar
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteFilter, setClienteFilter] = useState('todos');
  const [productoFilter, setProductoFilter] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventarioProspecto | null>(null);
  const [selectedPendingItem, setSelectedPendingItem] = useState<PendingProduct | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Form state
  const [formData, setFormData] = useState<CreateInventarioProspectoData>({
    cliente_id: 0,
    descripcion: '',
    producto: '',
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

  // Calcular estadísticas incluyendo productos pendientes
  const stats = useMemo(() => {
    const totalItems = inventario.reduce((sum: number, item: any) => sum + Number(item.cantidad || 0), 0);
    const pendingItems = pendingProducts.reduce((sum: number, item: any) => sum + Number(item.cantidad || 0), 0);
    
    const volumenTotal = inventario.reduce((sum: number, item: any) => {
      const volumen = Number(item.volumen_total_m3) || 0;
      return sum + volumen;
    }, 0);
    
    // Calcular volumen de productos pendientes
    const pendingVolumen = pendingProducts.reduce((sum: number, item: any) => {
      const volumen = (Number(item.largo_mm || 0) * Number(item.ancho_mm || 0) * Number(item.alto_mm || 0) * Number(item.cantidad || 0)) / 1000000000;
      return sum + volumen;
    }, 0);
    
    // Agrupar por producto (inventario + pendientes)
    const productosCount: {[key: string]: number} = {};
    
    inventario.forEach((item: any) => {
      const producto = item.producto || 'Sin especificar';
      productosCount[producto] = (productosCount[producto] || 0) + Number(item.cantidad || 0);
    });
    
    pendingProducts.forEach((item: any) => {
      const producto = item.producto || 'Sin especificar';
      productosCount[producto] = (productosCount[producto] || 0) + Number(item.cantidad || 0);
    });
  
    return { 
      totalItems: totalItems + pendingItems,
      volumenTotal: volumenTotal + pendingVolumen,
      productosCount,
      pendingItems,
      pendingVolumen
    };
  }, [inventario, pendingProducts]);

  // Filtrar inventario
  const filteredInventario = useMemo(() => {
    return inventario.filter((item: any) => {
      const matchesSearch = item.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCliente = clienteFilter === 'todos' || item.cliente_id.toString() === clienteFilter;
      const matchesProducto = productoFilter === 'todos' || item.producto === productoFilter;
      
      return matchesSearch && matchesCliente && matchesProducto;
    });
  }, [inventario, searchTerm, clienteFilter, productoFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedItem) {
      // Editar item existente en la base de datos
      try {
        setLoading(true);
        const updated = await InventarioProspectoController.updateInventario(selectedItem.inv_id, formData);
        if (updated) {
          const cliente = clientes.find((c: any) => c.cliente_id === updated.cliente_id);
          const updatedWithClientName = {
            ...updated,
            nombre_cliente: cliente?.nombre_cliente || 'N/A'
          };
          setInventario((prev: any) => prev.map((item: any) => item.inv_id === selectedItem.inv_id ? updatedWithClientName : item));
          toast.success('Producto actualizado exitosamente');
        }
        setShowModal(false);
        resetForm();
      } catch (error) {
        console.error('Error al actualizar:', error);
        toast.error('Error al actualizar el producto');
      } finally {
        setLoading(false);
      }
    } else if (selectedPendingItem) {
      // Editar producto pendiente local
      const cliente = clientes.find((c: any) => c.cliente_id === formData.cliente_id);
      const updatedPendingProduct: PendingProduct = {
        ...formData,
        tempId: selectedPendingItem.tempId,
        nombre_cliente: cliente?.nombre_cliente || 'N/A'
      };
      
      setPendingProducts(prev => prev.map(item => 
        item.tempId === selectedPendingItem.tempId ? updatedPendingProduct : item
      ));
      
      toast.success('Producto pendiente actualizado');
      setShowModal(false);
      resetForm();
    } else {
      // Agregar nuevo producto a la lista local (pendiente)
      const cliente = clientes.find((c: any) => c.cliente_id === formData.cliente_id);
      const newPendingProduct: PendingProduct = {
        ...formData,
        tempId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        nombre_cliente: cliente?.nombre_cliente || 'N/A'
      };
      
      setPendingProducts(prev => [...prev, newPendingProduct]);
      toast.success('Producto agregado al carrito');
      
      // Resetear solo los campos del producto pero mantener el cliente
      setFormData({
        ...formData,
        descripcion: '',
        producto: '',
        largo_mm: 0,
        ancho_mm: 0,
        alto_mm: 0,
        cantidad: 0,
        frecuencia_uso_dia: ''
      });
      
      toast.info('¡Puedes agregar otro producto para el mismo cliente!');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de que desea eliminar este producto?')) {
      try {
        const success = await InventarioProspectoController.deleteInventario(id);
        if (success) {
          setInventario((prev: any) => prev.filter((item: any) => item.inv_id !== id));
          toast.success('Producto eliminado exitosamente');
        }
      } catch (error) {
        console.error('Error al eliminar:', error);
        toast.error('Error al eliminar el producto');
      }
    }
  };

  const handleEdit = (item: InventarioProspecto) => {
    setSelectedItem(item);
    setSelectedPendingItem(null);
    setFormData({
      cliente_id: item.cliente_id,
      descripcion: item.descripcion || '',
      producto: item.producto,
      largo_mm: item.largo_mm,
      ancho_mm: item.ancho_mm,
      alto_mm: item.alto_mm,
      cantidad: item.cantidad,
      frecuencia_uso_dia: item.frecuencia_uso_dia || ''
    });
    setShowModal(true);
  };

  const handleEditPending = (item: PendingProduct) => {
    setSelectedPendingItem(item);
    setSelectedItem(null);
    setFormData({
      cliente_id: item.cliente_id,
      descripcion: item.descripcion || '',
      producto: item.producto,
      largo_mm: item.largo_mm,
      ancho_mm: item.ancho_mm,
      alto_mm: item.alto_mm,
      cantidad: item.cantidad,
      frecuencia_uso_dia: item.frecuencia_uso_dia || ''
    });
    setShowModal(true);
  };

  const handleDeletePending = (tempId: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este producto del carrito?')) {
      setPendingProducts(prev => prev.filter(item => item.tempId !== tempId));
      toast.success('Producto removido del carrito');
    }
  };

  // Función para enviar todos los productos pendientes a la base de datos
  const handleSaveAllPending = async () => {
    if (pendingProducts.length === 0) {
      toast.warning('No hay productos pendientes para guardar');
      return;
    }

    if (!window.confirm(`¿Está seguro de que desea guardar ${pendingProducts.length} productos en la base de datos?`)) {
      return;
    }

    try {
      setLoading(true);
      const savedProducts: InventarioProspecto[] = [];
      
      for (const product of pendingProducts) {
        const { tempId, nombre_cliente, ...productData } = product;
        const savedProduct = await InventarioProspectoController.createInventario(productData);
        const cliente = clientes.find((c: any) => c.cliente_id === savedProduct.cliente_id);
        savedProducts.push({
          ...savedProduct,
          nombre_cliente: cliente?.nombre_cliente || 'N/A'
        });
      }
      
      // Agregar productos guardados al inventario
      setInventario(prev => [...savedProducts, ...prev]);
      
      // Limpiar productos pendientes
      setPendingProducts([]);
      
      toast.success(`${savedProducts.length} productos guardados exitosamente en la base de datos`);
    } catch (error) {
      console.error('Error al guardar productos:', error);
      toast.error('Error al guardar los productos en la base de datos');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setSelectedPendingItem(null);
    setFormData({
      cliente_id: 0,
      descripcion: '',
      producto: '',
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
      <div className="flex justify-between items-center mb-8">
        <div className="text-center flex-1">
          <h1 className="text-3xl font-bold mb-2">Inventario de Productos</h1>
          <p className="text-gray-400 mb-6">Gestiona el inventario de productos de los clientes prospectos</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Botones para cambiar el modo de vista */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-gray-800 shadow-sm' : 'text-gray-400'}`}
              title="Vista de tarjetas"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-gray-800 shadow-sm' : 'text-gray-400'}`}
              title="Vista de tabla"
            >
              <List size={18} />
            </button>
          </div>
          
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Nuevo Producto
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
            <p className="text-gray-400 text-sm">Total Productos</p>
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
          <div className="bg-purple-600 p-3 rounded-lg mr-4">
            <Thermometer size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Tipos de Producto</p>
            <p className="text-2xl font-bold">{Object.keys(stats.productosCount).length}</p>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg flex items-center">
          <div className="bg-orange-600 p-3 rounded-lg mr-4">
            <ShoppingCart size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">En Carrito</p>
            <p className="text-2xl font-bold text-orange-400">{stats.pendingItems}</p>
          </div>
        </div>
      </div>

      {/* Sección de productos pendientes (Carrito) */}
      {pendingProducts.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingCart size={24} />
              Productos en Carrito ({pendingProducts.length})
            </h2>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingProducts([])}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Trash2 size={16} />
                Vaciar Carrito
              </button>
              <button
                onClick={handleSaveAllPending}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save size={16} />
                {loading ? 'Guardando...' : `Guardar Todo (${pendingProducts.length})`}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
            {pendingProducts.map((product) => (
              <div 
                key={product.tempId} 
                className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-orange-500 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Cabecera de la tarjeta con gradiente */}
                <div className="bg-gradient-to-r from-orange-500 to-yellow-600 p-4 relative">
                  <div className="absolute top-4 right-4 bg-white/20 p-2 rounded-full">
                    <Package size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white truncate pr-8">{product.descripcion || 'Sin descripción'}</h3>
                  <p className="text-orange-100 text-sm">{product.nombre_cliente}</p>
                </div>
                
                {/* Contenido principal */}
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="bg-purple-100 dark:bg-purple-900 rounded-full px-3 py-1 text-sm font-medium text-purple-800 dark:text-purple-200">
                      {product.producto}
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-200">
                      x{Number(product.cantidad || 0)}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Dimensiones:</span>
                      <span className="text-white text-sm">
                        {Number(product.largo_mm || 0)} × {Number(product.ancho_mm || 0)} × {Number(product.alto_mm || 0)} mm
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Volumen:</span>
                      <span className="text-white text-sm">
                        {((Number(product.largo_mm || 0) * Number(product.ancho_mm || 0) * Number(product.alto_mm || 0) * Number(product.cantidad || 0)) / 1000000000).toFixed(6)} m³
                      </span>
                    </div>
                    {product.frecuencia_uso_dia && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Frecuencia:</span>
                        <span className="text-white text-sm">{product.frecuencia_uso_dia}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Pie de tarjeta con acciones */}
                <div className="border-t border-gray-700 bg-gray-900 px-4 py-3 flex justify-between">
                  <button
                    onClick={() => handleEditPending(product)}
                    className="p-2 rounded-full bg-yellow-50 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeletePending(product.tempId)}
                    className="p-2 rounded-full bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
                    title="Eliminar del carrito"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar en inventario..."
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
        
        <select
          value={clienteFilter}
          onChange={(e: any) => setClienteFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="todos">Todos los clientes</option>
          {clientes.map((cliente: any) => (
            <option key={cliente.cliente_id} value={cliente.cliente_id.toString()}>
              {cliente.nombre_cliente}
            </option>
          ))}
        </select>
        
        <select
          value={productoFilter}
          onChange={(e: any) => setProductoFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="todos">Todos los productos</option>
          {Object.keys(stats.productosCount).map((producto: any) => (
            <option key={producto} value={producto}>
              {producto} ({stats.productosCount[producto]})
            </option>
          ))}
        </select>
      </div>

      {/* Productos guardados en la base de datos */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Package size={24} />
          Productos Guardados ({filteredInventario.length})
        </h2>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredInventario.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No se encontraron productos guardados</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredInventario.map((item: any) => (
              <div 
                key={item.inv_id} 
                className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-700 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Cabecera de la tarjeta con gradiente */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 relative">
                  <div className="absolute top-4 right-4 bg-white/20 p-2 rounded-full">
                    <Package size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white truncate pr-8">{item.descripcion || 'Sin descripción'}</h3>
                  <p className="text-blue-100 text-sm flex items-center gap-1">
                    <User size={14} />
                    {item.nombre_cliente || 'N/A'}
                  </p>
                </div>
                
                {/* Contenido principal */}
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="bg-purple-100 dark:bg-purple-900 rounded-full px-3 py-1 text-sm font-medium text-purple-800 dark:text-purple-200">
                      {item.producto || 'No especificado'}
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-200">
                      x{Number(item.cantidad || 0)}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Dimensiones:</span>
                      <span className="text-white text-sm">
                        {Number(item.largo_mm || 0)} × {Number(item.ancho_mm || 0)} × {Number(item.alto_mm || 0)} mm
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Volumen:</span>
                      <span className="text-white text-sm">
                        {(Number(item.volumen_total_m3) || 0).toFixed(6)} m³
                      </span>
                    </div>
                    {item.frecuencia_uso_dia && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Frecuencia:</span>
                        <span className="text-white text-sm">{item.frecuencia_uso_dia}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Pie de tarjeta con acciones */}
                <div className="border-t border-gray-700 bg-gray-900 px-4 py-3 flex justify-between">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 rounded-full bg-yellow-50 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.inv_id)}
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
          <div className="overflow-x-auto bg-gray-800 rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">DESCRIPCIÓN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">CLIENTE</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">PRODUCTO</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">DIMENSIONES</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">CANTIDAD</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">VOLUMEN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {filteredInventario.map((item: any) => (
                  <tr key={item.inv_id} className="hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{item.descripcion || 'Sin descripción'}</div>
                      {item.frecuencia_uso_dia && (
                        <div className="text-sm text-gray-400">Frecuencia: {item.frecuencia_uso_dia}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{item.nombre_cliente || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{item.producto || 'No especificado'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {Number(item.largo_mm || 0)} × {Number(item.ancho_mm || 0)} × {Number(item.alto_mm || 0)} mm
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{Number(item.cantidad || 0)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{(Number(item.volumen_total_m3) || 0).toFixed(6)} m³</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-yellow-400 hover:text-yellow-300 mr-4"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.inv_id)}
                        className="text-red-400 hover:text-red-300"
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
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {selectedItem ? 'Editar Producto Guardado' : 
               selectedPendingItem ? 'Editar Producto en Carrito' : 
               'Agregar Producto al Carrito'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
                <select
                  value={formData.cliente_id}
                  onChange={(e: any) => setFormData({...formData, cliente_id: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value={0}>Seleccionar cliente</option>
                  {clientes.map((cliente: any) => (
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
                  onChange={(e: any) => setFormData({...formData, descripcion: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Descripción del producto"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Producto</label>
                <input
                  type="text"
                  value={formData.producto}
                  onChange={(e: any) => setFormData({...formData, producto: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ej: Pastillas, Jeringas, ICOPOR, TÉRMICO, etc."
                  required
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Largo (mm)</label>
                  <input
                    type="number"
                    value={formData.largo_mm}
                    onChange={(e: any) => setFormData({...formData, largo_mm: parseInt(e.target.value) || 0})}
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
                    onChange={(e: any) => setFormData({...formData, ancho_mm: parseInt(e.target.value) || 0})}
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
                    onChange={(e: any) => setFormData({...formData, alto_mm: parseInt(e.target.value) || 0})}
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
                  onChange={(e: any) => setFormData({...formData, cantidad: parseInt(e.target.value) || 0})}
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
                  onChange={(e: any) => setFormData({...formData, frecuencia_uso_dia: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ej: 2-3 veces"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                {selectedItem ? (
                  // Modo edición de producto guardado
                  <>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                      {loading ? 'Actualizando...' : 'Actualizar en BD'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                ) : selectedPendingItem ? (
                  // Modo edición de producto en carrito
                  <>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                      Actualizar en Carrito
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  // Modo creación (agregar al carrito)
                  <>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                      Agregar al Carrito
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                      Finalizar
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventarioView;
