import React, { useState, useEffect } from 'react';
import { useSugerenciasController } from '../../../../controllers/hooks/useSugerenciasController';
import { useClienteProspectoController } from '../../../../controllers/hooks/useClienteProspectoController';
import { useInventarioProspectoController } from '../../../../controllers/hooks/useInventarioProspectoController';
import { Calculator, Package, CheckCircle, Clock, AlertCircle, Trash2, Download } from 'lucide-react';
import { CalculoSugerencia, ResultadoSugerencia } from '../../../../models/SugerenciasModel';
import { InventarioProspecto } from '../../../../models/InventarioProspectoModel';
import jsPDF from 'jspdf';

const SugerenciasView: React.FC = () => {
  const { sugerencias, loading, error, calcularSugerencias, createSugerencia, deleteSugerencia } = useSugerenciasController();
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

  const handleDeleteSugerencia = async (id: number) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta sugerencia?')) {
      try {
        await deleteSugerencia(id);
        alert('Sugerencia eliminada exitosamente');
      } catch (err) {
        console.error('Error al eliminar sugerencia:', err);
        alert('Error al eliminar la sugerencia');
      }
    }
  };

  const generatePDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let currentPage = 1;
    
    // Header con logo de Kryotec
    pdf.setFillColor(30, 41, 59); // bg-slate-800
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    // Título principal
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('KRYOTEC', 20, 25);
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Reporte de Sugerencias', 20, 35);
    
    // Fecha
    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(10);
    const fecha = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    pdf.text(`Generado el: ${fecha}`, pageWidth - 60, 25);
    
    let yPosition = 60;
    
    // Título de la sección
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Historial de Sugerencias', 20, yPosition);
    yPosition += 15;
    
    // Headers de la tabla
    pdf.setFillColor(59, 130, 246); // bg-blue-500
    pdf.rect(20, yPosition, pageWidth - 40, 10, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cliente', 25, yPosition + 7);
    pdf.text('Modelo', 70, yPosition + 7);
    pdf.text('Cantidad', 120, yPosition + 7);
    pdf.text('Estado', 145, yPosition + 7);
    pdf.text('Fecha', 170, yPosition + 7);
    
    yPosition += 15;
    
    // Datos de las sugerencias
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    
    sugerencias.forEach((sugerencia, index) => {
      // Alternar colores de fila
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252); // bg-slate-50
        pdf.rect(20, yPosition - 5, pageWidth - 40, 10, 'F');
      }
      
      pdf.text(sugerencia.nombre_cliente || 'N/A', 25, yPosition + 2);
      pdf.text(sugerencia.modelo_sugerido || 'N/A', 70, yPosition + 2);
      pdf.text(sugerencia.cantidad_sugerida?.toString() || '0', 120, yPosition + 2);
      
      // Estado con color
      const estado = sugerencia.estado || 'pendiente';
      if (estado === 'completado') {
        pdf.setTextColor(34, 197, 94); // text-green-500
      } else if (estado === 'pendiente') {
        pdf.setTextColor(251, 191, 36); // text-yellow-500
      } else {
        pdf.setTextColor(239, 68, 68); // text-red-500
      }
      pdf.text(estado, 145, yPosition + 2);
      
      pdf.setTextColor(0, 0, 0);
      const fecha = sugerencia.fecha_sugerencia 
        ? new Date(sugerencia.fecha_sugerencia).toLocaleDateString('es-ES')
        : 'N/A';
      pdf.text(fecha, 170, yPosition + 2);
      
      yPosition += 12;
      
      // Nueva página si es necesario
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        currentPage++;
        yPosition = 30;
      }
    });
    
    // Footer
    pdf.setFillColor(30, 41, 59);
    pdf.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.text('© 2025 Kryotec - Sistema de Gestión de Sugerencias', 20, pageHeight - 10);
    pdf.text(`Página ${currentPage}`, pageWidth - 40, pageHeight - 10);
    
    // Descargar el PDF
    pdf.save(`Kryotec_Sugerencias_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateIndividualPDF = async (sugerencia: any) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Header con logo de Kryotec
    pdf.setFillColor(30, 41, 59); // bg-slate-800
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    // Título principal
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('KRYOTEC', 20, 25);
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Reporte de Sugerencia Individual', 20, 35);
    
    // Fecha - Ajustado el espaciado
    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(10);
    const fecha = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    pdf.text(`Generado el: ${fecha}`, pageWidth - 80, 25);
    
    let yPosition = 60;
    
    // Información de la sugerencia
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Detalle de Sugerencia', 20, yPosition);
    yPosition += 20;
    
    // Datos de la sugerencia
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cliente:', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(sugerencia.nombre_cliente || 'N/A', 80, yPosition);
    yPosition += 15;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Modelo Sugerido:', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(sugerencia.modelo_sugerido || 'N/A', 80, yPosition);
    yPosition += 15;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cantidad:', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(sugerencia.cantidad_sugerida?.toString() || '0', 80, yPosition);
    yPosition += 15;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Estado:', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    
    // Estado con color
    const estado = sugerencia.estado || 'pendiente';
    if (estado === 'completado') {
      pdf.setTextColor(34, 197, 94); // text-green-500
    } else if (estado === 'pendiente') {
      pdf.setTextColor(251, 191, 36); // text-yellow-500
    } else {
      pdf.setTextColor(239, 68, 68); // text-red-500
    }
    pdf.text(estado, 80, yPosition);
    yPosition += 15;
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Fecha de Sugerencia:', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    const fechaSugerencia = sugerencia.fecha_sugerencia 
      ? new Date(sugerencia.fecha_sugerencia).toLocaleDateString('es-ES')
      : 'N/A';
    pdf.text(fechaSugerencia, 80, yPosition);
    
    // Footer
    pdf.setFillColor(30, 41, 59);
    pdf.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.text('© 2025 Kryotec - Sistema de Gestión de Sugerencias', 20, pageHeight - 10);
    pdf.text('Página 1', pageWidth - 40, pageHeight - 10);
    
    // Descargar el PDF
    const nombreCliente = sugerencia.nombre_cliente?.replace(/\s+/g, '_') || 'Cliente';
    const fechaArchivo = new Date().toISOString().split('T')[0];
    pdf.save(`Kryotec_Sugerencia_${nombreCliente}_${fechaArchivo}.pdf`);
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
                  readOnly={!!selectedInventario}
                  className={`w-full p-3 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 ${
                    selectedInventario 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-gray-700'
                  }`}
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
                  readOnly={!!selectedInventario}
                  className={`w-full p-3 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 ${
                    selectedInventario 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-gray-700'
                  }`}
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
                  readOnly={!!selectedInventario}
                  className={`w-full p-3 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 ${
                    selectedInventario 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-gray-700'
                  }`}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cantidad
              </label>
              <input
                type="number"
                value={selectedInventario ? (inventario.find(inv => inv.inv_id === Number(selectedInventario))?.cantidad || 0) : ''}
                readOnly
                className="w-full p-3 bg-gray-600 border border-gray-600 rounded-lg text-white cursor-not-allowed"
                placeholder="Seleccione un item del inventario"
              />
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
                readOnly={!!selectedInventario}
                className={`w-full p-3 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 ${
                  selectedInventario 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-gray-700'
                }`}
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
                      {/* Agregar el mensaje de comparación */}
                      {resultado.mensaje_comparacion && (
                        <p className="text-blue-400 text-sm mt-1 font-medium">
                          {resultado.mensaje_comparacion}
                        </p>
                      )}
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
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <Clock className="text-yellow-400" size={24} />
            <h2 className="text-xl font-semibold">Historial de Sugerencias</h2>
          </div>
          <button
            onClick={generatePDF}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            title="Descargar PDF"
          >
            <Download size={16} />
            Descargar PDF
          </button>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateIndividualPDF(sugerencia)}
                          className="text-blue-400 hover:text-blue-300 transition-colors p-1 rounded"
                          title="Descargar PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSugerencia(sugerencia.sugerencia_id)}
                          className="text-red-400 hover:text-red-300 transition-colors p-1 rounded"
                          title="Eliminar sugerencia"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
