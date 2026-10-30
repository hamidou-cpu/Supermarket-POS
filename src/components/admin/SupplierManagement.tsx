import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Truck, Search, Star, TrendingUp, Package } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status?: string | null;
  category?: string | null;
  rating?: number | null;
  created_at?: string;
}

interface SupplierStats {
  totalOrders: number;
  totalAmount: number;
  productCount: number;
}

export default function SupplierManagement() {
  const { showToast, showConfirm } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierStats, setSupplierStats] = useState<Record<string, SupplierStats>>({});
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    status: 'active',
    category: '',
    rating: 5,
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    filterSuppliers();
  }, [suppliers, searchQuery, statusFilter]);

  const loadSuppliers = async () => {
    const { data, error } = await supabase.from('suppliers').select('*').order('name');
    if (!error && data) {
      setSuppliers(data);
      loadSupplierStats(data);
    }
  };

  const loadSupplierStats = async (supplierList: Supplier[]) => {
    const stats: Record<string, SupplierStats> = {};

    for (const supplier of supplierList) {
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('supplier_id', supplier.id);

      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('quantity, unit_price')
        .in('product_id', products?.map(p => p.id) || []);

      const totalAmount = saleItems?.reduce((sum, item) => sum + (Number(item.unit_price) * item.quantity), 0) || 0;

      stats[supplier.id] = {
        totalOrders: saleItems?.length || 0,
        totalAmount: totalAmount,
        productCount: products?.length || 0,
      };
    }

    setSupplierStats(stats);
  };

  const filterSuppliers = () => {
    let filtered = suppliers;

    if (searchQuery) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone?.includes(searchQuery)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    setFilteredSuppliers(filtered);
  };

  const openModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contact_person: supplier.contact_person || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        status: supplier.status || 'active',
        category: supplier.category || '',
        rating: supplier.rating || 5,
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        status: 'active',
        category: '',
        rating: 5,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const supplierData = {
      name: formData.name,
      contact_person: formData.contact_person || null,
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      status: formData.status,
      category: formData.category || null,
      rating: formData.rating,
    };

    if (editingSupplier) {
      const { error } = await supabase.from('suppliers').update(supplierData).eq('id', editingSupplier.id);
      if (error) {
        showToast('Erreur lors de la mise à jour du fournisseur', 'error');
        return;
      }
      showToast('Fournisseur mis à jour avec succès', 'success');
    } else {
      const { error } = await supabase.from('suppliers').insert([supplierData]);
      if (error) {
        showToast('Erreur lors de la création du fournisseur', 'error');
        return;
      }
      showToast('Fournisseur créé avec succès', 'success');
    }

    setShowModal(false);
    loadSuppliers();
  };

  const deleteSupplier = async (id: string) => {
    showConfirm('Êtes-vous sûr de vouloir supprimer ce fournisseur?', async () => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) {
        showToast('Erreur lors de la suppression du fournisseur', 'error');
      } else {
        showToast('Fournisseur supprimé avec succès', 'success');
        loadSuppliers();
      }
    });
  };

  const getStatusBadge = (status?: string | null) => {
    if (!status) return null;
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || colors.inactive;
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
    ));
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Gestion des Fournisseurs</h2>
            <p className="text-gray-600 mt-1">Gérer et suivre vos fournisseurs</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition"
          >
            <Plus className="w-5 h-5" />
            Nouveau Fournisseur
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email ou téléphone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
            <option value="suspended">Suspendus</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fournisseur</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Contact</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Catégorie</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Statut</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Notation</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Produits</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Montant Total</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Truck className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                        <p className="text-sm text-gray-600">{supplier.contact_person}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-gray-900">{supplier.phone}</div>
                    <div className="text-gray-600">{supplier.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {supplier.category || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(supplier.status)}`}>
                      {supplier.status || 'actif'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      {getRatingStars(supplier.rating || 5)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-gray-900">{supplierStats[supplier.id]?.productCount || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-green-600">
                      {(supplierStats[supplier.id]?.totalAmount || 0).toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setShowDetailsModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 p-1 transition"
                        title="Détails"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openModal(supplier)}
                        className="text-blue-600 hover:text-blue-800 p-1 transition"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteSupplier(supplier.id)}
                        className="text-red-600 hover:text-red-800 p-1 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  Aucun fournisseur trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-900">
                {editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                      <option value="suspended">Suspendu</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Personne de contact</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="ex: Électronique, Alimentaire..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notation (1-5)</label>
                    <select
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="1">1 étoile</option>
                      <option value="2">2 étoiles</option>
                      <option value="3">3 étoiles</option>
                      <option value="4">4 étoiles</option>
                      <option value="5">5 étoiles</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {editingSupplier ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-6 overflow-y-auto flex-1">
              <h3 className="text-xl font-bold mb-4 text-gray-900">{selectedSupplier.name}</h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{supplierStats[selectedSupplier.id]?.productCount || 0}</div>
                    <div className="text-xs text-gray-600 mt-1">Produits</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{supplierStats[selectedSupplier.id]?.totalOrders || 0}</div>
                    <div className="text-xs text-gray-600 mt-1">Commandes</div>
                  </div>
                </div>

                <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200">
                  <div className="text-xs text-gray-600 mb-1">Montant Total Réalisé</div>
                  <div className="text-3xl font-bold text-emerald-600">
                    {(supplierStats[selectedSupplier.id]?.totalAmount || 0).toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'EUR'
                    })}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Moyenne: {supplierStats[selectedSupplier.id]?.totalOrders > 0
                      ? ((supplierStats[selectedSupplier.id]?.totalAmount || 0) / (supplierStats[selectedSupplier.id]?.totalOrders || 1)).toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'EUR'
                        })
                      : '0,00 €'}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Informations</h4>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-600">Personne de contact:</dt>
                      <dd className="font-medium text-gray-900">{selectedSupplier.contact_person || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Téléphone:</dt>
                      <dd className="font-medium text-gray-900">{selectedSupplier.phone || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Email:</dt>
                      <dd className="font-medium text-gray-900">{selectedSupplier.email || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Catégorie:</dt>
                      <dd className="font-medium text-gray-900">{selectedSupplier.category || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Adresse:</dt>
                      <dd className="font-medium text-gray-900">{selectedSupplier.address || '-'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-6 border-t bg-white flex-shrink-0">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}