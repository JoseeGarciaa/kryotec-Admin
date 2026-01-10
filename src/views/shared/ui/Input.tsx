import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  enforceManualInput?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  className = '',
  type = 'text',
  enforceManualInput = false,
  onPaste,
  onDrop,
  autoComplete,
  ...props
}) => {
  const hasLeft = !!leftIcon;
  const hasRight = !!rightIcon;
  const isSensitiveField = enforceManualInput || type === 'password';

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (isSensitiveField) {
      event.preventDefault();
      return;
    }
    if (onPaste) onPaste(event);
  };

  const handleDrop = (event: React.DragEvent<HTMLInputElement>) => {
    if (isSensitiveField) {
      event.preventDefault();
      return;
    }
    if (onDrop) onDrop(event);
  };
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
          {label}
        </label>
      )}
      <div className={`relative ${hasLeft || hasRight ? 'flex items-center' : ''}`}>
        {hasLeft && (
          <div className="pointer-events-none absolute left-3 inset-y-0 flex items-center text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          className={`w-full ${hasLeft ? 'pl-10' : 'pl-3'} ${hasRight ? 'pr-10' : 'pr-3'} py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
          type={type}
          autoComplete={isSensitiveField ? 'off' : autoComplete}
          onPaste={handlePaste}
          onDrop={handleDrop}
          {...props}
        />
        {hasRight && (
          <div className="absolute right-3 inset-y-0 flex items-center text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 transition-colors">{error}</p>
      )}
    </div>
  );
};
