import React from 'react';
import { Menu } from 'lucide-react';
import { useBreakpoint } from '../../../utils/responsive';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  setSidebarOpen
}) => {
  const { isMobile } = useBreakpoint();
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 lg:p-6 transition-all duration-300 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button - solo visible en pantallas grandes */}
          {!isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          
          <div>
            <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              Bienvenido a Kryotecsense
            </h2>
            <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
              Panel de administración multitenant SaaS • Sistema operativo 
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Espacio reservado para mantener el layout */}
          <div className="w-8"></div>
        </div>
      </div>
    </header>
  );
};
