import React, { createContext, useContext } from 'react';
import { useThemeController } from '../../controllers/ThemeController';
import { ThemeContextType } from '../../models/types/theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  const themeController = useThemeController();

  return (
    <ThemeContext.Provider value={themeController}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};