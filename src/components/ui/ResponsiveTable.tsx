import React, { ReactNode } from 'react';
import { useBreakpoint } from '../../utils/responsive';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => ReactNode);
  className?: string;
  mobileRender?: (item: T) => ReactNode;
  priority?: number; // 1 = alta prioridad (siempre visible), 3 = baja prioridad
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  className?: string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

/**
 * Componente de tabla responsiva que se adapta a diferentes tamaños de pantalla
 * En dispositivos móviles, muestra un diseño de tarjetas en lugar de una tabla tradicional
 */
export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  className = '',
  emptyMessage = 'No hay datos disponibles',
  onRowClick,
}: ResponsiveTableProps<T>) {
  const { isMobile, isTablet } = useBreakpoint();

  // Función para renderizar el valor de una celda
  const renderCell = (item: T, column: Column<T>) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(item);
    }
    return item[column.accessor] as ReactNode;
  };

  // Si no hay datos, mostrar mensaje
  if (data.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  // En dispositivos móviles, mostrar un diseño de tarjetas
  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${
              onRowClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
            }`}
            onClick={() => onRowClick && onRowClick(item)}
          >
            <div className="p-4 space-y-3">
              {columns
                .filter((col) => col.priority !== 3) // Filtrar columnas de baja prioridad en móvil
                .map((column) => (
                  <div key={column.header.toString()} className="flex flex-col">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {column.header}
                    </span>
                    <div className={column.className || 'text-sm'}>
                      {column.mobileRender ? column.mobileRender(item) : renderCell(item, column)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // En tablet, mostrar tabla con menos columnas
  const visibleColumns = isTablet
    ? columns.filter((col) => col.priority !== 3)
    : columns;

  // En pantallas más grandes, mostrar tabla tradicional
  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
        <thead className="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            {visibleColumns.map((column) => (
              <th
                key={column.header.toString()}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              className={onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors' : ''}
              onClick={() => onRowClick && onRowClick(item)}
            >
              {visibleColumns.map((column) => (
                <td
                  key={`${keyExtractor(item)}-${column.header.toString()}`}
                  className={`px-6 py-4 whitespace-nowrap ${column.className || 'text-sm text-gray-500 dark:text-gray-400'}`}
                >
                  {renderCell(item, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
