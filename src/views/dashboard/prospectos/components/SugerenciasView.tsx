import React, { useState, useEffect } from 'react';
import { useSugerenciasController } from '../../../../controllers/hooks/useSugerenciasController';
import { useClienteProspectoController } from '../../../../controllers/hooks/useClienteProspectoController';
import { useInventarioProspectoController } from '../../../../controllers/hooks/useInventarioProspectoController';
import { Calculator, Package, CheckCircle, Clock, AlertCircle, Trash2, Download, Filter, Users, LayoutGrid, List } from 'lucide-react';
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
  const [clienteHistorialFilter, setClienteHistorialFilter] = useState<number | ''>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Estados para cálculo por orden de despacho
  const [calculoPorOrden, setCalculoPorOrden] = useState(false);
  const [ordenesDespacho, setOrdenesDespacho] = useState<any[]>([]);
  const [selectedOrden, setSelectedOrden] = useState<string>('');
  const [productosOrden, setProductosOrden] = useState<any[]>([]);
  
  // Estados para precios de alquiler
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [preciosAlquiler, setPreciosAlquiler] = useState<{ [key: string]: string }>({});
  const [pdfType, setPdfType] = useState<'general' | 'cliente'>('general');
  const [productosUnicos, setProductosUnicos] = useState<string[]>([]);

  // Filtrar sugerencias por cliente seleccionado
  const filteredSugerencias = clienteHistorialFilter 
    ? sugerencias.filter(s => s.cliente_id === Number(clienteHistorialFilter))
    : sugerencias;

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
        setVolumenRequerido(item.volumen_total_m3_producto?.toString() || '');
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

  // Cargar órdenes de despacho cuando se activa el modo por orden
  useEffect(() => {
    if (calculoPorOrden) {
      cargarOrdenesDespacho();
    }
  }, [calculoPorOrden]);

  // Cargar productos cuando se selecciona una orden
  useEffect(() => {
    if (selectedOrden && calculoPorOrden) {
      cargarProductosOrden(selectedOrden);
    }
  }, [selectedOrden, calculoPorOrden]);

  const cargarOrdenesDespacho = async () => {
    try {
      const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';
      const response = await fetch(`${API_URL}/inventario-prospectos/ordenes-despacho`);
      if (response.ok) {
        const ordenes = await response.json();
        setOrdenesDespacho(ordenes);
      }
    } catch (error) {
      console.error('Error al cargar órdenes de despacho:', error);
    }
  };

  const cargarProductosOrden = async (ordenDespacho: string) => {
    try {
      const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';
      const response = await fetch(`${API_URL}/inventario-prospectos/orden/${encodeURIComponent(ordenDespacho)}`);
      if (response.ok) {
        const productos = await response.json();
        setProductosOrden(productos);
      }
    } catch (error) {
      console.error('Error al cargar productos de la orden:', error);
    }
  };

  const handleCalcular = async () => {
    if (calculoPorOrden) {
      // Cálculo por orden de despacho
      if (!selectedCliente || !selectedOrden) {
        alert('Por favor seleccione un cliente y una orden de despacho');
        return;
      }
      
      setCalculando(true);
      try {
        const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';
        const response = await fetch(`${API_URL}/sugerencias/calcular-por-orden`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cliente_id: Number(selectedCliente),
            orden_despacho: selectedOrden
          }),
        });
        
        if (response.ok) {
          const sugerencias = await response.json();
          setResultados(sugerencias);
        } else {
          alert('Error al calcular sugerencias por orden');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Error al calcular sugerencias');
      } finally {
        setCalculando(false);
      }
      return;
    }

    // Cálculo individual original
    if (!selectedCliente || !selectedInventario || !dimensiones.frente || !dimensiones.profundo || !dimensiones.alto) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    // Validar que las dimensiones sean números válidos
    const frente = parseFloat(dimensiones.frente);
    const profundo = parseFloat(dimensiones.profundo);
    const alto = parseFloat(dimensiones.alto);

    if (isNaN(frente) || isNaN(profundo) || isNaN(alto) || frente <= 0 || profundo <= 0 || alto <= 0) {
      alert('Por favor ingrese dimensiones válidas (números mayores a 0)');
      return;
    }

    setCalculando(true);
    try {
      // Obtener la cantidad del item de inventario seleccionado
      const item = inventario.find((inv: InventarioProspecto) => inv.inv_id === Number(selectedInventario));
      const cantidadCajas = item?.cantidad_despachada || 1;

      const calculo: CalculoSugerencia = {
        cliente_id: Number(selectedCliente),
        inv_id: Number(selectedInventario),
        volumen_requerido: Number(volumenRequerido) || 0,
        cantidad: cantidadCajas, // Agregar la cantidad de cajas
        dimensiones_requeridas: {
          frente: frente, // Ahora en mm
          profundo: profundo, // Ahora en mm
          alto: alto // Ahora en mm
        }
      };

      console.log('Enviando datos de cálculo:', calculo);
      const resultadosCalculo = await calcularSugerencias(calculo);
      console.log('Resultados recibidos:', resultadosCalculo);
      setResultados(resultadosCalculo);
    } catch (err) {
      console.error('Error al calcular sugerencias:', err);
      alert('Error al calcular sugerencias. Por favor intente nuevamente.');
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

  const handleGuardarSugerenciaOrden = async (resultado: ResultadoSugerencia) => {
    try {
      // Para orden de despacho, guardar una sugerencia por cada producto en la orden
      const promesasGuardado = productosOrden.map(async (producto) => {
        return createSugerencia({
          cliente_id: Number(selectedCliente),
          inv_id: Number(producto.inv_id),
          modelo_sugerido: resultado.nombre_modelo,
          cantidad_sugerida: Math.ceil(resultado.cantidad_sugerida / productosOrden.length), // Distribuir proporcionalmente
          modalidad: 'calculadora_orden',
          modelo_id: resultado.modelo_id,
          estado: 'pendiente'
        });
      });
      
      await Promise.all(promesasGuardado);
      alert(`Sugerencia guardada exitosamente para ${productosOrden.length} productos de la orden`);
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
    setSelectedOrden('');
    setProductosOrden([]);
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

  // Función para obtener productos únicos de las sugerencias
  const getProductosUnicos = (sugerenciasToCheck = sugerencias) => {
    const productos = new Set<string>();
    sugerenciasToCheck.forEach(sugerencia => {
      const producto = sugerencia.producto || sugerencia.descripcion_inventario || 'N/A';
      if (producto !== 'N/A') {
        productos.add(producto);
      }
    });
    return Array.from(productos);
  };

  // Función para abrir modal de precios
  const handlePDFWithPrices = (type: 'general' | 'cliente') => {
    const sugerenciasToCheck = type === 'cliente' ? filteredSugerencias : sugerencias;
    
    if (type === 'cliente' && !clienteHistorialFilter) {
      alert('Por favor selecciona un cliente para generar el PDF');
      return;
    }

    if (sugerenciasToCheck.length === 0) {
      alert(type === 'cliente' ? 'Este cliente no tiene sugerencias guardadas' : 'No hay sugerencias para generar PDF');
      return;
    }

    const productos = getProductosUnicos(sugerenciasToCheck);
    setProductosUnicos(productos);
    setPdfType(type);
    
    // Inicializar precios vacíos
    const preciosIniciales: { [key: string]: string } = {};
    productos.forEach(producto => {
      preciosIniciales[producto] = '';
    });
    setPreciosAlquiler(preciosIniciales);
    setShowPriceModal(true);
  };

  // Función para actualizar precio de un producto
  const handlePriceChange = (producto: string, precio: string) => {
    setPreciosAlquiler(prev => ({
      ...prev,
      [producto]: precio
    }));
  };

  // Función para generar PDF con precios
  const generatePDFWithPrices = () => {
    setShowPriceModal(false);
    if (pdfType === 'general') {
      generatePDF();
    } else {
      generateClientePDF();
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
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cliente', 22, yPosition + 7);
    pdf.text('Producto', 45, yPosition + 7);
    pdf.text('Cant.', 70, yPosition + 7);
    pdf.text('Precio Alq.', 85, yPosition + 7);
    pdf.text('Modelo Sugerido', 115, yPosition + 7);
    pdf.text('C.Sug', 170, yPosition + 7);
    pdf.text('Estado', 185, yPosition + 7);
    
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
      
      pdf.setFontSize(7);
      // Truncar textos si son muy largos
      const cliente = sugerencia.nombre_cliente || 'N/A';
      const clienteTruncado = cliente.length > 10 ? cliente.substring(0, 7) + '...' : cliente;
      pdf.text(clienteTruncado, 22, yPosition + 2);
      
      const producto = sugerencia.producto || sugerencia.descripcion_inventario || 'N/A';
      const productoTruncado = producto.length > 10 ? producto.substring(0, 7) + '...' : producto;
      pdf.text(productoTruncado, 45, yPosition + 2);
      
      pdf.text(sugerencia.cantidad_inventario?.toString() || '0', 70, yPosition + 2);
      
      // Precio de alquiler
      const precioAlquiler = preciosAlquiler[producto] || 'N/A';
      const precioTruncado = precioAlquiler.length > 8 ? precioAlquiler.substring(0, 5) + '...' : precioAlquiler;
      pdf.text(precioTruncado, 85, yPosition + 2);
      
      // Modelo completo sin truncar
      const modelo = sugerencia.modelo_sugerido || 'N/A';
      pdf.text(modelo, 115, yPosition + 2);
      
      pdf.text(sugerencia.cantidad_sugerida?.toString() || '0', 170, yPosition + 2);
      
      // Estado con color
      const estado = sugerencia.estado || 'pendiente';
      if (estado === 'completado') {
        pdf.setTextColor(34, 197, 94); // text-green-500
      } else if (estado === 'pendiente') {
        pdf.setTextColor(251, 191, 36); // text-yellow-500
      } else {
        pdf.setTextColor(239, 68, 68); // text-red-500
      }
      pdf.text(estado, 185, yPosition + 2);
      
      pdf.setTextColor(0, 0, 0);
      
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

  const generateClientePDF = async () => {
    if (!clienteHistorialFilter) {
      alert('Por favor selecciona un cliente para generar el PDF');
      return;
    }

    const clienteSeleccionado = clientes.find(c => c.cliente_id === Number(clienteHistorialFilter));
    const sugerenciasCliente = filteredSugerencias;

    if (sugerenciasCliente.length === 0) {
      alert('Este cliente no tiene sugerencias guardadas');
      return;
    }

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
    pdf.text(`Reporte de Cliente: ${clienteSeleccionado?.nombre_cliente}`, 20, 35);
    
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
    
    // Información del cliente
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Información del Cliente', 20, yPosition);
    yPosition += 15;
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nombre: ${clienteSeleccionado?.nombre_cliente}`, 20, yPosition);
    yPosition += 10;
    pdf.text(`Contacto: ${clienteSeleccionado?.contacto || 'N/A'}`, 20, yPosition);
    yPosition += 10;
    pdf.text(`Email: ${clienteSeleccionado?.correo || 'N/A'}`, 20, yPosition);
    yPosition += 10;
    pdf.text(`Teléfono: ${clienteSeleccionado?.telefono || 'N/A'}`, 20, yPosition);
    yPosition += 20;
    
    // Título de sugerencias
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Sugerencias (${sugerenciasCliente.length} registros)`, 20, yPosition);
    yPosition += 15;
    
    // Headers de la tabla
    pdf.setFillColor(59, 130, 246); // bg-blue-500
    pdf.rect(20, yPosition, pageWidth - 40, 10, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Producto', 25, yPosition + 7);
    pdf.text('Cant.', 55, yPosition + 7);
    pdf.text('Precio Alq.', 70, yPosition + 7);
    pdf.text('Modelo Sugerido', 100, yPosition + 7);
    pdf.text('C.Sug', 155, yPosition + 7);
    pdf.text('Estado', 175, yPosition + 7);
    
    yPosition += 15;
    
    // Datos de las sugerencias del cliente
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    
    sugerenciasCliente.forEach((sugerencia, index) => {
      // Alternar colores de fila
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252); // bg-slate-50
        pdf.rect(20, yPosition - 5, pageWidth - 40, 10, 'F');
      }
      
      pdf.setFontSize(7);
      // Truncar texto del producto si es muy largo
      const producto = sugerencia.producto || sugerencia.descripcion_inventario || 'N/A';
      const productoTruncado = producto.length > 12 ? producto.substring(0, 9) + '...' : producto;
      pdf.text(productoTruncado, 25, yPosition + 2);
      
      pdf.text(sugerencia.cantidad_inventario?.toString() || '0', 55, yPosition + 2);
      
      // Precio de alquiler
      const precioAlquiler = preciosAlquiler[producto] || 'N/A';
      const precioTruncado = precioAlquiler.length > 10 ? precioAlquiler.substring(0, 7) + '...' : precioAlquiler;
      pdf.text(precioTruncado, 70, yPosition + 2);
      
      // Modelo completo sin truncar
      const modelo = sugerencia.modelo_sugerido || 'N/A';
      pdf.text(modelo, 100, yPosition + 2);
      
      pdf.text(sugerencia.cantidad_sugerida?.toString() || '0', 155, yPosition + 2);
      
      // Estado con color
      const estado = sugerencia.estado || 'pendiente';
      if (estado === 'completado') {
        pdf.setTextColor(34, 197, 94); // text-green-500
      } else if (estado === 'pendiente') {
        pdf.setTextColor(251, 191, 36); // text-yellow-500
      } else {
        pdf.setTextColor(239, 68, 68); // text-red-500
      }
      pdf.text(estado, 175, yPosition + 2);
      
      pdf.setTextColor(0, 0, 0);
      
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
    const nombreCliente = clienteSeleccionado?.nombre_cliente.replace(/\s+/g, '_') || 'Cliente';
    pdf.save(`Kryotec_Cliente_${nombreCliente}_${new Date().toISOString().split('T')[0]}.pdf`);
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
    pdf.text('Nombre del Producto:', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(sugerencia.producto || sugerencia.descripcion_inventario || 'N/A', 80, yPosition);
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
            {/* Selector de Modo de Cálculo */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo de Cálculo
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipoCalculo"
                    checked={!calculoPorOrden}
                    onChange={() => {
                      setCalculoPorOrden(false);
                      setSelectedOrden('');
                      setProductosOrden([]);
                    }}
                    className="mr-2 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white">Por Producto Individual</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipoCalculo"
                    checked={calculoPorOrden}
                    onChange={() => {
                      setCalculoPorOrden(true);
                      setSelectedInventario('');
                    }}
                    className="mr-2 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white">Por Orden de Despacho</span>
                </label>
              </div>
            </div>

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

            {calculoPorOrden ? (
              /* Modo: Cálculo por Orden de Despacho */
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Orden de Despacho *
                </label>
                <select
                  value={selectedOrden}
                  onChange={(e) => setSelectedOrden(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar orden...</option>
                  {ordenesDespacho.map(orden => (
                    <option key={orden.orden_despacho} value={orden.orden_despacho}>
                      {orden.orden_despacho} ({orden.cantidad_productos} productos, {(parseFloat(orden.volumen_total) || 0).toFixed(3)} m³)
                    </option>
                  ))}
                </select>
                
                {/* Mostrar resumen de productos en la orden */}
                {productosOrden.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                    <h4 className="font-medium text-white mb-2">Productos en la orden:</h4>
                    <div className="space-y-1 text-sm text-gray-300">
                      {productosOrden.map(producto => (
                        <div key={producto.inv_id} className="flex justify-between">
                          <span>{producto.producto} - {producto.descripcion_producto}</span>
                          <span>{producto.cantidad_despachada} unidades</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-600 font-medium text-white">
                      Total: {productosOrden.reduce((sum, p) => sum + (parseInt(p.cantidad_despachada) || 0), 0)} productos
                      {' | '}
                      {productosOrden.reduce((sum, p) => sum + (parseFloat(p.volumen_total_m3_producto) || 0), 0).toFixed(3)} m³
                    </div>
                  </div>
                )}

                {/* Botón Calcular para orden de despacho */}
                {selectedCliente && selectedOrden && (
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
                )}
              </div>
            ) : (
              /* Modo: Cálculo Individual */
              <>
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
                    {item.descripcion_producto} - {item.producto}
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
                value={selectedInventario ? (inventario.find(inv => inv.inv_id === Number(selectedInventario))?.cantidad_despachada || 0) : ''}
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
            </>
            )}
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
                <div key={index} className={`rounded-lg p-4 border ${
                  resultado.es_mejor_opcion 
                    ? 'bg-gradient-to-r from-green-900/50 to-green-800/50 border-green-500' 
                    : 'bg-gray-700 border-gray-600'
                }`}>
                  {/* Etiqueta de mejor opción */}
                  {resultado.etiqueta_recomendacion && (
                    <div className="mb-2">
                      <span className="bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold">
                        {resultado.etiqueta_recomendacion}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{resultado.nombre_modelo}</h3>
                      <p className="text-gray-400 text-sm">Cantidad sugerida: {resultado.cantidad_sugerida} unidades</p>
                      
                      {/* Mensaje de comparación mejorado */}
                      {resultado.mensaje_comparacion && (
                        <p className="text-blue-400 text-sm mt-1 font-medium">
                          {resultado.mensaje_comparacion}
                        </p>
                      )}
                      
                      {/* Recomendación */}
                      {(resultado.recomendacion_nivel || resultado.recomendacion) && (
                        <p className={`text-xs mt-1 font-medium ${
                          (resultado.recomendacion_nivel || resultado.nivel_recomendacion || resultado.recomendacion || '').includes('EXCELENTE') ? 'text-green-400' :
                          (resultado.recomendacion_nivel || resultado.nivel_recomendacion || resultado.recomendacion || '').includes('RECOMENDADO') ? 'text-blue-400' :
                          (resultado.recomendacion_nivel || resultado.nivel_recomendacion || resultado.recomendacion || '').includes('ACEPTABLE') ? 'text-yellow-400' :
                          (resultado.recomendacion_nivel || resultado.nivel_recomendacion || resultado.recomendacion || '').includes('NO RECOMENDADO') ? 'text-orange-400' : 'text-red-400'
                        }`}>
                          {resultado.recomendacion_nivel || resultado.recomendacion}
                        </p>
                      )}
                      
                      {/* Detalle del espacio */}
                      {resultado.detalle_espacio && (
                        <p className="text-gray-500 text-xs mt-1">
                          {resultado.detalle_espacio}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-white px-2 py-1 rounded text-sm ${
                        ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 95 ? 'bg-green-600' :
                        ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 85 ? 'bg-blue-600' :
                        ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 70 ? 'bg-yellow-600' :
                        ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 50 ? 'bg-orange-600' : 'bg-red-600'
                      }`}>
                        {((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0).toFixed(1)}% eficiencia
                      </div>
                      {(resultado.recomendacion_nivel || resultado.nivel_recomendacion) && (
                        <div className={`text-xs mt-1 px-2 py-1 rounded ${
                          (resultado.recomendacion_nivel || resultado.nivel_recomendacion || '').includes('EXCELENTE') ? 'bg-green-800 text-green-200' :
                          (resultado.recomendacion_nivel || resultado.nivel_recomendacion || '').includes('RECOMENDADO') || 
                          (resultado.recomendacion_nivel || resultado.nivel_recomendacion || '') === 'BUENO' ? 'bg-blue-800 text-blue-200' :
                          (resultado.recomendacion_nivel || resultado.nivel_recomendacion || '').includes('ACEPTABLE') ? 'bg-yellow-800 text-yellow-200' :
                          (resultado.recomendacion_nivel || resultado.nivel_recomendacion || '').includes('NO RECOMENDADO') ||
                          (resultado.recomendacion_nivel || resultado.nivel_recomendacion || '') === 'MALO' ? 'bg-orange-800 text-orange-200' : 'bg-red-800 text-red-200'
                        }`}>
                          {resultado.recomendacion_nivel || resultado.nivel_recomendacion}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Dimensiones internas:</p>
                      <p className="text-white">
                        {resultado.dimensiones_internas ? 
                          `${resultado.dimensiones_internas.frente} × ${resultado.dimensiones_internas.profundo} × ${resultado.dimensiones_internas.alto} mm` :
                          'No disponible'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Volumen:</p>
                      <p className="text-white">{resultado.volumen_litros || 'No disponible'} litros</p>
                    </div>
                  </div>
                  
                  {/* Información adicional sobre espacio */}
                  {resultado.espacio_sobrante_m3 !== undefined && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-gray-400">Espacio utilizado:</p>
                          <p className="text-white">{(resultado.volumen_total_productos * 1000).toFixed(1)} litros</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Espacio sobrante:</p>
                          <p className={`${resultado.espacio_sobrante_m3 > 0.001 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {(resultado.espacio_sobrante_m3 * 1000).toFixed(1)} litros ({(resultado.porcentaje_espacio_sobrante || 0).toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => calculoPorOrden ? handleGuardarSugerenciaOrden(resultado) : handleGuardarSugerencia(resultado)}
                    className={`w-full mt-4 py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      resultado.es_mejor_opcion 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    <CheckCircle size={16} />
                    {resultado.es_mejor_opcion ? 'Seleccionar Mejor Opción' : 'Guardar Sugerencia'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Historial de Sugerencias */}
      <div className="bg-gray-800 rounded-lg p-6 mt-8">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <Clock className="text-yellow-400" size={24} />
            <h2 className="text-xl font-semibold">Historial de Sugerencias</h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Filtro por cliente */}
            <div className="flex items-center gap-2">
              <Users className="text-gray-400" size={16} />
              <select
                value={clienteHistorialFilter}
                onChange={(e) => setClienteHistorialFilter(e.target.value as any)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los clientes</option>
                {clientes.map(cliente => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id}>
                    {cliente.nombre_cliente}
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle de vista */}
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
            
            {/* Botones de descarga */}
            <div className="flex gap-2">
              {clienteHistorialFilter && (
                <button
                  onClick={() => handlePDFWithPrices('cliente')}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                  title="Descargar PDF del cliente seleccionado"
                >
                  <Users size={16} />
                  PDF Cliente
                </button>
              )}
              <button
                onClick={() => handlePDFWithPrices('general')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                title="Descargar PDF completo"
              >
                <Download size={16} />
                PDF Completo
              </button>
            </div>
          </div>
        </div>

        {/* Mostrar información del filtro activo */}
        {clienteHistorialFilter && (
          <div className="mb-4 p-3 bg-blue-900/50 border border-blue-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="text-blue-400" size={16} />
                <span className="text-blue-300 text-sm">
                  Mostrando sugerencias de: <strong>{clientes.find(c => c.cliente_id === Number(clienteHistorialFilter))?.nombre_cliente}</strong>
                </span>
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  {filteredSugerencias.length} registros
                </span>
              </div>
              <button
                onClick={() => setClienteHistorialFilter('')}
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                Limpiar filtro
              </button>
            </div>
          </div>
        )}
        
        {loading === 'loading' ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-400 py-8">
            <AlertCircle size={48} className="mx-auto mb-4" />
            <p>{error}</p>
          </div>
        ) : filteredSugerencias.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>{clienteHistorialFilter ? 'Este cliente no tiene sugerencias guardadas' : 'No hay sugerencias guardadas'}</p>
          </div>
        ) : viewMode === 'cards' ? (
          /* Vista de tarjetas */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSugerencias.map((sugerencia) => (
              <div 
                key={sugerencia.sugerencia_id} 
                className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-700 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Cabecera de la tarjeta con gradiente */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 relative">
                  <div className="absolute top-4 right-4 bg-white/20 p-2 rounded-full">
                    <Package size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white truncate pr-8">{sugerencia.modelo_sugerido || 'Sin modelo'}</h3>
                  <p className="text-blue-100 text-sm flex items-center gap-1 mb-1">
                    <Users size={14} />
                    {sugerencia.nombre_cliente || 'N/A'}
                  </p>
                  <p className="text-blue-100 text-xs opacity-90 truncate">
                    Producto: {sugerencia.producto || sugerencia.descripcion_inventario || 'N/A'}
                  </p>
                  {sugerencia.cantidad_inventario && (
                    <p className="text-blue-100 text-xs opacity-90">
                      Cantidad: {sugerencia.cantidad_inventario} unidades
                    </p>
                  )}
                </div>
                
                {/* Contenido principal */}
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-200">
                      x{sugerencia.cantidad_sugerida || 0}
                    </div>
                    <div className={`rounded-full px-3 py-1 text-sm font-medium ${
                      sugerencia.estado === 'aprobada' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      sugerencia.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {sugerencia.estado || 'pendiente'}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Modalidad:</span>
                      <span className="text-white text-sm">
                        {sugerencia.modalidad || 'N/A'}
                      </span>
                    </div>
                    {sugerencia.cantidad_inventario && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Cant. Productos:</span>
                        <span className="text-white text-sm">
                          {sugerencia.cantidad_inventario} unidades
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Fecha:</span>
                      <span className="text-white text-sm">
                        {sugerencia.fecha_sugerencia ? new Date(sugerencia.fecha_sugerencia).toLocaleDateString('es-ES') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Pie de tarjeta con acciones */}
                <div className="border-t border-gray-700 bg-gray-900 px-4 py-3 flex justify-between">
                  <button
                    onClick={() => generateIndividualPDF(sugerencia)}
                    className="p-2 rounded-full bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                    title="Descargar PDF"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteSugerencia(sugerencia.sugerencia_id)}
                    className="p-2 rounded-full bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
                    title="Eliminar sugerencia"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Vista de tabla */
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cant. Productos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Modelo Sugerido</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {filteredSugerencias.map((sugerencia) => (
                  <tr key={sugerencia.sugerencia_id} className="hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {sugerencia.nombre_cliente || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {sugerencia.producto || sugerencia.descripcion_inventario || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {sugerencia.cantidad_inventario || '0'}
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
      
      {/* Modal para agregar precios de alquiler */}
      {showPriceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Agregar Precios de Alquiler
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Ingresa el precio de alquiler para cada producto. Puedes omitir productos dejando el campo vacío.
            </p>
            
            <div className="space-y-4 mb-6">
              {productosUnicos.map((producto) => (
                <div key={producto} className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {producto}
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: $150/día"
                      value={preciosAlquiler[producto] || ''}
                      onChange={(e) => handlePriceChange(producto, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPriceModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={generatePDFWithPrices}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SugerenciasView;
