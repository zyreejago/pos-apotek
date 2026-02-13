'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Plus, Edit, Trash2, X, ChevronLeft, ChevronRight, Package, MoreVertical, Upload } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import ConfirmModal from '@/components/ConfirmModal';
import Header from '@/components/Header';
import { useRequirePermission } from '@/hooks/useRequirePermission';

interface Product {
  id: number;
  name: string;
  cost_price: number;
  selling_price: number;
  stock: number;
  unit: string;
  expired_date: string | null;
  category: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ProductFormData {
  name: string;
  cost_price: string;
  selling_price: string;
  stock: string;
  unit: string;
  expired_date: string;
  category: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  // Permission Check
  const { loading: permLoading, hasPermission, checkActionPermission } = useRequirePermission('Management Product');

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

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger' as 'danger' | 'warning' | 'info'
  });

  // Form State
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    cost_price: '',
    selling_price: '',
    stock: '',
    unit: 'pcs',
    expired_date: '',
    category: 'General'
  });

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const checkPermission = (action: 'create' | 'edit' | 'delete') => {
    return checkActionPermission(action);
  };

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getExpiredStatusColor = (dateString: string | null) => {
    if (!dateString) return 'bg-gray-100 text-gray-600';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'bg-red-100 text-red-700'; // Expired
    if (diffDays < 90) return 'bg-yellow-100 text-yellow-700'; // Expiring soon (< 3 months)
    return 'bg-green-100 text-green-700'; // Safe
  };

  // Handlers
  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({
      name: '',
      cost_price: '',
      selling_price: '',
      stock: '',
      unit: 'pcs',
      expired_date: '',
      category: 'General'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setModalMode('edit');
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      cost_price: product.cost_price.toString(),
      selling_price: product.selling_price.toString(),
      stock: product.stock.toString(),
      unit: product.unit || 'pcs',
      expired_date: product.expired_date ? new Date(product.expired_date).toISOString().split('T')[0] : '',
      category: product.category || 'General'
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Permission check
    if (modalMode === 'add' && !checkActionPermission('create')) {
        showToast('You do not have permission to create products', 'error');
        return;
    }
    if (modalMode === 'edit' && !checkActionPermission('edit')) {
        showToast('You do not have permission to edit products', 'error');
        return;
    }

    const url = modalMode === 'add' 
      ? 'http://localhost:5000/api/products'
      : `http://localhost:5000/api/products/${selectedProduct?.id}`;
    
    const method = modalMode === 'add' ? 'POST' : 'PUT';
    
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          cost_price: Number(formData.cost_price),
          selling_price: Number(formData.selling_price),
          stock: Number(formData.stock),
          expired_date: formData.expired_date || null
        }),
      });

      if (res.ok) {
        handleCloseModal();
        fetchProducts();
        showToast(`Product ${modalMode === 'add' ? 'created' : 'updated'} successfully`, 'success');
      } else {
        showToast('Failed to save product', 'error');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      showToast('Error saving product', 'error');
    }
  };

  const handleOpenDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Product',
      message: `Are you sure you want to delete ${product.name}? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await handleConfirmDelete(product);
      }
    });
  };

  const handleConfirmDelete = async (product: Product) => {
    // Permission check
    if (!checkActionPermission('delete')) {
        showToast('You do not have permission to delete products', 'error');
        return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/products/${product.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setProductToDelete(null);
        fetchProducts();
        showToast('Product deleted successfully', 'success');
      } else {
        showToast('Failed to delete product', 'error');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      showToast('Error deleting product', 'error');
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <Header 
        title="Products"
        subtitle={`All Products: ${pagination.total}`}
        rightContent={
          checkPermission('create') && (
            <button 
              onClick={handleOpenAddModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Products
            </button>
          )
        }
      />

      {/* Main Content */}
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
                placeholder="Search Products"
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Filter size={16} />
              Filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                </th>
                {/* <th className="px-6 py-4 cursor-pointer hover:text-gray-700">ID ↕</th> */}
                <th className="px-6 py-4 cursor-pointer hover:text-gray-700">Name </th>
                <th className="px-6 py-4 cursor-pointer hover:text-gray-700">Cost Price </th>
                <th className="px-6 py-4 cursor-pointer hover:text-gray-700">Selling Price </th>
                <th className="px-6 py-4 cursor-pointer hover:text-gray-700">Expired Date </th>
                <th className="px-6 py-4 cursor-pointer hover:text-gray-700">Stock </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    </td>
                    {/* <td className="px-6 py-4 text-gray-500">#{product.id}</td> */}
                    <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 text-gray-600">{formatCurrency(product.cost_price)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatCurrency(product.selling_price)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getExpiredStatusColor(product.expired_date)}`}>
                        {formatDate(product.expired_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{product.stock}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {checkPermission('edit') && (
                        <button 
                          onClick={() => handleOpenEditModal(product)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        )}
                        {checkPermission('delete') && (
                        <button 
                          onClick={() => handleOpenDeleteModal(product)}
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

        {/* Pagination */}
        <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              className="border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
            <span>per page</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span>
              {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-1">
              <button
                className={`w-8 h-8 flex items-center justify-center rounded border ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ←
              </button>
              <span className="w-8 h-8 flex items-center justify-center rounded bg-blue-600 text-white font-medium">
                {currentPage}
              </span>
              <button
                className={`w-8 h-8 flex items-center justify-center rounded border ${currentPage === pagination.totalPages ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">
                {modalMode === 'add' ? 'Add New Product' : 'Edit Product'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Enter product name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (IDR)</label>
                  <input
                    type="number"
                    name="cost_price"
                    required
                    min="0"
                    value={formData.cost_price}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (IDR)</label>
                  <input
                    type="number"
                    name="selling_price"
                    required
                    min="0"
                    value={formData.selling_price}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input
                    type="number"
                    name="stock"
                    required
                    min="0"
                    value={formData.stock}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="pcs">Pcs</option>
                    <option value="box">Box</option>
                    <option value="strip">Strip</option>
                    <option value="bottle">Bottle</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="General"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expired Date</label>
                  <input
                    type="date"
                    name="expired_date"
                    value={formData.expired_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {modalMode === 'add' ? 'Create Product' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
