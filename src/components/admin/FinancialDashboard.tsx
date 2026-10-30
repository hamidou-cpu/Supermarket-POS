import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, RefreshCw, Wallet, CreditCard, Smartphone } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

type Period = 'day' | 'week' | 'month';

export default function FinancialDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const from = new Date();
      if (period === 'day') from.setHours(0, 0, 0, 0);
      else if (period === 'week') from.setDate(from.getDate() - 7);
      else from.setMonth(from.getMonth() - 1);

      const [salesRes, itemsRes] = await Promise.all([
        supabase.from('sales').select('*').eq('status', 'completed').gte('created_at', from.toISOString()).order('created_at'),
        supabase.from('sale_items').select('*').gte('created_at', from.toISOString()),
      ]);

      setSales(salesRes.data || []);
      setSaleItems(itemsRes.data || []);

      const newAlerts: string[] = [];
      const revenue = (salesRes.data || []).reduce((s: number, sale: any) => s + sale.total_amount, 0);
      const costs = (itemsRes.data || []).reduce((s: number, item: any) => s + ((item.purchase_price || 0) * item.quantity), 0);
      const margin = revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0;

      if (margin < 15) newAlerts.push('Marge beneficiaire critique (< 15%)');
      if (margin < 5) newAlerts.push('ALERTE: Marge tres faible (< 5%)');

      const paymentMethods = (salesRes.data || []).reduce((acc: any, sale: any) => {
        acc[sale.payment_method] = (acc[sale.payment_method] || 0) + sale.total_amount;
        return acc;
      }, {});
      if (revenue > 0 && (!paymentMethods['card'] || paymentMethods['card'] / revenue < 0.05)) {
        newAlerts.push('Tres peu de paiements par carte detectes');
      }

      setAlerts(newAlerts);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((s, sale) => s + sale.total_amount, 0);
    const totalCosts = saleItems.reduce((s, item) => s + ((item.purchase_price || 0) * item.quantity), 0);
    const totalProfit = totalRevenue - totalCosts;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const paymentMethods = sales.reduce((acc, sale) => {
      acc[sale.payment_method] = (acc[sale.payment_method] || 0) + sale.total_amount;
      return acc;
    }, {} as Record<string, number>);

    const categoryMargins = new Map<string, { revenue: number; cost: number; qty: number }>();
    saleItems.forEach(item => {
      const key = item.product_name || 'Autre';
      const existing = categoryMargins.get(key) || { revenue: 0, cost: 0, qty: 0 };
      categoryMargins.set(key, {
        revenue: existing.revenue + item.unit_price * item.quantity,
        cost: existing.cost + ((item.purchase_price || 0) * item.quantity),
        qty: existing.qty + item.quantity,
      });
    });

    const topByProfit = Array.from(categoryMargins.entries())
      .map(([name, data]) => ({ name, ...data, profit: data.revenue - data.cost, margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);

    return { totalRevenue, totalCosts, totalProfit, margin, paymentMethods, topByProfit };
  }, [sales, saleItems]);

  const cashFlowChart = useMemo(() => {
    const grouped = new Map<string, { revenue: number; costs: number }>();
    sales.forEach(sale => {
      const key = new Date(sale.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      const existing = grouped.get(key) || { revenue: 0, costs: 0 };
      existing.revenue += sale.total_amount;
      grouped.set(key, existing);
    });
    saleItems.forEach(item => {
      const key = new Date(item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      const existing = grouped.get(key) || { revenue: 0, costs: 0 };
      existing.costs += (item.purchase_price || 0) * item.quantity;
      grouped.set(key, existing);
    });

    const labels = Array.from(grouped.keys()).slice(-14);
    return {
      labels,
      datasets: [
        { label: 'Revenus', data: labels.map(l => grouped.get(l)?.revenue || 0), backgroundColor: 'rgba(59, 130, 246, 0.7)', borderRadius: 4 },
        { label: 'Couts', data: labels.map(l => grouped.get(l)?.costs || 0), backgroundColor: 'rgba(239, 68, 68, 0.7)', borderRadius: 4 },
      ],
    };
  }, [sales, saleItems]);

  const marginChart = useMemo(() => {
    const labels = stats.topByProfit.map(p => p.name.length > 12 ? p.name.slice(0, 12) + '...' : p.name);
    return {
      labels,
      datasets: [{
        label: 'Marge %',
        data: stats.topByProfit.map(p => p.margin),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      }],
    };
  }, [stats.topByProfit]);

  if (loading) {
    return <div className="p-6 flex items-center justify-center min-h-[400px]"><RefreshCw className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Gestion Financiere</h2>
          <p className="text-gray-600 mt-1">Flux de tresorerie et suivi des marges</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value as Period)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="day">Aujourd'hui</option>
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
          </select>
          <button onClick={loadData} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"><RefreshCw className="w-5 h-5 text-gray-600" /></button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-700 font-medium">{alert}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <DollarSign className="w-8 h-8 opacity-80 mb-3" />
          <p className="text-4xl font-bold">{stats.totalRevenue.toFixed(2)}</p>
          <p className="text-sm opacity-90 mt-1">Chiffre d'Affaires (DH)</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
          <TrendingDown className="w-8 h-8 opacity-80 mb-3" />
          <p className="text-4xl font-bold">{stats.totalCosts.toFixed(2)}</p>
          <p className="text-sm opacity-90 mt-1">Couts d'Achat (DH)</p>
        </div>
        <div className={`bg-gradient-to-br ${stats.totalProfit > 0 ? 'from-green-500 to-green-600' : 'from-gray-500 to-gray-600'} rounded-xl p-6 text-white shadow-lg`}>
          <TrendingUp className="w-8 h-8 opacity-80 mb-3" />
          <p className="text-4xl font-bold">{stats.totalProfit.toFixed(2)}</p>
          <p className="text-sm opacity-90 mt-1">Benefice Net (DH) - Marge {stats.margin.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Flux de Tresorerie</h3>
          <Bar data={cashFlowChart} options={{ responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => v + ' DH' } } } }} />
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Marges par Produit</h3>
          <Line data={marginChart} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => v + '%' } } } }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Modes de Paiement</h3>
          <div className="space-y-4">
            {Object.entries(stats.paymentMethods).map(([method, amount]: [string, any]) => {
              const pct = stats.totalRevenue > 0 ? (amount / stats.totalRevenue) * 100 : 0;
              const Icon = method === 'cash' ? Wallet : method === 'card' ? CreditCard : Smartphone;
              const color = method === 'cash' ? 'text-green-600' : method === 'card' ? 'text-blue-600' : 'text-orange-600';
              return (
                <div key={method} className="flex items-center gap-4">
                  <Icon className={`w-6 h-6 ${color}`} />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 capitalize">{method === 'cash' ? 'Especes' : method === 'card' ? 'Carte' : 'Mobile'}</span>
                      <span className="font-semibold">{amount.toFixed(2)} DH</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 w-12 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Produits (Profit)</h3>
          <div className="space-y-3">
            {stats.topByProfit.slice(0, 5).map((item, i) => (
              <div key={i} className="flex justify-between items-center pb-3 border-b last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.qty} ventes</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600">{item.profit.toFixed(2)} DH</p>
                  <p className="text-xs text-gray-500">{item.margin.toFixed(0)}% marge</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
