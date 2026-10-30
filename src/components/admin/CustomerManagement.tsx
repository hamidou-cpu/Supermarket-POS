import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Phone, Mail, Search, Plus, Star, ShoppingBag, Zap, X, Trash2 } from 'lucide-react';

interface Customer {
  id: string;
  phone: string;
  full_name: string;
  email: string | null;
  total_purchases: number;
  total_amount_spent: number;
  loyalty_tier: string;
  last_purchase_at: string | null;
  created_at: string;
  loyalty_points?: { points_balance: number; points_earned: number; points_redeemed: number }[];
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ phone: '', full_name: '', email: '' });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*, loyalty_points(*)')
        .order('total_amount_spent', { ascending: false });

      if (!error && data) setCustomers(data as Customer[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phone || !formData.full_name) return;
    try {
      const { data: customer } = await supabase.from('customers').insert([{
        phone: formData.phone, full_name: formData.full_name, email: formData.email || null,
      }]).select().single();

      if (customer) {
        await supabase.from('loyalty_points').insert([{ customer_id: customer.id, points_balance: 0, points_earned: 0, points_redeemed: 0 }]);
      }

      setFormData({ phone: '', full_name: '', email: '' });
      setShowForm(false);
      loadCustomers();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const deleteCustomer = async (id: string) => {
    if (!window.confirm('Supprimer ce client?')) return;
    try {
      await supabase.from('customers').delete().eq('id', id);
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      loadCustomers();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const viewHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      const { data } = await supabase.from('customer_purchases').select('*, sales(*)').eq('customer_id', customer.id).order('purchase_date', { ascending: false });
      setPurchaseHistory(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const filtered = useMemo(() => {
    return customers.filter(c =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
    );
  }, [customers, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const tierStyle = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'bg-slate-100 text-slate-800 border-slate-300';
      case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'silver': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-orange-100 text-orange-800 border-orange-300';
    }
  };

  const tierIcon = (tier: string) => {
    const color = tier === 'platinum' ? 'text-slate-600' : tier === 'gold' ? 'text-yellow-600' : tier === 'silver' ? 'text-gray-500' : 'text-orange-600';
    return <Star className={`w-4 h-4 ${color}`} />;
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center min-h-[400px]"><div className="text-gray-500">Chargement...</div></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Gestion des Clients</h2>
          <p className="text-gray-600 mt-1">{customers.length} clients enregistres</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-5 h-5" /> Nouveau Client
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <form onSubmit={addCustomer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="tel" placeholder="Telephone *" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              <input type="text" placeholder="Nom complet *" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              <input type="email" placeholder="Email (optionnel)" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Ajouter</button>
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">Annuler</button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder="Rechercher par nom, telephone ou email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${selectedCustomer ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Achats</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Depenses</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Points</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Niveau</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginated.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Aucun client</td></tr>
                ) : paginated.map(c => (
                  <tr key={c.id} className={`hover:bg-gray-50 cursor-pointer ${selectedCustomer?.id === c.id ? 'bg-blue-50' : ''}`} onClick={() => viewHistory(c)}>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.full_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600"><Phone className="w-3 h-3" />{c.phone}</div>
                      {c.email && <div className="flex items-center gap-1 text-xs text-gray-500"><Mail className="w-3 h-3" />{c.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">{c.total_purchases}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-blue-600">{c.total_amount_spent.toFixed(2)} DH</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1"><Zap className="w-3 h-3 text-yellow-500" /><span className="text-sm font-semibold">{c.loyalty_points?.[0]?.points_balance || 0}</span></div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${tierStyle(c.loyalty_tier)}`}>
                        {tierIcon(c.loyalty_tier)} {c.loyalty_tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={e => { e.stopPropagation(); viewHistory(c); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><ShoppingBag className="w-4 h-4" /></button>
                        <button onClick={e => { e.stopPropagation(); deleteCustomer(c.id); }} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <p className="text-sm text-gray-600">{filtered.length} clients</p>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded text-sm ${p === page ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{p}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedCustomer && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Historique</h3>
              <button onClick={() => setSelectedCustomer(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-semibold text-gray-800">{selectedCustomer.full_name}</p>
              <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-gray-600">{selectedCustomer.total_purchases} achats</span>
                <span className="text-blue-600 font-medium">{selectedCustomer.total_amount_spent.toFixed(2)} DH</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-sm">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="font-medium">{selectedCustomer.loyalty_points?.[0]?.points_balance || 0} points</span>
                <span className="text-gray-400 ml-2">(gagnes: {selectedCustomer.loyalty_points?.[0]?.points_earned || 0})</span>
              </div>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {purchaseHistory.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Aucun achat</p>
              ) : purchaseHistory.map((p, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 font-medium">{p.amount.toFixed(2)} DH</span>
                    <span className="text-gray-500">{new Date(p.purchase_date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {p.points_earned > 0 && <p className="text-xs text-yellow-600 mt-1">+{p.points_earned} points</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
