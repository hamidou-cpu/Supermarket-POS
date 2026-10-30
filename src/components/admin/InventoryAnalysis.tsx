import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, ClipboardList, Save, X } from 'lucide-react';

interface ProductAnalysis {
  id: string;
  name: string;
  barcode: string;
  current_quantity: number;
  min_stock_level: number;
  category: string;
  sales_30d: number;
  avg_daily: number;
  days_remaining: number;
  suggested_restock: number;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

export default function InventoryAnalysis() {
  const [analysis, setAnalysis] = useState<ProductAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [search, setSearch] = useState('');
  const [showPhysicalCount, setShowPhysicalCount] = useState(false);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [savingCounts, setSavingCounts] = useState(false);

  useEffect(() => { loadAnalysis(); }, []);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [productsRes, saleItemsRes, categoriesRes] = await Promise.all([
        supabase.from('products').select('id, name, barcode, stock_quantity, min_stock_level, category_id'),
        supabase.from('sale_items').select('product_id, quantity, created_at').gte('created_at', thirtyDaysAgo),
        supabase.from('categories').select('id, name'),
      ]);

      const products = productsRes.data || [];
      const saleItems = saleItemsRes.data || [];
      const categories = new Map((categoriesRes.data || []).map((c: any) => [c.id, c.name]));

      const salesByProduct = new Map<string, number>();
      saleItems.forEach((item: any) => {
        salesByProduct.set(item.product_id, (salesByProduct.get(item.product_id) || 0) + item.quantity);
      });

      const analysisData: ProductAnalysis[] = products.map((p: any) => {
        const sales30d = salesByProduct.get(p.id) || 0;
        const avgDaily = sales30d / 30;
        const daysRemaining = avgDaily > 0 ? Math.floor(p.stock_quantity / avgDaily) : 9999;
        const suggestedRestock = Math.ceil(avgDaily * 60);

        let priority: ProductAnalysis['priority'] = 'low';
        if (p.stock_quantity <= 0) priority = 'urgent';
        else if (daysRemaining < 5) priority = 'urgent';
        else if (daysRemaining < 15) priority = 'high';
        else if (daysRemaining < 30) priority = 'medium';

        return {
          id: p.id,
          name: p.name,
          barcode: p.barcode,
          current_quantity: p.stock_quantity,
          min_stock_level: p.min_stock_level,
          category: categories.get(p.category_id) || 'Non classee',
          sales_30d: sales30d,
          avg_daily: avgDaily,
          days_remaining: daysRemaining,
          suggested_restock: suggestedRestock,
          priority,
        };
      }).sort((a, b) => {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      });

      setAnalysis(analysisData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return analysis.filter(item => {
      if (filter !== 'all' && item.priority !== filter) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.barcode.includes(search)) return false;
      return true;
    });
  }, [analysis, filter, search]);

  const counts = useMemo(() => {
    return {
      urgent: analysis.filter(a => a.priority === 'urgent').length,
      high: analysis.filter(a => a.priority === 'high').length,
      medium: analysis.filter(a => a.priority === 'medium').length,
      low: analysis.filter(a => a.priority === 'low').length,
    };
  }, [analysis]);

  const savePhysicalCount = async () => {
    try {
      setSavingCounts(true);
      const user = JSON.parse(localStorage.getItem('pos_user') || '{}');

      for (const [productId, count] of Object.entries(physicalCounts)) {
        const product = analysis.find(a => a.id === productId);
        if (!product) continue;

        const diff = count - product.current_quantity;

        await supabase.from('products').update({ stock_quantity: count }).eq('id', productId);

        await supabase.from('stock_history').insert([{
          product_id: productId,
          movement_type: 'physical_count',
          quantity_before: product.current_quantity,
          quantity_after: count,
          difference: diff,
          performed_by: user.id,
          notes: `Inventaire physique: ${product.current_quantity} -> ${count} (${diff >= 0 ? '+' : ''}${diff})`,
        }]);
      }

      setShowPhysicalCount(false);
      setPhysicalCounts({});
      loadAnalysis();
    } catch (error) {
      console.error('Error saving physical count:', error);
    } finally {
      setSavingCounts(false);
    }
  };

  const priorityStyle = (p: string) => {
    switch (p) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center min-h-[400px]"><RefreshCw className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Analyse d'Inventaire</h2>
          <p className="text-gray-600 mt-1">Suggestions de reapprovisionnement et inventaire physique</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowPhysicalCount(!showPhysicalCount)} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${showPhysicalCount ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <ClipboardList className="w-5 h-5" />
            Inventaire Physique
          </button>
          <button onClick={loadAnalysis} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"><RefreshCw className="w-5 h-5 text-gray-600" /></button>
        </div>
      </div>

      {showPhysicalCount && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            <div>
              <p className="font-medium text-blue-800">Mode Inventaire Physique</p>
              <p className="text-sm text-blue-600">Entrez les quantites reelles pour chaque produit</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={savePhysicalCount} disabled={savingCounts} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" /> {savingCounts ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            <button onClick={() => { setShowPhysicalCount(false); setPhysicalCounts({}); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2">
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <input type="text" placeholder="Rechercher par nom ou code-barres..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'urgent', 'high', 'medium', 'low'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 rounded-lg text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {f === 'all' ? `Tous (${analysis.length})` : f === 'urgent' ? `Urgent (${counts.urgent})` : f === 'high' ? `Elevee (${counts.high})` : f === 'medium' ? `Moyen (${counts.medium})` : `Bas (${counts.low})`}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categorie</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ventes/30j</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Jours Restants</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Reappro</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priorite</th>
                {showPhysicalCount && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comptage</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={showPhysicalCount ? 8 : 7} className="px-4 py-8 text-center text-gray-500">Aucun produit trouve</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.barcode}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${item.current_quantity <= item.min_stock_level ? 'text-red-600' : 'text-gray-800'}`}>{item.current_quantity}</span>
                    <span className="text-xs text-gray-400 ml-1">/ {item.min_stock_level}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">{item.sales_30d}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${item.days_remaining < 5 ? 'text-red-600' : item.days_remaining < 15 ? 'text-orange-600' : 'text-gray-800'}`}>
                      {item.days_remaining >= 9999 ? 'N/A' : `${item.days_remaining}j`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-blue-600">{item.suggested_restock}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${priorityStyle(item.priority)}`}>
                      {item.priority === 'urgent' ? 'URGENT' : item.priority === 'high' ? 'ELEVEE' : item.priority === 'medium' ? 'MOYEN' : 'BAS'}
                    </span>
                  </td>
                  {showPhysicalCount && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        placeholder={item.current_quantity.toString()}
                        value={physicalCounts[item.id] ?? ''}
                        onChange={e => setPhysicalCounts(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
