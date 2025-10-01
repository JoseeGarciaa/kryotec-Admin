import ExcelJS from 'exceljs';

// Generates and downloads a styled Excel template aligned to Inventario Prospecto schema
export async function downloadInventarioTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kryotec';
  wb.created = new Date();

  // Brand colors
  const brandDark = '1F2937'; // gray-800
  const brandBlue = '2563EB'; // blue-600

  // Sheet 1: Inventario
  const ws = wb.addWorksheet('Inventario', {
    views: [{ state: 'frozen', ySplit: 6 }]
  });

  // Title block
  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = 'KRYOTEC | Plantilla Inventario de Cliente';
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandBlue } };

  ws.mergeCells('A2:H2');
  ws.getCell('A2').value = `Generado: ${new Date().toLocaleString()}`;
  ws.getCell('A2').font = { size: 11, color: { argb: 'FFCBD5E1' } };
  ws.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandDark } };

  // Notes row
  ws.mergeCells('A4:H4');
  ws.getCell('A4').value = 'Importante: Rellene todos los campos. Solo "Descripcion" es opcional.';
  ws.getCell('A4').font = { italic: true, color: { argb: 'FF64748B' } };
  ws.getCell('A4').alignment = { wrapText: true } as any;
  ws.getRow(4).height = 24;

  // Headers at row 6
  const headerRow = 6;
  const headers = [
    'Descripcion',
    'Producto',
    'Largo_mm',
    'Ancho_mm',
    'Alto_mm',
    'Cantidad',
    'Fecha_Despacho (YYYY-MM-DD)',
    'Orden_Despacho'
  ];
  ws.addRow([]); // row 3 placeholder
  ws.addRow([]); // row 4 notes
  ws.addRow([]); // row 5 spacer
  const row = ws.addRow(headers);
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandBlue } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1F2937' } },
      left: { style: 'thin', color: { argb: 'FF1F2937' } },
      bottom: { style: 'thin', color: { argb: 'FF1F2937' } },
      right: { style: 'thin', color: { argb: 'FF1F2937' } }
    };
  });

  // Column widths
  ws.columns = [
    { key: 'descripcion', width: 30 },
    { key: 'producto', width: 18 },
    { key: 'largo', width: 12 },
    { key: 'ancho', width: 12 },
    { key: 'alto', width: 12 },
    { key: 'cantidad', width: 12 },
    { key: 'fecha', width: 22 },
    { key: 'orden', width: 18 }
  ];

  // Data validations for next 2000 rows
  const maxRows = 2000;
  for (let r = headerRow + 1; r <= headerRow + maxRows; r++) {
    // Largo, Ancho, Alto: permitir decimales >= 0.1 (mm)
    ['C', 'D', 'E', 'F'].forEach((col) => {
      if (col === 'F') {
        // Cantidad
        ws.getCell(`${col}${r}`).dataValidation = {
          type: 'whole', operator: 'greaterThanOrEqual', showErrorMessage: true,
          allowBlank: false, formulae: [1], errorStyle: 'error',
          errorTitle: 'Valor inválido', error: 'Debe ser un número entero mayor o igual a 1'
        } as any;
        // Formato sin decimales para cantidad
        ws.getCell(`${col}${r}`).numFmt = '0';
      } else {
        ws.getCell(`${col}${r}`).dataValidation = {
          type: 'decimal', operator: 'greaterThanOrEqual', showErrorMessage: true,
          allowBlank: false, formulae: [0.1], errorStyle: 'error',
          errorTitle: 'Valor inválido', error: 'Debe ser un número mayor o igual a 0.1 (mm). Se aceptan decimales con coma (,).'
        } as any;
        // Formato con dos decimales para ayudar a la visualización
        ws.getCell(`${col}${r}`).numFmt = '0.00';
      }
    });
    // Fecha
    const dateCell = ws.getCell(`G${r}`);
    dateCell.numFmt = 'yyyy-mm-dd';
    dateCell.dataValidation = {
      type: 'date', operator: 'between', showErrorMessage: true,
      allowBlank: true, formulae: [new Date(2000, 0, 1), new Date(2100, 0, 1)],
      errorTitle: 'Fecha inválida', error: 'Usa el formato YYYY-MM-DD'
    } as any;

    // Orden_Despacho requerido (texto no vacío)
    ws.getCell(`H${r}`).dataValidation = {
      type: 'textLength', operator: 'greaterThan', formulae: [0], allowBlank: false,
      showErrorMessage: true, errorTitle: 'Requerido', error: 'Orden_Despacho es obligatorio'
    } as any;
    // Forzar texto para Orden_Despacho
    ws.getCell(`H${r}`).numFmt = '@';
  }

  // Content background for data area (optional light band)
  // headers already styled

  // Sheet 2: Manual
  const manual = wb.addWorksheet('Manual de uso');
  manual.mergeCells('A1:D1');
  manual.getCell('A1').value = 'KRYOTEC | Manual de uso de plantilla';
  manual.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  manual.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  manual.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandBlue } };

  const instrucciones = [
    '1) Completa una fila por producto a ingresar en inventario.',
    '2) Descripcion: texto opcional con detalles del producto.',
    '3) Producto: el nombre o tipo (ej.: TAPAS, JERINGAS, ICOPOR, TERMICO).',
  '4) Largo_mm, Ancho_mm, Alto_mm: ingresar valores en milímetros. Se permiten decimales y usa coma (,) como separador (ej.: 87,2).',
  '5) Cantidad: ingresar un número entero mayor o igual a 1 (sin decimales).',
    '6) Fecha_Despacho: usar el formato YYYY-MM-DD (ej.: 2025-01-15). Puede dejarse vacío si no aplica.',
  '7) Orden_Despacho: obligatorio (ej.: OD-12345). Se guarda como texto, sin decimales.',
    '8) No modifiques los títulos de las columnas. Puedes añadir tantas filas como necesites.',
    '9) Evitamos duplicados por cliente usando la combinación: Descripcion + Producto + dimensiones (Largo/Ancho/Alto) + Cantidad + Orden.'
  ];
  manual.getColumn(1).width = 110;
  instrucciones.forEach((linea, idx) => {
    const r = manual.addRow([linea]);
    if (idx === 0) {
      r.getCell(1).font = { size: 12, color: { argb: 'FF111827' } };
    }
  });

  // Write file
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Kryotec_Plantilla_Inventario_Cliente.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
