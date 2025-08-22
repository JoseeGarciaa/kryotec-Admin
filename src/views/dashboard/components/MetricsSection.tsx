import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface MetricItem {
  title: string;
  value: string;
  change: string;
  trend: string;
  icon: React.ElementType;
  gradient: string;
  bgGradient: string;
}

interface MetricsSectionProps {
  metrics: MetricItem[];
}

export const MetricsSection: React.FC<MetricsSectionProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={index}
            className={`relative p-4 lg:p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 group shadow-sm hover:shadow-lg`}
          >
            <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${metric.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <h3 className="text-sm lg:text-base text-gray-600 dark:text-gray-400 font-medium">{metric.title}</h3>
                <div className={`p-2 rounded-lg bg-gradient-to-r ${metric.gradient}`}>
                  <Icon className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-1">{metric.value}</div>
                  <div className="flex items-center gap-1 text-sm">
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                    <span className="text-green-500">{metric.change}</span>
                    <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">vs el mes anterior</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
