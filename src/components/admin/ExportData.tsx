import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, FileText, AlertCircle } from 'lucide-react';

type ExportType = 'sales' | 'products' | 'inventory' | 'customers';

export default function ExportData() {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportType, setExportType] = useState<ExportType>('sales');
  const [message, setMessage] = useState('');

  const exportCSV = async () => {
    try {
      setLoading(true);
      setMessage('');
      let headers: string[] = [];
      let rows: any[][] = [];

      if (exportType === 'sales') {
        const { data } = await supabase.from('sales').select('id, sale_number, total_amount, payment_method, status, created_at').gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`).order('created_at', { ascending: false });
        headers = ['Date', 'Numero', 'Montant (DH)', 'Paiement', 'Statut'];
        rows = (data || []).map(s => [
          new Date(s.created_at).toLocaleString('fr-FR'), s.sale_number, s.total_amount.toFixed(2),
          s.payment_method === 'cash' ? 'Especes' : s.payment_method === 'card' ? 'Carte' : 'Mobile',
          s.status,
        ]);
      } else if (exportType === 'products') {
        const { data } = await supabase.from('products').select('name, barcode, stock_quantity, purchase_price, selling_price, min_stock_level').order('name');
        headers = ['Produit', 'Code-barres', 'Quantite', 'Prix Achat', 'Prix Vente', 'Seuil Min', 'Valeur Stock'];
        rows = (data || []).map(p => [p.name, p.barcode, p.stock_quantity, p.purchase_price.toFixed(2), p.selling_price.toFixed(2), p.min_stock_level, (p.stock_quantity * p.purchase_price).toFixed(2)]);
      } else if (exportType === 'inventory') {
        const { data } = await supabase.from('stock_history').select('*, products(name)').gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`).order('created_at', { ascending: false });
        headers = ['Date', 'Produit', 'Type', 'Avant', 'Apres', 'Difference', 'Notes'];
        rows = (data || []).map((h: any) => [
          new Date(h.created_at).toLocaleString('fr-FR'), h.products?.name || 'N/A', h.movement_type,
          h.quantity_before, h.quantity_after, h.difference, h.notes || '',
        ]);
      } else if (exportType === 'customers') {
        const { data } = await supabase.from('customers').select('full_name, phone, email, total_purchases, total_amount_spent, loyalty_tier').order('total_amount_spent', { ascending: false });
        headers = ['Nom', 'Telephone', 'Email', 'Achats', 'Depenses (DH)', 'Niveau'];
        rows = (data || []).map(c => [c.full_name, c.phone, c.email || '', c.total_purchases, c.total_amount_spent.toFixed(2), c.loyalty_tier]);
      }

      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportType}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage(`${rows.length} enregistrements exportes avec succes`);
    } catch (error) {
      console.error('Error:', error);
      setMessage('Erreur lors de l\'export');
    } finally {
      setLoading(false);
    }
  };

  const exportJSON = async () => {
    try {
      setLoading(true);
      setMessage('');
      let jsonData: any = {};

      if (exportType === 'sales') {
        const { data } = await supabase.from('sales').select('*, sale_items(*)').gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`);
        jsonData = { sales: data || [] };
      } else if (exportType === 'products') {
        const { data } = await supabase.from('products').select('*');
        jsonData = { products: data || [] };
      } else if (exportType === 'inventory') {
        const { data } = await supabase.from('stock_history').select('*, products(name)').gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`);
        jsonData = { stock_history: data || [] };
      } else if (exportType === 'customers') {
        const { data } = await supabase.from('customers').select('*, loyalty_points(*)');
        jsonData = { customers: data || [] };
      }

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportType}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage('Export JSON reussi');
    } catch (error) {
      console.error('Error:', error);
      setMessage('Erreur lors de l\'export');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">Export de Donnees</h2>
        <p className="text-gray-600 mt-1">Exportez les donnees en CSV ou JSON</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type d'Export</label>
            <select value={exportType} onChange={e => setExportType(e.target.value as ExportType)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="sales">Ventes</option>
              <option value="products">Produits</option>
              <option value="inventory">Historique d'Inventaire</option>
              <option value="customers">Clients</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Du</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Au</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700">Les exports sont traces dans les journaux d'audit pour la securite et la conformite.</p>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm font-medium ${message.includes('Erreur') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button onClick={exportCSV} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
              <Download className="w-5 h-5" /> Export CSV
            </button>
            <button onClick={exportJSON} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
              <FileText className="w-5 h-5" /> Export JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
