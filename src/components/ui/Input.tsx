import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  enablePasswordToggle?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  type = 'text',
  enablePasswordToggle = false,
  ...props
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPasswordField = type === 'password';
  const resolvedType = enablePasswordToggle && isPasswordField
    ? (isPasswordVisible ? 'text' : 'password')
    : type;

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(prev => !prev);
  };

  const inputClassName = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
  } text-gray-900 dark:text-white bg-white dark:bg-gray-800 ${
    enablePasswordToggle && isPasswordField ? 'pr-10' : ''
  } ${className}`;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type={resolvedType}
          className={inputClassName}
          {...props}
        />
        {enablePasswordToggle && isPasswordField && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};
