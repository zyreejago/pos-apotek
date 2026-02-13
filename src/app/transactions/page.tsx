'use client';

import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Plus, Minus, X, Store, CreditCard } from 'lucide-react';

import { useToast } from '@/components/ToastProvider';

interface Product {
  id: number;
  name: string;
  cost_price: number;
  selling_price: number;
  stock: number;
  unit: string;
  category: string;
}

interface Outlet {
  id: number;
  name: string;
}

interface CartItem extends Product {
  quantity: number;
}

export default function POSTransactionsPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, outletRes] = await Promise.all([
          fetch('http://localhost:5000/api/products?limit=100'), // Get enough products
          fetch('http://localhost:5000/api/outlets')
        ]);
        
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProducts(prodData.data || []);
        }

        if (outletRes.ok) {
          const outletData = await outletRes.json();
          if (Array.isArray(outletData)) {
            setOutlets(outletData);
            if (outletData.length > 0) {
              setSelectedOutlet(outletData[0].id);
            }
          } else {
            console.error('Outlets data is not an array:', outletData);
            setOutlets([]);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Cart Logic
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
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

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  const discount = 0; // Future implementation
  const total = subtotal - discount;

  // Filter Products
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle Payment
  const handlePayment = async () => {
    if (cart.length === 0) return showToast('Cart is empty', 'warning');
    if (!selectedOutlet) return showToast('Please select an outlet', 'warning');

    setProcessing(true);
    try {
      const payload = {
        outlet_id: selectedOutlet,
        items: cart.map(item => ({
          id: item.id,
          quantity: item.quantity,
          price: item.selling_price
        })),
        total_amount: total
      };

      const res = await fetch('http://localhost:5000/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Transaction successful!', 'success');
        setCart([]); // Clear cart
        // Refresh products to update stock
        const prodRes = await fetch('http://localhost:5000/api/products?limit=100');
        const prodData = await prodRes.json();
        setProducts(prodData.data || []);
      } else {
        showToast('Transaction failed', 'error');
      }
    } catch (error) {
      console.error('Payment error:', error);
      showToast('Error processing payment', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex justify-between items-center shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Transactions</span>
          <span>/</span>
          <span className="font-bold text-gray-900">Point Of Sales</span>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative">
                <Store size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select 
                    className="pl-10 pr-4 py-2 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedOutlet || ''}
                    onChange={(e) => setSelectedOutlet(Number(e.target.value))}
                >
                    {outlets.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </select>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                <img src="https://ui-avatars.com/api/?name=Admin" alt="User" />
            </div>
        </div>
      </header>

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
          <div className="flex-1 overflow-y-auto pr-2">
            {loading ? (
                <div className="flex justify-center items-center h-64">Loading products...</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map(product => (
                    <div 
                    key={product.id} 
                    onClick={() => addToCart(product)}
                    className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all group"
                    >
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-800 line-clamp-2 h-12">{product.name}</h3>
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            Stock: {product.stock}
                        </span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-blue-600 font-bold">
                                {formatCurrency(product.selling_price)} 
                                <span className="text-gray-400 text-sm font-normal"> / {product.unit.toLowerCase()}</span>
                            </p>
                        </div>
                        <button className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus size={16} />
                        </button>
                    </div>
                    </div>
                ))}
                </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-96 bg-white flex flex-col m-6 ml-0 rounded-2xl shadow-2xl z-20 overflow-hidden border border-gray-100">
          <div className="p-6 shrink-0 bg-white border-b border-gray-100 z-10">
            <h2 className="text-lg font-bold text-gray-800">Pesanan Saat Ini</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
            {cart.length === 0 ? (
                <div className="text-center text-gray-400 mt-10 flex flex-col items-center">
                    <ShoppingCart size={48} className="mb-4 opacity-20" />
                    <p>No items in cart</p>
                </div>
            ) : (
                cart.map(item => (
                <div key={item.id} className="flex gap-4 p-3 bg-white rounded-xl shadow-sm">
                    <div className="flex-1">
                        <h4 className="font-medium text-gray-800 text-sm mb-1">{item.name}</h4>
                        <p className="text-blue-600 text-xs font-bold">{formatCurrency(item.selling_price)} <span className="text-gray-400 font-normal">/ {item.unit.toLowerCase()}</span></p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                            <button 
                                onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}
                                className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-gray-600 shadow-sm transition-all"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                                className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-gray-600 shadow-sm transition-all"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                            className="text-red-400 hover:text-red-600"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
                ))
            )}
          </div>

          <div className="p-6 bg-gray-50 mt-auto">
            <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between text-gray-600">
                    <span>Sub total</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-red-500">
                    <span>Diskon</span>
                    <span className="font-medium">-Rp 0</span>
                </div>
                <div className="flex justify-between text-gray-900 font-bold text-lg pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
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