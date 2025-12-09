import React, { useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import credocubeLogo from '../../assets/images/favicon.png';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoginForm } from '../../views/auth/components/LoginForm';
import { useAuthContext } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { Button } from '../shared/ui/Button';
import { LoginCredentials } from '../../models/types/auth';

export const LoginView: React.FC = () => {
  const { login, isLoading, error, isAuthenticated } = useAuthContext();
  const { theme, toggleTheme } = useThemeContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirigir si el usuario ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleLogin = async (credentials: LoginCredentials) => {
    const result = await login(credentials);
    if (result.success) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 sm:p-6 transition-all duration-300">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-lg"
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5 text-gray-600" />
          ) : (
            <Sun className="w-5 h-5 text-yellow-500" />
          )}
        </Button>
      </div>

      <div className="w-full max-w-md mx-auto">
        {/* Logo and Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-2xl mb-4 shadow-lg p-2">
            <img src={credocubeLogo} alt="KryoTec Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">
            KryoTec
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 transition-colors px-4">
            Panel de administración multitenant SaaS
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 transition-all duration-300 mx-4 sm:mx-0">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2 transition-colors">
              Iniciar sesión
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 transition-colors">
              Accede a tu panel de administración
            </p>
          </div>

          <LoginForm
            onSubmit={handleLogin}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-6 sm:mt-8 px-4">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 transition-colors">
            © 2025. Desarrollado por Softdatai.
          </p>
        </div>
      </div>
    </div>
  );
};
