'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Plus, Edit, Trash2, X, PackageOpen } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
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

interface Batch {
  id: number;
  product_id: number;
  supplier_id: number | null;
  supplier_name: string | null;
  batch_number: string | null;
  stock_type: 'beli_normal' | 'consignment';
  purchase_date: string | null;
  initial_quantity: number;
  remaining_quantity: number;
  cost_price: number;
  expired_date: string | null;
  created_at: string;
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

interface BatchFormData {
  supplier_id: string;
  batch_number: string;
  stock_type: 'beli_normal' | 'consignment';
  purchase_date: string;
  initial_quantity: string;
  cost_price: string;
  expired_date: string;
}

export default function ProductsPage() {
  const router = useRouter();
  // Permission Check
  const { checkActionPermission } = useRequirePermission('Management Product');

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
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
  const [isBatchesModalOpen, setIsBatchesModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [batchModalMode, setBatchModalMode] = useState<'add' | 'edit'>('add');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger' as 'danger' | 'warning' | 'info'
  });

  // Form States
  const [batchFormData, setBatchFormData] = useState<BatchFormData>({
    supplier_id: '',
    batch_number: '',
    stock_type: 'beli_normal',
    purchase_date: '',
    initial_quantity: '',
    cost_price: '',
    expired_date: ''
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
  const authHeaders = useMemo<Record<string, string>>(() => {
    if (!token) return {} as Record<string, string>;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/products?page=${currentPage}&limit=${itemsPerPage}&search=${debouncedSearchQuery}`, {
        headers: authHeaders
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push('/login');
        return;
      }

      if (res.status === 403) {
        setProducts([]);
        setPagination({ total: 0, page: 1, limit: itemsPerPage, totalPages: 1 });
        goeyToast.error('Akses Ditolak', {
          description: 'Anda tidak memiliki izin untuk melihat daftar produk.'
        });
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
  }, [authHeaders, currentPage, itemsPerPage, debouncedSearchQuery, router]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/suppliers', {
        headers: authHeaders
      });
      const data = await res.json();
      setSuppliers(data.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }, [authHeaders]);

  const fetchBatches = useCallback(async (productId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/batches/${productId}`, {
        headers: authHeaders
      });
      const data = await res.json();
      setBatches(data.data || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, [fetchProducts, fetchSuppliers]);

  // Batches Handlers
  const handleOpenBatchesModal = (product: Product) => {
    setSelectedProduct(product);
    fetchBatches(product.id);
    setIsBatchesModalOpen(true);
  };

  const handleOpenAddBatchModal = () => {
    setBatchModalMode('add');
    setBatchFormData({
      supplier_id: '',
      batch_number: '',
      stock_type: 'beli_normal',
      purchase_date: new Date().toISOString().split('T')[0],
      initial_quantity: '',
      cost_price: selectedProduct?.cost_price.toString() || '',
      expired_date: ''
    });
  };

  const handleOpenEditBatchModal = (batch: Batch) => {
    setBatchModalMode('edit');
    setSelectedBatch(batch);
    setBatchFormData({
      supplier_id: batch.supplier_id?.toString() || '',
      batch_number: batch.batch_number || '',
      stock_type: batch.stock_type,
      purchase_date: batch.purchase_date || '',
      initial_quantity: batch.initial_quantity.toString(),
      cost_price: batch.cost_price.toString(),
      expired_date: batch.expired_date || ''
    });
  };

  const handleBatchInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setBatchFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveBatch = async () => {
    if (!selectedProduct) return;

    try {
      const url = batchModalMode === 'add'
        ? 'http://localhost:5000/api/inventory/batches'
        : `http://localhost:5000/api/inventory/batches/${selectedBatch?.id}`;
      const method = batchModalMode === 'add' ? 'POST' : 'PUT';

      const payload = {
        product_id: selectedProduct.id,
        supplier_id: batchFormData.supplier_id ? Number(batchFormData.supplier_id) : null,
        batch_number: batchFormData.batch_number || null,
        stock_type: batchFormData.stock_type,
        purchase_date: batchFormData.purchase_date || null,
        initial_quantity: Number(batchFormData.initial_quantity),
        remaining_quantity: batchModalMode === 'edit' ? Number(batchFormData.initial_quantity) : Number(batchFormData.initial_quantity),
        cost_price: Number(batchFormData.cost_price),
        expired_date: batchFormData.expired_date || null
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        goeyToast.success(`Batch ${batchModalMode === 'add' ? 'ditambahkan' : 'diperbarui'}!`);
        fetchBatches(selectedProduct.id);
        fetchProducts();
        setBatchFormData({
          supplier_id: '',
          batch_number: '',
          stock_type: 'beli_normal',
          purchase_date: '',
          initial_quantity: '',
          cost_price: '',
          expired_date: ''
        });
        setSelectedBatch(null);
      }
    } catch (error) {
      console.error('Error saving batch:', error);
    }
  };

  const handleDeleteBatch = async (batch: Batch) => {
    if (!confirm('Anda yakin ingin menghapus batch ini?')) return;

    try {
      const res = await fetch(`http://localhost:5000/api/inventory/batches/${batch.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });

      if (res.ok && selectedProduct) {
        goeyToast.success('Batch dihapus!');
        fetchBatches(selectedProduct.id);
        fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting batch:', error);
    }
  };

  const checkPermission = (action: 'create' | 'edit' | 'delete') => {
    return checkActionPermission(action);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
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
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk menambah produk baru."
        });
        return;
    }
    if (modalMode === 'edit' && !checkActionPermission('edit')) {
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk mengubah data produk."
        });
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
          ...authHeaders
        },
        body: JSON.stringify({
          ...formData,
          cost_price: Number(formData.cost_price),
          selling_price: Number(formData.selling_price),
          stock: Number(formData.stock),
          expired_date: formData.expired_date || null
        }),
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push('/login');
        return;
      }

      if (res.ok) {
        handleCloseModal();
        fetchProducts();
        goeyToast.success(`Produk berhasil ${modalMode === 'add' ? 'ditambahkan' : 'diperbarui'}`, {
          description: `Produk "${formData.name}" dengan harga ${formatCurrency(Number(formData.selling_price))} telah berhasil ${modalMode === 'add' ? 'ditambahkan ke katalog' : 'diperbarui'}.`
        });
      } else {
        const data = await res.json().catch(() => null);
        goeyToast.error('Gagal menyimpan produk', {
            description: data?.message || "Terjadi kesalahan saat menyimpan data produk."
        });
      }
    } catch (error) {
      console.error('Error saving product:', error);
      goeyToast.error('Terjadi kesalahan sistem', {
          description: "Gagal terhubung ke server. Silakan coba lagi."
      });
    }
  };

  const handleOpenDeleteModal = (product: Product) => {
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
        goeyToast.error('Akses Ditolak', {
          description: 'Anda tidak memiliki izin untuk menghapus produk.'
        });
        return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/products/${product.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push('/login');
        return;
      }

      if (res.ok) {
        fetchProducts();
        goeyToast.success('Produk Berhasil Dihapus', {
          description: `Produk "${product.name}" telah berhasil dihapus dari katalog.`
        });
      } else {
        const data = await res.json().catch(() => null);
        goeyToast.error('Gagal Menghapus Produk', {
          description: data?.message || 'Terjadi kesalahan saat menghapus produk.'
        });
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      goeyToast.error('Terjadi Kesalahan', {
        description: 'Gagal menghapus produk. Periksa koneksi internet Anda.'
      });
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
            {/* <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Filter size={16} />
              Filters
            </button> */}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium">
              <tr>
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
                          onClick={() => handleOpenBatchesModal(product)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Batches"
                        >
                          <PackageOpen size={16} />
                        </button>
                        )}
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

      {/* Batches Modal */}
      {isBatchesModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Batches for {selectedProduct.name}</h2>
                <p className="text-sm text-gray-500">Total stock: {selectedProduct.stock} {selectedProduct.unit}</p>
              </div>
              <button onClick={() => setIsBatchesModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="mb-4 flex justify-between items-center">
                <h3 className="font-semibold text-gray-700">Batch List</h3>
                <button
                  onClick={handleOpenAddBatchModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Plus size={16} /> Add Batch
                </button>
              </div>

              {batches.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No batches found. Add your first batch!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                      <tr>
                        <th className="px-4 py-3">Batch Number</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">Stock Type</th>
                        <th className="px-4 py-3">Purchase Date</th>
                        <th className="px-4 py-3">Expired Date</th>
                        <th className="px-4 py-3">Initial Qty</th>
                        <th className="px-4 py-3">Remaining Qty</th>
                        <th className="px-4 py-3">Cost Price</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((batch) => (
                        <tr key={batch.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">{batch.batch_number || '-'}</td>
                          <td className="px-4 py-3">{batch.supplier_name || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              batch.stock_type === 'beli_normal' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {batch.stock_type === 'beli_normal' ? 'Normal' : 'Consignment'}
                            </span>
                          </td>
                          <td className="px-4 py-3">{batch.purchase_date ? new Date(batch.purchase_date).toLocaleDateString('id-ID') : '-'}</td>
                          <td className="px-4 py-3">
                            {batch.expired_date ? new Date(batch.expired_date).toLocaleDateString('id-ID') : '-'}
                          </td>
                          <td className="px-4 py-3">{batch.initial_quantity}</td>
                          <td className="px-4 py-3 font-medium">{batch.remaining_quantity}</td>
                          <td className="px-4 py-3">{formatCurrency(batch.cost_price)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleOpenEditBatchModal(batch)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteBatch(batch)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Batch Form */}
              {(batchModalMode === 'add' || selectedBatch) && (
                <div className="mt-6 border-t border-gray-100 pt-6">
                  <h3 className="font-semibold text-gray-700 mb-4">
                    {batchModalMode === 'add' ? 'Add New Batch' : 'Edit Batch'}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                      <select
                        name="supplier_id"
                        value={batchFormData.supplier_id}
                        onChange={handleBatchInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                      <input
                        type="text"
                        name="batch_number"
                        value={batchFormData.batch_number}
                        onChange={handleBatchInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock Type</label>
                      <select
                        name="stock_type"
                        value={batchFormData.stock_type}
                        onChange={handleBatchInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="beli_normal">Normal Purchase</option>
                        <option value="consignment">Consignment</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                      <input
                        type="date"
                        name="purchase_date"
                        value={batchFormData.purchase_date}
                        onChange={handleBatchInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Initial Quantity</label>
                      <input
                        type="number"
                        name="initial_quantity"
                        value={batchFormData.initial_quantity}
                        onChange={handleBatchInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                      <input
                        type="number"
                        name="cost_price"
                        value={batchFormData.cost_price}
                        onChange={handleBatchInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expired Date</label>
                      <input
                        type="date"
                        name="expired_date"
                        value={batchFormData.expired_date}
                        onChange={handleBatchInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setBatchFormData({
                          supplier_id: '',
                          batch_number: '',
                          stock_type: 'beli_normal',
                          purchase_date: '',
                          initial_quantity: '',
                          cost_price: '',
                          expired_date: ''
                        });
                        setSelectedBatch(null);
                        setBatchModalMode('add');
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBatch}
                      className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      {batchModalMode === 'add' ? 'Add Batch' : 'Save Batch'}
                    </button>
                  </div>
                </div>
              )}
            </div>
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
