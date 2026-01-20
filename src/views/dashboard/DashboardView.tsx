import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Users, 
  Building2, 
  CreditCard,
  UserPlus,
  Package,
  Lightbulb,
  Boxes,
  Scan
} from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
// import { Button } from '../shared/ui/Button';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import SettingsView from './SettingsView';
import { InventarioCredocubesSection } from './components/InventarioCredocubesSection';
import { UsersView } from './UsersView';
import { CredocubesView } from './CredocubesView';
import { TenantInventoryView } from './TenantInventoryView';
import { TenantInventoryRegisterView } from './TenantInventoryRegisterView';
import { TenantsView } from './TenantsView';
import ProspectosView from './prospectos/ProspectosView';
import { CentralInventoryView } from './CentralInventoryView';

export const DashboardView: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Obtener la pestaña activa desde los parámetros de consulta
  const getTabFromQuery = () => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    return tab || 'dashboard';
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromQuery());
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Recuperar el estado de la barra lateral desde localStorage
    const savedState = localStorage.getItem('sidebarOpen');
    return savedState !== null ? savedState === 'true' : true; // Por defecto abierto
  });
  
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  
  // Actualizar la pestaña activa cuando cambien los parámetros de consulta
  useEffect(() => {
    setActiveTab(getTabFromQuery());
  }, [location.search]);
  
  // Actualizar la URL cuando cambie la pestaña activa manualmente
  const handleTabChange = (tab: string) => {
    const safeTab = isTabAllowed(tab) ? tab : 'dashboard';
    setActiveTab(safeTab);
    if (safeTab === 'dashboard') {
      navigate('/dashboard', { replace: true });
    } else {
      navigate(`/dashboard?tab=${safeTab}`, { replace: true });
    }
  };
  
  useEffect(() => {
    // Verificar si la pantalla es grande (lg)
    const checkScreenSize = () => {
      setIsLargeScreen(window.matchMedia('(min-width: 1024px)').matches);
    };
    
    // Verificar al cargar
    checkScreenSize();
    
    // Configurar listener para cambios de tamaño
    window.addEventListener('resize', checkScreenSize);
    
    // Limpiar listener
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  // Guardar el estado de la barra lateral en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('sidebarOpen', String(sidebarOpen));
  }, [sidebarOpen]);
  const { logout, user } = useAuthContext();
  const { theme, toggleTheme } = useThemeContext();

  const role = (user?.role ?? (user as any)?.rol) === 'admin' ? 'admin' : 'comercial';
  const hiddenTabs = new Set(['tenant-inventory', 'credocubes']);
  const allowedTabsForComercial = new Set([
    'dashboard',
    'prospectos',
    'prospectos-clientes',
    'prospectos-inventario',
    'prospectos-sugerencias'
  ]);

  const isTabAllowed = (tab: string) => {
    if (hiddenTabs.has(tab)) return false;
    if (role === 'admin') return true;
    return allowedTabsForComercial.has(tab);
  };

  const baseNavigationItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: Home 
    },
    { 
      id: 'usuarios', 
      label: 'Usuarios', 
      icon: Users 
    },
    { 
      id: 'empresas', 
      label: 'Empresas', 
      icon: Building2 
    },
    { 
      id: 'inventario-central',
      label: 'Inventario central',
      icon: Boxes 
    },
    { 
      id: 'tenant-inventory',
      label: 'Inventarios tenant',
      icon: Boxes 
    },
    { 
      id: 'tenant-register',
      label: 'Registro',
      icon: Scan 
    },
    { 
      id: 'credocubes', 
      label: 'Credocubes', 
      icon: CreditCard 
    },
    { 
      id: 'prospectos', 
      label: 'Prospectos', 
      icon: UserPlus,
      subItems: [
        { id: 'prospectos-clientes', label: 'Clientes', icon: Users },
        { id: 'prospectos-inventario', label: 'Inventario', icon: Package },
        { id: 'prospectos-sugerencias', label: 'Sugerencias', icon: Lightbulb }
      ]
    },
  ];

  const navigationItems = role === 'admin'
    ? baseNavigationItems
    : baseNavigationItems.filter(item => item.id === 'dashboard' || item.id === 'prospectos');
  const visibleNavigationItems = navigationItems.filter(item => !hiddenTabs.has(item.id));

  useEffect(() => {
    if (!isTabAllowed(activeTab)) {
      handleTabChange('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Ya no necesitamos datos falsos para gráficos y métricas

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-all duration-300">
      {/* Mobile Sidebar Overlay - solo visible en pantallas grandes */}
      {sidebarOpen && isLargeScreen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar 
        navigationItems={visibleNavigationItems}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        logout={logout}
        user={user}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenSettings={() => handleTabChange('settings')}
      />

      {/* Main Content */}
      <div className="min-h-screen transition-all duration-300" style={{ marginLeft: isLargeScreen ? (sidebarOpen ? '16rem' : '4rem') : '0' }}>
        {/* Header */}
        <Header 
          setSidebarOpen={setSidebarOpen} 
        />

        {/* Main Dashboard */}
        <main className="p-0">
          {activeTab === 'dashboard' && (
            <div className="p-4 lg:p-6">
              {/* Inventario de Credocubes Section */}
              <InventarioCredocubesSection />
            </div>
          )}
          {activeTab === 'settings' && <SettingsView />}
          
          {role === 'admin' && activeTab === 'usuarios' && <UsersView />}
          {role === 'admin' && activeTab === 'empresas' && <TenantsView />}
          {role === 'admin' && activeTab === 'inventario-central' && <CentralInventoryView />}
          {role === 'admin' && activeTab === 'tenant-inventory' && <TenantInventoryView />}
          {role === 'admin' && activeTab === 'tenant-register' && <TenantInventoryRegisterView />}
          {role === 'admin' && activeTab === 'credocubes' && <CredocubesView />}
          {(activeTab === 'prospectos' || activeTab.startsWith('prospectos-')) && <ProspectosView activeSubTab={activeTab} />}
        </main>
      </div>
    </div>
  );
};
