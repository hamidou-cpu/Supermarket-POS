import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, CreditCard as Edit2, Trash2, Package, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '../../contexts/ToastContext';

interface Product {
  id: string;
  name: string;
  barcode: string;
  category_id: string | null;
  supplier_id: string | null;
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_level: number;
  description: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

export default function ProductManagement() {
  const { showToast, showConfirm } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedBarcode, setSelectedBarcode] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category_id: '',
    supplier_id: '',
    purchase_price: '',
    selling_price: '',
    stock_quantity: '',
    min_stock_level: '10',
    description: '',
  });

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadSuppliers();
  }, []);

  const loadProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (!error && data) setProducts(data);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase.from('categories').select('id, name').order('name');
    if (!error && data) setCategories(data);
  };

  const loadSuppliers = async () => {
    const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
    if (!error && data) setSuppliers(data);
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        barcode: product.barcode,
        category_id: product.category_id || '',
        supplier_id: product.supplier_id || '',
        purchase_price: product.purchase_price.toString(),
        selling_price: product.selling_price.toString(),
        stock_quantity: product.stock_quantity.toString(),
        min_stock_level: product.min_stock_level.toString(),
        description: product.description || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        barcode: `PRD${Date.now()}`,
        category_id: '',
        supplier_id: '',
        purchase_price: '',
        selling_price: '',
        stock_quantity: '0',
        min_stock_level: '10',
        description: '',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const productData = {
      name: formData.name,
      barcode: formData.barcode,
      category_id: formData.category_id || null,
      supplier_id: formData.supplier_id || null,
      purchase_price: parseFloat(formData.purchase_price),
      selling_price: parseFloat(formData.selling_price),
      stock_quantity: parseInt(formData.stock_quantity),
      min_stock_level: parseInt(formData.min_stock_level),
      description: formData.description || null,
    };

    if (editingProduct) {
      const { error } = await supabase.from('products').update(productData).eq('id', editingProduct.id);
      if (error) {
        showToast('Erreur lors de la mise à jour du produit', 'error');
        return;
      }
      showToast('Produit mis à jour avec succès', 'success');
    } else {
      const { error } = await supabase.from('products').insert([productData]);
      if (error) {
        showToast('Erreur lors de la création du produit', 'error');
        return;
      }
      showToast('Produit créé avec succès', 'success');
    }

    setShowModal(false);
    loadProducts();
  };

  const deleteProduct = async (id: string) => {
    showConfirm('Êtes-vous sûr de vouloir supprimer ce produit?', async () => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        showToast('Erreur lors de la suppression du produit', 'error');
      } else {
        showToast('Produit supprimé avec succès', 'success');
        loadProducts();
      }
    });
  };

  const showQRCode = (barcode: string) => {
    setSelectedBarcode(barcode);
    setShowQRModal(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion des Produits</h2>
          <p className="text-gray-600">Gérer les produits du supermarché</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition"
        >
          <Plus className="w-5 h-5" />
          Nouveau Produit
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code-barres</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix d'achat</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix de vente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Package className="w-8 h-8 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => showQRCode(product.barcode)}
                    className="text-blue-600 hover:text-blue-800 font-mono text-sm"
                  >
                    {product.barcode}
                  </button>
                </td>
                <td className="px-6 py-4 text-gray-700">{product.purchase_price.toFixed(2)} DH</td>
                <td className="px-6 py-4 text-gray-700">{product.selling_price.toFixed(2)} DH</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={product.stock_quantity <= product.min_stock_level ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                      {product.stock_quantity}
                    </span>
                    {product.stock_quantity <= product.min_stock_level && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openModal(product)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du produit</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code-barres</label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Sélectionner...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Sélectionner...</option>
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix d'achat (DH)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (DH)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantité en stock</label>
                    <input
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Niveau minimum</label>
                    <input
                      type="number"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                    {editingProduct ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4 text-center">Code QR</h3>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={selectedBarcode} size={200} />
            </div>
            <p className="text-center text-gray-600 mb-4 font-mono">{selectedBarcode}</p>
            <button
              onClick={() => setShowQRModal(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}