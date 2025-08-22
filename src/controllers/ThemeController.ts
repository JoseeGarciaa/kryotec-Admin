import { useState, useEffect, useCallback } from 'react';
import { ThemeModel } from '../models/ThemeModel';
import { ThemeMode } from '../models/types/theme';

// El controlador maneja la lógica del tema y actualiza el estado
export const useThemeController = () => {
  // Inicializar el estado con el tema guardado o predeterminado
  const [theme, setTheme] = useState<ThemeMode>('light');
  
  // Cargar el tema al iniciar
  useEffect(() => {
    const savedTheme = ThemeModel.getTheme();
    setTheme(savedTheme);
    ThemeModel.setTheme(savedTheme); // Aplicar el tema al DOM
  }, []);
  
  // Método para cambiar entre temas
  const toggleTheme = useCallback(() => {
    const newTheme = ThemeModel.toggleTheme(theme);
    setTheme(newTheme);
  }, [theme]);
  
  // Método para establecer un tema específico
  const setThemeMode = useCallback((newTheme: ThemeMode) => {
    ThemeModel.setTheme(newTheme);
    setTheme(newTheme);
  }, []);
  
  return {
    theme,
    toggleTheme,
    setTheme: setThemeMode
  };
};
