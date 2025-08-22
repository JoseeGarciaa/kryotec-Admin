import React, { useState, useEffect } from 'react';
import ClientesView from './components/ClientesView';
import InventarioView from './components/InventarioView';
import SugerenciasView from './components/SugerenciasView';
import { Users, Package, Lightbulb } from 'lucide-react';

interface ProspectosViewProps {
  activeSubTab?: string;
}

const ProspectosView: React.FC<ProspectosViewProps> = ({ activeSubTab }) => {
  const [activeTab, setActiveTab] = useState<'clientes' | 'inventario' | 'sugerencias'>(
    activeSubTab?.replace('prospectos-', '') as any || 'clientes'
  );

  // Actualizar el tab activo cuando cambie desde la URL
  useEffect(() => {
    const newTab = activeSubTab?.replace('prospectos-', '') as 'clientes' | 'inventario' | 'sugerencias';
    if (newTab) {
      setActiveTab(newTab);
    }
  }, [activeSubTab]);

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
      <ActiveComponent />
    </div>
  );
};

export default ProspectosView;
