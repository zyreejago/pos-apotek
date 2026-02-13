'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import ConfirmModal from '@/components/ConfirmModal';

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

interface OpnameItem {
  id: number;
  system_stock: number;
  actual_stock: number;
}

interface OpnameEntry {
  actual: number;
  system: number;
}

export default function StockOpnamePage() {
  const { showToast } = useToast();
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

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/products?page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}`);
      const data = await res.json();
      setProducts(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
      
      // Initialize opname data with current system stock if active
      // Or keep existing inputs if navigating pages? 
      // For simplicity, we might lose inputs on page change if not careful.
      // But let's keep it simple: inputs are per-page for now or stored globally?
      // Storing globally is better but more complex. 
      // Let's assume user finishes one page or we store in a larger map.
      // We'll store in `opnameData` which is preserved across page changes if we don't clear it.
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [currentPage, itemsPerPage]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchProducts();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStartOpname = () => {
    setIsOpnameActive(true);
    setOpnameData({});
  };

  const handleCancelOpname = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Stock Opname',
      message: 'Are you sure you want to cancel stock opname? All unsaved changes will be lost.',
      variant: 'warning',
      onConfirm: () => {
        setIsOpnameActive(false);
        setOpnameData({});
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const calculateDifference = (systemStock: number, actualStock: number | undefined) => {
    if (actualStock === undefined) return 0;
    return actualStock - systemStock;
  };

  const getDifferenceColor = (diff: number) => {
    if (diff > 0) return 'bg-green-100 text-green-700';
    if (diff < 0) return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const handleSubmitOpname = async () => {
    // Collect all items that have changes
    const itemsToUpdate: OpnameItem[] = [];
    
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
      showToast('No changes to save.', 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Submit Stock Opname',
      message: `Are you sure you want to submit stock opname for ${payload.length} items? This will update the system stock.`,
      variant: 'info',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        try {
          const res = await fetch('http://localhost:5000/api/stock-opname', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: payload })
          });
    
          if (res.ok) {
            showToast(`Stock opname submitted successfully for ${payload.length} items!`, 'success');
            setIsOpnameActive(false);
            setOpnameData({});
            fetchProducts(); // Refresh data
          } else {
            showToast('Failed to submit stock opname', 'error');
          }
        } catch (error) {
          console.error('Error submitting opname:', error);
          showToast('Error submitting stock opname', 'error');
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
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <span>Inventory</span>
            <span>/</span>
            <span className="font-semibold text-gray-900">Stock Opname</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Opname</h1>
        </div>
        <div className="flex items-center gap-3">
          {!isOpnameActive ? (
            <button 
              onClick={handleStartOpname}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Mulai Stock Opname
            </button>
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
          )}
           <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden ml-2">
                <img src="https://ui-avatars.com/api/?name=Admin" alt="User" />
            </div>
        </div>
      </div>

      {/* Main Content */}
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
                <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center gap-2">
                    <Filter size={16} />
                    Filters
                </button>
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-500 font-medium text-sm">
              <tr>
                <th className="px-6 py-4 text-left w-10">
                  <input type="checkbox" className="rounded border-gray-300" disabled={isOpnameActive} />
                </th>
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
                        <input type="checkbox" className="rounded border-gray-300" disabled={isOpnameActive} />
                        </td>
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
