import React from 'react';
import { ThemeProvider } from './views/contexts/ThemeContext';
import { AuthProvider } from './views/contexts/AuthContext';
import { AppRouter } from './views/routing/AppRouter';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;