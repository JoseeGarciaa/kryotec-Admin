import { useState, useEffect } from 'react';

// Puntos de quiebre para diferentes tamaños de pantalla
export const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export type Breakpoint = keyof typeof breakpoints;

/**
 * Hook para detectar el tamaño de la pantalla y determinar qué breakpoints están activos
 * @returns Objeto con propiedades para cada breakpoint y si está activo
 */
export function useBreakpoint() {
  // Función para detectar si el dispositivo es móvil basado en User Agent y tamaño de pantalla
  const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isMobileSize = typeof window !== 'undefined' && window.innerWidth < 768;
    return isMobileUA || isMobileSize;
  };

  // Estado para dimensiones de la ventana - no lo usamos directamente pero necesitamos el setter
  const [, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    isMobileDevice: typeof navigator !== 'undefined' ? isMobileDevice() : false
  });

  const [breakpoint, setBreakpoint] = useState<{
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    active: Breakpoint;
    isTouchDevice: boolean;
  }>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    active: 'xs',
    isTouchDevice: typeof navigator !== 'undefined' ? isMobileDevice() : false
  });

  useEffect(() => {
    // Manejador para actualizar el estado cuando cambia el tamaño de la ventana
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setDimensions({
        width,
        height,
        isMobileDevice: isMobileDevice()
      });
      
      // Actualizar breakpoint inmediatamente para evitar retrasos
      let active: Breakpoint = 'xs';
      if (width >= breakpoints['2xl']) active = '2xl';
      else if (width >= breakpoints.xl) active = 'xl';
      else if (width >= breakpoints.lg) active = 'lg';
      else if (width >= breakpoints.md) active = 'md';
      else if (width >= breakpoints.sm) active = 'sm';
      
      // Forzar isMobile a true si estamos en un dispositivo móvil o pantalla pequeña
      const forceMobile = width < breakpoints.md || isMobileDevice();
      
      setBreakpoint({
        isMobile: forceMobile,
        isTablet: !forceMobile && width >= breakpoints.md && width < breakpoints.lg,
        isDesktop: !forceMobile && width >= breakpoints.lg,
        active,
        isTouchDevice: isMobileDevice() || 'ontouchstart' in window
      });
    }
    
    // Agregar event listener con throttling para mejor rendimiento
    let timeoutId: ReturnType<typeof setTimeout>;
    const throttledResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };
    
    window.addEventListener('resize', throttledResize);
    
    // Llamar al handler inmediatamente para establecer el estado inicial
    handleResize();
    
    // Limpiar event listener al desmontar
    return () => {
      window.removeEventListener('resize', throttledResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return breakpoint;
}

/**
 * Hook para obtener la orientación del dispositivo
 * @returns La orientación actual del dispositivo ('portrait' o 'landscape')
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth
      ? 'portrait'
      : 'landscape'
  );

  useEffect(() => {
    function handleResize() {
      setOrientation(
        window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
      );
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return orientation;
}

/**
 * Función para aplicar estilos específicos según el tamaño de la pantalla
 * @param base Estilos base que se aplicarán siempre
 * @param responsive Objeto con estilos específicos para cada breakpoint
 * @returns Estilos combinados según el breakpoint actual
 */
export function getResponsiveStyles(
  _base: string, // Prefijo con guion bajo para indicar que es un parámetro no utilizado
  responsive: Partial<Record<Breakpoint, string>>
): string {
  return Object.entries(responsive)
    .map(([breakpoint, styles]) => {
      const minWidth = breakpoints[breakpoint as Breakpoint];
      return `@media (min-width: ${minWidth}px) { ${styles} }`;
    })
    .join(' ');
}
