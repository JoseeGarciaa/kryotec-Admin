import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Users, 
  Building2, 
  CreditCard,
  UserPlus,
  Package,
  Lightbulb
} from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
// import { Button } from '../shared/ui/Button';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { InventarioCredocubesSection } from './components/InventarioCredocubesSection';
import { UsersView } from './UsersView';
import { CredocubesView } from './CredocubesView';
import { TenantsView } from './TenantsView';
import ProspectosView from './prospectos/ProspectosView';

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
    setActiveTab(tab);
    if (tab === 'dashboard') {
      navigate('/dashboard', { replace: true });
    } else {
      navigate(`/dashboard?tab=${tab}`, { replace: true });
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

  const navigationItems = [
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
        navigationItems={navigationItems}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        logout={logout}
        user={user}
        theme={theme}
        toggleTheme={toggleTheme}
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
          
          {activeTab === 'usuarios' && <UsersView />}
          {activeTab === 'empresas' && <TenantsView />}
          {activeTab === 'credocubes' && <CredocubesView />}
          {activeTab === 'prospectos' && <ProspectosView />}
        </main>
      </div>
    </div>
  );
};
