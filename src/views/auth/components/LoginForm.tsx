import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Button } from '../../shared/ui/Button';
import { Input } from '../../shared/ui/Input';
import { LoginCredentials } from '../../../models/types/auth';

interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading, error }: LoginFormProps) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<LoginCredentials>>({});

  const validateForm = (): boolean => {
    const errors: Partial<LoginCredentials> = {};
    
    if (!credentials.email) {
      errors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(credentials.email)) {
      errors.email = 'El email no es válido';
    }
    
    if (!credentials.password) {
      errors.password = 'La contraseña es requerida';
    } else if (credentials.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    await onSubmit(credentials);
  };

  const handleInputChange = (field: keyof LoginCredentials) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCredentials((prev: LoginCredentials) => ({ ...prev, [field]: e.target.value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev: Partial<LoginCredentials>) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 w-full">
      <div>
        <Input
          type="email"
          label="Email"
          placeholder=""
          value={credentials.email}
          onChange={handleInputChange('email')}
          error={fieldErrors.email}
          leftIcon={<Mail className="w-4 h-4" />}
        />
      </div>

      <div>
        <Input
          type={showPassword ? 'text' : 'password'}
          label="Contraseña"
          placeholder=""
          value={credentials.password}
          onChange={handleInputChange('password')}
          error={fieldErrors.password}
          leftIcon={<Lock className="w-4 h-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        isLoading={isLoading}
        className="w-full"
      >
        {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
      </Button>

  {/* Mensaje informativo opcional (eliminadas credenciales de ejemplo) */}
    </form>
  );
};
