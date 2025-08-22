import React, { useState, useEffect } from 'react';
import { useSugerenciasController } from '../../../../controllers/hooks/useSugerenciasController';
import { useClienteProspectoController } from '../../../../controllers/hooks/useClienteProspectoController';
import { useInventarioProspectoController } from '../../../../controllers/hooks/useInventarioProspectoController';
import { Calculator, Package, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { CalculoSugerencia, ResultadoSugerencia } from '../../../../models/SugerenciasModel';
import { InventarioProspecto } from '../../../../models/InventarioProspectoModel';

const SugerenciasView: React.FC = () => {
  const { sugerencias, loading, error, calcularSugerencias, createSugerencia } = useSugerenciasController();
  const { clientes } = useClienteProspectoController();
  const { inventario } = useInventarioProspectoController();
  
  const [selectedCliente, setSelectedCliente] = useState<number | ''>('');
  const [selectedInventario, setSelectedInventario] = useState<number | ''>('');
  const [dimensiones, setDimensiones] = useState({
    frente: '',
    profundo: '',
    alto: ''
  });
  const [volumenRequerido, setVolumenRequerido] = useState('');
  const [resultados, setResultados] = useState<ResultadoSugerencia[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [filteredInventario, setFilteredInventario] = useState<InventarioProspecto[]>([]);

  // Filtrar inventario por cliente seleccionado
  useEffect(() => {
    if (selectedCliente) {
      const inventarioCliente = inventario.filter((item: InventarioProspecto) => item.cliente_id === Number(selectedCliente));
      setFilteredInventario(inventarioCliente);
      setSelectedInventario('');
    } else {
      setFilteredInventario([]);
    }
  }, [selectedCliente, inventario]);

  // Auto-llenar dimensiones cuando se selecciona un item de inventario
  useEffect(() => {
    if (selectedInventario) {
      const item = inventario.find((inv: InventarioProspecto) => inv.inv_id === Number(selectedInventario));
      if (item) {
        setVolumenRequerido(item.volumen_total_m3?.toString() || '');
        // Si el item tiene dimensiones, las usamos (mantener en mm)
        if (item.largo_mm && item.ancho_mm && item.alto_mm) {
          setDimensiones({
            frente: item.largo_mm.toString(), // Mantener en mm
            profundo: item.ancho_mm.toString(), // Mantener en mm
            alto: item.alto_mm.toString() // Mantener en mm
          });
        }
      }
    }
  }, [selectedInventario, inventario]);

  const handleCalcular = async () => {
    if (!selectedCliente || !selectedInventario || !dimensiones.frente || !dimensiones.profundo || !dimensiones.alto) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    setCalculando(true);
    try {
      // Obtener la cantidad del item de inventario seleccionado
      const item = inventario.find((inv: InventarioProspecto) => inv.inv_id === Number(selectedInventario));
      const cantidadCajas = item?.cantidad || 1;

      const calculo: CalculoSugerencia = {
        cliente_id: Number(selectedCliente),
        inv_id: Number(selectedInventario),
        volumen_requerido: Number(volumenRequerido) || 0,
        cantidad: cantidadCajas, // Agregar la cantidad de cajas
        dimensiones_requeridas: {
          frente: Number(dimensiones.frente), // Ahora en mm
          profundo: Number(dimensiones.profundo), // Ahora en mm
          alto: Number(dimensiones.alto) // Ahora en mm
        }
      };

      const resultadosCalculo = await calcularSugerencias(calculo);
      setResultados(resultadosCalculo);
    } catch (err) {
      console.error('Error al calcular sugerencias:', err);
    } finally {
      setCalculando(false);
    }
  };

  const handleGuardarSugerencia = async (resultado: ResultadoSugerencia) => {
    try {
      await createSugerencia({
        cliente_id: Number(selectedCliente),
        inv_id: Number(selectedInventario),
        modelo_sugerido: resultado.nombre_modelo,
        cantidad_sugerida: resultado.cantidad_sugerida,
        modalidad: 'calculadora',
        modelo_id: resultado.modelo_id,
        estado: 'pendiente'
      });
      alert('Sugerencia guardada exitosamente');
    } catch (err) {
      console.error('Error al guardar sugerencia:', err);
      alert('Error al guardar la sugerencia');
    }
  };

  const resetForm = () => {
    setSelectedCliente('');
    setSelectedInventario('');
    setDimensiones({ frente: '', profundo: '', alto: '' });
    setVolumenRequerido('');
    setResultados([]);
  };

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Calculadora de Sugerencias</h1>
        <p className="text-gray-400 mb-6">Encuentra el modelo perfecto de Credocube para tus clientes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Panel de Cálculo */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Calculator className="text-blue-400" size={24} />
            <h2 className="text-xl font-semibold">Calculadora</h2>
          </div>

          <div className="space-y-4">
            {/* Selección de Cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cliente *
              </label>
              <select
                value={selectedCliente}
                onChange={(e) => setSelectedCliente(e.target.value as any)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map(cliente => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id}>
                    {cliente.nombre_cliente}
                  </option>
                ))}
              </select>
            </div>

            {/* Selección de Inventario */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Item de Inventario *
              </label>
              <select
                value={selectedInventario}
                onChange={(e) => setSelectedInventario(e.target.value as any)}
                disabled={!selectedCliente}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Seleccionar item...</option>
                {filteredInventario.map(item => (
                  <option key={item.inv_id} value={item.inv_id}>
                    {item.descripcion} - {item.material}
                  </option>
                ))}
              </select>
            </div>

            {/* Dimensiones Requeridas */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Frente (mm) *
                </label>
                <input
                  type="number"
                  value={dimensiones.frente}
                  onChange={(e) => setDimensiones(prev => ({ ...prev, frente: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Profundo (mm) *
                </label>
                <input
                  type="number"
                  value={dimensiones.profundo}
                  onChange={(e) => setDimensiones(prev => ({ ...prev, profundo: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Alto (mm) *
                </label>
                <input
                  type="number"
                  value={dimensiones.alto}
                  onChange={(e) => setDimensiones(prev => ({ ...prev, alto: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Volumen Requerido */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Volumen Requerido (m³)
              </label>
              <input
                type="number"
                step="0.001"
                value={volumenRequerido}
                onChange={(e) => setVolumenRequerido(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                placeholder="0.000"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleCalcular}
                disabled={calculando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {calculando ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    Calculando...
                  </>
                ) : (
                  <>
                    <Calculator size={20} />
                    Calcular
                  </>
                )}
              </button>
              <button
                onClick={resetForm}
                className="bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Panel de Resultados */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Package className="text-green-400" size={24} />
            <h2 className="text-xl font-semibold">Resultados</h2>
          </div>

          {resultados.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>Realiza un cálculo para ver las sugerencias</p>
            </div>
          ) : (
            <div className="space-y-4">
              {resultados.map((resultado, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{resultado.nombre_modelo}</h3>
                      <p className="text-gray-400 text-sm">Cantidad sugerida: {resultado.cantidad_sugerida} unidades</p>
                    </div>
                    <div className="text-right">
                      <div className="bg-green-600 text-white px-2 py-1 rounded text-sm">
                        {resultado.eficiencia.toFixed(1)}% eficiencia
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Dimensiones internas:</p>
                      <p className="text-white">
                        {resultado.dimensiones_internas.frente} × {resultado.dimensiones_internas.profundo} × {resultado.dimensiones_internas.alto} mm
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Volumen:</p>
                      <p className="text-white">{resultado.volumen_litros} litros</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleGuardarSugerencia(resultado)}
                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Guardar Sugerencia
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Historial de Sugerencias */}
      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="text-yellow-400" size={24} />
          <h2 className="text-xl font-semibold">Historial de Sugerencias</h2>
        </div>

        {loading === 'loading' ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-400 py-8">
            <AlertCircle size={48} className="mx-auto mb-4" />
            <p>{error}</p>
          </div>
        ) : sugerencias.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No hay sugerencias guardadas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Modelo Sugerido</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fecha</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {sugerencias.map((sugerencia) => (
                  <tr key={sugerencia.sugerencia_id} className="hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {sugerencia.nombre_cliente || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {sugerencia.modelo_sugerido}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {sugerencia.cantidad_sugerida}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        sugerencia.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                        sugerencia.estado === 'aprobada' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {sugerencia.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {sugerencia.fecha_sugerencia ? new Date(sugerencia.fecha_sugerencia).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SugerenciasView;
