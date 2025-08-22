import React, { ReactNode } from 'react';
import { useBreakpoint } from '../../utils/responsive';

interface ResponsiveLayoutProps {
  children: ReactNode;
  className?: string;
  mobileClassName?: string;
  tabletClassName?: string;
  desktopClassName?: string;
}

/**
 * Componente de layout responsivo que aplica diferentes clases según el tamaño de la pantalla
 */
export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  className = '',
  mobileClassName = '',
  tabletClassName = '',
  desktopClassName = '',
}) => {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  // Determinar qué clases aplicar según el breakpoint actual
  const responsiveClasses = [
    className,
    isMobile ? mobileClassName : '',
    isTablet ? tabletClassName : '',
    isDesktop ? desktopClassName : '',
  ].filter(Boolean).join(' ');

  return <div className={responsiveClasses}>{children}</div>;
};

/**
 * Componente que solo se muestra en dispositivos móviles
 */
export const MobileOnly: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const { isMobile } = useBreakpoint();
  
  if (!isMobile) return null;
  
  return <div className={className}>{children}</div>;
};

/**
 * Componente que solo se muestra en tablets y escritorio
 */
export const TabletUp: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const { isMobile } = useBreakpoint();
  
  if (isMobile) return null;
  
  return <div className={className}>{children}</div>;
};

/**
 * Componente que solo se muestra en escritorio
 */
export const DesktopOnly: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const { isDesktop } = useBreakpoint();
  
  if (!isDesktop) return null;
  
  return <div className={className}>{children}</div>;
};
