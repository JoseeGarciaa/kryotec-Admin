import React, { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../shared/ui/Input';
import { Button } from '../shared/ui/Button';
import { useAuthContext } from '../contexts/AuthContext';
import { AuthAPI, UserAPI } from '../../services/api';

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

const SettingsView: React.FC = () => {
  const { user, logout, updateUserSecurity, refreshUser } = useAuthContext();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const securityInfo = user?.security;
  const passwordExpiresLabel = useMemo(() => {
    if (!securityInfo?.passwordExpiresAt) return 'No disponible';
    try {
      const date = new Date(securityInfo.passwordExpiresAt);
      return date.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    } catch {
      return securityInfo.passwordExpiresAt;
    }
  }, [securityInfo?.passwordExpiresAt]);

  const passwordChangedLabel = useMemo(() => {
    if (!securityInfo?.passwordChangedAt) return 'Pendiente';
    try {
      const date = new Date(securityInfo.passwordChangedAt);
      return date.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    } catch {
      return securityInfo.passwordChangedAt;
    }
  }, [securityInfo?.passwordChangedAt]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('Completa todos los campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('La nueva contraseña y la confirmación no coinciden');
      return;
    }
    if (!PASSWORD_POLICY_REGEX.test(newPassword)) {
      alert('La contraseña debe tener mínimo 8 caracteres e incluir mayúsculas, minúsculas, números y caracteres especiales.');
      return;
    }
    try {
      setIsChanging(true);
      const uid = parseInt(user.id);
      const result = await AuthAPI.changePassword(uid, oldPassword, newPassword);
      if (result.security) {
        updateUserSecurity({
          ...result.security,
          passwordChangedAt: new Date().toISOString()
        });
      } else {
        await refreshUser();
      }
      alert('Contraseña actualizada correctamente');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(err?.message || 'No se pudo cambiar la contraseña');
    } finally {
      setIsChanging(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    const confirmed = window.confirm('¿Seguro que deseas eliminar tu cuenta? Esta acción desactivará tu usuario.');
    if (!confirmed) return;
    try {
      setIsDeleting(true);
      await UserAPI.deleteUser(parseInt(user.id));
      alert('Tu cuenta fue desactivada. Serás redirigido al inicio de sesión.');
      logout();
    } catch (err: any) {
      alert(err?.message || 'No se pudo eliminar la cuenta');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-xl space-y-6">
        <h2 className="text-2xl font-semibold mb-2">Configuración de la cuenta</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Actualiza tu contraseña o elimina tu cuenta.</p>

        <form onSubmit={handleChangePassword} className="space-y-4 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium">Cambiar contraseña</h3>
          {securityInfo?.mustChangePassword && (
            <div className="p-3 border border-amber-300 bg-amber-50 text-amber-800 rounded">
              Debes cambiar tu contraseña antes de continuar usando el sistema.
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            La contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas, números y un caracter especial.
          </p>
          <Input
            type={showOldPassword ? 'text' : 'password'}
            label="Contraseña actual"
            value={oldPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOldPassword(e.target.value)}
            rightIcon={(
              <button
                type="button"
                onClick={() => setShowOldPassword(v => !v)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={showOldPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          />
          <Input
            type={showNewPassword ? 'text' : 'password'}
            label="Nueva contraseña"
            value={newPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
            rightIcon={(
              <button
                type="button"
                onClick={() => setShowNewPassword(v => !v)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          />
          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            label="Confirmar nueva contraseña"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            rightIcon={(
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-200">Último cambio:</span>
              <p>{passwordChangedLabel}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-200">Vencimiento:</span>
              <p>{passwordExpiresLabel}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="submit" isLoading={isChanging}>Guardar</Button>
            <Button type="button" variant="secondary" onClick={() => { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}>Cancelar</Button>
          </div>
        </form>

        <div className="space-y-3 bg-white dark:bg-gray-800 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <h3 className="text-lg font-medium text-red-600 dark:text-red-400">Eliminar cuenta</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Esta acción desactivará tu usuario y cerrarás sesión.</p>
          <Button variant="secondary" className="!bg-red-100 dark:!bg-red-900/30 !text-red-700 dark:!text-red-300 hover:!bg-red-200" onClick={handleDeleteAccount} isLoading={isDeleting}>
            Eliminar mi cuenta
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
