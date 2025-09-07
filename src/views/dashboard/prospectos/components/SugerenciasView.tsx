import React, { useState, useEffect } from 'react';
import { useSugerenciasController } from '../../../../controllers/hooks/useSugerenciasController';
import { useClienteProspectoController } from '../../../../controllers/hooks/useClienteProspectoController';
import { useInventarioProspectoController } from '../../../../controllers/hooks/useInventarioProspectoController';
import { Calculator, Package, CheckCircle, Clock, AlertCircle, Trash2, Download, Filter, Users, LayoutGrid, List } from 'lucide-react';
import { CalculoSugerencia, ResultadoSugerencia } from '../../../../models/SugerenciasModel';
import { InventarioProspecto } from '../../../../models/InventarioProspectoModel';
import jsPDF from 'jspdf';

const SugerenciasView: React.FC = () => {
  const { sugerencias, total: sugerenciasTotal, loading, error, loadSugerenciasPaginated, calcularSugerencias, createSugerencia, deleteSugerencia } = useSugerenciasController();
  const { clientes } = useClienteProspectoController();
  const { inventario, total, getInventarioByCliente } = useInventarioProspectoController();
  
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
  const [sugPage, setSugPage] = useState(0);
  const sugLimit = 50;
  const [sugSearch, setSugSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Estados para cálculo por orden de despacho
  const [calculoPorOrden, setCalculoPorOrden] = useState(false);
  // Estado para cálculo por rango de fechas
  const [calculoPorRango, setCalculoPorRango] = useState(false);
  const [ordenesDespacho, setOrdenesDespacho] = useState<any[]>([]);
  const [selectedOrden, setSelectedOrden] = useState<string>('');
  const [productosOrden, setProductosOrden] = useState<any[]>([]);
  // Filtro por rango de fechas
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  // Resultado agregado por rango total (suma de m³)
  const [resultadoRangoTotal, setResultadoRangoTotal] = useState<{ resumen: any; sugerencias: ResultadoSugerencia[] } | null>(null);
  // Resumen previo (preview) para rango, mostrado bajo los filtros antes de calcular sugerencias
  const [rangoResumenPreview, setRangoResumenPreview] = useState<{
    total_ordenes: number;
    total_productos: number;
    volumen_total_m3: number;
    startDate?: string;
    endDate?: string;
  } | null>(null);
  const [rangoResumenLoading, setRangoResumenLoading] = useState(false);
  const [rangoResumenError, setRangoResumenError] = useState<string | null>(null);
  // Paginación y búsqueda de órdenes
  const [ordenesPage, setOrdenesPage] = useState(0);
  const ordenesLimit = 50;
  const [ordenesTotal, setOrdenesTotal] = useState(0);
  const [ordenesSearch, setOrdenesSearch] = useState('');
  const [ordenesLoading, setOrdenesLoading] = useState(false);
  
  // Paginación y búsqueda de items
  const [invPage, setInvPage] = useState(0);
  const invLimit = 100;
  const [invSearch, setInvSearch] = useState('');
  const [invLoading, setInvLoading] = useState(false);

  // Estados para precios de alquiler
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [preciosAlquiler, setPreciosAlquiler] = useState<{ [key: string]: string }>({});
  const [pdfType, setPdfType] = useState<'general' | 'cliente' | 'individual'>('general');
  const [productosUnicos, setProductosUnicos] = useState<{
    id: string;
    producto: string;
    descripcion: string;
    modelo_sugerido: string;
    cantidad_sugerida: number;
  }[]>([]);
  
  // Estados para PDF individual
  const [sugerenciaIndividual, setSugerenciaIndividual] = useState<any>(null);

  // Derivados para mostrar resumen del rango total (con llaves alternativas)
  const rangoResumen: any = (resultadoRangoTotal && (resultadoRangoTotal as any).resumen) || null;
  const rangoStart = rangoResumen?.startDate ?? rangoResumen?.start_date ?? rangoResumen?.desde ?? '';
  const rangoEnd = rangoResumen?.endDate ?? rangoResumen?.end_date ?? rangoResumen?.hasta ?? '';
  const rangoTotalProductos = Number(
    rangoResumen?.total_productos ?? rangoResumen?.cantidad_productos ?? rangoResumen?.totalProductos ?? rangoResumen?.cantidad_total ?? 0
  );
  const rangoTotalM3 = Number(
    rangoResumen?.volumen_total_m3 ?? rangoResumen?.volumen_total ?? rangoResumen?.total_m3 ?? rangoResumen?.m3_total ?? 0
  );

  // Filtrar sugerencias por cliente seleccionado
  const filteredSugerencias = sugerencias; // ya se traen paginadas del servidor

  // Cargar historial paginado al montar y cuando cambien filtros
  useEffect(() => {
    const cargar = async () => {
      try {
        await loadSugerenciasPaginated({ limit: sugLimit, offset: sugPage * sugLimit, search: sugSearch, clienteId: clienteHistorialFilter ? Number(clienteHistorialFilter) : null });
      } catch {
        // error ya manejado en hook
      }
    };
    cargar();
  }, [sugPage, sugSearch, clienteHistorialFilter]);

  // Filtrar inventario por cliente seleccionado
  useEffect(() => {
    const cargar = async () => {
      if (selectedCliente) {
        try {
          setInvLoading(true);
          const res = await getInventarioByCliente(Number(selectedCliente), { limit: invLimit, offset: invPage * invLimit, search: invSearch });
          setFilteredInventario(res.items);
          setSelectedInventario('');
        } catch (e) {
          console.error('Error al cargar inventario del cliente:', e);
          setFilteredInventario([]);
        } finally {
          setInvLoading(false);
        }
      } else {
        setFilteredInventario([]);
      }
    };
    cargar();
  }, [selectedCliente, invPage, invSearch]);

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

  // Cargar órdenes de despacho cuando se activa el modo por orden o cambia el cliente
  useEffect(() => {
    if (calculoPorOrden && selectedCliente) {
      cargarOrdenesDespacho(Number(selectedCliente), ordenesPage, ordenesSearch);
    } else if (calculoPorOrden && !selectedCliente) {
      // Limpiar órdenes si no hay cliente seleccionado
      setOrdenesDespacho([]);
      setSelectedOrden('');
      setProductosOrden([]);
    }
  }, [calculoPorOrden, selectedCliente, ordenesPage, ordenesSearch]);

  // Cargar productos cuando se selecciona una orden
  useEffect(() => {
    if (selectedOrden && calculoPorOrden) {
      cargarProductosOrden(selectedOrden);
    }
  }, [selectedOrden, calculoPorOrden]);

  const cargarOrdenesDespacho = async (clienteId: number, page = 0, search = '') => {
    try {
      const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';
      setOrdenesLoading(true);
      const params = new URLSearchParams({
        cliente_id: String(clienteId),
        limit: String(ordenesLimit),
        offset: String(page * ordenesLimit),
        ...(search ? { search } : {})
      });
      const response = await fetch(`${API_URL}/inventario-prospectos/ordenes-despacho?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setOrdenesDespacho(data.items || []);
        setOrdenesTotal(data.total || 0);
      } else {
        console.error('Error al cargar órdenes de despacho:', response.statusText);
        setOrdenesDespacho([]);
        setOrdenesTotal(0);
      }
    } catch (error) {
      console.error('Error al cargar órdenes de despacho:', error);
      setOrdenesDespacho([]);
      setOrdenesTotal(0);
    } finally {
      setOrdenesLoading(false);
    }
  };

  // Eliminado cálculo por rango agrupado; se usa solo rango total

  // Preview automático del resumen por rango (órdenes, productos, m3) al seleccionar cliente y fechas
  useEffect(() => {
    // Solo ejecutar en modo rango y cuando existan filtros completos
    if (!calculoPorRango || !selectedCliente || !startDate || !endDate) {
      setRangoResumenPreview(null);
      setRangoResumenError(null);
      setRangoResumenLoading(false);
      return;
    }

    const controller = new AbortController();
    setRangoResumenLoading(true);
    setRangoResumenError(null);

    const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';

    // Debounce breve para no disparar múltiples requests al tipear
    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(`${API_URL}/sugerencias/calcular-por-rango-total`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente_id: Number(selectedCliente), startDate, endDate }),
          signal: controller.signal
        });
        if (!resp.ok) throw new Error('Error obteniendo resumen');
        const data = await resp.json();
        const resumen = data.resumen || {};
        setRangoResumenPreview({
          total_ordenes: Number(resumen.total_ordenes ?? 0),
          total_productos: Number(resumen.total_productos ?? 0),
          volumen_total_m3: Number(resumen.volumen_total_m3 ?? 0),
          startDate: resumen.startDate ?? resumen.start_date ?? startDate,
          endDate: resumen.endDate ?? resumen.end_date ?? endDate,
        });
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          setRangoResumenError('No se pudo obtener el resumen del rango.');
          setRangoResumenPreview(null);
        }
      } finally {
        setRangoResumenLoading(false);
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [calculoPorRango, selectedCliente, startDate, endDate]);

  const handleCalcularPorRangoTotal = async () => {
    if (!selectedCliente || !startDate || !endDate) {
      alert('Seleccione cliente y rango de fechas');
      return;
    }
    setCalculando(true);
    try {
      const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';
      const resp = await fetch(`${API_URL}/sugerencias/calcular-por-rango-total`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: Number(selectedCliente), startDate, endDate })
      });
      if (!resp.ok) throw new Error('Error en cálculo por rango total');
      const data = await resp.json();
      const sugs = (data.sugerencias || []) as ResultadoSugerencia[];
      const ordenados = [...sugs].sort((a: any, b: any) => ((b.porcentaje_recomendacion ?? b.eficiencia_porcentaje ?? b.eficiencia ?? 0) - (a.porcentaje_recomendacion ?? a.eficiencia_porcentaje ?? a.eficiencia ?? 0)));
  setResultadoRangoTotal({ resumen: data.resumen, sugerencias: ordenados });
      setResultados([]);
    } catch (e) {
      console.error(e);
      alert('No se pudieron calcular recomendaciones por rango total');
    } finally {
      setCalculando(false);
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
          // Ordenar de mayor a menor eficiencia por seguridad
          const ordenados = [...sugerencias].sort((a: any, b: any) => ((b.porcentaje_recomendacion ?? b.eficiencia_porcentaje ?? b.eficiencia ?? 0) - (a.porcentaje_recomendacion ?? a.eficiencia_porcentaje ?? a.eficiencia ?? 0)));
          setResultados(ordenados);
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
  const ordenados = [...resultadosCalculo].sort((a: any, b: any) => ((b.porcentaje_recomendacion ?? b.eficiencia_porcentaje ?? b.eficiencia ?? 0) - (a.porcentaje_recomendacion ?? a.eficiencia_porcentaje ?? a.eficiencia ?? 0)));
  setResultados(ordenados);
    } catch (err) {
      console.error('Error al calcular sugerencias:', err);
      alert('Error al calcular sugerencias. Por favor intente nuevamente.');
    } finally {
      setCalculando(false);
    }
  };

  const handleGuardarSugerencia = async (resultado: ResultadoSugerencia) => {
    try {
      // Verificar si ya existe una sugerencia con los mismos datos
      const existeSugerencia = sugerencias.some(s => 
        s.cliente_id === Number(selectedCliente) &&
        s.inv_id === Number(selectedInventario) &&
        s.modelo_sugerido === resultado.nombre_modelo &&
        s.cantidad_sugerida === resultado.cantidad_sugerida
      );

      if (existeSugerencia) {
        alert('Esta sugerencia ya ha sido guardada anteriormente. No se puede agregar un duplicado.');
        return;
      }

  await createSugerencia({
        cliente_id: Number(selectedCliente),
        inv_id: Number(selectedInventario),
        modelo_sugerido: resultado.nombre_modelo,
        cantidad_sugerida: resultado.cantidad_sugerida,
        modelo_id: resultado.modelo_id,
        estado: 'pendiente'
      });
      
      // Limpiar las recomendaciones después de guardar exitosamente
      setResultados([]);
  // Refrescar historial paginado
  await loadSugerenciasPaginated({ limit: sugLimit, offset: sugPage * sugLimit, search: sugSearch, clienteId: clienteHistorialFilter ? Number(clienteHistorialFilter) : null });
      alert('Sugerencia guardada exitosamente. Las recomendaciones se han limpiado.');
    } catch (err) {
      console.error('Error al guardar sugerencia:', err);
      alert('Error al guardar la sugerencia');
    }
  };

  const handleGuardarSugerenciaOrden = async (resultado: ResultadoSugerencia) => {
    try {
      // Evitar guardar combinaciones (se requiere un único modelo)
      if ((resultado as any).es_combinacion || resultado.modelo_id == null) {
        alert('No se puede guardar una "Combinación de modelos" como sugerencia. Selecciona una opción de un único modelo.');
        return;
      }

      // Detalle por producto calculado en backend (si está disponible)
      let detalleProductos: any[] = (resultado as any).detalle_contenedores_por_producto || [];

      // Fallback: calcular detalle desde resumen y volumen del modelo
      if ((!detalleProductos || detalleProductos.length === 0) && (resultado as any).resumen_productos) {
        const resumen: any[] = (resultado as any).resumen_productos || [];
        const volumenModeloM3: number = (resultado as any).volumen_modelo_m3 || ((resultado as any).volumen_litros ? ((resultado as any).volumen_litros / 1000) : 0);
        if (volumenModeloM3 > 0) {
          detalleProductos = resumen.map((it: any) => {
            const cantidad = Number(it.cantidad || 0);
            const volTotal = (it.volumen_total_producto != null)
              ? Number(it.volumen_total_producto)
              : Number(it.volumen_individual || 0) * cantidad;
            const necesarios = Math.max(1, Math.ceil((volTotal || 0) / volumenModeloM3));
            return {
              inv_id: it.inv_id,
              producto: it.producto,
              descripcion_producto: it.descripcion,
              cantidad_productos: cantidad,
              contenedores_necesarios: necesarios,
              tipo_ajuste: 'volumetrico',
              volumen_total_producto: volTotal
            };
          }).filter((d: any) => d.inv_id);
        }
      }

      if (!detalleProductos || detalleProductos.length === 0) {
        alert('No se pudo determinar el detalle por producto para guardar.');
        return;
      }

      // Evitar duplicados
      const duplicados: string[] = [];
      for (const detalle of detalleProductos) {
        const existeSugerencia = sugerencias.some(s =>
          s.cliente_id === Number(selectedCliente) &&
          s.inv_id === Number(detalle.inv_id) &&
          s.modelo_sugerido === resultado.nombre_modelo &&
          s.cantidad_sugerida === detalle.contenedores_necesarios
        );
        if (existeSugerencia) {
          duplicados.push(detalle.producto || `Producto ID: ${detalle.inv_id}`);
        }
      }
      if (duplicados.length > 0) {
        alert(`Las siguientes sugerencias ya fueron guardadas y no se duplicarán:\n- ${duplicados.join('\n- ')}`);
        return;
      }

      // Guardar una sugerencia por producto
  await Promise.all(detalleProductos.map((detalle: any) => createSugerencia({
        cliente_id: Number(selectedCliente),
        inv_id: Number(detalle.inv_id),
        modelo_sugerido: resultado.nombre_modelo,
        cantidad_sugerida: detalle.contenedores_necesarios,
        modelo_id: resultado.modelo_id,
        estado: 'pendiente'
      })));

      setResultados([]);
  await loadSugerenciasPaginated({ limit: sugLimit, offset: sugPage * sugLimit, search: sugSearch, clienteId: clienteHistorialFilter ? Number(clienteHistorialFilter) : null });
      alert(`Sugerencias guardadas: ${detalleProductos.length} productos.`);
    } catch (err) {
      console.error('Error al guardar sugerencia (orden):', err);
      alert('Error al guardar la sugerencia de la orden');
    }
  };

  const handleGuardarSugerenciaRangoTotal = async (resultado: any) => {
    try {
      if (!selectedCliente) {
        alert('Seleccione un cliente para guardar.');
        return;
      }

      // Solo guardar opciones de un único modelo
      if (resultado?.es_combinacion || resultado?.modelo_id == null) {
        alert('No se puede guardar una "Combinación de modelos" como sugerencia. Selecciona una opción de un único modelo.');
        return;
      }

      // Preferir detalle desde backend
      let detalleProductos: any[] = resultado?.detalle_contenedores_por_producto || [];

      // Fallback con resumen + volumen del modelo
      if ((!detalleProductos || detalleProductos.length === 0) && resultado?.resumen_productos) {
        const resumen: any[] = resultado.resumen_productos || [];
        const volumenModeloM3: number = resultado.volumen_modelo_m3 || (resultado.volumen_litros ? (resultado.volumen_litros / 1000) : 0);
        if (volumenModeloM3 > 0) {
          detalleProductos = resumen.map((it: any) => {
            const cantidad = Number(it.cantidad || 0);
            const volTotal = (it.volumen_total_producto != null)
              ? Number(it.volumen_total_producto)
              : Number(it.volumen_individual || 0) * cantidad;
            const necesarios = Math.max(1, Math.ceil((volTotal || 0) / volumenModeloM3));
            return {
              inv_id: it.inv_id,
              producto: it.producto,
              descripcion_producto: it.descripcion,
              cantidad_productos: cantidad,
              contenedores_necesarios: necesarios,
              tipo_ajuste: 'volumetrico',
              volumen_total_producto: volTotal
            };
          }).filter((d: any) => d.inv_id);
        }
      }

      if (!detalleProductos || detalleProductos.length === 0) {
        alert('No se pudo determinar el detalle por producto para guardar.');
        return;
      }

      // Evitar duplicados existentes
      const aGuardar: any[] = [];
      const duplicados: string[] = [];
      for (const detalle of detalleProductos) {
        const yaExiste = sugerencias.some(s =>
          s.cliente_id === Number(selectedCliente) &&
          s.inv_id === Number(detalle.inv_id) &&
          s.modelo_sugerido === resultado.nombre_modelo &&
          s.cantidad_sugerida === detalle.contenedores_necesarios
        );
        if (yaExiste) {
          duplicados.push(detalle.producto || `Producto ID: ${detalle.inv_id}`);
        } else {
          aGuardar.push(detalle);
        }
      }

      if (aGuardar.length === 0) {
        alert('Todas las sugerencias ya estaban guardadas.');
        return;
      }
      if (duplicados.length > 0) {
        console.warn('Sugerencias duplicadas omitidas:', duplicados);
      }

      // Guardar por producto
  await Promise.all(aGuardar.map((detalle: any) => createSugerencia({
        cliente_id: Number(selectedCliente),
        inv_id: Number(detalle.inv_id),
        modelo_sugerido: resultado.nombre_modelo,
        cantidad_sugerida: detalle.contenedores_necesarios,
        modelo_id: resultado.modelo_id,
        estado: 'pendiente'
      })));

      setResultados([]);
  await loadSugerenciasPaginated({ limit: sugLimit, offset: sugPage * sugLimit, search: sugSearch, clienteId: clienteHistorialFilter ? Number(clienteHistorialFilter) : null });
      alert(`Sugerencias guardadas: ${aGuardar.length} productos.${duplicados.length ? `\nOmitidos por duplicado: ${duplicados.length}` : ''}`);
    } catch (err) {
      console.error('Error al guardar sugerencia (rango):', err);
      alert('Error al guardar las sugerencias del rango');
    }
  };

  const resetForm = () => {
    setSelectedCliente('');
    setSelectedInventario('');
    setDimensiones({ frente: '', profundo: '', alto: '' });
    setVolumenRequerido('');
    setResultados([]); // Limpiar las recomendaciones también
    setSelectedOrden('');
    setProductosOrden([]);
  };

  const handleDeleteSugerencia = async (id: number) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta sugerencia?')) {
      try {
  await deleteSugerencia(id);
  await loadSugerenciasPaginated({ limit: sugLimit, offset: sugPage * sugLimit, search: sugSearch, clienteId: clienteHistorialFilter ? Number(clienteHistorialFilter) : null });
        alert('Sugerencia eliminada exitosamente');
      } catch (err) {
        console.error('Error al eliminar sugerencia:', err);
        alert('Error al eliminar la sugerencia');
      }
    }
  };

  // Función para obtener productos únicos de las sugerencias
  // Generar listado para precios: ahora SIN deduplicar (una fila por sugerencia)
  const getListadoPrecios = (sugerenciasToCheck = sugerencias) => {
    return sugerenciasToCheck.map((s: any) => ({
      id: `id_${s.sugerencia_id}`,
      producto: s.producto || 'N/A',
      descripcion: s.descripcion_inventario || '',
      modelo_sugerido: s.modelo_sugerido || 'N/A',
      cantidad_sugerida: s.cantidad_sugerida || 0,
      orden: s.orden_despacho || ''
    }));
  };

  // Función helper para obtener el precio de alquiler de una sugerencia
  const getPrecioAlquiler = (sugerencia: any) => {
    // Nuevo: priorizar clave por sugerencia_id para permitir precios por cada registro
    const keyById = sugerencia.sugerencia_id ? `id_${sugerencia.sugerencia_id}` : null;
    if (keyById && preciosAlquiler[keyById]) return preciosAlquiler[keyById];
    // Fallback a la clave compuesta anterior si el usuario generó PDFs antiguos
    const producto = sugerencia.producto || 'N/A';
    const descripcion = sugerencia.descripcion_inventario || '';
    const modelo = sugerencia.modelo_sugerido || 'N/A';
    const legacyKey = `${producto}_${descripcion}_${modelo}`;
    return preciosAlquiler[keyById || ''] || preciosAlquiler[legacyKey] || 'N/A';
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

  const productos = getListadoPrecios(sugerenciasToCheck);
    setProductosUnicos(productos);
    setPdfType(type);
    
    // Inicializar precios vacíos usando el ID único
    const preciosIniciales: { [key: string]: string } = {};
    productos.forEach(producto => {
      preciosIniciales[producto.id] = '';
    });
    setPreciosAlquiler(preciosIniciales);
    setShowPriceModal(true);
  };

  // Función para abrir modal de precios para PDF individual
  const handleIndividualPDFWithPrices = (sugerencia: any) => {
    // Crear array con solo esta sugerencia
    const sugerenciasArray = [sugerencia];
  const productos = getListadoPrecios(sugerenciasArray);
    
    setProductosUnicos(productos);
    setPdfType('individual');
    setSugerenciaIndividual(sugerencia);
    
    // Inicializar precios vacíos usando el ID único
    const preciosIniciales: { [key: string]: string } = {};
    productos.forEach(producto => {
      preciosIniciales[producto.id] = '';
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
    } else if (pdfType === 'cliente') {
      generateClientePDF();
    } else if (pdfType === 'individual' && sugerenciaIndividual) {
      generateIndividualPDF(sugerenciaIndividual);
    }
  };

  const generatePDF = async () => {
    // Traer todas las sugerencias (ignorando paginación) para el PDF completo
    const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';
    let allSugerencias = sugerencias;
    try {
      const resp = await fetch(`${API_URL}/sugerencias`);
      if (resp.ok) {
        allSugerencias = await resp.json();
      }
    } catch {}
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
    
        // Fecha - Ajustado el espaciado
        pdf.setTextColor(200, 200, 200);
        pdf.setFontSize(10);
        const fecha = new Date().toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        pdf.text(`Generado el: ${fecha}`, pageWidth - 100, 25);
    
    let yPosition = 60;
    
    // Título de la sección
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Historial de Sugerencias', 20, yPosition);
    yPosition += 15;
    
    // Headers de la tabla con mejor espaciado
    pdf.setFillColor(59, 130, 246); // bg-blue-500
    pdf.rect(20, yPosition, pageWidth - 40, 12, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cliente', 22, yPosition + 8);
    pdf.text('Producto / Descripción', 50, yPosition + 8);
    pdf.text('Cant.', 120, yPosition + 8);
    pdf.text('Precio', 135, yPosition + 8);
    pdf.text('Modelo', 155, yPosition + 8);
    pdf.text('C.Sug', 180, yPosition + 8);
    
    yPosition += 15;
    
  // Datos de las sugerencias
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    
  let totalAlquiler = 0;
  allSugerencias.forEach((sugerencia: any, index: number) => {
      // Alternar colores de fila
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252); // bg-slate-50
        // Aumentar altura para incluir línea de Orden de despacho
        pdf.rect(20, yPosition - 2, pageWidth - 40, 22, 'F');
      }
      
      pdf.setFontSize(8);
      
      // Cliente
      const cliente = sugerencia.nombre_cliente || 'N/A';
      const clienteTruncado = cliente.length > 15 ? cliente.substring(0, 12) + '...' : cliente;
      pdf.text(clienteTruncado, 22, yPosition + 5);
      
      // Producto y descripción en formato más limpio
      const producto = sugerencia.producto || 'N/A';
      const descripcion = sugerencia.descripcion_inventario || '';
      
      // Mostrar producto
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      const productoTruncado = producto.length > 20 ? producto.substring(0, 17) + '...' : producto;
      pdf.text(productoTruncado, 50, yPosition + 3);
      
  // Mostrar descripción en línea separada con estilo diferente
      if (descripcion && descripcion.trim() !== '' && descripcion !== producto) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(80, 80, 80);
        const descripcionTruncada = descripcion.length > 25 ? descripcion.substring(0, 22) + '...' : descripcion;
        pdf.text(descripcionTruncada, 50, yPosition + 11);
        pdf.setTextColor(0, 0, 0);
      }

  // Orden de despacho (debajo de la descripción)
  const orden = sugerencia.orden_despacho || '-';
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  const ordenText = `Orden: ${orden}`;
  pdf.text(ordenText, 50, yPosition + 15);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      
      // Cantidad
      pdf.text(sugerencia.cantidad_inventario?.toString() || '0', 120, yPosition + 5);
      
  // Precio de alquiler
  const precioAlquiler = getPrecioAlquiler(sugerencia);
  const precioDisplay = precioAlquiler === 'N/A' ? '-' : precioAlquiler;
  const precioTruncado = precioDisplay.length > 8 ? precioDisplay.substring(0, 6) + '..' : precioDisplay;
  pdf.text(precioTruncado, 135, yPosition + 5);
  // Sumar al total si es numérico
  const precioNum = parseFloat(precioAlquiler.replace(/[^\d\.]/g, ''));
  if (!isNaN(precioNum)) totalAlquiler += precioNum;
      
      // Modelo sugerido
  const modelo = sugerencia.modelo_sugerido || 'N/A';
  // Mostrar el nombre completo del modelo sin truncar
  pdf.text(modelo, 155, yPosition + 5);
      
      // Cantidad sugerida
      pdf.text(sugerencia.cantidad_sugerida?.toString() || '0', 180, yPosition + 5);
      
  yPosition += 22; // Espacio mayor entre filas para acomodar descripción y orden
      
      // Nueva página si es necesario
  if (yPosition > pageHeight - 30) {
        pdf.addPage();
        currentPage++;
        yPosition = 30;
      }
    });
    
  // Mostrar total de alquiler al final de la tabla
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(59, 130, 246);
  pdf.text(`Total Alquiler: $${totalAlquiler.toFixed(2)}`, 135, yPosition + 8);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');

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
    // Traer todas las sugerencias del cliente (ignorando paginación de UI)
    const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';
    let sugerenciasCliente = filteredSugerencias;
    try {
      const params = new URLSearchParams({ cliente_id: String(clienteSeleccionado?.cliente_id || '') });
      const resp = await fetch(`${API_URL}/sugerencias?${params.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        // Si viene paginado (tiene items), tomar items; si viene array, usarlo
        sugerenciasCliente = Array.isArray(data) ? data : (data.items || []);
      }
    } catch {}

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
  // Mover más a la izquierda
  pdf.text(`Generado el: ${fecha}`, pageWidth - 100, 25);
    
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
    pdf.text('Cant.', 80, yPosition + 7);
    pdf.text('Precio Alq.', 95, yPosition + 7);
    pdf.text('Modelo Sugerido', 125, yPosition + 7);
    pdf.text('C.Sug', 160, yPosition + 7);
    pdf.text('Estado', 175, yPosition + 7);
    
    yPosition += 15;
    
    // Debug: verificar qué sugerencias se van a mostrar
    console.log('Sugerencias para PDF Cliente (total):', sugerenciasCliente.length);
    console.log('Primeras 3 sugerencias del cliente:', sugerenciasCliente.slice(0, 3));
    
    // Datos de las sugerencias del cliente
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    
  let totalAlquilerCliente = 0;
  sugerenciasCliente.forEach((sugerencia, index) => {
      // Debug: Verificar datos de la sugerencia
      console.log('Datos de sugerencia para PDF Cliente:', {
        producto: sugerencia.producto,
        descripcion_inventario: sugerencia.descripcion_inventario,
        index: index
      });
      
      // Alternar colores de fila
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252); // bg-slate-50
        // Aumentar altura para incluir línea de Orden de despacho
        pdf.rect(20, yPosition - 5, pageWidth - 40, 22, 'F');
      }
      
      pdf.setFontSize(7);
      
      // Producto con descripción
      const producto = sugerencia.producto || 'N/A';
      const descripcion = sugerencia.descripcion_inventario || '';
      
      // Mostrar producto en primera línea
      const productoTruncado = producto.length > 18 ? producto.substring(0, 15) + '...' : producto;
      pdf.text(productoTruncado, 25, yPosition + 2);
      
  // Mostrar descripción en segunda línea si existe
      if (descripcion && descripcion.trim() !== '') {
        pdf.setFontSize(6);
        pdf.setTextColor(100, 100, 100);
        const descripcionTruncada = descripcion.length > 20 ? descripcion.substring(0, 17) + '...' : descripcion;
        pdf.text(descripcionTruncada, 25, yPosition + 8);
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(7);
      }

  // Orden de despacho (tercera línea)
  const orden = (sugerencia as any).orden_despacho || '-';
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(6);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Orden: ${orden}`, 25, yPosition + 13);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
      
      pdf.text(sugerencia.cantidad_inventario?.toString() || '0', 80, yPosition + 2);
      
  // Precio de alquiler usando la función helper
  const precioAlquiler = getPrecioAlquiler(sugerencia);
  const precioTruncado = precioAlquiler.length > 10 ? precioAlquiler.substring(0, 7) + '...' : precioAlquiler;
  pdf.text(precioTruncado, 95, yPosition + 2);
  // Sumar al total si es numérico
  const precioNum = parseFloat(precioAlquiler.replace(/[^\d\.]/g, ''));
  if (!isNaN(precioNum)) totalAlquilerCliente += precioNum;
      
      // Modelo sugerido
  const modelo = sugerencia.modelo_sugerido || 'N/A';
  // Mostrar el nombre completo del modelo sin truncar
  pdf.text(modelo, 125, yPosition + 2);
      
      pdf.text(sugerencia.cantidad_sugerida?.toString() || '0', 160, yPosition + 2);
      
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
      pdf.setTextColor(0, 0, 0); // Resetear color
      
  yPosition += 22; // Aumentar espacio entre filas para acomodar la orden
      
      // Nueva página si es necesario
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        currentPage++;
        yPosition = 30;
      }
    });
    
  // Mostrar total de alquiler al final de la tabla
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(59, 130, 246);
  pdf.text(`Total Alquiler: $${totalAlquilerCliente.toFixed(2)}`, 95, yPosition + 8);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');

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
    
    // Agregar descripción si existe y es diferente del nombre del producto
    if (sugerencia.descripcion_inventario && sugerencia.producto && sugerencia.descripcion_inventario !== sugerencia.producto) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Descripción:', 20, yPosition);
      pdf.setFont('helvetica', 'normal');
      
      // Dividir texto largo en múltiples líneas si es necesario
      const descripcion = sugerencia.descripcion_inventario;
      const maxWidth = 100;
      const lines = pdf.splitTextToSize(descripcion, maxWidth);
      
      lines.forEach((line: string, index: number) => {
        pdf.text(line, 80, yPosition + (index * 5));
      });
      
      yPosition += lines.length * 5 + 10;
    }
    
  // Orden de Despacho
  pdf.setFont('helvetica', 'bold');
  pdf.text('Orden de Despacho:', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(sugerencia.orden_despacho || '-', 80, yPosition);
  yPosition += 15;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Modelo Sugerido:', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(sugerencia.modelo_sugerido || 'N/A', 80, yPosition);
  yPosition += 15;
    
    // Precio de alquiler
    pdf.setFont('helvetica', 'bold');
    pdf.text('Precio de Alquiler:', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    const precioAlquiler = getPrecioAlquiler(sugerencia);
    pdf.text(precioAlquiler, 80, yPosition);
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
    <div className="p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-800 dark:text-white">Calculadora de Sugerencias</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Encuentra el modelo perfecto de Credocube para tus clientes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Panel de Cálculo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <Calculator className="text-blue-500 dark:text-blue-400" size={24} />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Calculadora</h2>
          </div>

          <div className="space-y-4">
            {/* Selector de Modo de Cálculo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Cálculo
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipoCalculo"
                    checked={!calculoPorOrden && !calculoPorRango}
                    onChange={() => {
                      setCalculoPorOrden(false);
                      setCalculoPorRango(false);
                      setSelectedOrden('');
                      setProductosOrden([]);
                    }}
                    className="mr-2 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-gray-900 dark:text-white">Por Producto Individual</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipoCalculo"
                    checked={calculoPorOrden}
                    onChange={() => {
                      setCalculoPorOrden(true);
                      setCalculoPorRango(false);
                      setSelectedInventario('');
                    }}
                    className="mr-2 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-gray-900 dark:text-white">Por Orden de Despacho</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipoCalculo"
                    checked={calculoPorRango}
                    onChange={() => {
                      setCalculoPorRango(true);
                      setCalculoPorOrden(false);
                      setSelectedInventario('');
                      setSelectedOrden('');
                      setProductosOrden([]);
                    }}
                    className="mr-2 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-gray-900 dark:text-white">Por Rango de Fechas</span>
                </label>
              </div>
            </div>

            {/* Selección de Cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cliente *
              </label>
              <select
                value={selectedCliente}
                onChange={(e) => {
                  setSelectedCliente(e.target.value as any);
                  // Limpiar órdenes y productos cuando cambie el cliente
                  setSelectedOrden('');
                  setProductosOrden([]);
                  setOrdenesDespacho([]);
                }}
                className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Filtros de órdenes
                </label>

                {/* Búsqueda, filtros por fecha y paginación (separados para mejor usabilidad) */}
                <div className="flex flex-col gap-3 mb-2">
                  {/* Búsqueda */}
                  <div className="w-full">
                    <input
                      type="text"
                      value={ordenesSearch}
                      onChange={(e) => { setOrdenesSearch(e.target.value); setOrdenesPage(0); }}
                      placeholder="Buscar orden..."
                      className="w-full p-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>

                  {/* Se removieron filtros por fecha para este modo */}

                  {/* Paginación */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 mt-1">
                    <button
                      type="button"
                      onClick={() => setOrdenesPage(p => Math.max(0, p - 1))}
                      disabled={ordenesPage === 0 || ordenesLoading}
                      className="px-2 py-1 rounded bg-gray-200 disabled:opacity-50 dark:bg-gray-600"
                    >
                      Anterior
                    </button>
                    <span>
                      {ordenesPage * ordenesLimit + 1}-{Math.min((ordenesPage + 1) * ordenesLimit, ordenesTotal)} de {ordenesTotal}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOrdenesPage(p => ((p + 1) * ordenesLimit < ordenesTotal ? p + 1 : p))}
                      disabled={(ordenesPage + 1) * ordenesLimit >= ordenesTotal || ordenesLoading}
                      className="px-2 py-1 rounded bg-gray-200 disabled:opacity-50 dark:bg-gray-600"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
                <label className="block text-sm font-medium text-gray-200 mb-2 mt-3">Orden de Despacho *</label>
                <select
                  value={selectedOrden}
                  onChange={(e) => setSelectedOrden(e.target.value)}
                  disabled={!selectedCliente}
                  className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">
                    {!selectedCliente ? 'Primero seleccione un cliente...' : 
                     ordenesLoading ? 'Cargando órdenes...' :
                     ordenesDespacho.length === 0 ? 'No hay órdenes para este cliente...' : 
                     'Seleccionar orden...'}
                  </option>
                  {ordenesDespacho.map(orden => (
                    <option key={orden.orden_despacho} value={orden.orden_despacho}>
                      {orden.orden_despacho} ({orden.cantidad_productos} productos, {(parseFloat(orden.volumen_total) || 0).toFixed(3)} m³)
                    </option>
                  ))}
                </select>
                
                {/* Mostrar resumen de productos en la orden */}
                {productosOrden.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Productos en la orden:</h4>
                    <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      {productosOrden.map(producto => (
                        <div key={producto.inv_id} className="flex justify-between">
                          <span>{producto.producto} - {producto.descripcion_producto}</span>
                          <span>{producto.cantidad_despachada} unidades</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 font-medium text-gray-900 dark:text-white">
                      Total: {productosOrden.reduce((sum, p) => sum + (parseInt(p.cantidad_despachada) || 0), 0)} productos
                      {' | '}
                      {productosOrden.reduce((sum, p) => sum + (parseFloat(p.volumen_total_m3_producto) || 0), 0).toFixed(3)} m³
                    </div>
                  </div>
                )}

                {/* Botones de cálculo: por orden */}
                {selectedCliente && (
                  <div className="flex gap-4 pt-4">
          {selectedOrden && (
                      <button
                        onClick={handleCalcular}
                        disabled={calculando}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow"
                      >
                        {calculando ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                            Calculando...
                          </>
                        ) : (
                          <>
                            <Calculator size={20} />
                            Calcular orden
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={resetForm}
                      className="bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>
            ) : calculoPorRango ? (
              /* Modo: Cálculo por Rango de Fechas */
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Rango de Fechas (Fecha de despacho)
                </label>
                <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 sm:p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="w-full">
                      <label className="block text-xs text-gray-400 mb-1">Desde</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full h-10 p-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    <div className="w-full">
                      <label className="block text-xs text-gray-400 mb-1">Hasta</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full h-10 p-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2 flex items-center justify-between">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Selecciona un cliente y el rango de fechas para calcular el total de m³.
                      </div>
                      <button
                        type="button"
                        onClick={() => { setStartDate(''); setEndDate(''); }}
                        className="px-3 py-2 text-xs rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50"
                        title="Limpiar fechas"
                        disabled={!startDate && !endDate}
                      >
                        Limpiar fechas
                      </button>
                    </div>
                  </div>
                </div>
                {/* Resumen previo debajo de filtros */}
                {selectedCliente && startDate && endDate && (
                  <div className="mt-3 p-3 rounded-lg border border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
                    {rangoResumenLoading ? (
                      <div className="text-xs">Cargando resumen del rango...</div>
                    ) : rangoResumenError ? (
                      <div className="text-xs text-red-300">{rangoResumenError}</div>
                    ) : rangoResumenPreview ? (
                      <div className="text-xs flex flex-wrap gap-2 items-center">
                        <span className="font-semibold">Resumen:</span>
                        <span>Órdenes: {rangoResumenPreview.total_ordenes}</span>
                        <span>|</span>
                        <span>Productos: {rangoResumenPreview.total_productos}</span>
                        <span>|</span>
                        <span>Total: {rangoResumenPreview.volumen_total_m3.toFixed(3)} m³</span>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">Selecciona un cliente y el rango de fechas para ver el resumen.</div>
                    )}
                  </div>
                )}
                {selectedCliente && (
                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={handleCalcularPorRangoTotal}
                      disabled={calculando || !startDate || !endDate}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow"
                    >
                      {calculando ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          Calculando...
                        </>
                      ) : (
                        <>
                          <Calculator size={20} />
                          Calcular rango total (m³)
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

              {/* Barra de búsqueda y paginación de items */}
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={invSearch}
                    onChange={(e) => { setInvSearch(e.target.value); setInvPage(0); }}
                    placeholder="Buscar producto o descripción..."
                    className="w-full p-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <button
                    type="button"
                    onClick={() => setInvPage(p => Math.max(0, p - 1))}
                    disabled={invPage === 0 || invLoading}
                    className="px-2 py-1 rounded bg-gray-200 disabled:opacity-50 dark:bg-gray-600"
                  >
                    Anterior
                  </button>
                  <span>
                    {invPage * invLimit + 1}-{Math.min((invPage + 1) * invLimit, total || 0)} de {total || 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInvPage(p => ((p + 1) * invLimit < (total || 0) ? p + 1 : p))}
                    disabled={(invPage + 1) * invLimit >= (total || 0) || invLoading}
                    className="px-2 py-1 rounded bg-gray-200 disabled:opacity-50 dark:bg-gray-600"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
              <select
                value={selectedInventario}
                onChange={(e) => setSelectedInventario(e.target.value as any)}
                disabled={!selectedCliente}
                  className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Seleccionar item...</option>
                {filteredInventario.map(item => (
                  <option key={item.inv_id} value={item.inv_id}>
                    {item.descripcion_producto || item.producto} - {item.producto}
                  </option>
                ))}
              </select>
            </div>

            {/* Dimensiones Requeridas */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Frente (mm) *
                </label>
                <input
                  type="number"
                  value={dimensiones.frente}
                  onChange={(e) => setDimensiones(prev => ({ ...prev, frente: e.target.value }))}
                  readOnly={!!selectedInventario}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    selectedInventario 
                      ? 'bg-gray-200 text-gray-700 cursor-not-allowed dark:bg-gray-600 dark:text-white dark:border-gray-600' 
                      : 'bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600'
                  }`}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Profundo (mm) *
                </label>
                <input
                  type="number"
                  value={dimensiones.profundo}
                  onChange={(e) => setDimensiones(prev => ({ ...prev, profundo: e.target.value }))}
                  readOnly={!!selectedInventario}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    selectedInventario 
                      ? 'bg-gray-200 text-gray-700 cursor-not-allowed dark:bg-gray-600 dark:text-white dark:border-gray-600' 
                      : 'bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600'
                  }`}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alto (mm) *
                </label>
                <input
                  type="number"
                  value={dimensiones.alto}
                  onChange={(e) => setDimensiones(prev => ({ ...prev, alto: e.target.value }))}
                  readOnly={!!selectedInventario}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    selectedInventario 
                      ? 'bg-gray-200 text-gray-700 cursor-not-allowed dark:bg-gray-600 dark:text-white dark:border-gray-600' 
                      : 'bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600'
                  }`}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cantidad
              </label>
              <input
                type="number"
                value={selectedInventario ? (inventario.find(inv => inv.inv_id === Number(selectedInventario))?.cantidad_despachada || 0) : ''}
                readOnly
                className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 cursor-not-allowed dark:bg-gray-600 dark:border-gray-600 dark:text-white"
                placeholder="Seleccione un item del inventario"
              />
            </div>

            {/* Volumen Requerido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Volumen Requerido (m³)
              </label>
              <input
                type="number"
                step="0.001"
                value={volumenRequerido}
                onChange={(e) => setVolumenRequerido(e.target.value)}
                readOnly={!!selectedInventario}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  selectedInventario 
                    ? 'bg-gray-200 text-gray-700 cursor-not-allowed dark:bg-gray-600 dark:text-white dark:border-gray-600' 
                    : 'bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600'
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
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
      <Package className="text-green-500 dark:text-green-400" size={24} />
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Resultados</h2>
            </div>
            {/* Botón para limpiar recomendaciones */}
            {resultados.length > 0 && (
              <button
                onClick={() => setResultados([])}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm flex items-center gap-2"
                title="Limpiar recomendaciones"
              >
                <Clock size={16} />
                Limpiar
              </button>
            )}
          </div>

          {resultados.length === 0 && !resultadoRangoTotal ? (
      <div className="text-center text-gray-600 dark:text-gray-400 py-8">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>Realiza un cálculo para ver las sugerencias</p>
            </div>
          ) : resultadoRangoTotal ? (
            <div className="space-y-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-t-lg flex items-center justify-between">
                  <div className="text-sm text-gray-900 dark:text-white font-semibold">Rango total: {rangoStart} → {rangoEnd}</div>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    {/* Mostrar total de órdenes y productos */}
                    {resultadoRangoTotal?.resumen?.total_ordenes ?? 0} órdenes | {rangoTotalProductos} productos | {rangoTotalM3.toFixed(3)} m³
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {resultadoRangoTotal.sugerencias.map((resultado, index) => (
                    <div key={index} className={`rounded-lg p-4 border ${
                      resultado.es_mejor_opcion 
                        ? 'bg-green-50 border-green-300 dark:bg-green-900/50 dark:border-green-500' 
                        : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{resultado.nombre_modelo}</h3>
                          <p className="text-gray-700 dark:text-gray-400 text-sm">Cantidad sugerida: {resultado.cantidad_sugerida} unidades</p>
                          {resultado.mensaje_comparacion && (
                            <p className="text-blue-400 text-sm mt-1 font-medium">{resultado.mensaje_comparacion}</p>
                          )}
                        </div>
                        <div className="text-right">
                          {resultado.es_recomendable && (
                            <div className="text-white px-2 py-1 rounded text-sm bg-indigo-600">
                              {(resultado.porcentaje_recomendacion ?? 0).toFixed(1)}% recomendado
                            </div>
                          )}
                          <div className={`mt-1 text-white px-2 py-1 rounded text-[11px] ${
                            ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 95 ? 'bg-green-600' :
                            ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 85 ? 'bg-blue-600' :
                            ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 70 ? 'bg-yellow-600' :
                            ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 50 ? 'bg-orange-600' : 'bg-red-600'
                          }`}>
                            {((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0).toFixed(1)}% eficiencia
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleGuardarSugerenciaRangoTotal(resultado)}
                        disabled={resultado.es_recomendable === false}
                        className={`w-full mt-4 py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                          resultado.es_recomendable === false
                            ? 'bg-gray-500 text-white cursor-not-allowed opacity-70'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                        title={resultado.es_recomendable === false ? 'No recomendable: eficiencia baja (<80%)' : 'Al guardar, se crean sugerencias por producto del rango'}
                      >
                        <CheckCircle size={16} />
                        Guardar sugerencias del rango
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setResultadoRangoTotal(null)} className="mt-2 text-sm text-gray-300 underline">Limpiar resultados de rango total</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {resultados.map((resultado, index) => (
        <div key={index} className={`rounded-lg p-4 border ${
                  resultado.es_mejor_opcion 
          ? 'bg-green-50 border-green-300 dark:bg-green-900/50 dark:border-green-500' 
          : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
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
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{resultado.nombre_modelo}</h3>
                      <p className="text-gray-700 dark:text-gray-400 text-sm">Cantidad sugerida: {resultado.cantidad_sugerida} unidades</p>
                      
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
                        <p className="text-gray-600 dark:text-gray-500 text-xs mt-1">
                          {resultado.detalle_espacio}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {/* Porcentaje de recomendación (top=100). Mostrar solo si es recomendable */}
                      {resultado.es_recomendable && (
                        <div className="text-white px-2 py-1 rounded text-sm bg-indigo-600">
                          {(resultado.porcentaje_recomendacion ?? 0).toFixed(1)}% recomendado
                        </div>
                      )}
                      {/* Banda de eficiencia como detalle secundario */}
                      <div className={`mt-1 text-white px-2 py-1 rounded text-[11px] ${
                        ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 95 ? 'bg-green-600' :
                        ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 85 ? 'bg-blue-600' :
                        ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 70 ? 'bg-yellow-600' :
                        ((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0) >= 50 ? 'bg-orange-600' : 'bg-red-600'
                      }`}>
                        {((resultado.eficiencia_porcentaje || resultado.eficiencia) || 0).toFixed(1)}% eficiencia
                      </div>
                      {resultado.es_recomendable === false && (
                        <div className="text-xs mt-1 px-2 py-1 rounded bg-red-900 text-red-200">
                          No recomendable {resultado.motivo_no_recomendable ? `- ${resultado.motivo_no_recomendable}` : ''}
                        </div>
                      )}
                      {resultado.es_recomendable && (
                        <div className="text-xs mt-1 px-2 py-1 rounded bg-green-900 text-green-200">Recomendable</div>
                      )}
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
                      <p className="text-gray-900 dark:text-white">
                        {resultado.dimensiones_internas ? 
                          `${resultado.dimensiones_internas.frente} × ${resultado.dimensiones_internas.profundo} × ${resultado.dimensiones_internas.alto} mm` :
                          'No disponible'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Volumen:</p>
                      <p className="text-gray-900 dark:text-white">{resultado.volumen_litros || 'No disponible'} litros</p>
                    </div>
                  </div>

                  {/* Mostrar detalle de combinación cuando aplique */}
                  {resultado.es_combinacion && resultado.combinacion_items && resultado.combinacion_items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-sm">
                      <p className="text-gray-400 mb-1">Composición de la combinación:</p>
                      <ul className="list-disc pl-5 text-gray-900 dark:text-white">
                        {resultado.combinacion_items.map((it, idx) => (
                          <li key={idx}>{it.nombre_modelo} x{it.cantidad}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Información adicional sobre espacio */}
                  {resultado.espacio_sobrante_m3 !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-gray-400">Espacio utilizado:</p>
          <p className="text-gray-900 dark:text-white">{(resultado.volumen_total_productos * 1000).toFixed(1)} litros</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Espacio sobrante:</p>
                          <p className={`${resultado.espacio_sobrante_m3 > 0.001 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {(resultado.espacio_sobrante_m3 * 1000).toFixed(1)} litros ({(resultado.porcentaje_espacio_sobrante || 0).toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                      {resultado.detalle_espacio && (
                        <p className="text-[11px] mt-2 text-gray-600 dark:text-gray-400">{resultado.detalle_espacio}</p>
                      )}
                    </div>
                  )}

                  {/* Combinaciones alternativas (cuando existan) */}
                  {resultado.combinaciones_alternativas && resultado.combinaciones_alternativas.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Combinaciones alternativas</p>
                      <div className="space-y-2">
                        {resultado.combinaciones_alternativas.map((combo, idx) => (
                          <div key={idx} className="text-xs flex items-center justify-between bg-gray-100 dark:bg-gray-700 rounded p-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px]">{combo.etiqueta}</span>
                              {combo.items.map((it, k) => (
                                <span key={k} className="text-gray-900 dark:text-white">
                                  {it.nombre_modelo} x{it.cantidad}
                                </span>
                              ))}
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] text-gray-800 dark:text-gray-200">Eficiencia: {combo.eficiencia_porcentaje.toFixed(1)}%</div>
                              <div className="text-[11px] text-gray-600 dark:text-gray-300">Sobra: {(combo.espacio_sobrante_m3 * 1000).toFixed(1)} L</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => calculoPorOrden ? handleGuardarSugerenciaOrden(resultado) : handleGuardarSugerencia(resultado)}
                    disabled={resultado.es_recomendable === false}
                    className={`w-full mt-4 py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      resultado.es_recomendable === false
                        ? 'bg-gray-500 text-white cursor-not-allowed opacity-70'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                    title={resultado.es_recomendable === false ? 'No recomendable: eficiencia baja (<80%)' : 'Al guardar, las recomendaciones se limpiarán automáticamente'}
                  >
                    <CheckCircle size={16} />
                    {resultado.es_mejor_opcion ? 'Seleccionar Mejor Opción' : (resultado.es_recomendable === false ? 'No recomendable' : 'Guardar Sugerencia')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Historial de Sugerencias */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mt-8 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
              <Clock className="text-yellow-500 dark:text-yellow-400" size={24} />
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Historial de Sugerencias</h2>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Filtro por cliente */}
            <div className="flex items-center gap-2">
                <Users className="text-gray-500 dark:text-gray-400" size={16} />
              <select
                value={clienteHistorialFilter}
                onChange={(e) => { setClienteHistorialFilter(e.target.value as any); setSugPage(0); }}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 w-full sm:w-auto dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Todos los clientes</option>
                {clientes.map(cliente => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id}>
                    {cliente.nombre_cliente}
                  </option>
                ))}
              </select>
            </div>

            {/* Búsqueda en historial */}
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={sugSearch}
                onChange={(e) => { setSugSearch(e.target.value); setSugPage(0); }}
                placeholder="Buscar en historial..."
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            {/* Toggle de vista */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shrink-0 self-start sm:self-auto">
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
            
            {/* Botones de descarga */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {clienteHistorialFilter && (
                <button
                  onClick={() => handlePDFWithPrices('cliente')}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm w-full sm:w-auto justify-center"
                  title="Descargar PDF del cliente seleccionado"
                >
                  <Users size={16} />
                  PDF Cliente
                </button>
              )}
              <button
                onClick={() => handlePDFWithPrices('general')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm w-full sm:w-auto justify-center"
                title="Descargar PDF completo"
              >
                <Download size={16} />
                PDF Completo
              </button>
            </div>
          </div>
        </div>

        {/* Paginación del historial */}
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 mb-4">
          <button
            type="button"
            onClick={() => setSugPage(p => Math.max(0, p - 1))}
            disabled={sugPage === 0 || loading === 'loading'}
            className="px-2 py-1 rounded bg-gray-200 disabled:opacity-50 dark:bg-gray-600"
          >
            Anterior
          </button>
          <span>
            {sugPage * sugLimit + 1}-{Math.min((sugPage + 1) * sugLimit, sugerenciasTotal || 0)} de {sugerenciasTotal || 0}
          </span>
          <button
            type="button"
            onClick={() => setSugPage(p => ((p + 1) * sugLimit < (sugerenciasTotal || 0) ? p + 1 : p))}
            disabled={(sugPage + 1) * sugLimit >= (sugerenciasTotal || 0) || loading === 'loading'}
            className="px-2 py-1 rounded bg-gray-200 disabled:opacity-50 dark:bg-gray-600"
          >
            Siguiente
          </button>
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
                  {sugerenciasTotal} registros
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
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
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
                  {sugerencia.descripcion_inventario && sugerencia.producto && (
                    <p className="text-blue-100 text-xs opacity-75 truncate">
                      Descripción: {sugerencia.descripcion_inventario}
                    </p>
                  )}
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
                    {sugerencia.cantidad_inventario && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Cant. Productos:</span>
                        <span className="text-gray-900 dark:text-white text-sm">
                          {sugerencia.cantidad_inventario} unidades
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Fecha:</span>
                      <span className="text-gray-900 dark:text-white text-sm">
                        {sugerencia.fecha_sugerencia ? new Date(sugerencia.fecha_sugerencia).toLocaleDateString('es-ES') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Pie de tarjeta con acciones */}
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3 flex justify-between">
                  <button
                    onClick={() => handleIndividualPDFWithPrices(sugerencia)}
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
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cant. Productos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Modelo Sugerido</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSugerencias.map((sugerencia) => (
                  <tr key={sugerencia.sugerencia_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {sugerencia.nombre_cliente || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div>
                        <div>{sugerencia.producto || sugerencia.descripcion_inventario || 'N/A'}</div>
                        {sugerencia.descripcion_inventario && sugerencia.producto && sugerencia.descripcion_inventario !== sugerencia.producto && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">
                            {sugerencia.descripcion_inventario}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {sugerencia.cantidad_inventario || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {sugerencia.modelo_sugerido}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {sugerencia.fecha_sugerencia ? new Date(sugerencia.fecha_sugerencia).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleIndividualPDFWithPrices(sugerencia)}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-1 rounded"
                          title="Descargar PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSugerencia(sugerencia.sugerencia_id)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1 rounded"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {pdfType === 'individual' ? 'Precio de Alquiler para Sugerencia' : 'Agregar Precios de Alquiler'}
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-400 mb-6">
              {pdfType === 'individual' 
                ? 'Ingresa el precio de alquiler para esta sugerencia específica.' 
                : 'Ingresa el precio de alquiler para cada producto. Puedes omitir productos dejando el campo vacío.'
              }
            </p>
            
            <div className="space-y-4 mb-6">
              {productosUnicos.map((productoInfo) => (
                <div key={productoInfo.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {productoInfo.producto}
                    </h4>
                    {productoInfo.descripcion && (
                      <p className="text-sm text-gray-700 dark:text-gray-400">
                        Descripción: {productoInfo.descripcion}
                      </p>
                    )}
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Modelo Sugerido: {productoInfo.modelo_sugerido}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Cantidad Sugerida: {productoInfo.cantidad_sugerida} contenedores
                    </p>
                    {(productoInfo as any).orden && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Orden: {(productoInfo as any).orden}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Precio de Alquiler
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: $150/día"
                      value={preciosAlquiler[productoInfo.id] || ''}
                      onChange={(e) => handlePriceChange(productoInfo.id, e.target.value)}
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
