// MODO UNICO: cálculo por rango de fechas (versión limpia)
import React, { useEffect, useState } from 'react';
import { Calculator, Package, Clock, Trash2, Download, Users, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import { useSugerenciasController } from '../../../../controllers/hooks/useSugerenciasController';
import { useClienteProspectoController } from '../../../../controllers/hooks/useClienteProspectoController';
import { apiClient } from '../../../../services/api';

const SugerenciasView: React.FC = () => {
  // Util para formatear fechas sin desplazamiento de zona (cuando viene como YYYY-MM-DD)
  const formatFecha = (v: any) => {
    if (!v) return 'N/A';
    const str = String(v);
    // Extraer sólo la parte de fecha antes de ' ' o 'T'
    const datePart = str.split('T')[0].split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [y, m, d] = datePart.split('-');
      return `${Number(d)}/${Number(m)}/${y}`;
    }
    // Fallback: intentar Date normal
    try {
      const dt = new Date(str);
      if (!isNaN(dt.getTime())) return dt.toLocaleDateString();
      return datePart || str;
    } catch { return datePart || str; }
  };
  const { sugerencias, total, loading, error, loadSugerenciasPaginated, loadSugerenciasPorNumero, deleteSugerencia } = useSugerenciasController();
  const { clientes } = useClienteProspectoController();

  // Formulario
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [resumen, setResumen] = useState<{ total_ordenes: number; total_productos: number; volumen_total_m3: number } | null>(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [resumenError, setResumenError] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  // Resultado agregado: combinación mínima por orden (rango)
  const [mixAgg, setMixAgg] = useState<any|null>(null);
  // Días
  const [diasActivos, setDiasActivos] = useState<number | null>(null);
  const [diasRango, setDiasRango] = useState<number | null>(null);
  // Filtro de modelos (permitidos)
  const [modelos, setModelos] = useState<Array<{ modelo_id: number; nombre_modelo: string; volumen_litros: number }>>([]);
  const [modelosPermitidos, setModelosPermitidos] = useState<number[]>([]);

  // Historial
  const [limit] = useState(20);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState<number | ''>('');
  const [numeroFiltro, setNumeroFiltro] = useState<string>('');
  const numeroOptions = Array.from(new Set((sugerencias || []).map((s:any) => s.numero_de_sugerencia).filter((v:any) => !!v)));

  // PDF modal
  const [showModal, setShowModal] = useState(false);
  const [pdfType, setPdfType] = useState<'general' | 'cliente' | 'individual' | 'numero'>('general');
  const [pdfItems, setPdfItems] = useState<any[]>([]);
  const [pdfTitulo, setPdfTitulo] = useState<string>('Reporte_Completo');
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [productosModal, setProductosModal] = useState<Array<{ id: string; producto: string; modelo: string; cantidad: number }>>([]);
  // estado individual no requerido

  const filtered = sugerencias.filter(s => !clienteFiltro || s.cliente_id === Number(clienteFiltro));

  // Cargar historial
  useEffect(() => {
    loadSugerenciasPaginated({ limit, offset: page * limit, search, clienteId: clienteFiltro ? Number(clienteFiltro) : null, numero: numeroFiltro || null });
  }, [limit, page, search, clienteFiltro, numeroFiltro]);

  // Cargar catálogo de modelos para selector
  useEffect(() => {
    (async () => {
      try {
        const r = await apiClient.get('/credocubes');
        const data = r.data || [];
        const cubes = (data || [])
          .filter((m:any) => (m?.tipo || m?.tipo_modelo) === 'Cube' || /cube/i.test(String(m?.nombre_modelo || m?.modelo_nombre || '')))
          .map((m:any) => ({ modelo_id: m.modelo_id, nombre_modelo: m.nombre_modelo || m.modelo_nombre, volumen_litros: Number(m.volumen_litros) || 0 }));
        const sorted = [...cubes].sort((a,b) => (a.volumen_litros || 0) - (b.volumen_litros || 0));
        setModelos(sorted);
        setModelosPermitidos(sorted.map(m => m.modelo_id));
      } catch (err) {
        console.error('Error cargando credocubes para selector:', err);
      }
    })();
  }, []);

  // Resumen (debounce)
  useEffect(() => {
    if (!clienteId || !startDate || !endDate) { setResumen(null); return; }
    const ctrl = new AbortController();
    setResumenLoading(true); setResumenError(null);
    const t = setTimeout(async () => {
      try {
        const { data: d } = await apiClient.post('/sugerencias/calcular-por-rango-total', { cliente_id: Number(clienteId), startDate, endDate, modelos_permitidos: modelosPermitidos }, { signal: ctrl.signal as any });
        const rs = d.resumen || {};
        setResumen({
          total_ordenes: Number(rs.total_ordenes || 0),
          total_productos: Number(rs.total_productos || 0),
          volumen_total_m3: Number(rs.volumen_total_m3 || 0)
        });
      } catch (err) {
        // Si la solicitud fue abortada por un cambio rápido de fechas, no mostrar error
        if (!ctrl.signal.aborted) {
          setResumen(null); setResumenError('No se pudo obtener el resumen');
        }
      } finally { if (!ctrl.signal.aborted) setResumenLoading(false); }
    }, 300);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [clienteId, startDate, endDate, modelosPermitidos]);

  const calcular = async () => {
    if (!clienteId || !startDate || !endDate) { alert('Complete cliente y fechas'); return; }
    setCalculando(true);
    setMixAgg(null);
    try {
      const payload = { cliente_id: Number(clienteId), startDate, endDate, modelos_permitidos: modelosPermitidos };
      const rMixAgg = await apiClient.post('/sugerencias/calcular-por-rango-orden-a-orden-combinacion', payload);
      const diasCalendario = (() => { try { const sd = new Date(startDate); const ed = new Date(endDate); const diff = ed.getTime() - sd.getTime(); if (isNaN(diff) || diff < 0) return 0; return Math.max(1, Math.round(diff / 86400000) + 1); } catch { return 0; } })();
      setDiasRango(diasCalendario || null);
      const activos = rMixAgg.data?.resumen?.total_dias_activos ?? null;
      setDiasActivos(activos);
      setMixAgg(rMixAgg.data);
    } catch { alert('Error al calcular'); }
    finally { setCalculando(false); }
  };

  // Se elimina el guardado individual: solo mezcla global

  const eliminar = async (id: number) => {
    if (!window.confirm('Eliminar sugerencia?')) return;
    try {
      await deleteSugerencia(id);
      loadSugerenciasPaginated({ limit, offset: page * limit, search, clienteId: clienteFiltro ? Number(clienteFiltro) : null });
    } catch { alert('Error'); }
  };

  // PDF helpers
  const buildProductos = (arr = sugerencias) => arr.map(s => ({ id: `id_${s.sugerencia_id}`, producto: s.producto || s.descripcion_inventario || 'N/A', modelo: s.nombre_modelo || s.modelo_sugerido || 'N/A', cantidad: s.cantidad_sugerida || 0 }));
  const precioFor = (s: any) => precios[`id_${s.sugerencia_id}`] || '';
  const abrirModal = (tipo: 'general' | 'cliente') => {
    const arr = tipo === 'cliente' ? filtered : sugerencias;
    if (tipo === 'cliente' && !clienteFiltro) { alert('Seleccione cliente'); return; }
    if (arr.length === 0) { alert('No hay sugerencias'); return; }
    const prods = buildProductos(arr); const init: Record<string, string> = {}; prods.forEach(p => init[p.id] = '');
    setPdfType(tipo); setPdfItems(arr); setPdfTitulo(tipo === 'cliente' ? `Cliente_${clientes.find(c => c.cliente_id === Number(clienteFiltro))?.nombre_cliente || ''}` : 'Reporte_Completo');
    setProductosModal(prods); setPrecios(init); setShowModal(true);
  };
  const abrirModalIndividual = (s: any) => { const p = buildProductos([s]); setPdfType('individual'); setPdfItems([s]); setPdfTitulo('Sugerencia_Individual'); setProductosModal(p); setPrecios({ [p[0].id]: '' }); setShowModal(true); };
  const pdfGenerico = (arr: any[], titulo: string) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    // Encabezado principal
    pdf.setFillColor(30, 41, 59); pdf.rect(0, 0, w, 34, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255,255,255); pdf.setFontSize(24); pdf.text('KRYOTEC', 18, 22);
    pdf.setFontSize(14); pdf.setFont('helvetica','normal'); pdf.text(titulo.replace(/_/g,' '), w/2, 21, { align: 'center' });
    pdf.setFontSize(9); pdf.text(new Date().toLocaleString('es-ES'), w - 16, 12, { align: 'right' });
    // Subtítulo (si hay días)
  // Preferir valores almacenados en registros si existen
  const first = arr[0] || {};
  const rangoGuardado = first.rango_dias ? Number(first.rango_dias) : null;
  const activosGuardado = first.dias_activos ? Number(first.dias_activos) : null;
  const infoDias = `Rango: ${rangoGuardado || diasRango || 'N/A'} días | Días activos: ${activosGuardado || diasActivos || 'N/A'}`;
    pdf.setFontSize(8); pdf.text(infoDias, w - 16, 22, { align: 'right' });
    // Cabecera de tabla
    const colX = { modelo: 20, cantidad: 95, diaria: 135, precio: 170 };
    let y = 48;
    pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(34,34,34);
    pdf.text('Modelo', colX.modelo, y);
    pdf.text('Cantidad', colX.cantidad, y, { align: 'right' });
    pdf.text('Cantidad Diaria', colX.diaria, y, { align: 'right' });
    pdf.text('Precio', colX.precio, y, { align: 'right' });
    pdf.setDrawColor(210,210,210); pdf.line(16, y+2, w-16, y+2);
    y += 10; pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.setTextColor(0,0,0);
    // Helpers
    const fmtNum = (v:any) => { const n = Number(v); return isFinite(n) ? n.toLocaleString('es-CO') : (v||''); };
  let totalCant = 0; let totalPrecio = 0; let algunPrecio = false; let totalDiaria = 0;
    arr.forEach((s,i) => {
      if (y > h - 30) { // nueva página
        pdf.addPage(); y = 20; pdf.setFont('helvetica','bold'); pdf.setFontSize(11);
        pdf.text('Modelo', colX.modelo, y);
        pdf.text('Cantidad', colX.cantidad, y, { align: 'right' });
        pdf.text('Cantidad Diaria', colX.diaria, y, { align: 'right' });
        pdf.text('Precio', colX.precio, y, { align: 'right' });
        pdf.line(16, y+2, w-16, y+2); y += 10; pdf.setFont('helvetica','normal'); pdf.setFontSize(9);
      }
      if (i % 2 === 0) { pdf.setFillColor(248,248,248); pdf.rect(16, y-5, w-32, 10, 'F'); }
      const modelo = (s.nombre_modelo || s.modelo_sugerido || '').substring(0, 55);
      const cant = Number(s.cantidad_sugerida || s.total_cajas || 0); totalCant += cant;
      const diariaTxt = s.cantidad_diaria || '';
      // Intentar interpretar cantidad diaria como número si es puramente numérica
      const diariaNum = (() => {
        if (typeof s.cantidad_diaria === 'number') return s.cantidad_diaria;
        if (typeof s.cantidad_diaria === 'string') {
          // Puede venir "1 cada N días" o "8"; solo sumamos si es número simple
            const trimmed = s.cantidad_diaria.trim();
            if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
        }
        return 0;
      })();
      totalDiaria += diariaNum;
      const precioTxt = precioFor(s) || '';
      if (precioTxt) {
        const num = Number(String(precioTxt).replace(/[^0-9.]/g,''));
        if (isFinite(num)) { totalPrecio += num; algunPrecio = true; }
      }
      pdf.text(modelo, colX.modelo, y);
      pdf.text(fmtNum(cant), colX.cantidad, y, { align: 'right' });
      pdf.text(String(diariaTxt), colX.diaria, y, { align: 'right' });
      pdf.text(precioTxt || '-', colX.precio, y, { align: 'right' });
      y += 10;
    });
    // Totales
    pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setFillColor(225,239,255); pdf.rect(16, y-6, w-32, 12, 'F');
    pdf.text('TOTAL', colX.modelo, y);
  pdf.text(fmtNum(totalCant), colX.cantidad, y, { align: 'right' });
  // Total de cantidad diaria (solo suma valores numéricos directos)
  if (totalDiaria > 0) pdf.text(fmtNum(totalDiaria), colX.diaria, y, { align: 'right' });
    if (algunPrecio) pdf.text(fmtNum(totalPrecio), colX.precio, y, { align: 'right' });
    y += 14;
    // Notas
    pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(90,90,90);
    pdf.text('Las cantidades derivan del uso histórico real. La "Cantidad Diaria" puede representarse como frecuencia (1 cada N días).', 16, h-22, { maxWidth: w-32 });
    pdf.text('Generado automáticamente por Kryotec - Módulo de Sugerencias.', 16, h-16);
    pdf.save(`Sugerencias_${titulo.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };
  const generarPDF = () => pdfGenerico(pdfItems.length ? pdfItems : sugerencias, pdfTitulo || 'Reporte_Completo');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Sugerencias (Rango de Fechas)</h1>

      {/* Formulario */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-8">
        
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Cliente *</label>
            <select value={clienteId} onChange={e => { setClienteId(e.target.value as any); }} className="w-full p-2 rounded border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              <option value="">Seleccionar...</option>
              {clientes.map(c => <option key={c.cliente_id} value={c.cliente_id}>{c.nombre_cliente}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Desde *</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 rounded border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>
            <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Hasta *</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 rounded border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>
        </div>
        {/* Selector de modelos permitidos */}
        <div className="mt-4">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-2">Modelos a considerar (opcional)</label>
          <div className="flex gap-2 mb-2 text-xs">
            <button type="button" onClick={() => setModelosPermitidos(modelos.map(m => m.modelo_id))} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700">Seleccionar todos</button>
            <button type="button" onClick={() => setModelosPermitidos([])} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700">Limpiar</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {modelos.map((m: { modelo_id: number; nombre_modelo: string; volumen_litros: number }) => {
              const checked = modelosPermitidos.includes(m.modelo_id);
              return (
                <label key={m.modelo_id} className={`px-2 py-1 rounded border text-xs cursor-pointer select-none ${checked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setModelosPermitidos((prev: number[]) => e.target.checked ? [...new Set([...prev, m.modelo_id])] : prev.filter((id: number) => id !== m.modelo_id));
                    }}
                    className="mr-1 align-middle"
                  />
                  {m.nombre_modelo}
                </label>
              );
            })}
          </div>
          {modelosPermitidos.length > 0 && (
            <div className="text-[11px] mt-2 text-blue-600 dark:text-blue-400">Se filtrará la recomendación usando únicamente los modelos seleccionados.</div>
          )}
        </div>
        {clienteId && startDate && endDate && (
          <div className="mt-4 text-xs p-3 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
            {resumenLoading ? 'Cargando...' : resumenError ? resumenError : resumen ? `Órdenes: ${resumen.total_ordenes} | Productos: ${resumen.total_productos} | Total: ${resumen.volumen_total_m3.toFixed(3)} m³` : 'Sin datos'}
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <button onClick={calcular} disabled={calculando || !clienteId || !startDate || !endDate} className="px-5 py-3 rounded bg-blue-600 disabled:bg-blue-400 text-white flex items-center gap-2 text-sm">
            <Calculator size={18} />{calculando ? 'Calculando...' : 'Calcular'}
          </button>
          <button onClick={() => { setClienteId(''); setStartDate(''); setEndDate(''); }} className="px-5 py-3 rounded bg-gray-600 text-white text-sm">Limpiar</button>
        </div>

      </div>
      {/* RESULTADO: Recomendación Mensual Real */}
      {mixAgg && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-green-300 dark:border-green-600 mb-10">
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Package size={18}/>Recomendación Mensual (Combinación por Orden)</h2>
          <div className="mb-4 text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <div>Días calendario: {diasRango || '-'} | Días activos: {mixAgg.resumen?.total_dias_activos ?? '-'}</div>
            <div>Órdenes únicas: {mixAgg.resumen?.total_ordenes_unicas ?? '-'}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-200">
                <tr>
                  <th className="text-left p-2">Modelo</th>
                  <th className="text-left p-2">Cajas Periodo</th>
                  <th className="text-left p-2">Prom Diario</th>
                  <th className="text-left p-2">Recom. Diaria</th>
                  <th className="text-left p-2">Recom. Mensual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {mixAgg.modelos_agregados?.map((m:any) => {
                  const prom = Number(m.promedio_diario_cajas || 0);
                  const recomDiaria = prom >= 1 ? Math.round(prom) : 0;
                  const recomMensual = Math.ceil(prom * 30);
                  return (
                    <tr key={m.modelo_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-2">{m.nombre_modelo}</td>
                      <td className="p-2">{m.total_cajas}</td>
                      <td className="p-2">{prom.toFixed(3)}</td>
                      <td className="p-2">{recomDiaria || (prom > 0 ? `1 cada ${Math.round(1 / prom)} días` : 0)}</td>
                      <td className="p-2">{recomMensual}</td>
                    </tr>
                  );
                })}
                <tr className="font-semibold bg-green-50 dark:bg-green-900/30">
                  <td className="p-2">TOTAL</td>
                  <td className="p-2">{mixAgg.modelos_agregados?.reduce((s:number,x:any)=> s + (x.total_cajas||0),0)}</td>
                  <td className="p-2">{(() => { const sum = (mixAgg.modelos_agregados||[]).reduce((s:number,x:any)=> s + (x.promedio_diario_cajas||0),0); return Number(sum).toFixed(3); })()}</td>
                  <td className="p-2">{(() => { const sum = (mixAgg.modelos_agregados||[]).reduce((s:number,x:any)=> s + (x.promedio_diario_cajas||0),0); return sum >= 1 ? Math.round(sum) : (sum > 0 ? `1 cada ${Math.round(1 / sum)} días` : 0); })()}</td>
                  <td className="p-2">{(() => { const sum = (mixAgg.modelos_agregados||[]).reduce((s:number,x:any)=> s + (x.promedio_diario_cajas||0),0); return Math.ceil(sum * 30); })()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Historial */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4 justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2"><Clock size={20} />Historial</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-sm">
              <Users size={16} className="text-gray-500" />
              <select value={clienteFiltro} onChange={e => { setClienteFiltro(e.target.value as any); setPage(0); }} className="p-2 rounded border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm">
                <option value="">Todos</option>
                {clientes.map(c => <option key={c.cliente_id} value={c.cliente_id}>{c.nombre_cliente}</option>)}
              </select>
            </div>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar..." className="p-2 rounded border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
            <select value={numeroFiltro} onChange={e => { setNumeroFiltro(e.target.value); setPage(0); }} className="p-2 rounded border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm">
              <option value=""># sugerencia</option>
              {numeroOptions.map((n:string) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {clienteFiltro && <button onClick={() => abrirModal('cliente')} className="px-3 py-2 text-xs rounded bg-green-600 text-white flex items-center gap-1"><Download size={14} />PDF Cliente</button>}
            {numeroFiltro && <button onClick={async () => { const items = await loadSugerenciasPorNumero(numeroFiltro); if (items.length) { setPdfType('general'); setProductosModal(buildProductos(items)); const init: Record<string,string> = {}; items.forEach(s => init[`id_${s.sugerencia_id}`]=''); setPrecios(init); setShowModal(true);} else { alert('No hay registros para ese número'); } }} className="px-3 py-2 text-xs rounded bg-purple-600 text-white flex items-center gap-1"><Download size={14} />PDF Nº</button>}
            <button onClick={() => abrirModal('general')} className="px-3 py-2 text-xs rounded bg-blue-600 text-white flex items-center gap-1"><Download size={14} />PDF Completo</button>
          </div>
        </div>
        {clienteFiltro && <div className="text-xs mb-3 flex items-center gap-1 text-blue-600 dark:text-blue-400"><Filter size={12} />Filtrado por {clientes.find(c => c.cliente_id === Number(clienteFiltro))?.nombre_cliente}<button onClick={() => setClienteFiltro('')} className="underline ml-2">Limpiar</button></div>}
        {loading === 'loading' ? (
          <div className="py-6 text-center text-sm">Cargando...</div>
        ) : error ? (
          <div className="py-6 text-center text-red-500 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">Sin registros</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">
                <tr>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Modelo</th>
                  <th className="text-left p-2">Cant.</th>
                  <th className="text-left p-2">Cant. Diaria</th>
                  <th className="text-left p-2">Fecha</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {filtered.map(s => (
                  <tr key={s.sugerencia_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-2">{s.nombre_cliente || 'N/A'}</td>
                    <td className="p-2">{s.numero_de_sugerencia || '-'}</td>
                    <td className="p-2">{s.modelo_sugerido}</td>
                    <td className="p-2">{s.cantidad_sugerida}</td>
                    <td className="p-2">{s.cantidad_diaria || '-'}</td>
                    <td className="p-2">{formatFecha(s.fecha_sugerencia)}</td>
                    <td className="p-2 flex gap-2 justify-center">
                      <button onClick={() => abrirModalIndividual(s)} className="p-1 rounded bg-blue-600 text-white" title="PDF"><Download size={14} /></button>
                      <button onClick={() => eliminar(s.sugerencia_id)} className="p-1 rounded bg-red-600 text-white" title="Eliminar"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs mt-4">
          <button disabled={page === 0 || loading === 'loading'} onClick={() => setPage(p => Math.max(0, p - 1))} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 disabled:opacity-50">Anterior</button>
          <span>{page * limit + 1}-{Math.min((page + 1) * limit, total)} de {total}</span>
          <button disabled={(page + 1) * limit >= total || loading === 'loading'} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 disabled:opacity-50">Siguiente</button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-xl max-h-[80vh] overflow-y-auto border border-gray-300 dark:border-gray-700">
            <h3 className="font-semibold mb-4 text-gray-800 dark:text-white text-sm">{pdfType === 'individual' ? 'Precio de Alquiler' : 'Precios de Alquiler (opcional)'}</h3>
            <div className="space-y-4 mb-4">
              {productosModal.map(p => (
                <div key={p.id} className="border border-gray-200 dark:border-gray-600 rounded p-3 text-xs">
                  <div className="mb-2 font-medium text-gray-800 dark:text-white">{p.modelo || 'Modelo'}</div>
                  <div className="text-gray-500 dark:text-gray-300 mb-1">Cantidad: {p.cantidad}</div>
                  <input value={precios[p.id] || ''} onChange={e => setPrecios(pr => ({ ...pr, [p.id]: e.target.value }))} placeholder="Precio (Ej: $100)" className="w-full p-2 rounded border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button onClick={() => setShowModal(false)} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-600">Cancelar</button>
              <button onClick={() => { setShowModal(false); generarPDF(); }} className="px-3 py-2 rounded bg-blue-600 text-white">Generar PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SugerenciasView;
