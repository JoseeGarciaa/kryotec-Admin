import * as XLSX from 'xlsx';

// Generates and downloads an Excel template aligned to Inventario Prospecto schema
export function downloadInventarioTemplate(options?: { includeSampleRow?: boolean }) {
  const includeSampleRow = options?.includeSampleRow ?? false;

  const headers = [
    'Descripcion',
    'Producto',
    'Largo_mm',
    'Ancho_mm',
    'Alto_mm',
    'Cantidad',
    'Fecha_Despacho (YYYY-MM-DD)',
    'Orden_Despacho',
    'Notas (opcional)'
  ];

  const sampleRow = [
    'Ej: Tapas plásticas',
    'TAPAS',
    120,
    80,
    60,
    100,
    '2025-01-15',
    'OD-12345',
    'Comentarios internos'
  ];

  const data: any[][] = [headers];
  if (includeSampleRow) data.push(sampleRow);

  const ws = XLSX.utils.aoa_to_sheet(data);
  // Set column widths for better readability
  const colWidths = [
    { wch: 28 }, // Descripcion
    { wch: 18 }, // Producto
    { wch: 12 }, // Largo
    { wch: 12 }, // Ancho
    { wch: 12 }, // Alto
    { wch: 12 }, // Cantidad
    { wch: 22 }, // Fecha
    { wch: 16 }, // Orden
    { wch: 24 }  // Notas
  ];
  (ws as any)['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  // Fallback download without file-saver
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Plantilla_Inventario_Cliente.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
