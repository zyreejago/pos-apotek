'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Plus, Minus, X, CreditCard, User, Pill } from 'lucide-react';

import { API_URL } from '@/lib/api-config';
import { goeyToast } from "@/components/ui/goey-toaster";
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { useKeyboardShortcuts } from '@/context/KeyboardShortcutsContext';
import { useSidebar } from '@/context/SidebarContext';
import PageHeader from '@/components/PageHeader';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    snap: { pay: (token: string, options: Record<string, unknown>) => void };
  }
}

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
  prescriptionLabel?: string;
}

interface PrescriptionData {
  id?: number;
  label: string;
  prescription_code: string;
  doctor_name: string;
  instansi: string;
  prescription_date: string;
  notes: string;
  items: { product: Product; quantity: number }[];
}

interface ReceiptData {
  id: number;
  items: CartItem[];
  subtotal: number;
  ppn: number;
  discount: number;
  total: number;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  prescriptions?: PrescriptionData[];
}

export default function POSTransactionsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { setSearchInputRef } = useKeyboardShortcuts();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchInputRef(searchRef);
    return () => setSearchInputRef({ current: null });
  }, [setSearchInputRef]);

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
  const [editingQty, setEditingQty] = useState<{id: number; value: string} | null>(null);
  const [showBuyerForm, setShowBuyerForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const customerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionData[]>([]);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [editingPrescriptionIdx, setEditingPrescriptionIdx] = useState<number | null>(null);
  const [prescriptionSearch, setPrescriptionSearch] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [prescriptionForm, setPrescriptionForm] = useState({ prescription_code: '', doctor_name: '', instansi: '', prescription_date: new Date().toISOString().split('T')[0], notes: '' });

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const [prodRes, settingsRes] = await Promise.all([
          fetch(`${API_URL}/api/products?limit=100`, { headers: authHeaders }), // Get enough products
          fetch(`${API_URL}/api/settings?t=${Date.now()}`, {
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

  const decrementProduct = (productId: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter(item => item.id !== productId);
      }
      return prev.map(item =>
        item.id === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setEditingQty(null);
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

  const setQuantityDirect = (productId: number, val: number) => {
    const product = products.find(p => p.id === productId);
    const maxStock = product?.stock ?? Infinity;
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(1, Math.min(val, maxStock)) };
      }
      return item;
    }));
  };

  const openNewPrescription = () => {
    setPrescriptionForm({ prescription_code: '', doctor_name: '', instansi: '', prescription_date: new Date().toISOString().split('T')[0], notes: '' });
    setPrescriptionItems([]);
    setPrescriptionSearch('');
    setEditingPrescriptionIdx(null);
    setShowPrescriptionForm(true);
  };

  const openEditPrescription = (idx: number) => {
    const p = prescriptions[idx];
    setPrescriptionForm({
      prescription_code: p.prescription_code,
      doctor_name: p.doctor_name,
      instansi: p.instansi,
      prescription_date: p.prescription_date,
      notes: p.notes,
    });
    setPrescriptionItems(p.items.map(i => ({ product: i.product, quantity: i.quantity })));
    setEditingPrescriptionIdx(idx);
    setShowPrescriptionForm(true);
  };

  const savePrescriptionToApi = async (data: PrescriptionData): Promise<number | undefined> => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const itemsPayload = data.items.map(i => ({ product_id: i.product.id, quantity: i.quantity, selling_price: i.product.selling_price }));
      const body = {
        prescription_code: data.prescription_code,
        doctor_name: data.doctor_name,
        instansi: data.instansi,
        prescription_date: data.prescription_date,
        notes: data.notes,
        entered_by: currentUser?.id,
        items: JSON.stringify(itemsPayload),
      };

      if (data.id) {
        const res = await fetch(`${API_URL}/api/inventory/prescriptions/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(body),
        });
        if (res.ok) return data.id;
      } else {
        const res = await fetch(`${API_URL}/api/inventory/prescriptions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const result = await res.json();
          return result.data?.id;
        }
      }
    } catch (error) {
      console.error('Error saving prescription:', error);
    }
  };

  const savePrescription = async () => {
    const label = editingPrescriptionIdx !== null
      ? prescriptions[editingPrescriptionIdx].label
      : `Resep ${prescriptions.length + 1}`;

    const data: PrescriptionData = {
      id: editingPrescriptionIdx !== null ? prescriptions[editingPrescriptionIdx].id : undefined,
      label,
      ...prescriptionForm,
      items: prescriptionItems.map(i => ({ product: i.product, quantity: i.quantity })),
    };

    if (editingPrescriptionIdx !== null) {
      setCart(prev => prev.filter(item => item.prescriptionLabel !== label));
      setPrescriptions(prev => prev.map((p, i) => i === editingPrescriptionIdx ? data : p));
    } else {
      setPrescriptions(prev => [...prev, data]);
    }

    const cartItems: CartItem[] = prescriptionItems.map(i => ({
      ...i.product,
      quantity: i.quantity,
      prescriptionLabel: label,
    }));

    setCart(prev => {
      const filtered = editingPrescriptionIdx !== null
        ? prev.filter(item => item.prescriptionLabel !== label)
        : prev;
      const merged = [...filtered];
      for (const newItem of cartItems) {
        const existing = merged.find(item => item.id === newItem.id && item.prescriptionLabel === label);
        if (existing) {
          existing.quantity += newItem.quantity;
        } else {
          merged.push(newItem);
        }
      }
      return merged;
    });

    setShowPrescriptionForm(false);
  };

  const deletePrescription = (idx: number) => {
    const p = prescriptions[idx];
    setCart(prev => prev.filter(item => item.prescriptionLabel !== p.label));
    setPrescriptions(prev => prev.filter((_, i) => i !== idx));
  };

  const addPrescriptionItem = (product: Product) => {
    setPrescriptionItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removePrescriptionItem = (productId: number) => {
    setPrescriptionItems(prev => prev.filter(i => i.product.id !== productId));
  };

  const updatePrescriptionItemQty = (productId: number, delta: number) => {
    setPrescriptionItems(prev => prev.map(i =>
      i.product.id === productId
        ? { ...i, quantity: Math.max(1, i.quantity + delta) }
        : i
    ));
  };

  const filteredPrescriptionProducts = products.filter(p =>
    p.name.toLowerCase().includes(prescriptionSearch.toLowerCase())
  );

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const saveCustomer = async () => {
    if (!customerName || !customerPhone) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: customerName, phone: customerPhone })
      });
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const searchCustomerByPhone = async (phone: string) => {
    if (!phone || phone.length < 4) return;
    setSearchingCustomer(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/customers/search?phone=${encodeURIComponent(phone)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.customer) {
          setCustomerName(data.customer.name);
        }
      }
    } catch (error) {
      console.error('Error searching customer:', error);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const handlePhoneChange = (val: string) => {
    setCustomerPhone(val);
    if (customerTimerRef.current) clearTimeout(customerTimerRef.current);
    customerTimerRef.current = setTimeout(() => searchCustomerByPhone(val), 500);
  };

  const formatStock = (stock: number, multiplier: number, purchaseUnit: string, baseUnit: string) => {
    return `${stock} ${baseUnit || 'Tablet'}`;
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  const ppn = settings.ppn_rate > 0 ? (subtotal * settings.ppn_rate / 100) : 0;
  const discount = settings.discount_rate > 0 ? (subtotal * settings.discount_rate / 100) : 0;
  const total = subtotal + ppn - discount;

  const showCartOnTablet = cart.length > 0 && isCollapsed;

  // Filter Products
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Save all prescriptions to API after successful payment
  const saveAllPrescriptionsToApi = async () => {
    for (const p of prescriptions) {
      await savePrescriptionToApi(p);
    }
  };

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
        payment_method: paymentMethod,
        customer_name: customerName || null,
        customer_phone: customerPhone || null
      };

      const res = await fetch(`${API_URL}/api/transactions`, {
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
          
          window.snap.pay(snapToken, {
            onSuccess: async () => {
              try {
                const statusRes = await fetch(`${API_URL}/api/midtrans/status/${orderId}`, {
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
                      cashierName: currentUser?.username || 'Admin',
                      customerName: customerName || undefined,
                      customerPhone: customerPhone || undefined,
                      prescriptions: prescriptions.length > 0 ? prescriptions : undefined,
                    });
                    
                    saveCustomer();
                    await saveAllPrescriptionsToApi();
                    setCart([]);
                    setPrescriptions([]);
                    setCustomerName('');
                    setCustomerPhone('');
                    // Refresh products
                    const prodRes = await fetch(`${API_URL}/api/products?limit=100`, {
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
            cashierName: currentUser?.username || 'Admin',
            customerName: customerName || undefined,
            customerPhone: customerPhone || undefined,
            prescriptions: prescriptions.length > 0 ? prescriptions : undefined,
          });
          
          saveCustomer();
          await saveAllPrescriptionsToApi();
          setCart([]);
          setPrescriptions([]);
          setCustomerName('');
          setCustomerPhone('');
          // Refresh products to update stock
          const prodRes = await fetch(`${API_URL}/api/products?limit=100`, {
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
        ${receiptData.customerName ? `
        <div class="info">Pembeli      : ${receiptData.customerName}${receiptData.customerPhone ? ` (${receiptData.customerPhone})` : ''}</div>
        ` : ''}
        
        <div class="divider-dash"></div>
        
        <div class="items">
          ${receiptData.prescriptions ? receiptData.prescriptions.map(p => `
            <div style="margin-bottom: 10px;">
              <div style="font-weight: bold; font-size: 12px; color: #7c3aed; margin-bottom: 4px;">${p.label}${p.doctor_name ? ` - ${p.doctor_name}` : ''}</div>
              ${p.items.map(pi => `
                <div class="item" style="margin: 6px 0 6px 8px;">
                  <div class="item-name" style="font-size: 11px;">${pi.product.name}</div>
                  <div class="item-qty-price">
                    <span>${pi.quantity} ${pi.product.unit}</span>
                    <span>${formatCurrency(pi.product.selling_price * pi.quantity)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('') : ''}
          ${receiptData.items.filter((i: CartItem) => !i.prescriptionLabel).length > 0 ? `
            ${receiptData.prescriptions ? '<div style="font-weight: bold; font-size: 12px; margin-bottom: 4px;">Non Resep</div>' : ''}
            ${receiptData.items.filter((i: CartItem) => !i.prescriptionLabel).map((item: CartItem) => `
              <div class="item">
                <div class="item-name">${item.name}</div>
                <div class="item-qty-price">
                  <span>${item.quantity} ${item.unit}</span>
                  <span>${formatCurrency(item.selling_price * item.quantity)}</span>
                </div>
              </div>
            `).join('')}
          ` : ''}
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

      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden relative">
        {/* Left: Product Grid */}
        <div className={`flex-1 flex flex-col p-3 sm:p-6 ${showCartOnTablet ? 'sm:pr-[26rem]' : 'lg:pr-[26rem]'} overflow-hidden ${cart.length > 0 ? 'pb-[45vh] sm:pb-0' : ''}`}>
          {/* Search */}
          <div className="relative mb-6 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              ref={searchRef}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-5 pb-4">
                {filteredProducts.map(product => {
                    const cartItem = cart.find(item => item.id === product.id);
                    const prescItem = prescriptionItems.find(i => i.product.id === product.id);
                    const isActive = showPrescriptionForm ? !!prescItem : !!cartItem;
                    const quantity = showPrescriptionForm ? (prescItem?.quantity || 0) : (cartItem?.quantity || 0);
                    const isHighlighted = highlightedProductId === product.id;
                    
                    return (
                    <div 
                    key={product.id} 
                    onClick={() => showPrescriptionForm ? addPrescriptionItem(product) : addToCart(product)}
                    className={`p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-sm cursor-pointer transition-all duration-300 group relative ${
                        isActive 
                          ? 'bg-blue-50 border-2 border-blue-500 shadow-md' 
                          : 'bg-white border-2 border-transparent hover:shadow-md hover:border-gray-200'
                    } ${isHighlighted ? 'product-highlight' : ''}`}
                    >
                    {/* Badge Quantity */}
                    {isActive && (
                        <div className={`absolute -top-2 -right-2 w-6 sm:w-8 h-6 sm:h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-md z-10 ${
                            isHighlighted ? 'badge-scale-in' : ''
                        }`}>
                        {quantity}
                        </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-1 sm:mb-2 gap-1">
                        <h3 className="font-semibold text-gray-800 line-clamp-1 text-xs sm:text-sm">{product.name}</h3>
                        <span className="text-[9px] sm:text-xs font-medium bg-gray-100 text-gray-600 px-1 sm:px-2 py-0.5 rounded-full shrink-0">
                            {formatStock(product.stock, product.unit_multiplier || 1, product.purchase_unit || 'Box', product.unit || 'Tablet')}
                        </span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className={`font-bold text-[11px] sm:text-sm ${
                                isActive ? 'text-blue-700' : 'text-blue-600'
                            }`}>
                                {formatCurrency(product.selling_price)} 
                                <span className="text-gray-400 text-[9px] sm:text-xs font-normal"> /{product.unit.toLowerCase()}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          {isActive && !showPrescriptionForm && (
                            <button onClick={(e) => { e.stopPropagation(); decrementProduct(product.id); }}
                              className="w-6 sm:w-8 h-6 sm:h-8 flex items-center justify-center rounded-lg transition-all bg-blue-600 text-white shadow-md">
                              <Minus size={12} />
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); if (showPrescriptionForm) addPrescriptionItem(product); else addToCart(product); }}
                            className={`w-6 sm:w-8 h-6 sm:h-8 flex items-center justify-center rounded-lg transition-all ${
                              isActive && !showPrescriptionForm
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-blue-50 text-blue-600 opacity-0 sm:opacity-0 sm:group-hover:opacity-100'
                            }`}>
                            <Plus size={12} />
                          </button>
                        </div>
                    </div>
                    </div>
                    );
                })}
                </div>
            )}
          </div>
        </div>

        {/* Right: Cart — side panel on desktop, slide-up bottom sheet on mobile */}
        {!showBuyerForm && !showPrescriptionForm && (
          <div className={`
            fixed bottom-0 left-16 right-0 z-30
            lg:fixed lg:right-6 lg:left-auto lg:top-[5rem] lg:w-96
            bg-white flex flex-col
            lg:h-[calc(100vh-7rem)]
            transition-all duration-300 ease-out
            ${!showCartOnTablet ? 'hidden lg:flex' : ''}
            ${cart.length > 0 
              ? 'max-h-[55vh] lg:max-h-full shadow-2xl rounded-t-2xl lg:rounded-2xl lg:shadow-2xl lg:border lg:border-gray-100' 
              : 'lg:max-h-full lg:shadow-2xl lg:border lg:border-gray-100 lg:rounded-2xl max-h-0 shadow-none'
            }
          `}>
            {/* Cart Header */}
            <div className={`
              px-3 lg:px-4 py-2 lg:py-3 shrink-0 bg-white border-b border-gray-100 flex items-center justify-between
              ${cart.length === 0 ? 'border-b-0 lg:border-b' : ''}
            `}>
              <h2 className="text-sm lg:text-lg font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart size={16} className="text-blue-600" />
                Pesanan Saat Ini
                {cart.length > 0 && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">{cart.length}</span>}
              </h2>
              {cart.length > 0 && (
                <button onClick={() => { setCart([]); setPrescriptions([]); }} className="text-xs text-red-500 hover:text-red-700 lg:hidden">Hapus Semua</button>
              )}
            </div>

            {/* Cart Items */}
            <div className={`flex-1 overflow-y-auto px-3 lg:px-4 py-2 space-y-2 bg-white min-h-0 ${cart.length === 0 ? 'hidden lg:block' : ''}`}>
              {/* Prescription badges */}
              {prescriptions.length > 0 && (
                <div className="space-y-2 pb-1">
                  {prescriptions.map((p, i) => (
                    <div key={i} className="relative flex items-center gap-2 p-2 lg:p-3 bg-purple-50 rounded-xl border border-purple-200">
                      <button onClick={(e) => { e.stopPropagation(); deletePrescription(i); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors z-10">
                        <X size={10} />
                      </button>
                      <Pill size={16} className="text-purple-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-800 text-xs lg:text-sm">{p.label}</h4>
                          <span className="text-[10px] font-medium text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">{p.items.length} item</span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{p.doctor_name || p.instansi ? `${p.doctor_name || ''}${p.doctor_name && p.instansi ? ' - ' : ''}${p.instansi || ''}` : 'Tanpa dokter'}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); openEditPrescription(i); }}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium shrink-0 border border-purple-300 px-2 py-1 rounded-lg">
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {cart.filter(i => !i.prescriptionLabel).length === 0 && prescriptions.length === 0 ? (
                <div className="text-center text-gray-400 py-8 flex flex-col items-center justify-center">
                  <ShoppingCart size={32} className="mb-2 opacity-20" />
                  <p className="text-sm">Belum ada pesanan</p>
                  <p className="text-xs mt-1 opacity-60">Klik produk untuk menambahkan</p>
                </div>
              ) : (
                cart.filter(i => !i.prescriptionLabel).map(item => (
                <div key={`${item.id}-manual`} className="relative flex gap-2 p-2 lg:p-3 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-shadow">
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors z-10"
                  >
                    <X size={10} />
                  </button>
                  <div className="flex-1 min-w-0 pr-6">
                    <h4 className="font-semibold text-gray-800 text-xs lg:text-sm truncate">{item.name}</h4>
                    <p className="text-blue-600 text-xs lg:text-sm font-bold mt-0.5">{formatCurrency(item.selling_price)}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}
                      className="w-6 h-6 flex items-center justify-center hover:bg-white rounded-md text-gray-700 shadow-sm transition-all">
                      <Minus size={12} />
                    </button>
                    {editingQty?.id === item.id ? (
                      <input
                        type="number"
                        value={editingQty.value}
                        onChange={(e) => setEditingQty({ id: item.id, value: e.target.value })}
                        onBlur={() => {
                          const val = parseInt(editingQty!.value);
                          if (!isNaN(val) && val > 0) setQuantityDirect(item.id, val);
                          setEditingQty(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          else if (e.key === 'Escape') setEditingQty(null);
                        }}
                        autoFocus
                        className="w-10 text-center text-xs font-semibold border border-blue-300 rounded px-1 outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        onClick={(e) => { e.stopPropagation(); setEditingQty({ id: item.id, value: String(item.quantity) }); }}
                        className="text-xs font-semibold px-2 text-center min-w-[2rem] cursor-pointer hover:bg-white rounded"
                      >
                        {item.quantity}
                      </span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                      className="w-6 h-6 flex items-center justify-center hover:bg-white rounded-md text-gray-700 shadow-sm transition-all">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                ))
              )}
            </div>

            {/* Payment Footer */}
            <div className={`${cart.length === 0 ? 'hidden lg:block' : ''} px-3 lg:px-4 py-2 lg:py-3 bg-gray-50 shrink-0 border-t border-gray-100`}>
              <div className="space-y-1 mb-2 lg:mb-2 text-xs lg:text-sm">
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
                <div className="flex justify-between text-gray-900 font-bold text-sm lg:text-base pt-1 lg:pt-2 border-t border-gray-100">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="mb-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setPaymentMethod('cash')}
                    className={`p-2 lg:p-2 rounded-xl border-2 transition-all text-xs lg:text-sm ${
                      paymentMethod === 'cash' 
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}>
                    <div className="font-semibold leading-tight">Cash</div>
                    <div className="text-[10px] lg:text-xs opacity-75 leading-tight">Tunai</div>
                  </button>
                  <button onClick={() => setPaymentMethod('midtrans')}
                    className={`p-2 lg:p-2 rounded-xl border-2 transition-all text-xs lg:text-sm ${
                      paymentMethod === 'midtrans' 
                        ? 'border-green-600 bg-green-50 text-green-700' 
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}>
                    <div className="font-semibold leading-tight">Midtrans</div>
                    <div className="text-[10px] lg:text-xs opacity-75 leading-tight">Transfer/QRIS</div>
                  </button>
                </div>
              </div>

              {/* Data Pembeli */}
              <button
                onClick={() => setShowBuyerForm(true)}
                className={`w-full mb-1 lg:mb-1 py-1.5 lg:py-1.5 rounded-xl border-2 transition-all text-xs lg:text-sm flex items-center justify-center gap-1 lg:gap-2 ${
                  customerName || customerPhone
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <User size={12} />
                {customerName ? `${customerName} (${customerPhone})` : 'Data Pembeli'}
              </button>

              {/* Resep */}
              <button
                onClick={openNewPrescription}
                className={`w-full mb-1 lg:mb-1 py-1.5 lg:py-1.5 rounded-xl border-2 transition-all text-xs lg:text-sm flex items-center justify-center gap-1 lg:gap-2 ${
                  prescriptions.length > 0
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <Pill size={12} />
                {prescriptions.length > 0 ? `+ Resep Lain` : 'Resep'}
              </button>

              <button 
                onClick={handlePayment}
                disabled={processing || cart.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2 lg:py-2 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-1.5 lg:gap-2 text-xs lg:text-sm"
              >
                {processing ? 'Processing...' : (
                  <><CreditCard size={14} /> Pembayaran</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Buyer Form Offcanvas */}
        {showBuyerForm && (
          <div className="fixed bottom-0 left-16 right-0 z-30 sm:fixed sm:right-6 sm:left-auto sm:top-[5rem] sm:w-96 bg-white flex flex-col overflow-hidden sm:h-[calc(100vh-7rem)] max-h-[80vh] sm:max-h-full shadow-2xl rounded-t-2xl sm:rounded-2xl sm:border sm:border-gray-100">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h2 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2">
                <User size={16} className="text-blue-600" />
                Data Pembeli
              </h2>
              <button onClick={() => setShowBuyerForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">No. Handphone</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  {searchingCustomer && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nama Pembeli</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama pembeli"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="px-4 sm:px-5 py-3 border-t border-gray-200 shrink-0">
              <button
                onClick={() => setShowBuyerForm(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all text-sm"
              >
                Simpan
              </button>
            </div>
          </div>
        )}

        {/* Prescription Form Offcanvas */}
        {showPrescriptionForm && (
          <div className="fixed bottom-0 left-16 right-0 z-30 sm:fixed sm:right-6 sm:left-auto sm:top-[5rem] sm:w-96 bg-white flex flex-col overflow-hidden h-[50vh] sm:h-[calc(100vh-7rem)] sm:max-h-full shadow-2xl rounded-t-2xl sm:rounded-2xl sm:border sm:border-gray-100">
            <div className="px-3 sm:px-5 py-2 sm:py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h2 className="text-xs sm:text-base font-bold text-gray-800 flex items-center gap-1 sm:gap-2">
                <Pill size={14} className="text-purple-600" />
                {editingPrescriptionIdx !== null ? `Edit ${prescriptions[editingPrescriptionIdx].label}` : 'Resep Baru'}
              </h2>
              <button onClick={() => setShowPrescriptionForm(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={16} />
              </button>
            </div>
            <div className="px-2 sm:px-5 pt-2 sm:pt-5 shrink-0">
              <div className="grid grid-cols-2 gap-1 sm:gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Kode Resep</label>
                  <input type="text" value={prescriptionForm.prescription_code} onChange={(e) => setPrescriptionForm(p => ({ ...p, prescription_code: e.target.value }))} placeholder="Kode resep" className="w-full px-2 py-1 sm:px-3 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Dokter</label>
                  <input type="text" value={prescriptionForm.doctor_name} onChange={(e) => setPrescriptionForm(p => ({ ...p, doctor_name: e.target.value }))} placeholder="Dokter" className="w-full px-2 py-1 sm:px-3 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Instansi</label>
                  <input type="text" value={prescriptionForm.instansi} onChange={(e) => setPrescriptionForm(p => ({ ...p, instansi: e.target.value }))} placeholder="Instansi" className="w-full px-2 py-1 sm:px-3 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Tanggal</label>
                  <input type="date" value={prescriptionForm.prescription_date} onChange={(e) => setPrescriptionForm(p => ({ ...p, prescription_date: e.target.value }))} className="w-full px-2 py-1 sm:px-3 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Catatan</label>
                  <textarea value={prescriptionForm.notes} onChange={(e) => setPrescriptionForm(p => ({ ...p, notes: e.target.value }))} placeholder="Catatan" rows={1} className="w-full px-2 py-1 sm:px-3 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none" />
                </div>
              </div>
            </div>

            <div className="grow-0 shrink overflow-y-auto min-h-0 px-2 sm:px-5 pb-1 sm:pb-3">
              <div className="border-t border-gray-200 pt-0.5 sm:pt-3">
                <label className="block text-[9px] sm:text-xs font-semibold text-gray-700 mb-0.5 sm:mb-2">Daftar Obat Resep</label>
                <div className="relative mb-0.5 sm:mb-2">
                  <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" size={8} />
                  <input type="text" value={prescriptionSearch} onChange={(e) => setPrescriptionSearch(e.target.value)} placeholder="Cari..." className="w-full pl-5 sm:pl-8 pr-1.5 sm:pr-3 py-0.5 sm:py-2 border border-gray-300 rounded sm:rounded-xl text-[10px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" />
                </div>
                {prescriptionSearch && (
                  <div className="max-h-16 sm:max-h-32 overflow-y-auto border border-gray-200 rounded sm:rounded-xl mb-0.5 sm:mb-2">
                    {filteredPrescriptionProducts.slice(0, 10).map(product => (
                      <button key={product.id} onClick={() => addPrescriptionItem(product)}
                        className="w-full text-left px-1.5 sm:px-3 py-0.5 sm:py-2 text-[10px] sm:text-xs hover:bg-purple-50 border-b border-gray-100 last:border-b-0 flex justify-between items-center">
                        <span className="truncate">{product.name}</span>
                        <span className="text-purple-600 font-medium shrink-0 ml-1 sm:ml-2">+</span>
                      </button>
                    ))}
                  </div>
                )}
                {prescriptionItems.length > 0 && (
                  <div>
                    <div className="space-y-0.5">
                      {prescriptionItems.map(item => (
                        <div key={item.product.id} className="flex items-center gap-0.5 p-1 sm:p-2 bg-purple-50 rounded sm:rounded-xl border border-purple-100">
                          <button onClick={() => removePrescriptionItem(item.product.id)} className="w-3.5 h-3.5 sm:w-5 sm:h-5 flex items-center justify-center text-red-500 hover:text-red-700 shrink-0">
                            <X size={7} />
                          </button>
                          <span className="flex-1 text-[9px] sm:text-xs truncate">{item.product.name}</span>
                          <div className="flex items-center gap-0 bg-white rounded p-0">
                            <button onClick={() => updatePrescriptionItemQty(item.product.id, -1)} className="w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded text-[7px] sm:text-[9px]">-</button>
                            <span className="text-[8px] sm:text-[10px] font-semibold px-0 min-w-[0.8rem] sm:min-w-[1rem] text-center">{item.quantity}</span>
                            <button onClick={() => updatePrescriptionItemQty(item.product.id, 1)} className="w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded text-[7px] sm:text-[9px]">+</button>
                          </div>
                          <span className="text-[8px] sm:text-[10px] font-medium text-gray-600 min-w-[2rem] sm:min-w-[2.5rem] text-right">{formatCurrency(item.product.selling_price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] sm:text-[10px] font-semibold text-gray-700 pt-0 border-t border-purple-200 mt-0.5">
                      <span>Subtotal</span>
                      <span>{formatCurrency(prescriptionItems.reduce((sum, i) => sum + i.product.selling_price * i.quantity, 0))}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-3 sm:px-5 py-2 sm:py-3 border-t border-gray-200 shrink-0">
              <button onClick={savePrescription} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm">
                Simpan Resep
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

