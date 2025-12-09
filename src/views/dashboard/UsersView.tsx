import React, { useMemo, useState } from 'react';
import { useUserController } from '../../controllers/UserController';
import { AdminUser } from '../../models/UserModel';
import { Edit, Trash2, UserPlus, Search, Users, LayoutGrid, List, Eye, EyeOff } from 'lucide-react';
import { formatDate as formatDateCO } from '../../utils/dateUtils';

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

const clampSessionTimeout = (rawValue: string, fallback = 120) => {
  const numeric = parseInt(rawValue, 10);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(15, Math.min(480, numeric));
};

type UserFormState = {
  nombre: string;
  correo: string;
  telefono: string;
  contraseña: string;
  rol: 'admin' | 'soporte';
  activo: boolean;
  session_timeout_minutos: number;
  debe_cambiar_contraseña: boolean;
};

export const UsersView: React.FC = () => {
  const { users, loading, error, fetchUsers, createUser, updateUser, deleteUser } = useUserController();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Estado para el formulario
  const [formData, setFormData] = useState<UserFormState>({
    nombre: '',
    correo: '',
    telefono: '',
    contraseña: '',
    rol: 'soporte' as 'admin' | 'soporte',
    activo: true,
    session_timeout_minutos: 120,
    debe_cambiar_contraseña: true
  });
  const [isCreatePasswordVisible, setIsCreatePasswordVisible] = useState(false);
  const [isEditPasswordVisible, setIsEditPasswordVisible] = useState(false);

  // Manejar cambios en el formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    setFormData((prev: UserFormState) => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : name === 'session_timeout_minutos'
          ? clampSessionTimeout(value, prev.session_timeout_minutos)
          : value
    }));
  };

  // Resetear el formulario
  const resetForm = () => {
    setFormData({
      nombre: '',
      correo: '',
      telefono: '',
      contraseña: '',
      rol: 'soporte',
      activo: true,
      session_timeout_minutos: 120,
      debe_cambiar_contraseña: true
    });
    setIsCreatePasswordVisible(false);
    setIsEditPasswordVisible(false);
  };

  // Manejar envío del formulario de creación
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!PASSWORD_POLICY_REGEX.test(formData.contraseña)) {
        alert('La contraseña debe tener mínimo 8 caracteres e incluir mayúsculas, minúsculas, números y un caracter especial.');
        return;
      }
      await createUser(formData);
      setShowCreateForm(false);
      resetForm();
      fetchUsers(); // Recargar la lista
    } catch (err) {
      console.error('Error al crear usuario:', err);
    }
  };

  // Manejar envío del formulario de edición
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser) return;
    
    try {
      if (formData.contraseña && !PASSWORD_POLICY_REGEX.test(formData.contraseña)) {
        alert('La contraseña debe cumplir la política de seguridad (mínimo 8 caracteres, mayúsculas, minúsculas, números y caracter especial).');
        return;
      }
      const { id } = editingUser;
      // No enviamos la contraseña si está vacía (para no cambiarla)
      const dataToUpdate: Partial<typeof formData> = { ...formData };
      if (!dataToUpdate.contraseña) {
        delete (dataToUpdate as any).contraseña;
      }
      
      await updateUser(id, dataToUpdate);
      setEditingUser(null);
      resetForm();
      fetchUsers(); // Recargar la lista
    } catch (err) {
      console.error('Error al actualizar usuario:', err);
    }
  };

  // Iniciar edición de usuario
  const startEditing = (user: AdminUser) => {
    setEditingUser(user);
    setShowCreateForm(false);
    setFormData({
      nombre: user.nombre,
      correo: user.correo,
      telefono: user.telefono || '',
      contraseña: '', // No mostramos la contraseña actual
      rol: user.rol,
      activo: user.activo,
      session_timeout_minutos: user.session_timeout_minutos ?? 120,
      debe_cambiar_contraseña: user.debe_cambiar_contraseña ?? false
    });
    setIsCreatePasswordVisible(false);
    setIsEditPasswordVisible(false);
  };

  // Manejar eliminación de usuario
  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de que deseas desactivar este usuario?')) {
      try {
        await deleteUser(id);
        fetchUsers(); // Recargar la lista
      } catch (err) {
        console.error('Error al eliminar usuario:', err);
      }
    }
  };

  // Filtrar usuarios por término de búsqueda
  const filteredUsers = users.filter(user => 
    user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.correo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.telefono && user.telefono.includes(searchTerm))
  );

  // Formatear fecha
  const formatDate = (date: Date | null | string) => formatDateCO(date) || 'N/A';

  const passwordPolicyHint = useMemo(
    () => 'Debe incluir mayúsculas, minúsculas, números y caracteres especiales (mínimo 8).',
    []
  );

  const renderSecurityTags = (user: AdminUser) => {
    const tags: { label: string; tone: 'warning' | 'danger' | 'info'; key: string }[] = [];
    if (user.debe_cambiar_contraseña) {
      tags.push({ label: 'Cambio obligatorio', tone: 'warning', key: 'must-change' });
    }
    if (user.intentos_fallidos && user.intentos_fallidos >= 1) {
      tags.push({ label: `${user.intentos_fallidos} intentos fallidos`, tone: 'warning', key: 'failed' });
    }
    const now = new Date();
    const isLocked = user.bloqueado || (user.bloqueado_hasta ? user.bloqueado_hasta > now : false);
    if (isLocked) {
      tags.push({ label: 'Bloqueado', tone: 'danger', key: 'locked' });
    }
    if (user.contraseña_expira_el) {
      const expires = user.contraseña_expira_el;
      const diff = expires.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (days <= 7) {
        tags.push({ label: `Expira en ${days} día${days === 1 ? '' : 's'}`, tone: 'warning', key: 'expires' });
      }
    }
    if (!tags.length) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {tags.map(tag => (
          <span
            key={`${user.id}-${tag.key}`}
            className={`px-2 py-1 text-xs font-medium rounded-full border ${
              tag.tone === 'danger'
                ? 'border-red-400 text-red-600 bg-red-50 dark:bg-red-900/10 dark:text-red-200 dark:border-red-700'
                : tag.tone === 'warning'
                  ? 'border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-900/10 dark:text-amber-200 dark:border-amber-700'
                  : 'border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-900/10 dark:text-blue-200 dark:border-blue-700'
            }`}
          >
            {tag.label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gestión de Usuarios</h1>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Botones para cambiar el modo de vista */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 self-end">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
              title="Vista de tarjetas"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
              title="Vista de tabla"
            >
              <List size={18} />
            </button>
          </div>
          
          {/* Buscador */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
          </div>
          
          {/* Botón para crear usuario */}
          <button
            onClick={() => {
              resetForm();
              setShowCreateForm(true);
              setEditingUser(null);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
          >
            <UserPlus size={18} />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Formulario de creación */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Crear Nuevo Usuario</h2>
          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleInputChange}
                required
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo</label>
              <input
                type="email"
                name="correo"
                value={formData.correo}
                onChange={handleInputChange}
                required
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
              <div className="relative">
                <input
                  type={isCreatePasswordVisible ? 'text' : 'password'}
                  name="contraseña"
                  value={formData.contraseña}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 pr-10 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setIsCreatePasswordVisible(prev => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label={isCreatePasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {isCreatePasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{passwordPolicyHint}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiempo de sesión (minutos)</label>
              <input
                type="number"
                name="session_timeout_minutos"
                value={formData.session_timeout_minutos}
                onChange={handleInputChange}
                min={15}
                max={480}
                step={5}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Define el tiempo máximo inactivo antes de cerrar sesión (entre 15 y 480 minutos).</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
              <select
                name="rol"
                value={formData.rol}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="admin">Administrador</option>
                <option value="soporte">Soporte</option>
              </select>
            </div>
            
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                name="activo"
                checked={formData.activo}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">Usuario activo</label>
            </div>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                name="debe_cambiar_contraseña"
                checked={formData.debe_cambiar_contraseña}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">Solicitar cambio de contraseña en el próximo inicio</label>
            </div>
            
            <div className="md:col-span-2 flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setIsCreatePasswordVisible(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Crear Usuario
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Formulario de edición */}
      {editingUser && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Editar Usuario</h2>
          <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleInputChange}
                required
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo</label>
              <input
                type="email"
                name="correo"
                value={formData.correo}
                onChange={handleInputChange}
                required
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña (dejar en blanco para no cambiar)</label>
              <div className="relative">
                <input
                  type={isEditPasswordVisible ? 'text' : 'password'}
                  name="contraseña"
                  value={formData.contraseña}
                  onChange={handleInputChange}
                  className="w-full p-2 pr-10 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setIsEditPasswordVisible(prev => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label={isEditPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {isEditPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{passwordPolicyHint}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiempo de sesión (minutos)</label>
              <input
                type="number"
                name="session_timeout_minutos"
                value={formData.session_timeout_minutos}
                onChange={handleInputChange}
                min={15}
                max={480}
                step={5}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Aplica al siguiente inicio de sesión del usuario.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
              <select
                name="rol"
                value={formData.rol}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="admin">Administrador</option>
                <option value="soporte">Soporte</option>
              </select>
            </div>
            
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                name="activo"
                checked={formData.activo}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">Usuario activo</label>
            </div>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                name="debe_cambiar_contraseña"
                checked={formData.debe_cambiar_contraseña}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">Solicitar cambio de contraseña en el próximo inicio</label>
            </div>
            
            <div className="md:col-span-2 flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setIsEditPasswordVisible(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Estado de carga y errores */}
      {loading === 'loading' && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Cargando usuarios...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}

      {/* Contenido de usuarios */}
      {loading !== 'loading' && !error && (
        <div>
          {/* Vista de tarjetas */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:translate-y-[-4px]"
                  >
                    {/* Cabecera con ícono */}
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 relative">
                      <div className="absolute top-3 right-3 text-white opacity-80">
                        <Users size={24} />
                      </div>
                      <h3 className="text-lg font-semibold text-white truncate pr-8">{user.nombre}</h3>
                      <p className="text-blue-100 text-sm truncate">{user.correo}</p>
                    </div>
                    
                    {/* Contenido */}
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.rol === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
                            {user.rol === 'admin' ? 'Administrador' : 'Soporte'}
                          </span>
                        </div>
                        <div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.activo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                            {user.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        {user.telefono && (
                          <p className="flex items-center">
                            <span className="font-medium mr-2">Teléfono:</span> {user.telefono}
                          </p>
                        )}
                        <p className="flex items-center">
                          <span className="font-medium mr-2">Último ingreso:</span> {formatDate(user.ultimo_ingreso)}
                        </p>
                        <p className="flex items-center">
                          <span className="font-medium mr-2">Creado:</span> {formatDate(user.fecha_creacion)}
                        </p>
                        <p className="flex items-center">
                          <span className="font-medium mr-2">Tiempo sesión:</span> {user.session_timeout_minutos ?? 'N/D'} min
                        </p>
                        <p className="flex items-center">
                          <span className="font-medium mr-2">Intentos fallidos:</span> {user.intentos_fallidos ?? 0}
                        </p>
                      </div>
                      {renderSecurityTags(user)}
                    </div>
                    
                    {/* Acciones */}
                    <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800 flex justify-end gap-2">
                      <button
                        onClick={() => startEditing(user)}
                        className="p-1.5 rounded-md text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-gray-700"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-1.5 rounded-md text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-gray-700"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                  No se encontraron usuarios
                </div>
              )}
            </div>
          )}

          {/* Vista de tabla */}
          {viewMode === 'table' && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Correo</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Teléfono</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rol</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sesión (min)</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Último Ingreso</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha Creación</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Seguridad</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{user.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{user.nombre}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{user.correo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{user.telefono || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.rol === 'admin' 
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}>
                              {user.rol === 'admin' ? 'Administrador' : 'Soporte'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.activo 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {user.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {user.session_timeout_minutos ?? 'N/D'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatDate(user.ultimo_ingreso)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatDate(user.fecha_creacion)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {renderSecurityTags(user)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => startEditing(user)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                title="Editar"
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                title="Eliminar"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          No se encontraron usuarios
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
