import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, TrendingUp, TrendingDown, Package, Search, Filter, X, Edit2, Check } from 'lucide-react';
import { getCurrentUser } from '../../lib/auth';

interface Product {
  id: string;
  name: string;
  barcode: string;
  stock_quantity: number;
  min_stock_level: number;
  selling_price: number;
}

interface StockMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out';
  quantity: number;
  reference: string | null;
  notes: string | null;
  created_at: string;
  products?: {
    name: string;
  };
}

type StockStatus = 'all' | 'out' | 'low' | 'ok';
type SortOption = 'name' | 'stock' | 'min_level';

export default function StockManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [editingMinStock, setEditingMinStock] = useState<{ id: string; value: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<StockStatus>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [formData, setFormData] = useState({
    movement_type: 'in' as 'in' | 'out',
    quantity: '',
    reference: '',
    notes: '',
  });

  useEffect(() => {
    loadProducts();
    loadMovements();
  }, []);

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, barcode, stock_quantity, min_stock_level, selling_price')
      .order('name');

    if (!error && data) {
      setProducts(data);
      const lowStock = data.filter(p => p.stock_quantity <= p.min_stock_level && p.stock_quantity > 0);
      setLowStockProducts(lowStock);
    }
  };

  const getStockStatus = (product: Product): StockStatus => {
    if (product.stock_quantity === 0) return 'out';
    if (product.stock_quantity <= product.min_stock_level) return 'low';
    return 'ok';
  };

  const getStockColor = (status: StockStatus) => {
    switch (status) {
      case 'out':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
      case 'low':
        return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' };
      case 'ok':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700' };
    }
  };

  const getStatusLabel = (status: StockStatus) => {
    switch (status) {
      case 'out': return 'RUPTURE';
      case 'low': return 'STOCK BAS';
      case 'ok': return 'OK';
      default: return 'Tous';
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.barcode.toLowerCase().includes(searchTerm.toLowerCase());
    const status = getStockStatus(p);
    const matchesFilter = filterStatus === 'all' || status === filterStatus;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'stock':
        return a.stock_quantity - b.stock_quantity;
      case 'min_level':
        return a.min_stock_level - b.min_stock_level;
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const updateMinStockLevel = async (productId: string, newValue: number) => {
    if (newValue < 0) return;
    const { error } = await supabase
      .from('products')
      .update({ min_stock_level: newValue })
      .eq('id', productId);

    if (!error) {
      loadProducts();
      setEditingMinStock(null);
    }
  };

  const loadMovements = async () => {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*, products(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setMovements(data);
  };

  const openModal = () => {
    setFormData({
      movement_type: 'in',
      quantity: '',
      reference: '',
      notes: '',
    });
    setSelectedProduct('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const movementData = {
      product_id: selectedProduct,
      movement_type: formData.movement_type,
      quantity: parseInt(formData.quantity),
      reference: formData.reference || null,
      notes: formData.notes || null,
      created_by: currentUser.id,
    };

    await supabase.from('stock_movements').insert([movementData]);

    const product = products.find(p => p.id === selectedProduct);
    if (product) {
      const newQuantity = formData.movement_type === 'in'
        ? product.stock_quantity + parseInt(formData.quantity)
        : product.stock_quantity - parseInt(formData.quantity);

      await supabase
        .from('products')
        .update({ stock_quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', selectedProduct);
    }

    setShowModal(false);
    loadProducts();
    loadMovements();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion du Stock</h2>
          <p className="text-gray-600">Suivi des mouvements de stock</p>
        </div>
        <button
          onClick={openModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition"
        >
          <Package className="w-5 h-5" />
          Nouveau Mouvement
        </button>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 mb-2">Alertes de Stock Bas</h3>
              <div className="space-y-1">
                {lowStockProducts.map((product) => (
                  <p key={product.id} className="text-sm text-red-700">
                    <span className="font-medium">{product.name}</span> - Stock: {product.stock_quantity}
                    (Minimum: {product.min_stock_level})
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg mb-4">Filtres et Tri</h3>
          <div className="space-y-3">
            <div className="flex gap-3 items-center flex-wrap">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou code-barres..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Filter className="w-5 h-5 text-gray-600" />
                {(['all', 'ok', 'low', 'out'] as StockStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-2 rounded-lg transition text-sm font-medium ${
                      filterStatus === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {getStatusLabel(status as StockStatus)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium text-gray-700">Trier par:</span>
              {(['name', 'stock', 'min_level'] as SortOption[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`px-3 py-2 rounded-lg transition text-sm ${
                    sortBy === option
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option === 'name' ? 'Nom' : option === 'stock' ? 'Stock' : 'Min. Stock'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold text-lg">État du Stock ({filteredProducts.length})</h3>
          </div>
          <div className="p-4 max-h-[600px] overflow-y-auto">
            <div className="space-y-3">
              {filteredProducts.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Aucun produit trouvé</p>
              ) : (
                filteredProducts.map((product) => {
                  const status = getStockStatus(product);
                  const colors = getStockColor(status);
                  return (
                    <div key={product.id} className={`flex items-start justify-between p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-semibold text-gray-800">{product.name}</p>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${colors.badge}`}>
                            {getStatusLabel(status)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">Code: {product.barcode}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-gray-600">Stock actuel</p>
                            <p className={`text-lg font-bold ${colors.text}`}>{product.stock_quantity}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Stock minimum</p>
                            {editingMinStock?.id === product.id ? (
                              <div className="flex gap-1 mt-1">
                                <input
                                  type="number"
                                  value={editingMinStock.value}
                                  onChange={(e) => setEditingMinStock({ ...editingMinStock, value: e.target.value })}
                                  className="w-12 px-2 py-1 border rounded text-sm"
                                  min="0"
                                />
                                <button
                                  onClick={() => updateMinStockLevel(product.id, parseInt(editingMinStock.value))}
                                  className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingMinStock(null)}
                                  className="p-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-1">
                                <p className={`text-lg font-bold ${colors.text}`}>{product.min_stock_level}</p>
                                <button
                                  onClick={() => setEditingMinStock({ id: product.id, value: product.min_stock_level.toString() })}
                                  className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                  title="Modifier le stock minimum"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-lg">Mouvements Récents</h3>
          </div>
          <div className="p-4 max-h-[500px] overflow-y-auto">
            <div className="space-y-3">
              {movements.map((movement) => (
                <div key={movement.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`p-2 rounded-lg ${
                    movement.movement_type === 'in' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {movement.movement_type === 'in' ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{movement.products?.name}</p>
                    <p className="text-sm text-gray-600">
                      {movement.movement_type === 'in' ? '+' : '-'}{movement.quantity} unités
                    </p>
                    {movement.reference && (
                      <p className="text-xs text-gray-500">Réf: {movement.reference}</p>
                    )}
                    {movement.notes && (
                      <p className="text-xs text-gray-500">{movement.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(movement.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Nouveau Mouvement de Stock</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Produit</label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="">Sélectionner un produit...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} (Stock actuel: {product.stock_quantity})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de mouvement</label>
                  <select
                    value={formData.movement_type}
                    onChange={(e) => setFormData({ ...formData, movement_type: e.target.value as 'in' | 'out' })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="in">Entrée (+)</option>
                    <option value="out">Sortie (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Référence</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: BON-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
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
                    Enregistrer
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