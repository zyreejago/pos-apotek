'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Save, AlertCircle } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import ConfirmModal from '@/components/ConfirmModal';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import PageHeader from '@/components/PageHeader';

interface Product {
  id: number;
  name: string;
  stock: number;
  unit: string;
  category: string;
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

  const fetchProducts = useCallback(async (page: number, limit: number, search: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/products?page=${page}&limit=${limit}&search=${search}`, {
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
          const res = await fetch('http://localhost:5000/api/stock-opname', {
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
          !isOpnameActive ? (
            (checkActionPermission('create') || checkActionPermission('edit')) && (
            <button 
              onClick={handleStartOpname}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Mulai Stock Opname
            </button>
            )
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={handleCancelOpname}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitOpname}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                disabled={isSubmitting}
              >
                <Save size={16} />
                {isSubmitting ? 'Saving...' : 'Submit Opname'}
              </button>
            </div>
          )
        }
      />

      {/* Main Content */}
      <div className="p-8 pt-0">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="w-full md:w-auto text-sm text-gray-500">
               {isOpnameActive && (
                 <span className="text-blue-600 font-medium flex items-center gap-1">
                   <AlertCircle size={14}/> 
                   Recording mode active. Only items with entered values will be updated.
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
                {/* <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center gap-2">
                    <Filter size={16} />
                    Filters
                </button> */}
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-500 font-medium text-sm">
              <tr>
                <th className="px-6 py-4 text-left">Name</th>
                <th className="px-6 py-4 text-left">Stock Sistem</th>
                <th className="px-6 py-4 text-left">Stock Faktual</th>
                <th className="px-6 py-4 text-left">Selisih</th>
                <th className="px-6 py-4 text-right">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
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
                        <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.category}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-medium">{product.stock}</td>
                        <td className="px-6 py-4">
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
                        <td className="px-6 py-4">
                        {hasEntry ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifferenceColor(difference)}`}>
                            {difference > 0 ? '+' : ''}{difference}
                            </span>
                        ) : (
                            <span className="text-gray-400">-</span>
                        )}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-500 text-sm">
                            {product.unit}
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
                <div className="flex gap-1">
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
