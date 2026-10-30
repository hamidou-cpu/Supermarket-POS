import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  Package,
  Truck,
  Tag,
  BarChart3,
  Users,
  ShoppingCart,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Bell,
  FileText,
  DollarSign,
  Download,
} from 'lucide-react';
import ProductManagement from './admin/ProductManagement';
import SupplierManagement from './admin/SupplierManagement';
import CategoryManagement from './admin/CategoryManagement';
import StockManagement from './admin/StockManagement';
import SalesReport from './admin/SalesReport';
import UserManagement from './admin/UserManagement';
import CashierInterface from './cashier/CashierInterface';
import ExecutiveKPIs from './admin/ExecutiveKPIs';
import LowStockAlerts from './admin/LowStockAlerts';
import AuditLogs from './admin/AuditLogs';
import FinancialDashboard from './admin/FinancialDashboard';
import InventoryAnalysis from './admin/InventoryAnalysis';
import CustomerManagement from './admin/CustomerManagement';
import ExportData from './admin/ExportData';

type View = 'pos' | 'products' | 'suppliers' | 'categories' | 'stock' | 'sales' | 'users' | 'kpis' | 'alerts' | 'audit' | 'financial' | 'inventory' | 'customers' | 'export';

export default function Dashboard() {
  const { user, logout, isAdmin } = useAuth();
  const [currentView, setCurrentView] = useState<View>(isAdmin ? 'kpis' : 'pos');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [alertCount, setAlertCount] = useState(0);

  const fetchAlertCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (!error && count !== null) {
        setAlertCount(count);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 15000);
    return () => clearInterval(interval);
  }, [fetchAlertCount]);

  const handleViewChange = (view: View) => {
    setCurrentView(view);
    if (view === 'alerts') {
      fetchAlertCount();
    }
  };

  const adminMenuItems: { id: View; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: 'kpis', label: 'KPIs', icon: LayoutDashboard },
    { id: 'financial', label: 'Finances', icon: DollarSign },
    { id: 'alerts', label: 'Alertes', icon: Bell, badge: alertCount },
    { id: 'sales', label: 'Ventes', icon: BarChart3 },
    { id: 'inventory', label: 'Inventaire', icon: TrendingUp },
    { id: 'customers', label: 'Clients', icon: Users },
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'suppliers', label: 'Fournisseurs', icon: Truck },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'stock', label: 'Stock', icon: TrendingUp },
    { id: 'export', label: 'Export', icon: Download },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'audit', label: 'Audit', icon: FileText },
    { id: 'pos', label: 'POS', icon: ShoppingCart },
  ];

  const cashierMenuItems: { id: View; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: 'pos', label: 'Point de Vente', icon: ShoppingCart },
  ];

  const menuItems = isAdmin ? adminMenuItems : cashierMenuItems;

  const renderContent = () => {
    switch (currentView) {
      case 'kpis': return <ExecutiveKPIs />;
      case 'financial': return <FinancialDashboard />;
      case 'alerts': return <LowStockAlerts onAlertsRead={fetchAlertCount} />;
      case 'sales': return <SalesReport />;
      case 'inventory': return <InventoryAnalysis />;
      case 'customers': return <CustomerManagement />;
      case 'export': return <ExportData />;
      case 'audit': return <AuditLogs />;
      case 'pos': return <CashierInterface />;
      case 'products': return <ProductManagement />;
      case 'suppliers': return <SupplierManagement />;
      case 'categories': return <CategoryManagement />;
      case 'stock': return <StockManagement />;
      case 'users': return <UserManagement />;
      default: return <CashierInterface />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`bg-gradient-to-b from-blue-600 to-blue-700 text-white transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-8 h-8" />
              <div>
                <h1 className="font-bold text-lg">SuperMarket</h1>
                <p className="text-xs text-blue-200">Systeme POS</p>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-blue-500 rounded-lg transition">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            const showDivider = idx === 1 || idx === 5 || idx === 10 || idx === 13;
            const badge = item.badge ?? 0;
            return (
              <div key={item.id}>
                {showDivider && sidebarOpen && <div className="mx-4 my-2 border-t border-blue-500" />}
                <button
                  onClick={() => handleViewChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-500 transition ${currentView === item.id ? 'bg-blue-500 border-r-4 border-white' : ''}`}
                >
                  <span className="relative flex-shrink-0">
                    <Icon className="w-5 h-5" />
                    {badge > 0 && (
                      <span className={`absolute -top-2 -right-2 flex items-center justify-center font-bold text-white rounded-full shadow-lg ${badge >= 100 ? 'w-6 h-4 text-[9px] bg-red-500' : badge >= 10 ? 'w-5 h-5 text-[10px] bg-red-500' : 'w-4 h-4 text-[10px] bg-red-500'} ${!sidebarOpen ? '-top-1.5 -right-1.5' : ''}`}>
                        {badge >= 100 ? '99+' : badge}
                      </span>
                    )}
                  </span>
                  {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                  {sidebarOpen && badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
                      {badge >= 100 ? '99+' : badge}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="p-4 bg-blue-800 mt-auto">
          <div className={`flex items-center gap-3 mb-3 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">
              {user?.full_name.charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{user?.full_name}</p>
                <p className="text-xs text-blue-200 truncate">{user?.email}</p>
                <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">
                  {user?.role === 'admin' ? 'Admin' : 'Caissier'}
                </span>
              </div>
            )}
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition">
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Deconnexion</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}
