import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, AlertCircle, Clock, RefreshCw, ArrowRight } from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

type Period = 'day' | 'week' | 'month' | 'year';

export default function ExecutiveKPIs() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [salesData, setSalesData] = useState<any[]>([]);
  const [saleItemsData, setSaleItemsData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const dateFrom = new Date();
      switch (period) {
        case 'day': dateFrom.setHours(0, 0, 0, 0); break;
        case 'week': dateFrom.setDate(dateFrom.getDate() - 7); break;
        case 'month': dateFrom.setMonth(dateFrom.getMonth() - 1); break;
        case 'year': dateFrom.setFullYear(dateFrom.getFullYear() - 1); break;
      }

      const [salesRes, itemsRes, productsRes] = await Promise.all([
        supabase.from('sales').select('*').eq('status', 'completed').gte('created_at', dateFrom.toISOString()).order('created_at'),
        supabase.from('sale_items').select('*').gte('created_at', dateFrom.toISOString()),
        supabase.from('products').select('id, name, stock_quantity, purchase_price, selling_price, min_stock_level, category_id'),
      ]);

      setSalesData(salesRes.data || []);
      setSaleItemsData(itemsRes.data || []);
      setProductsData(productsRes.data || []);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    const totalRevenue = salesData.reduce((sum, s) => sum + s.total_amount, 0);
    const totalProfit = saleItemsData.reduce((sum, item) => sum + ((item.unit_price - (item.purchase_price || 0)) * item.quantity), 0);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const avgTransaction = salesData.length > 0 ? totalRevenue / salesData.length : 0;
    const lowStockCount = productsData.filter(p => p.stock_quantity < p.min_stock_level).length;
    const stockValue = productsData.reduce((sum, p) => sum + p.stock_quantity * p.purchase_price, 0);

    const productStats = new Map<string, { revenue: number; qty: number }>();
    saleItemsData.forEach(item => {
      const existing = productStats.get(item.product_name) || { revenue: 0, qty: 0 };
      productStats.set(item.product_name, {
        revenue: existing.revenue + item.unit_price * item.quantity,
        qty: existing.qty + item.quantity,
      });
    });
    const topProducts = Array.from(productStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const paymentBreakdown = salesData.reduce((acc, s) => {
      acc[s.payment_method] = (acc[s.payment_method] || 0) + s.total_amount;
      return acc;
    }, {} as Record<string, number>);

    return { totalRevenue, totalProfit, profitMargin, avgTransaction, lowStockCount, stockValue, topProducts, paymentBreakdown, totalTransactions: salesData.length };
  }, [salesData, saleItemsData, productsData]);

  const revenueChart = useMemo(() => {
    const grouped = new Map<string, number>();
    salesData.forEach(s => {
      const key = new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      grouped.set(key, (grouped.get(key) || 0) + s.total_amount);
    });
    const labels = Array.from(grouped.keys()).slice(-14);
    const values = labels.map(l => grouped.get(l) || 0);

    return {
      labels,
      datasets: [{
        label: "Chiffre d'affaires (DH)",
        data: values,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      }],
    };
  }, [salesData]);

  const topProductsChart = useMemo(() => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    return {
      labels: metrics.topProducts.map(p => p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name),
      datasets: [{
        data: metrics.topProducts.map(p => p.revenue),
        backgroundColor: colors,
        borderRadius: 6,
      }],
    };
  }, [metrics.topProducts]);

  const paymentChart = useMemo(() => {
    const labels = Object.keys(metrics.paymentBreakdown).map(m =>
      m === 'cash' ? 'Especes' : m === 'card' ? 'Carte' : 'Mobile'
    );
    return {
      labels,
      datasets: [{
        data: Object.values(metrics.paymentBreakdown),
        backgroundColor: ['#10B981', '#3B82F6', '#F59E0B'],
        borderWidth: 0,
      }],
    };
  }, [metrics.paymentBreakdown]);

  const kpis = [
    { label: "Chiffre d'affaires", value: `${metrics.totalRevenue.toFixed(2)} DH`, icon: DollarSign, color: 'from-blue-500 to-blue-600' },
    { label: 'Benefice Net', value: `${metrics.totalProfit.toFixed(2)} DH`, icon: TrendingUp, color: 'from-green-500 to-green-600' },
    { label: 'Marge', value: `${metrics.profitMargin.toFixed(1)}%`, icon: TrendingDown, color: 'from-teal-500 to-teal-600' },
    { label: 'Panier Moyen', value: `${metrics.avgTransaction.toFixed(2)} DH`, icon: ShoppingBag, color: 'from-cyan-500 to-cyan-600' },
    { label: 'Transactions', value: metrics.totalTransactions, icon: Clock, color: 'from-amber-500 to-amber-600' },
    { label: 'Sous-stock', value: metrics.lowStockCount, icon: AlertCircle, color: 'from-red-500 to-red-600' },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Tableau de Bord Executif</h1>
          <p className="text-gray-600 mt-1">Vue d'ensemble des KPIs et tendances</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value as Period)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="day">Aujourd'hui</option>
            <option value="week">Cette Semaine</option>
            <option value="month">Ce Mois</option>
            <option value="year">Cette Annee</option>
          </select>
          <button onClick={loadData} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`bg-gradient-to-br ${kpi.color} rounded-xl p-5 text-white shadow-lg`}>
              <Icon className="w-6 h-6 opacity-80 mb-3" />
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs opacity-90 mt-1">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Evolution du Chiffre d'Affaires</h3>
          <Line data={revenueChart} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => v + ' DH' } } } }} />
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Modes de Paiement</h3>
          <Doughnut data={paymentChart} options={{ responsive: true, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Produits</h3>
          <Bar data={topProductsChart} options={{ responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: (v: any) => v + ' DH' } } } }} />
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Valeur du Stock</h3>
          <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
            <p className="text-sm text-gray-600 mb-1">Valeur d'achat totale</p>
            <p className="text-3xl font-bold text-gray-800 mb-4">{metrics.stockValue.toFixed(2)} DH</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-600 font-medium">{metrics.lowStockCount} articles</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">en sous-stock</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
