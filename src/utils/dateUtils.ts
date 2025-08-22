/**
 * Formatea una fecha en formato ISO a un formato legible
 * @param dateString Fecha en formato ISO o string compatible con Date
 * @returns Fecha formateada en formato DD/MM/YYYY HH:MM
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    // Verificar si la fecha es válida
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    // Formatear la fecha como DD/MM/YYYY HH:MM
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error al formatear fecha:', error);
    return 'Error en formato de fecha';
  }
};
