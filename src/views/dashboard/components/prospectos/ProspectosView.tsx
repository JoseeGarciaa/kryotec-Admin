import React, { useState } from 'react';
import ClientesView from './ClientesView';
import InventarioView from './InventarioView';
import SugerenciasView from './SugerenciasView';

const ProspectosView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('clientes');

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
      <h1 className="text-3xl font-bold mb-6">Prospectos</h1>
      
      <div className="flex space-x-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${
            activeTab === 'clientes' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => setActiveTab('clientes')}
        >
          Clientes
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === 'inventario' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => setActiveTab('inventario')}
        >
          Inventario
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === 'sugerencias' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => setActiveTab('sugerencias')}
        >
          Sugerencias
        </button>
      </div>

      {renderContent()}
    </div>
  );
};

export default ProspectosView;
