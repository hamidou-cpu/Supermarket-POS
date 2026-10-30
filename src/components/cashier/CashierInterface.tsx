import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../lib/auth';
import { Scan, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, Zap, Save, RotateCcw, Keyboard, X, User, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { useToast } from '../../contexts/ToastContext';
import { useOffline } from '../../contexts/OfflineContext';
import { saveOfflineTransaction, isOnline as checkOnline } from '../../lib/offline';

interface Product {
  id: string;
  name: string;
  barcode: string;
  selling_price: number;
  purchase_price: number;
  stock_quantity: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface SavedCart {
  id: string;
  name: string;
  items: CartItem[];
  savedAt: string;
}

export default function CashierInterface() {
  const { showToast, showConfirm } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanBuffer, setScanBuffer] = useState('');
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [savedCarts, setSavedCarts] = useState<SavedCart[]>([]);
  const [showSavedCarts, setShowSavedCarts] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadProducts();
    loadSavedCarts();
    const recent = localStorage.getItem('pos_recent_products');
    if (recent) setRecentProducts(JSON.parse(recent));
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;

      if (e.key === 'Enter' && scanBuffer.length > 0) {
        e.preventDefault();
        processScan(scanBuffer);
        setScanBuffer('');
        setIsScanning(false);
        return;
      }

      if (timeDiff < 50 && e.key.length === 1) {
        e.preventDefault();
        setScanBuffer(prev => prev + e.key);
        setIsScanning(true);
        setLastKeyTime(currentTime);
      } else if (e.key.length === 1) {
        setScanBuffer(e.key);
        setLastKeyTime(currentTime);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (cart.length > 0) setShowPaymentModal(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        if (cart.length > 0) showConfirm('Vider le panier?', () => setCart([]));
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
        e.preventDefault();
        setQuickMode(prev => !prev);
      } else if (e.key === 'Escape') {
        setShowPaymentModal(false);
        setShowShortcutsHelp(false);
        setShowSavedCarts(false);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lastKeyTime, scanBuffer, cart]);

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, barcode, selling_price, purchase_price, stock_quantity').order('name');
    if (data) setProducts(data);
  };

  const loadSavedCarts = () => {
    const saved = localStorage.getItem('pos_saved_carts');
    if (saved) setSavedCarts(JSON.parse(saved));
  };

  const saveCart = () => {
    if (cart.length === 0) return;
    const name = prompt('Nom du panier sauvegarde:');
    if (!name) return;
    const newCart: SavedCart = { id: Date.now().toString(), name, items: [...cart], savedAt: new Date().toISOString() };
    const updated = [newCart, ...savedCarts];
    setSavedCarts(updated);
    localStorage.setItem('pos_saved_carts', JSON.stringify(updated));
    showToast('Panier sauvegarde!', 'success');
  };

  const loadCart = (saved: SavedCart) => {
    setCart(saved.items);
    setShowSavedCarts(false);
    showToast(`Panier "${saved.name}" charge!`, 'success');
  };

  const deleteSavedCart = (id: string) => {
    const updated = savedCarts.filter(c => c.id !== id);
    setSavedCarts(updated);
    localStorage.setItem('pos_saved_carts', JSON.stringify(updated));
  };

  const lookupCustomer = async () => {
    if (!customerPhone.trim()) return;
    try {
      const { data } = await supabase.from('customers').select('id, full_name, phone').eq('phone', customerPhone).single();
      if (data) {
        setCustomerId(data.id);
        setCustomerName(data.full_name);
        showToast(`Client: ${data.full_name}`, 'success');
      } else {
        setCustomerId(null);
        setCustomerName('');
        showToast('Client non trouve', 'error');
      }
    } catch {
      setCustomerId(null);
      setCustomerName('');
    }
  };

  const processScan = useCallback((scannedBarcode: string) => {
    const trimmed = scannedBarcode.trim();
    if (!trimmed) return;
    const product = products.find(p => p.barcode === trimmed);
    if (product) {
      addToCart(product);
      showToast(`${product.name} ajoute!`, 'success');
    } else {
      showToast('Produit non trouve!', 'error');
    }
  }, [products]);

  const handleBarcodeInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    processScan(barcode);
    setBarcode('');
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock_quantity) {
        setCart(prev => prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      } else {
        showToast('Stock insuffisant!', 'error');
      }
    } else {
      if (product.stock_quantity > 0) {
        setCart(prev => [...prev, { product, quantity: 1 }]);
        const recent = [product, ...recentProducts].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i).slice(0, 10);
        setRecentProducts(recent);
        localStorage.setItem('pos_recent_products', JSON.stringify(recent));
      } else {
        showToast('Produit en rupture de stock!', 'error');
      }
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.product.id !== productId));
    } else if (newQty <= item.product.stock_quantity) {
      setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: newQty } : i));
    } else {
      showToast('Stock insuffisant!', 'error');
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const getTotal = () => cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm)
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Interface de Caisse</h2>
        <div className="flex items-center gap-2">
          <OfflineStatus />
          <button onClick={() => setQuickMode(!quickMode)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${quickMode ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <Zap className="w-4 h-4 inline mr-1" />Mode Rapide
          </button>
          <button onClick={() => setShowSavedCarts(!showSavedCarts)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
            <Save className="w-4 h-4 inline mr-1" />Paniers ({savedCarts.length})
          </button>
          <button onClick={() => setShowShortcutsHelp(!showShortcutsHelp)} className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200">
            <Keyboard className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {isScanning && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 animate-pulse">
          <Scan className="w-5 h-5 text-green-600" />
          <span className="text-green-700 font-medium">Scan en cours... {scanBuffer}</span>
        </div>
      )}

      {quickMode && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-green-600" />
          <span className="text-green-700 font-medium text-sm">Mode Rapide actif - Interface simplifiee pour les heures de pointe</span>
        </div>
      )}

      <div className="mb-4">
        <form onSubmit={handleBarcodeInput} className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Scan className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isScanning ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
            <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Scanner ou entrer le code-barres..." autoFocus />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">Ajouter</button>
        </form>

        <div className="flex gap-2">
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Rechercher un produit..." />
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-3">
            <User className="w-4 h-4 text-gray-400" />
            <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} onBlur={lookupCustomer} placeholder="Tel client" className="w-28 py-2 outline-none text-sm" />
            {customerName && <span className="text-xs text-green-600 font-medium whitespace-nowrap">{customerName}</span>}
          </div>
        </div>
      </div>

      {showSavedCarts && savedCarts.length > 0 && (
        <div className="mb-4 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Paniers Sauvegardes</h3>
          <div className="space-y-2">
            {savedCarts.map(sc => (
              <div key={sc.id} className="flex items-center justify-between p-2 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{sc.name}</p>
                  <p className="text-xs text-gray-500">{sc.items.length} articles - {new Date(sc.savedAt).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadCart(sc)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><RotateCcw className="w-4 h-4" /></button>
                  <button onClick={() => deleteSavedCart(sc.id)} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!quickMode && recentProducts.length > 0 && searchTerm === '' && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 font-medium mb-2">ARTICLES RECENTS</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {recentProducts.slice(0, 8).map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className="flex-shrink-0 px-3 py-2 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-sm">
                <p className="font-medium text-gray-800">{p.name}</p>
                <p className="text-xs text-blue-600 font-semibold">{p.selling_price.toFixed(2)} DH</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg">Produits Disponibles</h3>
              <span className="text-sm text-gray-500">{filteredProducts.length} produits</span>
            </div>
            <div className={`p-4 grid gap-3 max-h-[600px] overflow-y-auto ${quickMode ? 'grid-cols-3 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
              {filteredProducts.map(product => (
                <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock_quantity === 0} className={`p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left disabled:opacity-40 disabled:cursor-not-allowed ${quickMode ? 'py-2 px-3' : ''}`}>
                  <p className={`font-medium text-gray-800 mb-1 ${quickMode ? 'text-sm' : ''}`}>{product.name}</p>
                  <p className="text-lg font-bold text-blue-600">{product.selling_price.toFixed(2)} DH</p>
                  {!quickMode && <p className="text-xs text-gray-500">Stock: {product.stock_quantity}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow sticky top-6">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-lg">Panier</h3>
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-sm font-semibold">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <>
                    <button onClick={saveCart} className="text-blue-600 hover:text-blue-800" title="Sauvegarder"><Save className="w-4 h-4" /></button>
                    <button onClick={() => showConfirm('Vider le panier?', () => setCart([]))} className="text-red-600 hover:text-red-800 text-sm">Vider</button>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Panier vide</p>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.product.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium text-gray-800 flex-1 text-sm">{item.product.name}</p>
                        <button onClick={() => removeFromCart(item.product.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 bg-gray-100 rounded hover:bg-gray-200 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                          <span className="w-7 text-center font-semibold text-sm">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 bg-gray-100 rounded hover:bg-gray-200 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                        </div>
                        <p className="font-semibold text-blue-600 text-sm">{(item.product.selling_price * item.quantity).toFixed(2)} DH</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t">
              {customerName && (
                <div className="mb-2 text-xs text-green-600 font-medium flex items-center gap-1">
                  <User className="w-3 h-3" /> Client: {customerName}
                </div>
              )}
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold text-gray-800">Total</span>
                <span className="text-2xl font-bold text-blue-600">{getTotal().toFixed(2)} DH</span>
              </div>
              <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed">
                Payer (Ctrl+P)
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal cart={cart} total={getTotal()} onClose={() => setShowPaymentModal(false)} onSuccess={() => { setCart([]); setShowPaymentModal(false); loadProducts(); }} customerId={customerId} customerName={customerName} />
      )}

      {showShortcutsHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Raccourcis Clavier</h3>
              <button onClick={() => setShowShortcutsHelp(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Paiement', 'Ctrl+P'],
                ['Vider le panier', 'Ctrl+L'],
                ['Aide', 'Ctrl+K'],
                ['Mode rapide', 'Ctrl+Q'],
                ['Fermer les modals', 'Escape'],
              ].map(([action, key]) => (
                <div key={key} className="flex justify-between items-center pb-3 border-b last:border-b-0">
                  <span className="text-gray-700">{action}</span>
                  <kbd className="px-2 py-1 bg-gray-200 rounded font-mono text-xs">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PaymentModalProps {
  cart: CartItem[];
  total: number;
  onClose: () => void;
  onSuccess: () => void;
  customerId: string | null;
  customerName: string;
}

function PaymentModal({ cart, total, onClose, onSuccess, customerId, customerName }: PaymentModalProps) {
  const { showToast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    setProcessing(true);
    const currentUser = getCurrentUser();
    if (!currentUser) { showToast('Utilisateur non connecte!', 'error'); setProcessing(false); return; }

    const saleNumber = `SALE-${Date.now()}`;
    const { data: saleData, error: saleError } = await supabase.from('sales').insert([{
      sale_number: saleNumber, cashier_id: currentUser.id, total_amount: total, payment_method: paymentMethod, status: 'completed',
    }]).select().single();

    if (saleError || !saleData) { showToast('Erreur lors de la vente!', 'error'); setProcessing(false); return; }

    const saleItems = cart.map(item => ({
      sale_id: saleData.id, product_id: item.product.id, product_name: item.product.name,
      quantity: item.quantity, unit_price: item.product.selling_price, purchase_price: item.product.purchase_price,
      subtotal: item.product.selling_price * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
    if (itemsError) { showToast('Erreur articles!', 'error'); setProcessing(false); return; }

    if (customerId) {
      const itemsInCart = cart.reduce((s, i) => s + i.quantity, 0);
      const pointsEarned = Math.floor(total / 10);
      await supabase.from('customer_purchases').insert([{ customer_id: customerId, sale_id: saleData.id, amount: total, points_earned: pointsEarned }]);

      const { data: currentCustomer } = await supabase.from('customers').select('total_purchases, total_amount_spent').eq('id', customerId).single();
      const newTotalPurchases = (currentCustomer?.total_purchases || 0) + itemsInCart;
      const newTotalSpent = (currentCustomer?.total_amount_spent || 0) + total;
      const newTier = newTotalSpent >= 10000 ? 'platinum' : newTotalSpent >= 5000 ? 'gold' : newTotalSpent >= 2000 ? 'silver' : 'bronze';
      await supabase.from('customers').update({ total_purchases: newTotalPurchases, total_amount_spent: newTotalSpent, loyalty_tier: newTier, last_purchase_at: new Date().toISOString() }).eq('id', customerId);
      const { data: lp } = await supabase.from('loyalty_points').select('*').eq('customer_id', customerId).single();
      if (lp) {
        await supabase.from('loyalty_points').update({ points_balance: lp.points_balance + pointsEarned, points_earned: lp.points_earned + pointsEarned, last_activity: new Date().toISOString() }).eq('id', lp.id);
      }
    }

    generateReceipt(saleNumber, cart, total, paymentMethod, currentUser.full_name, customerName);
    showToast('Vente enregistree!', 'success');
    onSuccess();
  };

  const generateReceipt = (saleNumber: string, items: CartItem[], total: number, method: string, cashierName: string, custName: string) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('SuperMarket POS', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Ticket de Caisse', 105, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`N ${saleNumber}`, 20, 45);
    doc.text(`Date: ${new Date().toLocaleString('fr-FR')}`, 20, 52);
    doc.text(`Caissier: ${cashierName}`, 20, 59);
    if (custName) doc.text(`Client: ${custName}`, 20, 66);
    doc.line(20, custName ? 70 : 65, 190, custName ? 70 : 65);
    let y = custName ? 80 : 75;
    doc.setFontSize(9);
    doc.text('Article', 20, y);
    doc.text('Qte', 130, y, { align: 'center' });
    doc.text('P.U.', 155, y, { align: 'right' });
    doc.text('Total', 190, y, { align: 'right' });
    y += 5;
    doc.line(20, y, 190, y);
    y += 8;
    items.forEach(item => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(item.product.name, 20, y);
      doc.text(item.quantity.toString(), 130, y, { align: 'center' });
      doc.text(`${item.product.selling_price.toFixed(2)} DH`, 155, y, { align: 'right' });
      doc.text(`${(item.product.selling_price * item.quantity).toFixed(2)} DH`, 190, y, { align: 'right' });
      y += 7;
    });
    y += 5;
    doc.line(20, y, 190, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', 20, y);
    doc.text(`${total.toFixed(2)} DH`, 190, y, { align: 'right' });
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Mode: ${method === 'cash' ? 'Especes' : method === 'card' ? 'Carte' : 'Mobile'}`, 20, y);
    y += 15;
    doc.setFontSize(9);
    doc.text('Merci de votre visite!', 105, y, { align: 'center' });
    doc.save(`ticket-${saleNumber}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">Finaliser le Paiement</h3>
          {customerName && <p className="text-sm text-green-600 mb-2 flex items-center gap-1"><User className="w-4 h-4" />Client: {customerName}</p>}
          <div className="mb-6">
            <p className="text-gray-600 mb-2">Montant total</p>
            <p className="text-3xl font-bold text-blue-600">{total.toFixed(2)} DH</p>
          </div>
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Methode de paiement</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { method: 'cash' as const, icon: Banknote, label: 'Especes', color: 'text-green-600' },
                { method: 'card' as const, icon: CreditCard, label: 'Carte', color: 'text-blue-600' },
                { method: 'mobile' as const, icon: Smartphone, label: 'Mobile', color: 'text-orange-600' },
              ].map(({ method, icon: Icon, label, color }) => (
                <button key={method} onClick={() => setPaymentMethod(method)} className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition ${paymentMethod === method ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:border-blue-300'}`}>
                  <Icon className={`w-8 h-8 ${color}`} />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={processing} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50 transition disabled:opacity-50">Annuler</button>
            <button onClick={handlePayment} disabled={processing} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">{processing ? 'Traitement...' : 'Confirmer'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OfflineStatus() {
  const { isOnline, hasPendingTransactions, pendingCount, isSyncing } = useOffline();
  const { showToast } = useToast();

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
        <WifiOff className="w-4 h-4 text-red-600" />
        <span className="text-sm font-medium text-red-700">Mode Offline</span>
      </div>
    );
  }

  if (hasPendingTransactions) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
        <AlertCircle className="w-4 h-4 text-yellow-600" />
        <span className="text-sm font-medium text-yellow-700">
          {isSyncing ? `Sync: ${pendingCount}...` : `${pendingCount} a synchroniser`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
      <Wifi className="w-4 h-4 text-green-600" />
      <span className="text-sm font-medium text-green-700">Online</span>
    </div>
  );
}
