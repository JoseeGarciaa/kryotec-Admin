import React, { useState, useEffect } from 'react';
import { Menu, X, Home, Users, LogOut, Moon, Sun, Package, Lightbulb } from 'lucide-react';
import credocubeLogo from '../../assets/images/favicon.png';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthContext } from '../../views/contexts/AuthContext';
import { useThemeContext } from '../../views/contexts/ThemeContext';
import { useBreakpoint } from '../../utils/responsive';

/**
 * Componente de navegación móvil que se muestra como un menú hamburguesa en dispositivos pequeños
 */
export const MobileNavigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isMobile } = useBreakpoint();
  const { logout, user } = useAuthContext();
  const { theme, toggleTheme } = useThemeContext();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Forzar re-renderizado cuando cambie la ruta para asegurar que el menú esté cerrado
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);
  
  // Siempre mostrar el componente en dispositivos móviles
  // No usar return null aquí para evitar problemas de renderizado

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const role = (user?.role ?? (user as any)?.rol) === 'admin' ? 'admin' : 'comercial';

  const menuItems = [
    { icon: <Home size={22} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Users size={22} />, label: 'Empresas', path: '/tenants' },
    { icon: <Users size={22} />, label: 'Usuarios', path: '/dashboard?tab=usuarios' },
  // Prospectos (nuevo)
  { icon: <Users size={22} />, label: 'Prospectos', path: '/dashboard?tab=prospectos' },
  { icon: <Package size={22} />, label: 'Inventario (Prospectos)', path: '/dashboard?tab=prospectos-inventario' },
  { icon: <Lightbulb size={22} />, label: 'Sugerencias', path: '/dashboard?tab=prospectos-sugerencias' },
  ];

  const filteredMenuItems = role === 'admin'
    ? menuItems
    : menuItems.filter(item => item.label === 'Dashboard' || item.path.includes('prospectos'));

  const isActive = (path: string) => {
    // Para rutas simples
    if (!path.includes('?')) {
      return location.pathname.startsWith(path);
    }
    
    // Para rutas con parámetros de consulta
    const [basePath, queryParam] = path.split('?');
    if (location.pathname.startsWith(basePath)) {
      // Si la ruta tiene un parámetro tab, verificamos que coincida
      if (queryParam && queryParam.startsWith('tab=')) {
        const tabValue = queryParam.split('=')[1];
        return location.search.includes(`tab=${tabValue}`);
      }
      return true;
    }
    return false;
  };

  return (
    <>
      {/* Botón de menú hamburguesa en la esquina superior izquierda */}
      {isMobile && (
        <button
          onClick={toggleMenu}
          className="fixed top-4 left-3 z-40 p-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg text-white"
          aria-label="Menú de navegación"
       >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}

      {/* Menú modal que aparece desde el centro cuando se hace clic en el botón */}
      {isOpen && (
        <>
          {/* Overlay con efecto de desenfoque */}
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-md animate-fade-in transition-opacity duration-300"
            onClick={closeMenu}
          />
          
          {/* Panel de navegación modal centrado */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col animate-scale-in">
              {/* Encabezado del menú */}
              <div className="p-6 border-b border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-lg p-1">
                      <img src={credocubeLogo} alt="KryoTec Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">KryoTec</h2>
                      <p className="text-xs text-blue-300 mt-0.5">Panel de Administración</p>
                    </div>
                  </div>
                  <button 
                    onClick={closeMenu}
                    className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                    aria-label="Cerrar menú"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Elementos del menú */}
              <nav className="flex-1 overflow-y-auto py-4 px-4">
                <ul className="space-y-2">
                  {filteredMenuItems.map((item) => (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={closeMenu}
                        className={`flex items-center space-x-4 px-4 py-3.5 rounded-xl transition-all w-full text-left ${
                          isActive(item.path)
                            ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-400 shadow-md'
                            : 'text-gray-300 hover:bg-gray-800/70 hover:text-white'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${isActive(item.path) ? 'bg-blue-500 text-white' : 'bg-gray-700/50 text-gray-400'}`}>
                          {item.icon}
                        </div>
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Botón para cambiar tema claro/oscuro */}
              <div className="px-6 pt-4 border-t border-gray-700/50">
                <button
                  onClick={() => toggleTheme()}
                  className="flex items-center space-x-4 w-full px-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-600/20 text-blue-400 hover:from-blue-500/30 hover:to-purple-600/30 hover:text-blue-300 transition-all"
                >
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                    {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
                  </div>
                  <span className="font-medium">{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                </button>
              </div>
              
              {/* Botón de cerrar sesión */}
              <div className="p-6 pt-3">
                <button
                  onClick={() => {
                    closeMenu();
                    logout();
                    navigate('/login');
                  }}
                  className="flex items-center space-x-4 w-full px-4 py-3.5 rounded-xl bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-400 hover:from-red-500/30 hover:to-red-600/30 hover:text-red-300 transition-all"
                >
                  <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                    <LogOut size={22} />
                  </div>
                  <span className="font-medium">Cerrar sesión</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
