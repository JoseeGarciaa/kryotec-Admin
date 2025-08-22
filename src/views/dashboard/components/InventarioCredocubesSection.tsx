import React, { useEffect, useRef, useState } from 'react';
import { Package2, AlertCircle, CheckCircle2, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
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
  const { inventario, loading, refreshing, error, refreshInventarioData, formatDate, prepareChartData } = useInventarioCredocubeController();
  
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
                              return `Unidades: ${context.raw}`;
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                            font: {
                              size: 11
                            },
                            padding: 8
                          },
                          grid: {
                            color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                            // Eliminamos propiedades no compatibles con GridLineOptions
                          }
                        },
                        x: {
                          ticks: {
                            color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                            font: {
                              size: 11
                            },
                            padding: 8
                          },
                          grid: {
                            display: false
                            // Eliminamos propiedades no compatibles con GridLineOptions
                          }
                        }
                      },
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
                    
                    {/* Tabla de unidades de esta empresa - Visible solo si está expandida */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Nombre Unidad
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Fecha Ingreso
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Última Actualización
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Estado
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {items.map((item, index: number) => (
                              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">
                                  {item.nombre_unidad}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                  {formatDate(item.fecha_ingreso)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                  {formatDate(item.ultima_actualizacion)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${
                                    item.activo
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  }`}>
                                    {item.activo ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Activo
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Inactivo
                                      </>
                                    )}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
