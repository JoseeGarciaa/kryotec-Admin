import React from 'react';
import { useThemeController } from '../controllers/ThemeController';

interface CredentialsModalProps {
  open: boolean;
  onClose: () => void;
  credentials: {
    usuario: string;
    contraseña: string;
  };
  tenantName: string;
}

const CredentialsModal: React.FC<CredentialsModalProps> = ({ 
  open, 
  onClose, 
  credentials, 
  tenantName 
}) => {
  const { theme } = useThemeController();
  const [usernameCopied, setUsernameCopied] = React.useState(false);
  const [passwordCopied, setPasswordCopied] = React.useState(false);

  const copyToClipboard = (text: string, field: 'username' | 'password') => {
    navigator.clipboard.writeText(text);
    if (field === 'username') {
      setUsernameCopied(true);
      setTimeout(() => setUsernameCopied(false), 2000);
    } else {
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };
  
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        {/* Botón de cerrar en la esquina superior derecha */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Cerrar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Icono de éxito */}
        <div className="flex justify-center mb-4">
          <div className="bg-green-100 dark:bg-green-900 rounded-full p-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        
        {/* Título */}
        <h2 className="text-xl font-bold text-center mb-2">¡Empresa creada con éxito!</h2>
        
        {/* Subtítulo */}
        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
          Se ha creado la empresa <span className="font-semibold">{tenantName}</span> correctamente.
        </p>
        
        {/* Credenciales */}
        <div className={`rounded-lg p-4 mb-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <h3 className="text-center font-medium mb-4">Credenciales de acceso</h3>
          
          {/* Usuario */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuario:</label>
            <div className="flex">
              <input 
                type="text" 
                readOnly 
                value={credentials.usuario} 
                className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-gray-50 dark:bg-gray-800 focus:outline-none"
              />
              <button 
                onClick={() => copyToClipboard(credentials.usuario, 'username')}
                className={`px-3 py-2 rounded-r-md transition-colors ${usernameCopied 
                  ? 'bg-green-500 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                title="Copiar al portapapeles"
              >
                {usernameCopied ? (
                  <span>✓</span>
                ) : (
                  <span>📋</span>
                )}
              </button>
            </div>
          </div>
          
          {/* Contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña:</label>
            <div className="flex">
              <input 
                type="text" 
                readOnly 
                value={credentials.contraseña} 
                className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-gray-50 dark:bg-gray-800 focus:outline-none"
              />
              <button 
                onClick={() => copyToClipboard(credentials.contraseña, 'password')}
                className={`px-3 py-2 rounded-r-md transition-colors ${passwordCopied 
                  ? 'bg-green-500 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                title="Copiar al portapapeles"
              >
                {passwordCopied ? (
                  <span>✓</span>
                ) : (
                  <span>📋</span>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mensaje */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
          Por favor, comparta estas credenciales con el administrador de la empresa para que pueda iniciar sesión.
        </p>
        
        {/* Botón de cerrar */}
        <div className="flex justify-center">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default CredentialsModal;
