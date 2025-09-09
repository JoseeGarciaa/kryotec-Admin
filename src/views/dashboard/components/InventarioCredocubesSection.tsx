import React, { useEffect, useRef, useState } from 'react';
import { Package2, AlertCircle, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useInventarioCredocubeController } from '../../../controllers/InventarioCredocubeController';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import gsap from 'gsap';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

// Registramos los componentes necesarios para Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Definimos colores más vibrantes y modernos para el gráfico
const CHART_COLORS = {
  purple: 'rgba(124, 58, 237, 0.9)',   // Púrpura vibrante
  pink: 'rgba(236, 72, 153, 0.9)',      // Rosa chicle
  blue: 'rgba(59, 130, 246, 0.9)',      // Azul brillante
  cyan: 'rgba(14, 165, 233, 0.9)',      // Cian vibrante
  teal: 'rgba(20, 184, 166, 0.9)',      // Verde azulado
  green: 'rgba(34, 197, 94, 0.9)',      // Verde brillante
  lime: 'rgba(132, 204, 22, 0.9)',      // Lima brillante
  yellow: 'rgba(250, 204, 21, 0.9)',    // Amarillo brillante
  orange: 'rgba(249, 115, 22, 0.9)',    // Naranja brillante
  red: 'rgba(239, 68, 68, 0.9)',        // Rojo brillante
};

