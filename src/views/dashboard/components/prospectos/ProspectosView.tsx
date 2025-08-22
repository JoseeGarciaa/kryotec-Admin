import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Users, Package, Lightbulb } from 'lucide-react';
import ClientesView from './ClientesView';
import InventarioView from './InventarioView';
import SugerenciasView from './SugerenciasView';

const ProspectosView: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('clientes');

  const menuItems = [
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'sugerencias', label: 'Sugerencias', icon: Lightbulb },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'clientes':
        return <ClientesView />;
      case 'inventario':
        return <InventarioView />;
      case 'sugerencias':
        return <SugerenciasView />;
      default:
        return <ClientesView />;
    }
  };

  return (
    <div className="p-4">
      {/* Cabecera desplegable */}
      <div className="mb-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 bg-gray-800 dark:bg-gray-900 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-800 transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5" />
            <span className="text-lg font-semibold">Prospectos</span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {/* Menú desplegable */}
        {isOpen && (
          <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-600 pl-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className={`mt-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
        {renderContent()}
      </div>
    </div>
  );
};

export default ProspectosView;
