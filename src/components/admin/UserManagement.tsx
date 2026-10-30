import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { hashPassword } from '../../lib/auth';
import { Plus, CreditCard as Edit2, Trash2, Shield, User } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'cashier';
  created_at: string;
}

export default function UserManagement() {
  const { showToast, showConfirm } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'cashier' as 'admin' | 'cashier',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) setUsers(data);
  };

  const openModal = (user?: AppUser) => {
    setError('');
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        full_name: user.full_name,
        password: '',
        role: user.role,
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        full_name: '',
        password: '',
        role: 'cashier',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (editingUser) {
        const updateData: any = {
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          updated_at: new Date().toISOString(),
        };

        if (formData.password) {
          updateData.password_hash = await hashPassword(formData.password);
        }

        const { error } = await supabase.from('users').update(updateData).eq('id', editingUser.id);

        if (error) {
          console.error('Update error:', error);
          setError(`Erreur lors de la mise à jour: ${error.message}`);
          setLoading(false);
          return;
        }
        showToast('Utilisateur mis à jour avec succès', 'success');
      } else {
        if (!formData.password) {
          setError('Le mot de passe est requis pour un nouvel utilisateur!');
          setLoading(false);
          return;
        }

        const passwordHash = await hashPassword(formData.password);

        const userData = {
          email: formData.email,
          full_name: formData.full_name,
          password_hash: passwordHash,
          role: formData.role,
        };

        const { error } = await supabase.from('users').insert([userData]);

        if (error) {
          console.error('Insert error:', error);
          setError(`Erreur lors de la création: ${error.message}`);
          setLoading(false);
          return;
        }
        showToast('Utilisateur créé avec succès', 'success');
      }

      setShowModal(false);
      setLoading(false);
      loadUsers();
    } catch (err: any) {
      console.error('Error:', err);
      setError(`Erreur: ${err.message || 'Une erreur est survenue'}`);
      setLoading(false);
    }
  };

  const deleteUser = async (id: string) => {
    showConfirm('Êtes-vous sûr de vouloir supprimer cet utilisateur?', async () => {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        showToast('Erreur lors de la suppression de l\'utilisateur', 'error');
      } else {
        showToast('Utilisateur supprimé avec succès', 'success');
        loadUsers();
      }
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion des Utilisateurs</h2>
          <p className="text-gray-600">Gérer les comptes utilisateurs</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition"
        >
          <Plus className="w-5 h-5" />
          Nouvel Utilisateur
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${
                  user.role === 'admin' ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                  {user.role === 'admin' ? (
                    <Shield className="w-6 h-6 text-red-600" />
                  ) : (
                    <User className="w-6 h-6 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-800">{user.full_name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    user.role === 'admin'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user.role === 'admin' ? 'Administrateur' : 'Caissier'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openModal(user)}
                  className="text-blue-600 hover:text-blue-800 p-1"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteUser(user.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600">
                <span className="font-medium">Email:</span> {user.email}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Créé le:</span>{' '}
                {new Date(user.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h3>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe {editingUser && '(laisser vide pour ne pas changer)'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required={!editingUser}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'cashier' })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="cashier">Caissier</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
                    disabled={loading}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? 'En cours...' : (editingUser ? 'Mettre à jour' : 'Créer')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}