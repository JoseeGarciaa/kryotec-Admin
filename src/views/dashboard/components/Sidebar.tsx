import React, { useEffect, useState } from 'react';
import { LogOut, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Settings, Bell, Moon, Sun } from 'lucide-react';
import credocubeLogo from '../../../assets/images/favicon.png';
import type { LucideIcon } from 'lucide-react';
import { User } from '../../../models/types/auth';
import { ThemeMode } from '../../../models/types/theme';

interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  subItems?: NavigationItem[];
}

interface SidebarProps {
  navigationItems: NavigationItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  logout: () => void;
  user: User | null;
  theme: ThemeMode;
  toggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  navigationItems,
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  logout,
  user,
  theme,
  toggleTheme
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['prospectos']);
  
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
  
  // No renderizar nada en dispositivos móviles
  if (!isLargeScreen) return null;
  return (
    <div 
      className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 ${!sidebarOpen && !isLargeScreen ? '-translate-x-full' : 'translate-x-0'}`}
      style={{
        width: isLargeScreen 
          ? (sidebarOpen ? '16rem' : '4rem') 
          : (sidebarOpen ? '16rem' : '0')
      }}
    >
      {/* Mobile Close Button */}
      <button
        onClick={() => setSidebarOpen(false)}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
      >
        <X className="w-5 h-5" />
      </button>
      
      {/* Toggle Sidebar Button (visible only on desktop) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="hidden lg:flex absolute -right-4 top-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md hover:shadow-lg transition-all duration-200"
      >
        {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <div className="h-full flex flex-col">
        {/* Encabezado con logo */}
        <div className={`p-6 ${!sidebarOpen ? 'lg:p-3' : ''}`}>
          <div className={`flex items-center gap-3 mb-8 ${!sidebarOpen ? 'lg:justify-center lg:mb-6' : ''}`}>
            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm p-1">
              <img src={credocubeLogo} alt="KryoSense Logo" className="w-full h-full object-contain" />
            </div>
            {sidebarOpen && <h1 className="text-xl font-bold text-gray-900 dark:text-white">KryoSense</h1>}
          </div>
        </div>

        {/* Navegación scrollable */}
        <div className={`flex-1 overflow-y-auto px-6 ${!sidebarOpen ? 'lg:px-3' : ''}`}>
          <nav className="space-y-2">
            {navigationItems.map((item) => {
            const IconComponent = item.icon;
            const isExpanded = expandedItems.includes(item.id);
            const isActive = activeTab === item.id || activeTab.startsWith(`${item.id}-`);

            return (
              <div key={item.id}>
                <button
                  onClick={() => {
                    if (item.subItems) {
                      setExpandedItems(prev => 
                        prev.includes(item.id) 
                          ? prev.filter(id => id !== item.id)
                          : [...prev, item.id]
                      );
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between ${sidebarOpen ? 'px-4' : 'lg:justify-center px-2'} py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className="w-5 h-5" />
                    {sidebarOpen && <span className="font-medium">{item.label}</span>}
                  </div>
                  {item.subItems && sidebarOpen && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {/* SubItems */}
                {item.subItems && isExpanded && sidebarOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-600 pl-4">
                    {item.subItems.map(subItem => {
                      const SubIconComponent = subItem.icon;
                      const isSubItemActive = activeTab === subItem.id;

                      return (
                        <button
                          key={subItem.id}
                          onClick={() => setActiveTab(subItem.id)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${
                            isSubItemActive
                              ? 'bg-blue-500 text-white'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <SubIconComponent className="w-4 h-4" />
                          <span className="text-sm">{subItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </nav>
        </div>

        {/* Sección inferior fija al flujo (no absoluta) */}
        <div className={`${sidebarOpen ? 'px-6' : 'lg:px-3'} pb-6`}>
          {/* Usuario y menú de opciones */}
          <div className={`border-t border-gray-200 dark:border-gray-700 pt-4 mb-4 ${!sidebarOpen ? 'hidden lg:block' : ''}`}>
            <div 
              className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.name?.charAt(0) || 'A'}
                </span>
              </div>
              {sidebarOpen && (
                <div className="flex-1 overflow-hidden flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || 'Usuario Admin'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || 'test@kryosense.com'}</p>
                  </div>
                  {userMenuOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
              )}
            </div>

            {/* Opciones de configuración */}
            {sidebarOpen && userMenuOpen && (
              <div className="space-y-1 pl-11 mt-1 transition-all duration-300 ease-in-out">
                <button className="flex items-center w-full px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                  <Settings className="w-4 h-4 mr-3" />
                  Configuración
                </button>
                <button className="flex items-center w-full px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                  <Bell className="w-4 h-4 mr-3" />
                  Notificaciones
                </button>
                <button 
                  onClick={toggleTheme}
                  className="flex items-center w-full px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-4 h-4 mr-3 text-yellow-500" />
                      Modo claro
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 mr-3" />
                      Modo oscuro
                    </>
                  )}
                </button>
                <button 
                  onClick={logout}
                  className="flex items-center w-full px-2 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>

          {/* Botón de cerrar sesión cuando la barra está colapsada */}
          {!sidebarOpen && (
            <button 
              onClick={logout}
              className="flex items-center justify-center p-2 rounded-lg w-full text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 mt-auto"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
