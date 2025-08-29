import React, { ReactNode } from 'react';
import { useBreakpoint } from '../../utils/responsive';

interface MainLayoutProps {
  children: ReactNode;
  header?: ReactNode;
  sidebar?: ReactNode;
  footer?: ReactNode;
}

/**
 * Componente de layout principal que se adapta a diferentes tamaños de pantalla
 * En dispositivos móviles, muestra una navegación móvil y oculta la barra lateral
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  header,
  sidebar,
  footer,
}) => {
  const { isMobile } = useBreakpoint();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      {/* La navegación móvil ahora se maneja a nivel de rutas en AppRouter */}

      <div className="flex min-h-screen">
        {/* Barra lateral (oculta en dispositivos móviles) */}
        {!isMobile && sidebar && (
          <aside className="w-64 border-r border-gray-200 dark:border-gray-800 min-h-screen">
            {sidebar}
          </aside>
        )}

        {/* Contenido principal */}
  <main className={`flex-1 flex flex-col`}>
          {/* Encabezado */}
          {header && (
            <header className={`sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm ${isMobile ? 'pl-14' : ''}`}>
              {header}
            </header>
          )}

          {/* Contenido */}
          <div className="flex-1 p-3 sm:p-6">
            {children}
          </div>

          {/* Pie de página */}
          {footer && (
            <footer className="border-t border-gray-200 dark:border-gray-800 p-4">
              {footer}
            </footer>
          )}
        </main>
      </div>
    </div>
  );
};
