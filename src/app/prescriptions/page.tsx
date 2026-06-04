'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Edit, Trash2, Image as ImageIcon, ShoppingCart, Minus, X, CreditCard, UploadCloud, Camera, FileText } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import ConfirmModal from '@/components/ConfirmModal';
import OffCanvas from '@/components/OffCanvas';
import PageHeader from '@/components/PageHeader';
import { useRequirePermission } from '@/hooks/useRequirePermission';

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

interface Prescription {
  id: number;
  prescription_code: string | null;
  image_url: string | null;
  prescription_date: string | null;
  entered_by: number | null;
  transaction_id: number | null;
  notes: string | null;
  created_at: string;
  entered_by_name: string | null;
}

interface PrescriptionFormData {
  prescription_code: string;
  image: File | null;
  image_url: string;
  prescription_date: string;
  notes: string;
}

export default function PrescriptionsPage() {
  const router = useRouter();
  const { checkActionPermission } = useRequirePermission('Resep Dokter');

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // OffCanvas States
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [offCanvasMode, setOffCanvasMode] = useState<'add' | 'edit'>('add');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  useEffect(() => {
    console.log('isOffCanvasOpen changed to:', isOffCanvasOpen);
    console.trace('Stack trace for isOffCanvasOpen change:');
  }, [isOffCanvasOpen]);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger' as 'danger' | 'warning' | 'info'
  });

  // Form State
  const [formData, setFormData] = useState<PrescriptionFormData>({
    prescription_code: '',
    image: null,
    image_url: '',
    prescription_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Product & Cart State
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [settings, setSettings] = useState({ ppn_rate: 0, discount_rate: 0 });
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'midtrans'>('cash');
  const [processing, setProcessing] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const currentUser = useMemo(() => userStr ? JSON.parse(userStr) : null, [userStr]);
  const authHeaders = useMemo<Record<string, string>>(() => {
    if (!token) return {} as Record<string, string>;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  const ppn = settings.ppn_rate > 0 ? (subtotal * settings.ppn_rate / 100) : 0;
  const discount = settings.discount_rate > 0 ? (subtotal * settings.discount_rate / 100) : 0;
  const total = subtotal + ppn - discount;

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/prescriptions`, {
        headers: authHeaders
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00";
        router.push('/login');
        return;
      }

      const data = await res.json();
      setPrescriptions(data.data || []);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, router]);

  const fetchProductsAndSettings = useCallback(async () => {
    try {
      const [prodRes, settingsRes] = await Promise.all([
        fetch('http://localhost:5000/api/products?limit=100', { headers: authHeaders }),
        fetch(`http://localhost:5000/api/settings?t=${Date.now()}`, { headers: authHeaders })
      ]);

      if (prodRes.status === 401 || settingsRes.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }
      
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.data || []);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings({
          ppn_rate: Number(settingsData.ppn_rate) || 0,
          discount_rate: Number(settingsData.discount_rate) || 0
        });
      }
    } catch (error) {
      console.error('Error fetching products/settings:', error);
    }
  }, [authHeaders, router]);

  useEffect(() => {
    fetchPrescriptions();
    fetchProductsAndSettings();
  }, [fetchPrescriptions, fetchProductsAndSettings]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'file') {
      const fileInput = e.target as HTMLInputElement;
      const file = fileInput.files?.[0] || null;
      if (file) {
        setFormData(prev => ({ ...prev, image: file }));
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleOpenAddOffCanvas = () => {
    setOffCanvasMode('add');
    setFormData({
      prescription_code: '',
      image: null,
      image_url: '',
      prescription_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setCart([]);
    setImagePreview(null);
    setIsOffCanvasOpen(true);
  };

  const handleOpenEditOffCanvas = (prescription: Prescription) => {
    setOffCanvasMode('edit');
    setSelectedPrescription(prescription);
    setFormData({
      prescription_code: prescription.prescription_code || '',
      image: null,
      image_url: prescription.image_url || '',
      prescription_date: prescription.prescription_date || new Date().toISOString().split('T')[0],
      notes: prescription.notes || ''
    });
    setCart([]);
    setImagePreview(prescription.image_url ? `http://localhost:5000${prescription.image_url}` : null);
    setIsOffCanvasOpen(true);
  };

  const handleOpenDeleteModal = (prescription: Prescription) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Resep',
      message: `Apakah Anda yakin ingin menghapus resep ${prescription.prescription_code || 'ini'}? Tindakan ini tidak dapat dibatalkan.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await handleDelete(prescription);
      }
    });
  };

  const printReceiptFunction = (receiptData: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Nota Pembelian - Resep</title>
        <style>
          body { font-family: monospace; max-width: 300px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .info { font-size: 12px; margin: 2px 0; }
          .items { margin: 10px 0; border-bottom: 1px dashed #000; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .summary { margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px; }
          .summary-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .total { font-weight: bold; font-size: 14px; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px; }
          .footer { margin-top: 20px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">APOTEK SUMBER WARAS</div>
          <div class="info">Jl. Kesehatan No. 123, Karangasem</div>
          <div class="info">Telp: (021) 12345678</div>
        </div>
        
        <div class="info">ID Transaksi: ${receiptData.id}</div>
        <div class="info">Resep: ${formData.prescription_code || '-'}</div>
        <div class="info">Tanggal: ${new Date().toLocaleString('id-ID')}</div>
        <div class="info">Kasir: ${currentUser?.username || 'Admin'}</div>
        
        <div class="items">
          ${receiptData.items.map((item: CartItem) => `
            <div class="item">
              <span>${item.name} x${item.quantity} ${item.unit}</span>
              <span>${formatCurrency(item.selling_price * item.quantity)}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="summary">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>${formatCurrency(receiptData.subtotal)}</span>
          </div>
          ${receiptData.ppn > 0 ? `
            <div class="summary-row">
              <span>PPN</span>
              <span>${formatCurrency(receiptData.ppn)}</span>
            </div>
          ` : ''}
          ${receiptData.discount > 0 ? `
            <div class="summary-row">
              <span>Diskon</span>
              <span>-${formatCurrency(receiptData.discount)}</span>
            </div>
          ` : ''}
          <div class="summary-row total">
            <span>Total</span>
            <span>${formatCurrency(receiptData.total)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Terima kasih atas kunjungan Anda!</p>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (offCanvasMode === 'add' && !checkActionPermission('create')) {
        goeyToast.error('Akses Ditolak', { description: "Anda tidak memiliki izin untuk menambahkan resep baru." });
        return;
    }
    if (offCanvasMode === 'edit' && !checkActionPermission('edit')) {
        goeyToast.error('Akses Ditolak', { description: "Anda tidak memiliki izin untuk mengubah data resep ini." });
        return;
    }

    if (offCanvasMode === 'add') {
      await handlePaymentAndCreatePrescription();
    } else {
      try {
        const formDataToSend = new FormData();
        formDataToSend.append('prescription_code', formData.prescription_code);
        formDataToSend.append('prescription_date', formData.prescription_date);
        formDataToSend.append('notes', formData.notes);
        formDataToSend.append('entered_by', currentUser?.id || '');
        if (formData.image) {
          formDataToSend.append('image', formData.image);
        }

        const res = await fetch(`http://localhost:5000/api/inventory/prescriptions/${selectedPrescription?.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: formDataToSend
        });

        if (res.ok) {
          setIsOffCanvasOpen(false);
          fetchPrescriptions();
          goeyToast.success('Resep berhasil diperbarui', { description: 'Data resep telah berhasil diperbarui.' });
        } else {
          goeyToast.error('Gagal Memperbarui Resep', { description: 'Terjadi kesalahan saat menyimpan data.' });
        }
      } catch (error) {
        console.error('Error saving prescription:', error);
        goeyToast.error('Terjadi kesalahan sistem', { description: 'Gagal terhubung ke server.' });
      }
    }
  };

  const handlePaymentAndCreatePrescription = async () => {
    if (cart.length === 0) {
      goeyToast.error('Keranjang Kosong', { description: 'Silakan pilih obat terlebih dahulu sebelum menyimpan dan memproses transaksi.' });
      return;
    }

    setProcessing(true);
    try {
      // First create the transaction
      const transactionPayload = {
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

      const transactionRes = await fetch('http://localhost:5000/api/transactions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        },
        body: JSON.stringify(transactionPayload)
      });

      if (transactionRes.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      const transactionData = await transactionRes.json();
      if (!transactionRes.ok) {
        goeyToast.error('Transaksi gagal', { description: transactionData.message || 'Terjadi kesalahan saat memproses transaksi.' });
        return;
      }

      // Now create the prescription linked to the transaction
      const prescriptionFormData = new FormData();
      prescriptionFormData.append('prescription_code', formData.prescription_code);
      prescriptionFormData.append('prescription_date', formData.prescription_date);
      prescriptionFormData.append('notes', formData.notes);
      prescriptionFormData.append('entered_by', currentUser?.id || '');
      prescriptionFormData.append('transaction_id', transactionData.id.toString());
      if (formData.image) {
        prescriptionFormData.append('image', formData.image);
      }

      const prescriptionRes = await fetch('http://localhost:5000/api/inventory/prescriptions', {
        method: 'POST',
        headers: authHeaders,
        body: prescriptionFormData
      });

      if (prescriptionRes.ok) {
        // Handle Midtrans if needed
        if (paymentMethod === 'midtrans' && transactionData.redirect_url) {
          const snapToken = transactionData.redirect_url.split('/').pop();
          ((window as unknown) as Window & { snap: { pay: (token: string, options: Record<string, unknown>) => void } }).snap.pay(snapToken || '', {
            onSuccess: async () => {
              goeyToast.success('Transaksi Berhasil', { description: `Pembayaran senilai ${formatCurrency(total)} berhasil diproses.` });
              printReceiptFunction({ id: transactionData.id, items: cart, subtotal, ppn, discount, total });
              setIsOffCanvasOpen(false);
              setCart([]);
              fetchPrescriptions();
              fetchProductsAndSettings();
            },
            onPending: () => {
              goeyToast.info('Menunggu Pembayaran', { description: 'Silakan selesaikan pembayaran Anda.' });
              setIsOffCanvasOpen(false);
              setCart([]);
              fetchPrescriptions();
            },
            onError: () => {
              goeyToast.error('Pembayaran Gagal', { description: 'Terjadi kesalahan saat memproses pembayaran.' });
            },
            onClose: () => {
              goeyToast.info('Pembayaran Ditutup', { description: 'Anda menutup halaman pembayaran.' });
              setIsOffCanvasOpen(false);
              setCart([]);
              fetchPrescriptions();
            }
          });
        } else {
          goeyToast.success('Resep & Transaksi Berhasil', { description: `Pembayaran senilai ${formatCurrency(total)} berhasil diproses.` });
          printReceiptFunction({ id: transactionData.id, items: cart, subtotal, ppn, discount, total });
          setIsOffCanvasOpen(false);
          setCart([]);
          fetchPrescriptions();
          fetchProductsAndSettings();
        }
      } else {
        goeyToast.error('Gagal Membuat Resep', { description: 'Transaksi berhasil dibuat, tetapi gagal menyimpan data resep.' });
        setIsOffCanvasOpen(false);
        setCart([]);
        fetchPrescriptions();
      }
    } catch (error) {
      console.error('Payment error:', error);
      goeyToast.error('Gagal memproses pembayaran', { description: 'Periksa koneksi internet Anda dan coba lagi.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (prescription: Prescription) => {
    if (!checkActionPermission('delete')) {
        goeyToast.error('Akses Ditolak', { description: "Anda tidak memiliki izin untuk menghapus resep." });
        return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/inventory/prescriptions/${prescription.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });

      if (res.ok) {
        fetchPrescriptions();
        goeyToast.success('Resep Berhasil Dihapus', { description: 'Resep telah dihapus permanen dari sistem.' });
      } else {
        goeyToast.error('Gagal Menghapus Resep', { description: 'Terjadi kesalahan saat mencoba menghapus data resep.' });
      }
    } catch (error) {
      console.error('Error deleting prescription:', error);
      goeyToast.error('Terjadi kesalahan sistem', { description: 'Gagal terhubung ke server.' });
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <PageHeader 
        title="Resep Dokter"
        subtitle="Data Resep Dokter"
        rightContent={
          checkActionPermission('create') && (
            <button 
              onClick={handleOpenAddOffCanvas}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Tambah Resep
            </button>
          )
        }
      />

      <div className="p-8 pt-0">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600 font-medium">
              Menampilkan {prescriptions.length} Resep
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Cari Resep..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-4">Kode Resep</th>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Diupload Oleh</th>
                  <th className="px-6 py-4">Gambar</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Memuat resep...
                    </td>
                  </tr>
                ) : prescriptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Belum ada resep yang ditambahkan
                    </td>
                  </tr>
                ) : (
                  prescriptions.map((prescription) => (
                    <tr key={prescription.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {prescription.prescription_code || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(prescription.prescription_date)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {prescription.entered_by_name || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {prescription.image_url ? (
                          <a 
                            href={`http://localhost:5000${prescription.image_url}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <ImageIcon size={16} />
                            Lihat Gambar
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {checkActionPermission('edit') && (
                            <button 
                              onClick={() => handleOpenEditOffCanvas(prescription)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          {checkActionPermission('delete') && (
                            <button 
                              onClick={() => handleOpenDeleteModal(prescription)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => setIsOffCanvasOpen(false)}
        title={offCanvasMode === 'add' ? 'Tambah Resep Baru' : 'Edit Resep'}
        width={offCanvasMode === 'add' ? '600px' : '500px'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kode Resep</label>
              <input 
                type="text" 
                name="prescription_code"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Masukkan kode resep"
                value={formData.prescription_code}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Resep</label>
              <input 
                type="date" 
                name="prescription_date"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.prescription_date}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload Gambar Resep</label>
            <div className="flex flex-col gap-4 items-start">
              {/* Image Input UI */}
              <div className="w-full flex flex-col gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-600"
                  >
                    <UploadCloud size={20} className="text-gray-400" />
                    Pilih File
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-600"
                  >
                    <Camera size={20} className="text-gray-400" />
                    Ambil Foto
                  </button>
                </div>
                
                {/* Hidden File Inputs */}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  name="image"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInputChange}
                />
                <input 
                  type="file" 
                  ref={cameraInputRef}
                  name="image"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleInputChange}
                />
              </div>

              {/* Preview */}
              {imagePreview && (
                <div className="relative w-full max-w-sm h-48 shrink-0 rounded-xl overflow-hidden border-2 border-gray-200 group">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setFormData(prev => ({ ...prev, image: null }));
                      }}
                      className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <textarea 
              name="notes"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Catatan tambahan..."
              rows={2}
              value={formData.notes}
              onChange={handleInputChange}
            />
          </div>

          {offCanvasMode === 'add' && (
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Detail Obat Resep</h3>
                <div className="text-sm font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                  Total Item: {cart.length}
                </div>
              </div>
              
              <div className="flex flex-col gap-6">
                {/* Search & Select Medicine Section */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cari & Tambahkan Obat ke Resep</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Ketik nama obat untuk mencari..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                    />
                    
                    <div className="w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-sm max-h-60 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          Obat tidak ditemukan.
                        </div>
                      ) : (
                        filteredProducts.slice(0, 50).map(product => (
                          <div 
                            key={product.id} 
                            onClick={() => {
                              addToCart(product);
                              setProductSearchQuery(''); // Auto-clear search after adding
                            }}
                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center group transition-colors"
                          >
                            <div>
                              <h4 className="font-medium text-gray-800 text-sm">{product.name}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">Sisa Stok: {product.stock} {product.unit}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-blue-600 font-medium text-sm">{formatCurrency(product.selling_price)}</span>
                              <div className="text-blue-600 bg-blue-100 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus size={14} />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Prescription List Table (Medical Style) */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h4 className="font-medium text-slate-700 text-sm flex items-center gap-2">
                      <FileText size={16} className="text-slate-500" />
                      Daftar Obat yang Diberikan
                    </h4>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 w-10 text-center">#</th>
                          <th className="px-4 py-3">Nama Obat</th>
                          <th className="px-4 py-3 w-32 text-center">Dosis/Jumlah</th>
                          <th className="px-4 py-3 text-right">Harga Satuan</th>
                          <th className="px-4 py-3 text-right">Subtotal</th>
                          <th className="px-4 py-3 w-16 text-center">Hapus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cart.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                              <div className="flex flex-col items-center justify-center">
                                <FileText size={32} className="mb-2 opacity-20" />
                                <p>Belum ada obat yang dimasukkan ke resep</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          cart.map((item, index) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 text-center text-slate-400">{index + 1}</td>
                              <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-md p-1 shadow-sm w-fit mx-auto">
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}
                                    className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className="text-sm font-semibold w-8 text-center text-slate-700">{item.quantity}</span>
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                                    className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.selling_price)}</td>
                              <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(item.selling_price * item.quantity)}</td>
                              <td className="px-4 py-3 text-center">
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                                  className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-colors"
                                  title="Hapus dari resep"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Billing Summary & Payment Method */}
                {cart.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-inner">
                    <div className="flex flex-col gap-6">
                      
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider border-b border-slate-100 pb-3">Ringkasan Biaya</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center text-slate-600">
                            <span>Subtotal Obat</span>
                            <span className="font-medium text-slate-800">{formatCurrency(subtotal)}</span>
                          </div>
                          {settings.ppn_rate > 0 && (
                            <div className="flex justify-between items-center text-slate-600">
                              <span>PPN ({settings.ppn_rate}%)</span>
                              <span className="font-medium text-slate-800">{formatCurrency(ppn)}</span>
                            </div>
                          )}
                          {settings.discount_rate > 0 && (
                            <div className="flex justify-between items-center text-red-500">
                              <span>Diskon ({settings.discount_rate}%)</span>
                              <span className="font-medium">-{formatCurrency(discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-slate-900 font-bold pt-4 border-t border-slate-200 mt-4 text-base">
                            <span>Total Tagihan</span>
                            <span className="text-blue-600 text-lg">{formatCurrency(total)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Metode Pembayaran</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPaymentMethod('cash');
                            }}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                              paymentMethod === 'cash' 
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-semibold mb-1 text-center">Tunai</span>
                            <span className="text-xs opacity-80 text-center">Bayar di Kasir</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPaymentMethod('midtrans');
                            }}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                              paymentMethod === 'midtrans' 
                                ? 'border-green-500 bg-green-50 text-green-700 shadow-sm' 
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-semibold mb-1 text-center">Midtrans</span>
                            <span className="text-xs opacity-80 text-center">QRIS / Transfer</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button 
              type="button"
              onClick={() => setIsOffCanvasOpen(false)}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button 
              type="submit"
              disabled={processing}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? 'Memproses...' : (
                <>
                  {offCanvasMode === 'add' ? (
                    <>
                      <CreditCard size={18} />
                      Proses Transaksi & Resep
                    </>
                  ) : 'Simpan Perubahan'}
                </>
              )}
            </button>
          </div>
        </form>
      </OffCanvas>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />
    </div>
  );
}