import React, { useState } from 'react';
import ClientesView from './components/ClientesView';
import InventarioView from './components/InventarioView';
import SugerenciasView from './components/SugerenciasView';
import { Users, Package, Lightbulb } from 'lucide-react';

const ProspectosView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'clientes' | 'inventario' | 'sugerencias'>('clientes');

  const tabs = [
    {
      id: 'clientes',
      label: 'Clientes',
      icon: Users,
      component: ClientesView
    },
    {
      id: 'inventario',
      label: 'Inventario',
      icon: Package,
      component: InventarioView
    },
    {
      id: 'sugerencias',
      label: 'Sugerencias',
      icon: Lightbulb,
      component: SugerenciasView
    }
  ] as const;

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || tabs[0].component;

  return (
    <div className="p-4">
      {/* Pestañas */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === id
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              <Icon
                className={`
                  mr-2 h-5 w-5
                  ${activeTab === id
                    ? 'text-blue-500 dark:text-blue-400'
                    : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                  }
                `}
                aria-hidden="true"
              />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido */}
      <div className="mt-4">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default ProspectosView;
