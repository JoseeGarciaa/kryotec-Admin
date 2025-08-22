import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LoginView } from '../auth/LoginView';
import { DashboardView } from '../dashboard/DashboardView';
import { TenantsView } from '../dashboard/TenantsView';
import { useAuthContext } from '../contexts/AuthContext';
import { MobileNavigation } from '../../components/navigation/MobileNavigation';
import { useBreakpoint } from '../../utils/responsive';
import ProspectosView from '../dashboard/components/prospectos/ProspectosView';

// Componente para proteger rutas que requieren autenticación
const ProtectedRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  const { isAuthenticated, isLoading } = useAuthContext();
  const location = useLocation();
  const { isMobile } = useBreakpoint();
  
  // Mostrar un indicador de carga mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Redirigir al login si no está autenticado, guardando la ruta actual
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Renderizar el elemento protegido si está autenticado
  return (
    <>
      {isMobile && <MobileNavigation />}
      {element}
    </>
  );
};

// Componente para manejar la redirección después del login
const AuthRedirect: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      // Redirigir al dashboard si el usuario está autenticado
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  return null;
};

// Componente para la ruta de login
const LoginRoute: React.FC = () => {
  const { isAuthenticated } = useAuthContext();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <LoginView />;
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/dashboard" element={<ProtectedRoute element={<DashboardView />} />} />
        <Route path="/tenants" element={<ProtectedRoute element={<TenantsView />} />} />
        <Route path="/prospectos" element={<ProtectedRoute element={<ProspectosView />} />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<AuthRedirect />} />
      </Routes>
    </BrowserRouter>
  );
};
