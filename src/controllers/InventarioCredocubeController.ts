import { useState, useEffect } from 'react';
import { InventarioCredocube, getInventarioCredocubes, refreshInventarioCredocubes } from '../models/InventarioCredocubeModel';
import { toast } from 'react-toastify';

export const useInventarioCredocubeController = () => {
  const [inventario, setInventario] = useState<InventarioCredocube[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInventario = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Obtenemos los datos reales de la API usando la consulta SQL especificada
      const data = await getInventarioCredocubes();
      setInventario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error al cargar inventario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventario();
  }, []);

  // Función para refrescar los datos ejecutando la función SQL
  const refreshInventarioData = async () => {
    try {
      setRefreshing(true);
      // Ejecutamos la función SQL para refrescar el inventario
      await refreshInventarioCredocubes();
      // Obtenemos los datos actualizados
      await fetchInventario();
      toast.success('Inventario actualizado correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el inventario');
      toast.error('Error al actualizar el inventario');
      console.error('Error al refrescar inventario:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Formatear fecha para visualización
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-MX');
  };

  // Preparar datos para gráfico de barras
  const prepareChartData = () => {
    // Agrupar por tenant_schema_name y contar unidades
    const tenantCounts = inventario.reduce((acc, item) => {
      const tenant = item.tenant_schema_name;
      acc[tenant] = (acc[tenant] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Agrupar por estado activo/inactivo
    const statusCounts = inventario.reduce(
      (acc, item) => {
        if (item.activo) {
          acc.activos++;
        } else {
          acc.inactivos++;
        }
        return acc;
      },
      { activos: 0, inactivos: 0 }
    );

    return {
      tenantData: {
        labels: Object.keys(tenantCounts).map(name => `empresa ${name.replace('tenant_', '')}`),
        datasets: [
          {
            label: 'Unidades por Empresa',
            data: Object.values(tenantCounts),
            backgroundColor: [
              'rgba(37, 99, 235, 0.85)',   // Azul más intenso
              'rgba(220, 38, 38, 0.85)',    // Rojo más intenso
              'rgba(5, 150, 105, 0.85)',    // Verde esmeralda
              'rgba(234, 179, 8, 0.85)',     // Amarillo ámbar
              'rgba(124, 58, 237, 0.85)',    // Púrpura más intenso
              'rgba(249, 115, 22, 0.85)'     // Naranja más intenso
            ],
            borderColor: [
              'rgba(30, 64, 175, 1)',       // Borde azul oscuro
              'rgba(185, 28, 28, 1)',       // Borde rojo oscuro
              'rgba(4, 120, 87, 1)',        // Borde verde oscuro
              'rgba(202, 138, 4, 1)',       // Borde amarillo oscuro
              'rgba(109, 40, 217, 1)',      // Borde púrpura oscuro
              'rgba(194, 65, 12, 1)'        // Borde naranja oscuro
            ],
            borderWidth: 1
          }
        ]
      },
      statusData: {
        labels: ['Activos', 'Inactivos'],
        datasets: [
          {
            label: 'Estado de Unidades',
            data: [statusCounts.activos, statusCounts.inactivos],
            backgroundColor: [
              'rgba(124, 58, 237, 0.9)',    // Púrpura vibrante
              'rgba(236, 72, 153, 0.9)'      // Rosa chicle
            ],
            borderColor: [
              'rgba(109, 40, 217, 1)',       // Borde púrpura oscuro
              'rgba(219, 39, 119, 1)'        // Borde rosa oscuro
            ],
            borderWidth: 1
          }
        ]
      }
    };
  };

  return {
    inventario,
    loading,
    refreshing,
    error,
    refreshInventarioData,
    formatDate,
    prepareChartData
  };
};
