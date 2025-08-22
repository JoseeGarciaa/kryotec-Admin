import React from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface ChartData {
  month: string;
  usuarios: number;
  empresas: number;
}

interface CredocubeData {
  type: string;
  value: number;
  color: string;
}

interface ChartsSectionProps {
  chartData: ChartData[];
  credocubesData: CredocubeData[];
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ chartData, credocubesData }) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
      {/* Growth Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 lg:p-6 transition-all duration-300">
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <div>
            <h3 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-white">Crecimiento de Empresas y Usuarios</h3>
            <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">Últimos 6 meses</p>
          </div>
          <TrendingUp className="w-6 h-6 text-blue-500" />
        </div>
        
        <div className="h-48 lg:h-64 flex items-end justify-between gap-1 lg:gap-2">
          {chartData.map((data, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col items-center mb-2">
                <div 
                  className="w-full bg-gradient-to-t from-purple-500 to-pink-500 rounded-t-lg mb-1"
                  style={{ height: `${data.usuarios * 1.5}px` }}
                ></div>
                <div 
                  className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-lg"
                  style={{ height: `${data.empresas * 1.5}px` }}
                ></div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 lg:mt-2">{data.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 lg:p-6 transition-all duration-300">
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <div>
            <h3 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-white">Distribución de Credocubes</h3>
            <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">Cantidad de credocubes por tipo</p>
          </div>
          <BarChart3 className="w-6 h-6 text-teal-500" />
        </div>
        
        <div className="space-y-3 lg:space-y-4">
          {credocubesData.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className={`w-4 h-4 rounded ${item.color}`}></div>
                <span className="text-sm lg:text-base text-gray-700 dark:text-gray-300">{item.type}</span>
              </div>
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="w-20 lg:w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${item.color}`}
                    style={{ width: `${(item.value / 220) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm lg:text-base text-gray-900 dark:text-white font-medium w-8 lg:w-12 text-right">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
