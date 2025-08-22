import { ThemeMode } from './types/theme';

export class ThemeModel {
  // Obtiene el tema guardado o usa el predeterminado
  static getTheme(): ThemeMode {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    
    // Si no hay tema guardado, detectar preferencia del sistema
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  // Guarda el tema seleccionado
  static setTheme(theme: ThemeMode): void {
    localStorage.setItem('theme', theme);
    
    // Aplicar clase al elemento HTML para cambiar el tema
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  // Alterna entre temas
  static toggleTheme(currentTheme: ThemeMode): ThemeMode {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
    return newTheme;
  }
}
