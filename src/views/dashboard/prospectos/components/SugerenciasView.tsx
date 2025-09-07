// MODO UNICO: cálculo por rango de fechas (versión limpia)
import React, { useEffect, useState } from 'react';
import { Calculator, Package, Clock, Trash2, Download, Users, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import { useSugerenciasController } from '../../../../controllers/hooks/useSugerenciasController';
import { useClienteProspectoController } from '../../../../controllers/hooks/useClienteProspectoController';


const API = import.meta.env.PROD ? '/api' : 'http://localhost:3002/api';

const SugerenciasView: React.FC = () => {
  const { sugerencias, total, loading, error, loadSugerenciasPaginated, deleteSugerencia } = useSugerenciasController();
  const { clientes } = useClienteProspectoController();

  // Formulario
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [resumen, setResumen] = useState<{ total_ordenes: number; total_productos: number; volumen_total_m3: number } | null>(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [resumenError, setResumenError] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  // Resultado: recomendación mensual real (agregada por modelo)
  const [recomendacion, setRecomendacion] = useState<any|null>(null);
  // Guardado
  const [guardando, setGuardando] = useState(false);
  // Días
  const [diasActivos, setDiasActivos] = useState<number | null>(null);
  const [diasRango, setDiasRango] = useState<number | null>(null);

  // Historial
  const [limit] = useState(20);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState<number | ''>('');

  // PDF modal
  const [showModal, setShowModal] = useState(false);
  const [pdfType, setPdfType] = useState<'general' | 'cliente' | 'individual'>('general');
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [productosModal, setProductosModal] = useState<Array<{ id: string; producto: string; modelo: string; cantidad: number }>>([]);
  const [sugerenciaIndividual, setSugerenciaIndividual] = useState<any | null>(null);

  const filtered = sugerencias.filter(s => !clienteFiltro || s.cliente_id === Number(clienteFiltro));

  // Cargar historial
  useEffect(() => {
    loadSugerenciasPaginated({ limit, offset: page * limit, search, clienteId: clienteFiltro ? Number(clienteFiltro) : null });
  }, [limit, page, search, clienteFiltro]);

  // Resumen (debounce)
  useEffect(() => {
    if (!clienteId || !startDate || !endDate) { setResumen(null); return; }
    const ctrl = new AbortController();
    setResumenLoading(true); setResumenError(null);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/sugerencias/calcular-por-rango-total`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_id: Number(clienteId), startDate, endDate }),
          signal: ctrl.signal
        });
        if (!r.ok) throw new Error();
        const d = await r.json();
        const rs = d.resumen || {};
        setResumen({
          total_ordenes: Number(rs.total_ordenes || 0),
          total_productos: Number(rs.total_productos || 0),
          volumen_total_m3: Number(rs.volumen_total_m3 || 0)
        });
      } catch {
        setResumen(null); setResumenError('No se pudo obtener el resumen');
      } finally { setResumenLoading(false); }
    }, 300);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [clienteId, startDate, endDate]);

  const calcular = async () => {
    if (!clienteId || !startDate || !endDate) { alert('Complete cliente y fechas'); return; }
    setCalculando(true);
    setRecomendacion(null);
    try {
      const body = JSON.stringify({ cliente_id: Number(clienteId), startDate, endDate });
      // Obtenemos días activos (orden a orden) y la recomendación mensual real
      const [rOrden, rReco] = await Promise.all([
        fetch(`${API}/sugerencias/calcular-por-rango-orden-a-orden`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }),
        fetch(`${API}/sugerencias/recomendacion-mensual-real`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      ]);
      const diasCalendario = (() => { try { const sd = new Date(startDate); const ed = new Date(endDate); const diff = ed.getTime() - sd.getTime(); if (isNaN(diff) || diff < 0) return 0; return Math.max(1, Math.round(diff / 86400000) + 1); } catch { return 0; } })();
      setDiasRango(diasCalendario || null);
      let activos: number | null = null;
      if (rOrden.ok) { try { const dOrden = await rOrden.json(); activos = dOrden?.resumen?.total_dias_activos ?? null; } catch {} }
      setDiasActivos(activos);
      if (!rReco.ok) throw new Error('Error recomendación');
      const reco = await rReco.json();
      setRecomendacion(reco);
    } catch { alert('Error al calcular'); }
    finally { setCalculando(false); }
  };

  const guardarRecomendacion = async () => {
    if (!recomendacion || !clienteId || !startDate || !endDate) return;
    if (!window.confirm('Guardar esta recomendación mensual en la base? Creará una fila por modelo.')) return;
    try {
      setGuardando(true);
      const r = await fetch(`${API}/sugerencias/recomendacion-mensual-real/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: Number(clienteId), startDate, endDate })
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      alert(`Guardado: ${d.total_creadas} filas`);
      // Refrescar historial después de guardar
      loadSugerenciasPaginated({ limit, offset: page * limit, search, clienteId: clienteFiltro ? Number(clienteFiltro) : null });
    } catch { alert('No se pudo guardar'); }
    finally { setGuardando(false); }
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
  const buildProductos = (arr = sugerencias) => arr.map(s => ({ id: `id_${s.sugerencia_id}`, producto: s.producto || s.descripcion_inventario || 'N/A', modelo: s.modelo_sugerido || 'N/A', cantidad: s.cantidad_sugerida || 0 }));
  const precioFor = (s: any) => precios[`id_${s.sugerencia_id}`] || '';
  const abrirModal = (tipo: 'general' | 'cliente') => {
    const arr = tipo === 'cliente' ? filtered : sugerencias;
    if (tipo === 'cliente' && !clienteFiltro) { alert('Seleccione cliente'); return; }
    if (arr.length === 0) { alert('No hay sugerencias'); return; }
    const prods = buildProductos(arr); const init: Record<string, string> = {}; prods.forEach(p => init[p.id] = '');
    setPdfType(tipo); setProductosModal(prods); setPrecios(init); setShowModal(true); setSugerenciaIndividual(null);
  };
  const abrirModalIndividual = (s: any) => { const p = buildProductos([s]); setPdfType('individual'); setProductosModal(p); setPrecios({ [p[0].id]: '' }); setShowModal(true); setSugerenciaIndividual(s); };
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
    let totalCant = 0; let totalPrecio = 0; let algunPrecio = false;
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
    if (algunPrecio) pdf.text(fmtNum(totalPrecio), colX.precio, y, { align: 'right' });
    y += 14;
    // Notas
    pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(90,90,90);
    pdf.text('Las cantidades derivan del uso histórico real. La "Cantidad Diaria" puede representarse como frecuencia (1 cada N días).', 16, h-22, { maxWidth: w-32 });
    pdf.text('Generado automáticamente por Kryotec - Módulo de Sugerencias.', 16, h-16);
    pdf.save(`Sugerencias_${titulo.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };
  const generarPDF = () => pdfGenerico(sugerencias, 'Reporte_Completo');
  const generarPDFCliente = () => { const cli = clientes.find(c => c.cliente_id === Number(clienteFiltro)); pdfGenerico(filtered, `Cliente_${cli?.nombre_cliente || ''}`); };
  const generarPDFIndividual = () => { if (sugerenciaIndividual) pdfGenerico([sugerenciaIndividual], 'Sugerencia_Individual'); };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Sugerencias (Rango de Fechas)</h1>

      {/* Formulario */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-8">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Cliente *</label>
            <select value={clienteId} onChange={e => { setClienteId(e.target.value as any); setRecomendacion(null); }} className="w-full p-2 rounded border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white">
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
        {clienteId && startDate && endDate && (
          <div className="mt-4 text-xs p-3 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
            {resumenLoading ? 'Cargando...' : resumenError ? resumenError : resumen ? `Órdenes: ${resumen.total_ordenes} | Productos: ${resumen.total_productos} | Total: ${resumen.volumen_total_m3.toFixed(3)} m³` : 'Sin datos'}
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <button onClick={calcular} disabled={calculando || !clienteId || !startDate || !endDate} className="px-5 py-3 rounded bg-blue-600 disabled:bg-blue-400 text-white flex items-center gap-2 text-sm">
            <Calculator size={18} />{calculando ? 'Calculando...' : 'Calcular'}
          </button>
          <button onClick={() => { setClienteId(''); setStartDate(''); setEndDate(''); setRecomendacion(null); }} className="px-5 py-3 rounded bg-gray-600 text-white text-sm">Limpiar</button>
        </div>
      </div>
      {/* RESULTADO: Recomendación Mensual Real */}
      {recomendacion && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-green-300 dark:border-green-600 mb-10">
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Package size={18}/>Recomendación Mensual Real</h2>
          <div className="mb-3 flex gap-2">
            <button onClick={guardarRecomendacion} className="px-3 py-1.5 rounded bg-green-600 text-white text-xs">Guardar</button>
            {guardando && <span className="text-xs text-gray-500">Guardando...</span>}
          </div>
          {(() => {
            const r = recomendacion;
            const resumenR = r.resumen || {};
            return (
              <div className="mb-4 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                <div>Días calendario: {resumenR.dias_calendario} | Días activos: {resumenR.dias_activos} | Base usada: {resumenR.base_dias_usada}</div>
                <div>Total cajas periodo: {resumenR.total_cajas_periodo} | Promedio diario total: {Number(resumenR.promedio_diario_total||0).toFixed(2)}</div>
                <div>Proyección mensual (30): {Math.ceil(resumenR.promedio_diario_total * 30 || 0)} cajas</div>
              </div>
            );
          })()}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-200">
                <tr>
                  <th className="text-left p-2">Modelo</th>
                  <th className="text-left p-2">Cajas Periodo</th>
                  <th className="text-left p-2">Prom Diario (técnico)</th>
                  <th className="text-left p-2">Recom. Diaria</th>
                  <th className="text-left p-2">Recom. Mensual</th>
                  <th className="text-left p-2">Frecuencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {recomendacion.modelos?.map((m:any) => (
                  <tr key={m.modelo_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-2">{m.nombre_modelo}</td>
                    <td className="p-2">{m.cajas_totales_periodo}</td>
                    <td className="p-2">{Number(m.promedio_diario).toFixed(3)}</td>
                    <td className="p-2">{m.recomendacion_diaria}</td>
                    <td className="p-2">{m.recomendacion_mensual}</td>
                    <td className="p-2">{m.frecuencia_cada_dias ? `1 cada ${m.frecuencia_cada_dias} días` : (m.recomendacion_diaria>0? 'diario':'-')}</td>
                  </tr>
                ))}
                <tr className="font-semibold bg-green-50 dark:bg-green-900/30">
                  <td className="p-2">TOTAL</td>
                  <td className="p-2">{recomendacion.modelos?.reduce((s:number,x:any)=> s + (x.cajas_totales_periodo||0),0)}</td>
                  <td className="p-2">{Number(recomendacion.resumen?.promedio_diario_total||0).toFixed(3)}</td>
                  <td className="p-2">{/* suma recomendación diaria */}{(() => { const sum = recomendacion.modelos?.reduce((s:number,x:any)=> s + (x.recomendacion_diaria||0),0) || 0; return sum; })()}</td>
                  <td className="p-2">{/* suma recomendación mensual */}{(() => { const sum = recomendacion.modelos?.reduce((s:number,x:any)=> s + (x.recomendacion_mensual||0),0) || 0; return sum; })()}</td>
                  <td className="p-2">-</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">Basado 100% en asignación real histórica de modelos a líneas, proyectado a 30 días. Valores &lt;1/día mostrados como frecuencia.</p>
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
            {clienteFiltro && <button onClick={() => abrirModal('cliente')} className="px-3 py-2 text-xs rounded bg-green-600 text-white flex items-center gap-1"><Download size={14} />PDF Cliente</button>}
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
                  <th className="text-left p-2">Modelo</th>
                  <th className="text-left p-2">Cant.</th>
                  <th className="text-left p-2">Cant. Diaria</th>
                  <th className="text-left p-2">Estado</th>
                  <th className="text-left p-2">Fecha</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {filtered.map(s => (
                  <tr key={s.sugerencia_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-2">{s.nombre_cliente || 'N/A'}</td>
                    <td className="p-2">{s.modelo_sugerido}</td>
                    <td className="p-2">{s.cantidad_sugerida}</td>
                    <td className="p-2">{s.cantidad_diaria || '-'}</td>
                    <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[10px] ${s.estado === 'aprobada' ? 'bg-green-100 text-green-700' : s.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{s.estado}</span></td>
                    <td className="p-2">{s.fecha_sugerencia ? new Date(s.fecha_sugerencia).toLocaleDateString() : 'N/A'}</td>
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
              <button onClick={() => { setShowModal(false); if (pdfType === 'general') generarPDF(); else if (pdfType === 'cliente') generarPDFCliente(); else generarPDFIndividual(); }} className="px-3 py-2 rounded bg-blue-600 text-white">Generar PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SugerenciasView;
