'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, History } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

interface Product {
  id: number;
  name: string;
  stock: number;
  unit: string;
  category: string;
  cost_price: number;
  selling_price: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function StockManagementPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { loading: permLoading, checkActionPermission } = useRequirePermission('Management Stock');

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<'add' | 'reduce' | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/products?page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}`, {
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
      setProducts(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching products:', error);
      showToast('Error fetching products', 'error');
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

  const handleOpenAdjustment = (product: Product, mode: 'add' | 'reduce') => {
    if (!checkActionPermission('edit')) {
        showToast('You do not have permission to adjust stock', 'error');
        return;
    }
    setSelectedProduct(product);
    setAdjustmentMode(mode);
    setAdjustmentQty('');
    setAdjustmentNote('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setAdjustmentMode(null);
    setAdjustmentQty('');
    setAdjustmentNote('');
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !adjustmentMode) return;
    if (!checkActionPermission('edit')) {
        showToast('You do not have permission to adjust stock', 'error');
        return;
    }

    const qty = parseInt(adjustmentQty);
    if (isNaN(qty) || qty <= 0) {
        showToast('Please enter a valid quantity', 'warning');
        return;
    }

    if (adjustmentMode === 'reduce' && qty > selectedProduct.stock) {
        showToast('Insufficient stock', 'warning');
        return;
    }

    setIsSubmitting(true);
    try {
        const newStock = adjustmentMode === 'add' 
            ? selectedProduct.stock + qty 
            : selectedProduct.stock - qty;

        // Use dedicated inventory adjustment endpoint
        const res = await fetch('http://localhost:5000/api/inventory/adjust', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({
                productId: selectedProduct.id,
                type: adjustmentMode,
                quantity: qty,
                note: adjustmentNote
            })
        });

        if (res.ok) {
            showToast(`Stock ${adjustmentMode === 'add' ? 'added' : 'reduced'} successfully`, 'success');
            fetchProducts();
            handleCloseModal();
        } else {
            const data = await res.json();
            showToast(data.message || 'Failed to update stock', 'error');
        }
    } catch (error) {
        console.error('Error updating stock:', error);
        showToast('Error updating stock', 'error');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <Header 
        title="Stock Management"
        subtitle="Manage inventory levels"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Management' }]}
      />

      <div className="p-8 pt-0">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600 font-medium">
            Showing {products.length} of {pagination.total} Products
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Current Stock</th>
                <th className="px-6 py-4">Unit</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No products found.</td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 text-gray-600">{product.category}</td>
                    <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.stock <= 10 ? 'bg-red-100 text-red-800' : 
                            product.stock <= 50 ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-green-100 text-green-800'
                        }`}>
                            {product.stock}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{product.unit}</td>
                    <td className="px-6 py-4 text-right">
                        {checkActionPermission('edit') && (
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => handleOpenAdjustment(product, 'add')}
                                className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-medium transition-colors"
                            >
                                + Add
                            </button>
                            <button 
                                onClick={() => handleOpenAdjustment(product, 'reduce')}
                                className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-medium transition-colors"
                            >
                                - Reduce
                            </button>
                        </div>
                        )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500 border-t border-gray-100">
             {/* Simple pagination similar to ProductsPage */}
             <div className="flex items-center gap-2">
                <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                    Previous
                </button>
                <span>Page {currentPage} of {pagination.totalPages}</span>
                <button
                    disabled={currentPage === pagination.totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                    Next
                </button>
             </div>
        </div>
      </div>
      </div>

      {/* Adjustment Modal */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                    {adjustmentMode === 'add' ? 'Add Stock' : 'Reduce Stock'} - {selectedProduct.name}
                </h2>
                <form onSubmit={handleAdjustment}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity to {adjustmentMode === 'add' ? 'Add' : 'Reduce'}
                        </label>
                        <input
                            type="number"
                            min="1"
                            max={adjustmentMode === 'reduce' ? selectedProduct.stock : undefined}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            value={adjustmentQty}
                            onChange={(e) => setAdjustmentQty(e.target.value)}
                            required
                        />
                        {adjustmentMode === 'reduce' && (
                            <p className="text-xs text-gray-500 mt-1">Current stock: {selectedProduct.stock}</p>
                        )}
                    </div>
                    <div className="mb-6">
                         <label className="block text-sm font-medium text-gray-700 mb-1">
                            Note (Optional)
                        </label>
                        <textarea
                             className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                             rows={3}
                             value={adjustmentNote}
                             onChange={(e) => setAdjustmentNote(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-4 py-2 text-white rounded-lg text-sm font-medium ${
                                adjustmentMode === 'add' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            {isSubmitting ? 'Saving...' : 'Confirm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
