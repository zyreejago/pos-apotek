'use client';

import { API_URL } from '@/lib/api-config';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Save, AlertCircle, Eye, X } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import ConfirmModal from '@/components/ConfirmModal';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import PageHeader from '@/components/PageHeader';
import OffCanvas from '@/components/OffCanvas';

interface Product {
  id: number;
  name: string;
  stock: number;
  unit: string;
  category: string;
  last_opname_at?: string | null;
  last_opname_by?: string | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OpnameEntry {
  actual: number;
  system: number;
}

interface OpnameSession {
  id: number;
  date: string;
  user_id: number;
  total_items: number;
  created_at: string;
  username: string;
}

interface SessionDetail {
  id: number;
  product_id: number;
  product_name: string;
  unit: string;
  type: string;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
}

interface ProductHistoryRecord {
  id: number;
  product_id: number;
  previous_stock: number;
  new_stock: number;
  quantity_change: number;
  date: string;
  username: string;
}

export default function StockOpnamePage() {
  // Permission Check
  const { checkActionPermission } = useRequirePermission('Stock Opname');

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });

  // Opname State
  const [isOpnameActive, setIsOpnameActive] = useState(false);
  const [opnameData, setOpnameData] = useState<Record<number, OpnameEntry>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product History Modal State
  const [productHistoryOpen, setProductHistoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: number; name: string; unit: string } | null>(null);
  const [productHistoryRecords, setProductHistoryRecords] = useState<ProductHistoryRecord[]>([]);
  const [productHistoryLoading, setProductHistoryLoading] = useState(false);

  // History Modal State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<OpnameSession | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger' as 'danger' | 'warning' | 'info'
  });

  const router = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = React.useMemo((): HeadersInit => (token ? { 'Authorization': `Bearer ${token}` } : {}), [token]);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/stock-opname/sessions`, {
        headers: authHeaders
      });
      const data = await res.json();
      setSessions(data.data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  }, [authHeaders]);

  const fetchSessionDetail = useCallback(async (sessionId: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/stock-opname/sessions/${sessionId}`, {
        headers: authHeaders
      });
      const data = await res.json();
      setSessionDetail(data.items || []);
      setSelectedSession(data.session || null);
    } catch (error) {
      console.error('Error fetching session detail:', error);
    } finally {
      setDetailLoading(false);
    }
  }, [authHeaders]);

  const openHistoryModal = () => {
    setHistoryOpen(true);
    fetchSessions();
  };

  const openSessionDetail = (session: OpnameSession) => {
    fetchSessionDetail(session.id);
  };

  const closeHistoryModal = () => {
    setHistoryOpen(false);
    setSelectedSession(null);
    setSessionDetail([]);
  };

  const fetchProductOpnameHistory = useCallback(async (productId: number) => {
    setProductHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/products/${productId}/opname-history`, {
        headers: authHeaders
      });
      const data = await res.json();
      setProductHistoryRecords(data.records || []);
      setSelectedProduct(data.product || null);
      setProductHistoryOpen(true);
    } catch (error) {
      console.error('Error fetching product opname history:', error);
      goeyToast.error('Gagal Memuat Riwayat', {
        description: "Terjadi kesalahan saat memuat riwayat opname produk."
      });
    } finally {
      setProductHistoryLoading(false);
    }
  }, [authHeaders]);

  const closeProductHistory = () => {
    setProductHistoryOpen(false);
    setSelectedProduct(null);
    setProductHistoryRecords([]);
  };

  const fetchProducts = useCallback(async (page: number, limit: number, search: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/products?page=${page}&limit=${limit}&search=${search}`, {
        headers: authHeaders
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push('/login');
        return;
      }

      const data = await res.json();
      setProducts(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (error) {
      console.error('Error fetching products:', error);
      goeyToast.error('Gagal Mengambil Data Produk', {
        description: "Terjadi kesalahan saat mengambil daftar produk. Silakan coba lagi."
      });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, router]);

  useEffect(() => {
    fetchProducts(currentPage, itemsPerPage, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchProducts(currentPage, itemsPerPage, searchQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleStartOpname = () => {
    // Permission Check
    if (!checkActionPermission('create') && !checkActionPermission('edit')) {
        goeyToast.error('Akses Ditolak', {
          description: "Anda tidak memiliki izin untuk memulai proses stock opname."
        });
        return;
    }
    setIsOpnameActive(true);
    setOpnameData({});
    goeyToast.info('Mode Stock Opname Aktif', {
      description: "Silakan masukkan jumlah stok aktual pada kolom yang tersedia."
    });
  };

  const handleCancelOpname = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Batalkan Stock Opname',
      message: 'Apakah Anda yakin ingin membatalkan stock opname? Semua perubahan yang belum disimpan akan hilang.',
      variant: 'warning',
      onConfirm: () => {
        setIsOpnameActive(false);
        setOpnameData({});
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const getDifferenceColor = (diff: number) => {
    if (diff > 0) return 'bg-green-100 text-green-700';
    if (diff < 0) return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const handleSubmitOpname = async () => {
    // Permission Check
    if (!checkActionPermission('create') && !checkActionPermission('edit')) {
        goeyToast.error('Anda tidak memiliki izin untuk mengirimkan stock opname', {
          description: "Hubungi administrator untuk meminta akses."
        });
        return;
    }

    // Collect all items that have changes
    
    // Iterate over all loaded products (Wait, this only updates current page products if we only have access to `products` state)
    // But `opnameData` has keys for modified items.
    // We need to know system stock for those items.
    // Issue: If user modifies item on page 1, goes to page 2, we need system stock for page 1 item.
    // Solution: Store system stock in opnameData too? Or just fetch product details?
    // Simplified: Only allow submitting current view? No, that's bad UX.
    // Better: When starting opname, maybe we should fetch ALL products?
    // Or: Store `{ actual: number, system: number }` in `opnameData`.
    
    // Let's use `products` from current page for now. 
    // If we want cross-page, we need to track system stock when we render or change it.
    
    // For this version: We'll iterate through `opnameData` keys.
    // But we need the system stock.
    // Let's assume for now user operates on visible items or we only support visible items update.
    // To support multi-page, we'd need to cache system stock.
    // Let's modify `handleStockChange` to store system stock too.
    
    // Actually, let's keep it simple: Iterate `products` (visible) and check `opnameData`.
    // Warning user: "Only changes on the current page will be saved" if we do that.
    // Better: `handleStockChange` takes `systemStock` as arg and stores it.
    
    // Refined `opnameData`: Record<number, { actual: number, system: number }>
    
    const payload = Object.entries(opnameData).map(([id, data]) => ({
        id: parseInt(id),
        system_stock: data.system,
        actual_stock: data.actual
    }));

    if (payload.length === 0) {
      goeyToast.info('Tidak Ada Perubahan', {
        description: "Belum ada data stok opname yang dimasukkan. Silakan isi data terlebih dahulu."
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Kirim Stock Opname',
      message: `Anda akan memperbarui stok untuk ${payload.length} produk. Lanjutkan?`,
      variant: 'info',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        try {
          const res = await fetch(`${API_URL}/api/stock-opname`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ items: payload })
          });
    
          if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            router.push('/login');
            return;
          }

          if (res.ok) {
            const itemNames = payload.slice(0, 3).map(p => products.find(prod => prod.id === p.id)?.name).filter(Boolean).join(', ');
            const remainingCount = payload.length - 3;
            const detailText = remainingCount > 0 ? `${itemNames} dan ${remainingCount} lainnya` : itemNames;

            goeyToast.success(`Stock Opname Selesai`, {
                description: `Stok fisik untuk ${payload.length} produk (${detailText}) telah berhasil diperbarui di sistem.`
            });
            setIsOpnameActive(false);
            setOpnameData({});
            fetchProducts(currentPage, itemsPerPage, searchQuery); // Refresh data
          } else {
            goeyToast.error('Gagal Mengirim Data', {
              description: "Terjadi kesalahan saat menyimpan hasil stock opname."
            });
          }
        } catch (error) {
          console.error('Error submitting opname:', error);
          goeyToast.error('Terjadi kesalahan sistem', {
            description: "Silakan coba lagi beberapa saat lagi."
          });
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  // Refined handler
  const handleStockChangeWithSystem = (productId: number, value: string, systemStock: number) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setOpnameData(prev => ({
        ...prev,
        [productId]: { actual: numValue, system: systemStock }
      }));
    } else if (value === '') {
       const newData = { ...opnameData };
       delete newData[productId];
       setOpnameData(newData);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <PageHeader 
        title="Stock Opname"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Opname' }]}
        rightContent={
          <div className="flex items-center gap-2">
            {!isOpnameActive ? (
              <>
                <button
                  onClick={openHistoryModal}
                  className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 px-1.5 sm:px-3 py-0.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2"
                >
                  <Eye className="w-3 sm:w-4 h-3 sm:h-4" />
                  Riwayat
                </button>
                {(checkActionPermission('create') || checkActionPermission('edit')) && (
                <button 
                  onClick={handleStartOpname}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-1.5 sm:px-4 py-0.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-colors shadow-sm"
                >
                  Mulai Stock Opname
                </button>
                )}
              </>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={handleCancelOpname}
                  className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-1.5 sm:px-4 py-0.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitOpname}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-1.5 sm:px-4 py-0.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-colors shadow-sm flex items-center gap-1 sm:gap-2"
                  disabled={isSubmitting}
                >
                  <Save className="w-3 sm:w-4 h-3 sm:h-4" />
                  {isSubmitting ? 'Saving...' : 'Submit Opname'}
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* Main Content */}
      <div className="p-3 sm:p-4 md:p-8 pt-0">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* General Info */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="text-sm text-gray-500">
            {products.length > 0 && products[0].last_opname_at ? (
              <span className="text-gray-600">
                <span className="font-medium">Opname Terakhir:</span>{' '}
                {new Date(products[0].last_opname_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                {products[0].last_opname_by && (
                  <span> oleh <span className="font-medium">{products[0].last_opname_by}</span></span>
                )}
              </span>
            ) : (
              <span className="text-gray-400">Belum pernah melakukan stock opname</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOpnameActive && (
              <span className="text-blue-600 font-medium flex items-center gap-1 text-xs">
                <AlertCircle size={14}/> 
                Recording mode active
              </span>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="w-full md:w-auto text-sm text-gray-500">
               {isOpnameActive && (
                 <span className="text-blue-600 font-medium flex items-center gap-1">
                   <AlertCircle size={14}/> 
                   Hanya produk dengan nilai yang dimasukkan akan diperbarui
                 </span>
               )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                    type="text" 
                    placeholder="Search Products" 
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50 text-gray-500 font-medium text-sm">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-4 text-left">Name</th>
                <th className="px-3 sm:px-6 py-2 sm:py-4 text-left">Stock Sistem</th>
                <th className="px-3 sm:px-6 py-2 sm:py-4 text-left">Stock Faktual</th>
                <th className="px-3 sm:px-6 py-2 sm:py-4 text-left">Selisih</th>
                <th className="px-3 sm:px-6 py-2 sm:py-4 text-right">Unit</th>
                <th className="px-3 sm:px-6 py-2 sm:py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 sm:px-6 py-4 sm:py-8 text-center text-gray-500">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 sm:px-6 py-4 sm:py-8 text-center text-gray-500">
                    No products found
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  // Get current actual value from state or undefined
                  const currentData = opnameData[product.id];
                  const actualValue = currentData?.actual;
                  const difference = actualValue !== undefined ? actualValue - product.stock : 0;
                  const hasEntry = actualValue !== undefined;

                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 sm:px-6 py-2 sm:py-4">
                        <div className="font-medium text-gray-900">{product.name}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-600 font-medium">{product.stock}</td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4">
                        {isOpnameActive ? (
                            <input 
                            type="number" 
                            className={`w-24 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasEntry ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                            placeholder={product.stock.toString()}
                            value={actualValue !== undefined ? actualValue : ''}
                            onChange={(e) => handleStockChangeWithSystem(product.id, e.target.value, product.stock)}
                            min="0"
                            />
                        ) : (
                            <span className="text-gray-400">-</span>
                        )}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4">
                        {hasEntry ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifferenceColor(difference)}`}>
                            {difference > 0 ? '+' : ''}{difference}
                            </span>
                        ) : (
                            <span className="text-gray-400">-</span>
                        )}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-right text-gray-500 text-sm">
                            {product.unit}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-center">
                            <button
                              onClick={() => fetchProductOpnameHistory(product.id)}
                              className="p-1 sm:p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Lihat Riwayat Opname"
                            >
                              <Eye size={16} />
                            </button>
                        </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
                <span>Show</span>
                <select 
                className="border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                </select>
                <span>per page</span>
            </div>

            <div className="flex items-center gap-2">
                <span>
                    {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
                <div className="flex gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
                    <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    &larr;
                    </button>
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
                        <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 flex items-center justify-center rounded border ${
                            currentPage === page 
                            ? 'bg-gray-100 border-gray-300 font-medium text-gray-900' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        >
                        {page}
                        </button>
                    ))}
                    <button 
                    onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                    disabled={currentPage === pagination.totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    &rarr;
                    </button>
                </div>
            </div>
        </div>
      </div>
      </div>
      {/* History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedSession ? 'Detail Stock Opname' : 'Riwayat Stock Opname'}
              </h2>
              <button onClick={closeHistoryModal} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {selectedSession ? (
                <>
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
                    <span><span className="font-medium">Tanggal:</span> {new Date(selectedSession.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span><span className="font-medium">Oleh:</span> {selectedSession.username || '-'}</span>
                    <span><span className="font-medium">Jumlah Produk:</span> {selectedSession.total_items}</span>
                  </div>
                  {detailLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading detail...</div>
                  ) : (
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500">
                          <th className="text-left py-1 sm:py-2 px-1 sm:px-2">Produk</th>
                          <th className="text-right py-1 sm:py-2 px-1 sm:px-2">Stok Sistem</th>
                          <th className="text-right py-1 sm:py-2 px-1 sm:px-2">Stok Aktual</th>
                          <th className="text-right py-1 sm:py-2 px-1 sm:px-2">Selisih</th>
                          <th className="text-right py-1 sm:py-2 px-1 sm:px-2">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionDetail.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100">
                            <td className="py-1 sm:py-2 px-1 sm:px-2 font-medium text-gray-900">{item.product_name}</td>
                            <td className="py-1 sm:py-2 px-1 sm:px-2 text-right text-gray-600">{item.previous_stock}</td>
                            <td className="py-1 sm:py-2 px-1 sm:px-2 text-right text-gray-600">{item.new_stock}</td>
                            <td className={`py-1 sm:py-2 px-1 sm:px-2 text-right font-medium ${item.quantity_change > 0 ? 'text-green-600' : item.quantity_change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                              {item.quantity_change > 0 ? '+' : ''}{item.quantity_change}
                            </td>
                            <td className="py-1 sm:py-2 px-1 sm:px-2 text-right text-gray-500">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <button
                    onClick={() => { setSelectedSession(null); setSessionDetail([]); }}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    &larr; Kembali ke daftar
                  </button>
                </>
              ) : (
                <>
                  {sessionsLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">Belum ada riwayat stock opname</div>
                  ) : (
                    <div className="space-y-2">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => openSessionDetail(session)}
                          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-600">
                              <Eye size={18} />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {new Date(session.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </div>
                              <div className="text-sm text-gray-500">
                                {session.total_items} produk diperbarui oleh {session.username || '-'}
                              </div>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product History Offcanvas */}
      <OffCanvas
        isOpen={productHistoryOpen}
        onClose={closeProductHistory}
        title={`Riwayat Opname - ${selectedProduct?.name || ''}`}
        width="450px"
      >
        {productHistoryLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : productHistoryRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Belum ada riwayat opname untuk produk ini</div>
        ) : (
          <div className="space-y-3">
            {productHistoryRecords.map((record) => (
              <div key={record.id} className="p-3 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {record.date ? new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </span>
                  <span className="text-xs text-gray-500">
                    oleh {record.username || '-'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">
                    Stok Sistem: <span className="font-medium text-gray-700">{record.previous_stock}</span>
                  </span>
                  <span className="text-gray-500">
                    Stok Aktual: <span className="font-medium text-gray-700">{record.new_stock}</span>
                  </span>
                  <span className={`font-medium ${record.quantity_change > 0 ? 'text-green-600' : record.quantity_change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {record.quantity_change > 0 ? '+' : ''}{record.quantity_change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </OffCanvas>

      {/* Confirm Modal */}
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