export const InventarioCredocubesSection: React.FC = () => {
  // Referencias para animaciones GSAP
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  
  // Usamos el controlador para manejar la lógica y el estado
  const { inventario, loading, refreshing, error, refreshInventarioData, prepareChartData } = useInventarioCredocubeController();
  
  // Estado para controlar qué tenants están expandidos
  const [expandedTenants, setExpandedTenants] = useState<{[key: string]: boolean}>({});
  
  // Función para alternar el estado de expansión de un tenant
  const toggleTenantExpansion = (tenantId: string) => {
    setExpandedTenants(prev => ({
      ...prev,
      [tenantId]: !prev[tenantId]
    }));
  };
  
  // Efecto para animar el gráfico cuando se carga
  useEffect(() => {
    if (chartContainerRef.current && !loading && inventario.length > 0) {
      // Animación de entrada para el contenedor del gráfico
      gsap.fromTo(
        chartContainerRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
      );
      
      // Animación para los elementos dentro del gráfico
      const chartElements = chartContainerRef.current.querySelectorAll('.chart-label');
      gsap.fromTo(
        chartElements,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "power2.out", delay: 0.3 }
      );
    }
  }, [loading, inventario]);
  // Preparamos los datos para los gráficos si hay datos disponibles
  const chartData = !loading && !error && inventario.length > 0 ? prepareChartData() : null;
  // Datos para gráfico solo de Cubes por empresa
  const cubesByTenant = React.useMemo(() => {
    if (loading || error || inventario.length === 0) return null;
    const cubes = inventario.filter(i => (i.categoria?.toLowerCase() === 'cube') || (i.tipo_modelo?.toLowerCase() === 'cube'));
    const map: Record<string, number> = cubes.reduce((acc: Record<string, number>, it: any) => {
      const tenant = it.tenant_schema_name || 'N/D';
      acc[tenant] = (acc[tenant] || 0) + 1;
      return acc;
    }, {});
    const labels = Object.keys(map);
    const values = labels.map(l => map[l]);
    return { labels, values };
  }, [inventario, loading, error]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
          <Package2 className="h-6 w-6 mr-2" />
          Inventario de Credocubes
        </h2>
        <button
          onClick={refreshInventarioData}
          disabled={loading || refreshing}
          className={`flex items-center px-4 py-2 rounded-md text-white ${loading || refreshing
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualizando...' : 'Actualizar Inventario'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900 p-4 rounded-md text-red-700 dark:text-red-200">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Error: {error}
          </div>
        </div>
      ) : (
        <div>
          {/* Sección de gráficos */}
          {chartData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center">
                  <span className="bg-gradient-to-r from-blue-600 to-cyan-500 w-2 h-6 rounded mr-2"></span>
                  Unidades por Empresa
                </h3>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: chartData.tenantData.labels,
                      datasets: [{
                        label: 'Unidades',
                        data: chartData.tenantData.datasets[0].data,
                        backgroundColor: chartData.tenantData.labels.map((_, i) => {
                          const colors = [CHART_COLORS.blue, CHART_COLORS.cyan, CHART_COLORS.teal, 
                                         CHART_COLORS.green, CHART_COLORS.purple, CHART_COLORS.pink];
                          return colors[i % colors.length];
                        }),
                        borderColor: 'transparent',
                        borderRadius: 8,
                        borderWidth: 0,
                        hoverBackgroundColor: chartData.tenantData.labels.map((_, i) => {
                          const colors = ['rgba(37, 99, 235, 1)', 'rgba(6, 182, 212, 1)', 'rgba(20, 184, 166, 1)', 
                                         'rgba(34, 197, 94, 1)', 'rgba(124, 58, 237, 1)', 'rgba(236, 72, 153, 1)'];
                          return colors[i % colors.length];
                        }),
                        maxBarThickness: 50
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      animation: {
                        duration: 1000,
                        easing: 'easeOutQuart'
                      }
                    }}
                  />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700" ref={chartContainerRef}>
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center">
                  <span className="bg-gradient-to-r from-purple-600 to-pink-500 w-2 h-6 rounded mr-2"></span>
                  Estado de Unidades
                </h3>
                
                <div className="flex flex-col md:flex-row items-center justify-between">
                  <div className="w-full md:w-3/5 h-64 flex items-center justify-center relative">
                    <Doughnut
                      ref={chartRef}
                      data={{
                        labels: chartData.statusData.labels,
                        datasets: [{
                          label: 'Estado de Unidades',
                          data: chartData.statusData.datasets[0].data,
                          backgroundColor: [
                            CHART_COLORS.purple,
                            CHART_COLORS.pink,
                          ],
                          borderColor: 'transparent',
                          borderWidth: 2,
                          hoverOffset: 8
                          // cutout se debe mover a las opciones, no al dataset
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%', // Movido desde el dataset a las opciones
                        plugins: {
                          legend: {
                            display: false
                          },
                          tooltip: {
                            backgroundColor: 'rgba(17, 24, 39, 0.9)',
                            titleFont: {
                              size: 14,
                              weight: 'bold'
                            },
                            bodyFont: {
                              size: 13
                            },
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                              label: function(context) {
                                const label = context.label || '';
                                const value = context.raw as number || 0;
                                const dataArray = context.chart.data.datasets[0].data as number[];
                                const total = dataArray.reduce((a, b) => Number(a) + Number(b), 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                              }
                            }
                          }
                        },
                        animation: {
                          animateScale: true,
                          animateRotate: true,
                          duration: 1000,
                          easing: 'easeOutCirc'
                        }
                      }}
                    />
                    
                    {/* Texto central en el donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {chartData.statusData.datasets[0].data.reduce((a: number, b: number) => a + b, 0)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Total unidades</div>
                    </div>
                  </div>
                  
                  {/* Leyenda personalizada */}
                  <div className="w-full md:w-2/5 mt-4 md:mt-0 space-y-3">
                    {chartData.statusData.labels.map((label: string, index: number) => {
                      const value = chartData.statusData.datasets[0].data[index] as number;
                      const total = chartData.statusData.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
                      const percentage = Math.round((value / total) * 100);
                      
                      return (
                        <div key={label} className="flex items-center justify-between chart-label">
                          <div className="flex items-center">
                            <div 
                              className="w-4 h-4 rounded-full mr-2" 
                              style={{ backgroundColor: index === 0 ? CHART_COLORS.purple : CHART_COLORS.pink }}
                            ></div>
                            <span className="text-gray-700 dark:text-gray-300">{label}</span>
                          </div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {value} <span className="text-gray-500 dark:text-gray-400 text-sm">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gráfico adicional: Cubes por Empresa */}
          {cubesByTenant && cubesByTenant.labels.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 mb-6">
              <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center">
                <span className="bg-gradient-to-r from-cyan-500 to-blue-600 w-2 h-6 rounded mr-2"></span>
                Cubes por Empresa
              </h3>
              <div className="h-64">
                <Bar
                  data={{
                    labels: cubesByTenant.labels.map(l => l.replace('tenant_', '')),
                    datasets: [{
                      label: 'Cubes',
                      data: cubesByTenant.values,
                      backgroundColor: cubesByTenant.labels.map((_, i) => {
                        const colors = [CHART_COLORS.blue, CHART_COLORS.cyan, CHART_COLORS.teal, CHART_COLORS.green, CHART_COLORS.purple, CHART_COLORS.pink];
                        return colors[i % colors.length];
                      }),
                      borderColor: 'transparent',
                      borderRadius: 8,
                      borderWidth: 0,
                      hoverBackgroundColor: cubesByTenant.labels.map((_, i) => {
                        const colors = ['rgba(37, 99, 235, 1)', 'rgba(6, 182, 212, 1)', 'rgba(20, 184, 166, 1)', 'rgba(34, 197, 94, 1)', 'rgba(124, 58, 237, 1)', 'rgba(236, 72, 153, 1)'];
                        return colors[i % colors.length];
                      }),
                      maxBarThickness: 50
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 1000, easing: 'easeOutQuart' }
                  }}
                />
              </div>
            </div>
          )}

          {/* Inventario agrupado por empresa */}
          <div className="grid grid-cols-1 gap-8 mt-6">
            {inventario.length > 0 && (() => {
              // Definir la interfaz para el objeto agrupado
              interface GroupedInventory {
                [key: string]: typeof inventario;
              }
              
              // Agrupar los datos por empresa
              const groupedByTenant = inventario.reduce<GroupedInventory>((acc, item) => {
                const tenant = item.tenant_schema_name;
                if (!acc[tenant]) {
                  acc[tenant] = [];
                }
                acc[tenant].push(item);
                return acc;
              }, {});
              
              // Renderizar los grupos
              return Object.entries(groupedByTenant).map(([tenant, items]: [string, typeof inventario]) => {
                const unidadesActivas = items.filter(item => item.activo).length;
                const totalUnidades = items.length;
                
                // Crear un ID único para cada tenant
                const tenantId = `tenant-${tenant.replace(/\s+/g, '-').toLowerCase()}`;
                const isExpanded = expandedTenants[tenantId] || false;
                
                return (
                  <div key={tenantId} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {/* Cabecera de la empresa con toggle */}
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 flex justify-between items-center cursor-pointer hover:from-blue-700 hover:to-indigo-800 transition-colors"
                      onClick={() => toggleTenantExpansion(tenantId)}
                    >
                      <div className="flex items-center">
                        <div className="bg-white/20 p-2 rounded-full mr-3">
                          <Package2 className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-white">empresa {tenant.replace('tenant_', '')}</h3>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="bg-white/20 px-3 py-1 rounded-full text-sm text-white">
                          {unidadesActivas}/{totalUnidades} unidades activas
                        </span>
                        <button 
                          className="bg-white/20 p-2 rounded-full text-white hover:bg-white/30 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation(); // Evitar que el clic en el botón también active el div padre
                            toggleTenantExpansion(tenantId);
                          }}
                          aria-label={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                        >
                          {isExpanded ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    {/* Contenido expandido: Solo categoría Cube, agrupado por litros, en tarjetas */}
                    {isExpanded && (() => {
                      type Grupo = { litros: number; count: number };
                      const cubes = items.filter(i => (i.categoria?.toLowerCase() === 'cube') || (i.tipo_modelo?.toLowerCase() === 'cube'));
                      const grupos = cubes.reduce<Record<string, Grupo>>((acc, it) => {
                        const litros = Number((it as any).volumen_litros || 0);
                        const key = String(litros);
                        if (!acc[key]) acc[key] = { litros, count: 0 };
                        acc[key].count += 1;
                        return acc;
                      }, {});
                      const cards = Object.values(grupos).sort((a, b) => a.litros - b.litros);
                      return (
                        <div className="p-5">
                          {cards.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">No hay unidades categoría Cube.</div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                              {cards.map((g) => (
                                <div key={g.litros} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4">
                                    <h4 className="text-lg font-bold text-white">Credo Cube {g.litros}L</h4>
                                  </div>
                                  <div className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-500 dark:text-gray-400">Unidades</span>
                                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">{g.count}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-500 dark:text-gray-400">Categoría</span>
                                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Cube</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              });
            })()}
          </div>
          <ToastContainer position="bottom-right" theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} />
        </div>
      )}
    </div>
  );
};
