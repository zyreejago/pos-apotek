'use client';

import { useState, useEffect } from 'react';
import { Search, ShoppingCart, Plus, Minus, X, CreditCard } from 'lucide-react';

import { goeyToast } from "@/components/ui/goey-toaster";
import { useRequirePermission } from '@/hooks/useRequirePermission';
import PageHeader from '@/components/PageHeader';
import { useRouter } from 'next/navigation';

interface Product {
  id: number;
  name: string;
  cost_price: number;
  selling_price: number;
  stock: number;
  unit: string;
  category: string;
  purchase_unit?: string | null;
  unit_multiplier?: number;
}

interface CartItem extends Product {
  quantity: number;
}

interface ReceiptData {
  id: number;
  items: CartItem[];
  subtotal: number;
  ppn: number;
  discount: number;
  total: number;
  cashierName: string;
}

export default function POSTransactionsPage() {
  const router = useRouter();
  // Permission Check
  const { checkActionPermission } = useRequirePermission('Transactions');

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState({ ppn_rate: 0, discount_rate: 0 });
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'midtrans'>('cash');
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const [prodRes, settingsRes] = await Promise.all([
          fetch('http://localhost:5000/api/products?limit=100', { headers: authHeaders }), // Get enough products
          fetch(`http://localhost:5000/api/settings?t=${Date.now()}`, {
            headers: authHeaders
          })
        ]);

        if (prodRes.status === 401 || settingsRes.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          router.push('/login');
          return;
        }
        
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProducts(prodData.data || []);
        } else if (prodRes.status === 403) {
          goeyToast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk melihat daftar produk.'
          });
        }

        if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            setSettings({
                ppn_rate: Number(settingsData.ppn_rate) || 0,
                discount_rate: Number(settingsData.discount_rate) || 0
            });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  // Cart Logic
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      goeyToast.error('Stok Habis', {
        description: `Stok produk ${product.name} habis.`
      });
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          goeyToast.error('Stok Tidak Cukup', {
            description: `Stok produk ${product.name} hanya tersisa ${product.stock} ${product.unit}.`
          });
          return prev;
        }
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      // Highlight when new product is added
      setHighlightedProductId(product.id);
      setTimeout(() => setHighlightedProductId(null), 800);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const formatStock = (stock: number, multiplier: number, purchaseUnit: string, baseUnit: string) => {
    return `${stock} ${baseUnit || 'Tablet'}`;
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  const ppn = settings.ppn_rate > 0 ? (subtotal * settings.ppn_rate / 100) : 0;
  const discount = settings.discount_rate > 0 ? (subtotal * settings.discount_rate / 100) : 0;
  const total = subtotal + ppn - discount;

  // Filter Products
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle Payment
  const handlePayment = async () => {
    // Permission check for creating transaction (assuming 'create' is needed for payment)
    if (!checkActionPermission('create')) {
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk memproses transaksi penjualan."
        });
        return;
    }

    if (cart.length === 0) return goeyToast.error('Keranjang Kosong', { description: "Silakan pilih produk terlebih dahulu sebelum melanjutkan pembayaran." });

    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      
      const payload = {
        items: cart.map(item => ({
          id: item.id,
          quantity: item.quantity,
          price: item.selling_price
        })),
        total_amount: total,
        subtotal: subtotal,
        tax_amount: ppn,
        discount_amount: discount,
        payment_method: paymentMethod
      };

      const res = await fetch('http://localhost:5000/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push('/login');
        return;
      }

      const data = await res.json();
      if (res.ok) {
        if (paymentMethod === 'midtrans' && data.redirect_url) {
          // Use snap modal instead of redirect
          // Extract order_id from data (we need to return order_id from backend too!)
          // First, let's update backend to return order_id, but for now, extract from redirect_url:
          const urlParts = data.redirect_url.split('/');
          const snapToken = urlParts[urlParts.length - 1];
          const orderId = data.order_id || `POS-${Date.now()}`; // Wait, we need backend to return order_id! Let's update backend first!
          
          (window as any).snap.pay(snapToken, {
            onSuccess: async () => {
              try {
                const statusRes = await fetch(`http://localhost:5000/api/midtrans/status/${orderId}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                
                if (statusRes.ok) {
                  const statusData = await statusRes.json();
                  if (statusData.payment_status === 'completed') {
                    goeyToast.success('Transaksi Berhasil', {
                      description: `Pembayaran senilai ${formatCurrency(total)} berhasil diproses. ${cart.length} item telah tercatat dalam sistem penjualan.`
                    });
                    
                    printReceiptFunction({
                      id: data.id,
                      items: cart,
                      subtotal,
                      ppn,
                      discount,
                      total,
                      cashierName: currentUser?.username || 'Admin'
                    });
                    
                    setCart([]);
                    // Refresh products
                    const prodRes = await fetch('http://localhost:5000/api/products?limit=100', {
                      headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });
                    const prodData = await prodRes.json();
                    setProducts(prodData.data || []);
                  } else {
                    goeyToast.warning('Pembayaran Belum Selesai', {
                      description: `Status pembayaran: ${statusData.payment_status}`
                    });
                  }
                } else {
                  goeyToast.error('Gagal Memeriksa Status', {
                    description: 'Terjadi kesalahan saat memeriksa status pembayaran.'
                  });
                }
              } catch (error) {
                console.error('Error checking payment status:', error);
                goeyToast.error('Gagal Memeriksa Status', {
                  description: 'Periksa koneksi internet Anda dan coba lagi.'
                });
              }
            },
            onPending: () => {
              goeyToast.info('Menunggu Pembayaran', {
                description: 'Silakan selesaikan pembayaran Anda.'
              });
            },
            onError: () => {
              goeyToast.error('Pembayaran Gagal', {
                description: 'Terjadi kesalahan saat memproses pembayaran.'
              });
            },
            onClose: () => {
              goeyToast.info('Pembayaran Ditutup', {
                description: 'Anda menutup halaman pembayaran.'
              });
            }
          });
        } else {
          goeyToast.success('Transaksi Berhasil', {
            description: `Pembayaran senilai ${formatCurrency(total)} berhasil diproses. ${cart.length} item telah tercatat dalam sistem penjualan.`
          });
          
          printReceiptFunction({
            id: data.id,
            items: cart,
            subtotal,
            ppn,
            discount,
            total,
            cashierName: currentUser?.username || 'Admin'
          });
          
          setCart([]); // Clear cart
          // Refresh products to update stock
          const prodRes = await fetch('http://localhost:5000/api/products?limit=100', {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          const prodData = await prodRes.json();
          setProducts(prodData.data || []);
        }
      } else {
        goeyToast.error('Transaksi gagal', {
            description: data.message || "Terjadi kesalahan saat memproses transaksi."
        });
      }
    } catch (error) {
      console.error("Payment error:", error);
      goeyToast.error('Gagal memproses pembayaran', {
          description: "Periksa koneksi internet Anda dan coba lagi."
      });
    } finally {
      setProcessing(false);
    }
  };

  // Print Receipt Function
  const printReceiptFunction = (receiptData: ReceiptData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Nota Pembelian</title>
        <style>
          body {
            font-family: monospace;
            max-width: 300px;
            margin: 0 auto;
            padding: 15px;
          }
          .header {
            text-align: center;
            border-bottom: 1px solid #000;
            padding-bottom: 12px;
            margin-bottom: 12px;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .info {
            font-size: 12px;
            margin: 2px 0;
          }
          .divider-dash {
            border-bottom: 1px dashed #000;
            margin: 10px 0;
          }
          .items {
            margin: 10px 0;
          }
          .item {
            margin: 12px 0;
          }
          .item-name {
            font-weight: 500;
            margin-bottom: 2px;
            word-wrap: break-word;
          }
          .item-qty-price {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #444;
          }
          .summary {
            margin-top: 10px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            font-size: 12px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 2px solid #000;
            font-weight: bold;
            font-size: 15px;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">APOTEK SUMBER WARAS</div>
        </div>
        
        <div class="info">ID Transaksi : ${receiptData.id}</div>
        <div class="info">Tanggal      : ${new Date().toLocaleString('id-ID')}</div>
        <div class="info">Kasir        : ${receiptData.cashierName}</div>
        
        <div class="divider-dash"></div>
        
        <div class="items">
          ${receiptData.items.map((item: CartItem) => `
            <div class="item">
              <div class="item-name">${item.name}</div>
              <div class="item-qty-price">
                <span>${item.quantity} ${item.unit}</span>
                <span>${formatCurrency(item.selling_price * item.quantity)}</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="divider-dash"></div>
        
        <div class="summary">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>${formatCurrency(receiptData.subtotal)}</span>
          </div>
          ${receiptData.ppn > 0 ? `
            <div class="summary-row">
              <span>PPN (${settings.ppn_rate}%)</span>
              <span>${formatCurrency(receiptData.ppn)}</span>
            </div>
          ` : ''}
          ${receiptData.discount > 0 ? `
            <div class="summary-row">
              <span>Diskon (${settings.discount_rate}%)</span>
              <span>-${formatCurrency(receiptData.discount)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>TOTAL</span>
            <span>${formatCurrency(receiptData.total)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Terima kasih atas kunjungan Anda</p>
          <p>Semoga cepat sembuh</p>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <PageHeader 
        breadcrumbs={[{ label: 'Transactions' }, { label: 'Point Of Sales' }]}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Product Grid */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          {/* Search */}
          <div className="relative mb-6 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Type name, team name..." 
              className="w-full pl-10 pr-4 py-3 bg-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto pr-6 pt-4">
            {/* CSS Animations */}
            <style jsx>{`
              @keyframes highlightPulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
                50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
              }
              @keyframes badgeScaleIn {
                0% { transform: scale(0); opacity: 0; }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); opacity: 1; }
              }
              .product-highlight {
                animation: highlightPulse 0.8s ease-out;
              }
              .badge-scale-in {
                animation: badgeScaleIn 0.3s ease-out;
              }
            `}</style>
            
            {loading ? (
                <div className="flex justify-center items-center h-64">Loading products...</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
                {filteredProducts.map(product => {
                    const cartItem = cart.find(item => item.id === product.id);
                    const isActive = !!cartItem;
                    const quantity = cartItem?.quantity || 0;
                    const isHighlighted = highlightedProductId === product.id;
                    
                    return (
                    <div 
                    key={product.id} 
                    onClick={() => addToCart(product)}
                    className={`p-4 rounded-xl shadow-sm cursor-pointer transition-all duration-300 group relative ${
                        isActive 
                          ? 'bg-blue-50 border-2 border-blue-500 shadow-md' 
                          : 'bg-white border-2 border-transparent hover:shadow-md hover:border-gray-200'
                    } ${isHighlighted ? 'product-highlight' : ''}`}
                    >
                    {/* Badge Quantity */}
                    {isActive && (
                        <div className={`absolute -top-3 -right-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md z-10 ${
                            isHighlighted ? 'badge-scale-in' : ''
                        }`}>
                        {quantity}
                        </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-800 line-clamp-2 h-12">{product.name}</h3>
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            Stock: {formatStock(product.stock, product.unit_multiplier || 1, product.purchase_unit || 'Box', product.unit || 'Tablet')}
                        </span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className={`font-bold ${
                                isActive ? 'text-blue-700' : 'text-blue-600'
                            }`}>
                                {formatCurrency(product.selling_price)} 
                                <span className="text-gray-400 text-sm font-normal"> / {product.unit.toLowerCase()}</span>
                            </p>
                        </div>
                        <button className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                            isActive 
                              ? 'bg-blue-600 text-white shadow-md' 
                              : 'bg-blue-50 text-blue-600 opacity-0 group-hover:opacity-100'
                        }`}>
                            <Plus size={16} />
                        </button>
                    </div>
                    </div>
                    );
                })}
                </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-96 bg-white flex flex-col my-4 mr-6 ml-0 rounded-2xl shadow-2xl z-20 overflow-hidden border border-gray-100 h-[calc(100vh-8rem)]">
          <div className="px-4 py-3 shrink-0 bg-white border-b border-gray-100 z-10">
            <h2 className="text-lg font-bold text-gray-800">Pesanan Saat Ini</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-white min-h-0">
            {cart.length === 0 ? (
                <div className="text-center text-gray-400 py-8 flex flex-col items-center justify-center">
                    <ShoppingCart size={36} className="mb-2 opacity-20" />
                    <p className="text-sm">No items in cart</p>
                </div>
            ) : (
                cart.map(item => (
                <div key={item.id} className="relative flex gap-3 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                    {/* Delete Button at Top Right (like badge) */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors z-10"
                    >
                        <X size={12} />
                    </button>
                    
                    <div className="flex-1 pr-8">
                        <h4 className="font-semibold text-gray-800 text-sm mb-1">{item.name}</h4>
                        <p className="text-blue-600 text-sm font-bold">{formatCurrency(item.selling_price)} <span className="text-gray-400 font-normal text-xs">/ {item.unit.toLowerCase()}</span></p>
                    </div>
                    <div className="flex flex-col items-end justify-center">
                        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                            <button 
                                onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}
                                className="w-5 h-5 flex items-center justify-center hover:bg-white rounded-md text-gray-700 shadow-sm transition-all hover:shadow-md"
                            >
                                <Minus size={12} />
                            </button>
                            <span className="text-xs font-semibold px-1.5 text-center whitespace-nowrap min-w-[2.5rem]">{item.quantity} {item.unit}</span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                                className="w-5 h-5 flex items-center justify-center hover:bg-white rounded-md text-gray-700 shadow-sm transition-all hover:shadow-md"
                            >
                                <Plus size={12} />
                            </button>
                        </div>
                    </div>
                </div>
                ))
            )}
          </div>

          <div className="p-4 bg-gray-50 shrink-0 border-t border-gray-100">
            <div className="space-y-2 mb-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Sub total</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {settings.ppn_rate > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>PPN ({settings.ppn_rate}%)</span>
                  <span className="font-medium text-orange-600">+{formatCurrency(ppn)}</span>
                </div>
              )}
              {settings.discount_rate > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Diskon ({settings.discount_rate}%)</span>
                  <span className="font-medium">-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-900 font-bold text-base pt-2 border-t border-gray-100">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Metode Pembayaran</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === 'cash' 
                      ? 'border-blue-600 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm">Cash</div>
                  <div className="text-xs opacity-75">Tunai</div>
                </button>
                <button
                  onClick={() => setPaymentMethod('midtrans')}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === 'midtrans' 
                      ? 'border-green-600 bg-green-50 text-green-700' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm">Midtrans</div>
                  <div className="text-xs opacity-75">Transfer/QRIS</div>
                </button>
              </div>
            </div>

            <button 
                onClick={handlePayment}
                disabled={processing || cart.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
            >
                {processing ? 'Processing...' : (
                    <>
                        <CreditCard size={20} />
                        Pembayaran
                    </>
                )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
