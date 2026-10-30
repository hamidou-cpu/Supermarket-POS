import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, CheckCircle, X, RefreshCw, AlertTriangle, Package } from 'lucide-react';

interface Alert {
  id: string;
  product_id: string;
  message: string;
  alert_type: string;
  is_read: boolean;
  created_at: string;
  acknowledged_at: string | null;
  products?: {
    name: string;
    stock_quantity: number;
    min_stock_level: number;
  };
}

interface LowStockProduct {
  id: string;
  name: string;
  barcode: string;
  stock_quantity: number;
  min_stock_level: number;
  category_id: string | null;
}

interface LowStockAlertsProps {
  onAlertsRead?: () => void;
}

export default function LowStockAlerts({ onAlertsRead }: LowStockAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'acknowledged'>('unread');
  const [tab, setTab] = useState<'alerts' | 'products'>('products');

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadAll = async () => {
    await Promise.all([loadAlerts(), loadLowStockProducts()]);
  };

  const loadAlerts = async () => {
    try {
      let query = supabase
        .from('alerts')
        .select('*, products(name, stock_quantity, min_stock_level)')
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'acknowledged') {
        query = query.not('acknowledged_at', 'is', null);
      }

      const { data, error } = await query;
      if (!error && data) setAlerts(data as Alert[]);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const loadLowStockProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, barcode, stock_quantity, min_stock_level, category_id')
        .lt('stock_quantity', 5)
        .order('stock_quantity', { ascending: true });

      if (!error && data) setLowStockProducts(data as LowStockProduct[]);
    } catch (error) {
      console.error('Error loading low stock products:', error);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await supabase
        .from('alerts')
        .update({ is_read: true, acknowledged_at: new Date().toISOString() })
        .eq('id', alertId);
      loadAlerts();
      onAlertsRead?.();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      await supabase.from('alerts').delete().eq('id', alertId);
      loadAlerts();
      onAlertsRead?.();
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const acknowledgeAllAlerts = async () => {
    try {
      await supabase
        .from('alerts')
        .update({ is_read: true, acknowledged_at: new Date().toISOString() })
        .eq('is_read', false)
        .eq('alert_type', 'low_stock');
      loadAlerts();
      onAlertsRead?.();
    } catch (error) {
      console.error('Error acknowledging all:', error);
    }
  };

  const getAlertColor = (alertType: string, stockQty?: number) => {
    if (stockQty !== undefined && stockQty <= 0) return 'border-l-4 border-red-700 bg-red-50';
    switch (alertType) {
      case 'low_stock': return 'border-l-4 border-red-500 bg-red-50';
      case 'overstock': return 'border-l-4 border-yellow-500 bg-yellow-50';
      case 'expiring': return 'border-l-4 border-orange-500 bg-orange-50';
      default: return 'border-l-4 border-gray-500 bg-gray-50';
    }
  };

  const getStockBadge = (qty: number, min: number) => {
    if (qty <= 0) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-200 text-red-800">RUPTURE</span>;
    if (qty < min * 0.5) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-200 text-orange-800">CRITIQUE</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-200 text-yellow-800">FAIBLE</span>;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const ruptureCount = lowStockProducts.filter(p => p.stock_quantity <= 0).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Alertes de Stock</h2>
          <p className="text-gray-600 mt-1">Surveillance en temps reel des niveaux de stock</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={acknowledgeAllAlerts} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4" /> Tout confirmer
            </button>
          )}
          <button onClick={loadAll} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {ruptureCount > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">{ruptureCount} produit{ruptureCount > 1 ? 's' : ''} en rupture de stock</p>
            <p className="text-sm text-red-600">Reapprovisionnement urgent necessaire</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => setTab('products')} className={`px-4 py-2 rounded-lg transition font-medium ${tab === 'products' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          <Package className="w-4 h-4 inline mr-1" />
          Produits en alerte ({lowStockProducts.length})
        </button>
        <button onClick={() => setTab('alerts')} className={`px-4 py-2 rounded-lg transition font-medium ${tab === 'alerts' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          <AlertCircle className="w-4 h-4 inline mr-1" />
          Notifications ({alerts.length})
        </button>
      </div>

      {tab === 'products' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {lowStockProducts.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Aucun produit en alerte</p>
              <p className="text-gray-500 text-sm">Tous les produits sont au-dessus des seuils minimum</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock Actuel</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Seuil Min</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ecart</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lowStockProducts.map(product => {
                  const diff = product.stock_quantity - product.min_stock_level;
                  return (
                    <tr key={product.id} className={`hover:bg-gray-50 ${product.stock_quantity <= 0 ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.barcode}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-lg ${product.stock_quantity <= 0 ? 'text-red-600' : product.stock_quantity < product.min_stock_level ? 'text-orange-600' : 'text-gray-800'}`}>
                          {product.stock_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{product.min_stock_level}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold text-sm ${diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{getStockBadge(product.stock_quantity, product.min_stock_level)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'alerts' && (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-lg transition ${filter === 'unread' ? 'bg-red-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              Non lues ({alerts.filter(a => !a.is_read).length})
            </button>
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg transition ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              Toutes
            </button>
            <button onClick={() => setFilter('acknowledged')} className={`px-4 py-2 rounded-lg transition ${filter === 'acknowledged' ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              Confirmees
            </button>
          </div>

          <div className="space-y-4">
            {alerts.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Aucune notification</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className={`${getAlertColor(alert.alert_type, alert.products?.stock_quantity)} rounded-lg p-4 flex items-start justify-between`}>
                  <div className="flex gap-3 flex-1">
                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${(alert.products?.stock_quantity ?? 0) <= 0 ? 'text-red-700' : 'text-red-600'}`} />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{alert.products?.name || 'Produit inconnu'}</h3>
                      <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>{new Date(alert.created_at).toLocaleString('fr-FR')}</span>
                        {alert.products && (
                          <span>Stock: {alert.products.stock_quantity} / Min: {alert.products.min_stock_level}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {!alert.is_read && (
                      <button onClick={() => acknowledgeAlert(alert.id)} className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition" title="Confirmer">
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                    <button onClick={() => dismissAlert(alert.id)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition" title="Supprimer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
