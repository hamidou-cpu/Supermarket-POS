import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, DollarSign, ShoppingBag, Calendar, Download, BarChart, Wallet } from 'lucide-react';
import jsPDF from 'jspdf';

interface Sale {
  id: string;
  sale_number: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  users?: {
    full_name: string;
  };
}

interface SaleItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  purchase_price: number;
  subtotal: number;
}

interface Stats {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  averageTransaction: number;
  todayRevenue: number;
  todayProfit: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  profitMargin: number;
}

interface ProductStats {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  profit_margin: number;
}

export default function SalesReport() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    averageTransaction: 0,
    todayRevenue: 0,
    todayProfit: 0,
    monthlyRevenue: 0,
    monthlyProfit: 0,
    profitMargin: 0,
  });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [showProductStats, setShowProductStats] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    loadSales();
    loadProductStats();
  }, [dateFilter, customStartDate, customEndDate]);

  const getDateRange = () => {
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }

    if (dateFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { start: today.toISOString(), end: null };
    } else if (dateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo.toISOString(), end: null };
    } else if (dateFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: monthAgo.toISOString(), end: null };
    }

    return { start: null, end: null };
  };

  const loadSales = async () => {
    let query = supabase
      .from('sales')
      .select('*, users(full_name)')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    const { start, end } = getDateRange();

    if (start) {
      query = query.gte('created_at', start);
    }

    if (end) {
      query = query.lte('created_at', end);
    }

    const { data, error } = await query;

    if (!error && data) {
      setSales(data);
      calculateStats(data);
    }
  };

  const loadProductStats = async () => {
    const { start, end } = getDateRange();

    let query = supabase
      .from('sale_items')
      .select('product_name, quantity, subtotal, unit_price, purchase_price, sales!inner(status, created_at)')
      .eq('sales.status', 'completed');

    if (start) {
      query = query.gte('sales.created_at', start);
    }

    if (end) {
      query = query.lte('sales.created_at', end);
    }

    const { data, error } = await query;

    if (!error && data) {
      const statsMap = new Map<string, { quantity: number; revenue: number; cost: number }>();

      data.forEach((item: any) => {
        const existing = statsMap.get(item.product_name) || { quantity: 0, revenue: 0, cost: 0 };
        const itemCost = (item.purchase_price || 0) * item.quantity;
        statsMap.set(item.product_name, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + item.subtotal,
          cost: existing.cost + itemCost,
        });
      });

      const stats = Array.from(statsMap.entries())
        .map(([product_name, { quantity, revenue, cost }]) => {
          const profit = revenue - cost;
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
          return {
            product_name,
            total_quantity: quantity,
            total_revenue: revenue,
            total_cost: cost,
            total_profit: profit,
            profit_margin: margin,
          };
        })
        .sort((a, b) => b.total_profit - a.total_profit);

      setProductStats(stats);
    }
  };

  const calculateStats = async (salesData: Sale[]) => {
    const totalSales = salesData.length;
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total_amount, 0);
    const averageTransaction = totalSales > 0 ? totalRevenue / totalSales : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = salesData.filter(sale => new Date(sale.created_at) >= today);
    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total_amount, 0);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlySales = salesData.filter(sale => new Date(sale.created_at) >= monthStart);
    const monthlyRevenue = monthlySales.reduce((sum, sale) => sum + sale.total_amount, 0);

    const saleIds = salesData.map(s => s.id);
    if (saleIds.length > 0) {
      const { data: items } = await supabase
        .from('sale_items')
        .select('quantity, unit_price, purchase_price, sale_id')
        .in('sale_id', saleIds);

      if (items) {
        const totalProfit = items.reduce((sum, item) => {
          const profit = (item.unit_price - (item.purchase_price || 0)) * item.quantity;
          return sum + profit;
        }, 0);

        const todaySaleIds = todaySales.map(s => s.id);
        const todayProfit = items
          .filter(item => todaySaleIds.includes(item.sale_id))
          .reduce((sum, item) => {
            const profit = (item.unit_price - (item.purchase_price || 0)) * item.quantity;
            return sum + profit;
          }, 0);

        const monthlySaleIds = monthlySales.map(s => s.id);
        const monthlyProfit = items
          .filter(item => monthlySaleIds.includes(item.sale_id))
          .reduce((sum, item) => {
            const profit = (item.unit_price - (item.purchase_price || 0)) * item.quantity;
            return sum + profit;
          }, 0);

        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        setStats({
          totalSales,
          totalRevenue,
          totalProfit,
          averageTransaction,
          todayRevenue,
          todayProfit,
          monthlyRevenue,
          monthlyProfit,
          profitMargin,
        });
      }
    } else {
      setStats({
        totalSales: 0,
        totalRevenue: 0,
        totalProfit: 0,
        averageTransaction: 0,
        todayRevenue: 0,
        todayProfit: 0,
        monthlyRevenue: 0,
        monthlyProfit: 0,
        profitMargin: 0,
      });
    }
  };

  const viewSaleDetails = async (sale: Sale) => {
    setSelectedSale(sale);

    const { data, error } = await supabase
      .from('sale_items')
      .select('product_name, quantity, unit_price, purchase_price, subtotal')
      .eq('sale_id', sale.id);

    if (!error && data) {
      setSaleItems(data);
      setShowDetailsModal(true);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Rapport de Ventes - SuperMarket', 14, 20);

    doc.setFontSize(11);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);
    doc.text(`Période: ${dateFilter === 'all' ? 'Toutes' : dateFilter === 'today' ? "Aujourd'hui" : dateFilter === 'week' ? '7 derniers jours' : dateFilter === 'month' ? '30 derniers jours' : 'Personnalisée'}`, 14, 37);

    doc.setFontSize(12);
    doc.text('Statistiques', 14, 50);
    doc.setFontSize(10);
    doc.text(`Nombre de ventes: ${stats.totalSales}`, 14, 58);
    doc.text(`Chiffre d'affaires total: ${stats.totalRevenue.toFixed(2)} DH`, 14, 65);
    doc.text(`Bénéfice total: ${stats.totalProfit.toFixed(2)} DH`, 14, 72);
    doc.text(`Marge bénéficiaire: ${stats.profitMargin.toFixed(1)}%`, 14, 79);
    doc.text(`Panier moyen: ${stats.averageTransaction.toFixed(2)} DH`, 14, 86);
    doc.text(`CA Aujourd'hui: ${stats.todayRevenue.toFixed(2)} DH`, 14, 93);
    doc.text(`Bénéfice aujourd'hui: ${stats.todayProfit.toFixed(2)} DH`, 14, 100);

    doc.setFontSize(12);
    doc.text('Historique des Ventes', 14, 115);

    let yPos = 125;
    sales.slice(0, 12).forEach((sale) => {
      doc.setFontSize(9);
      doc.text(`${sale.sale_number} - ${new Date(sale.created_at).toLocaleDateString('fr-FR')} - ${sale.total_amount.toFixed(2)} DH`, 14, yPos);
      yPos += 7;
      if (yPos > 280) return;
    });

    doc.save('rapport-ventes.pdf');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Rapports de Ventes</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowProductStats(!showProductStats)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 transition"
            >
              <BarChart className="w-5 h-5" />
              Stats Produits
            </button>
            <button
              onClick={exportToPDF}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition"
            >
              <Download className="w-5 h-5" />
              Export PDF
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${
              dateFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Toutes
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-2 rounded-lg transition ${
              dateFilter === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setDateFilter('week')}
            className={`px-4 py-2 rounded-lg transition ${
              dateFilter === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            7 derniers jours
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-4 py-2 rounded-lg transition ${
              dateFilter === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            30 derniers jours
          </button>
          <button
            onClick={() => setDateFilter('custom')}
            className={`px-4 py-2 rounded-lg transition ${
              dateFilter === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Personnalisé
          </button>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <ShoppingBag className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalSales}</p>
            <p className="text-blue-100">Ventes totales</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalRevenue.toFixed(2)} DH</p>
            <p className="text-green-100">Chiffre d'affaires</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Wallet className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalProfit.toFixed(2)} DH</p>
            <p className="text-emerald-100">Bénéfice total</p>
            <p className="text-xs text-emerald-200 mt-1">Marge: {stats.profitMargin.toFixed(1)}%</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-2xl font-bold mb-1">{stats.todayRevenue.toFixed(2)} DH</p>
            <p className="text-orange-100">CA Aujourd'hui</p>
            <p className="text-xs text-orange-200 mt-1">Bén.: {stats.todayProfit.toFixed(2)} DH</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold mb-1">{stats.averageTransaction.toFixed(2)} DH</p>
            <p className="text-purple-100">Panier moyen</p>
          </div>
        </div>
      </div>

      {showProductStats && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-lg">Statistiques par Produit</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantité vendue</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">CA généré</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Coût total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bénéfice</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Marge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productStats.map((stat, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{stat.product_name}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-700">{stat.total_quantity}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">
                      {stat.total_revenue.toFixed(2)} DH
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">
                      {stat.total_cost.toFixed(2)} DH
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                      {stat.total_profit.toFixed(2)} DH
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        stat.profit_margin >= 30 ? 'bg-green-100 text-green-800' :
                        stat.profit_margin >= 15 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {stat.profit_margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Historique des Ventes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Vente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Caissier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paiement</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm text-gray-900">{sale.sale_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(sale.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{sale.users?.full_name}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">
                    {sale.total_amount.toFixed(2)} DH
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sale.payment_method === 'cash' ? 'bg-green-100 text-green-800' :
                      sale.payment_method === 'card' ? 'bg-blue-100 text-blue-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {sale.payment_method === 'cash' ? 'Espèces' :
                       sale.payment_method === 'card' ? 'Carte' : 'Mobile'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => viewSaleDetails(sale)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showDetailsModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Détails de la Vente</h3>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Numéro de vente</p>
                    <p className="font-mono font-semibold">{selectedSale.sale_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-semibold">{new Date(selectedSale.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Caissier</p>
                    <p className="font-semibold">{selectedSale.users?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Méthode de paiement</p>
                    <p className="font-semibold">
                      {selectedSale.payment_method === 'cash' ? 'Espèces' :
                       selectedSale.payment_method === 'card' ? 'Carte' : 'Mobile'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-3">Articles vendus</h4>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Article</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Qté</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">P.U.</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Bénéf.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {saleItems.map((item, index) => {
                      const itemProfit = (item.unit_price - (item.purchase_price || 0)) * item.quantity;
                      return (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm">{item.product_name}</td>
                          <td className="px-4 py-3 text-sm text-center">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right">{item.unit_price.toFixed(2)} DH</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold">{item.subtotal.toFixed(2)} DH</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{itemProfit.toFixed(2)} DH</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total</span>
                    <span className="text-xl font-bold text-blue-600">{selectedSale.total_amount.toFixed(2)} DH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Bénéfice</span>
                    <span className="text-xl font-bold text-green-600">
                      {saleItems.reduce((sum, item) => sum + (item.unit_price - (item.purchase_price || 0)) * item.quantity, 0).toFixed(2)} DH
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
