import React, { useState } from 'react';
import { Input } from '../shared/ui/Input';
import { Button } from '../shared/ui/Button';
import { useAuthContext } from '../contexts/AuthContext';
import { AuthAPI, UserAPI } from '../../services/api';

const SettingsView: React.FC = () => {
  const { user, logout } = useAuthContext();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (newPassword.length < 8) {
      alert('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    try {
      setIsChanging(true);
      const uid = parseInt(user.id);
      await AuthAPI.changePassword(uid, oldPassword, newPassword);
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
          <Input
            type="password"
            label="Contraseña actual"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <Input
            type="password"
            label="Nueva contraseña"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            type="password"
            label="Confirmar nueva contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
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
