import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // ¡Añade esta línea! Le dice a Vite que genere rutas absolutas para los assets.
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Corregido el puerto del proxy para que coincida con el puerto del servidor API
        changeOrigin: true,
        secure: false,
      }
    }
  },
});