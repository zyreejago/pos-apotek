'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Plus, Edit, Trash2, FileText, Info } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import ConfirmModal from '@/components/ConfirmModal';
import PageHeader from '@/components/PageHeader';
import OffCanvas from '@/components/OffCanvas';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { useKeyboardShortcuts } from '@/context/KeyboardShortcutsContext';

interface Product {
  id: number;
  name: string;
  cost_price: number;
  selling_price: number;
  stock: number;
  unit: string;
  expired_date: string | null;
  location_code: string;
  supplier_id: number | null;
  supplier_name: string | null;
  stock_type: 'belum_bayar' | 'konsinyasi' | 'dp' | 'lunas' | null;
  purchase_date: string | null;
  dp_amount?: number;
  due_date?: string | null;
  invoice_number?: string | null;
  purchase_unit?: string | null;
  unit_multiplier?: number;
}

interface Faktur {
  id: number;
  product_id: number;
  invoice_number: string;
  supplier_id: number | null;
  supplier_name: string | null;
  purchase_date: string | null;
  quantity: number;
  cost_price: number;
  total_amount: number;
  stock_type: 'belum_bayar' | 'konsinyasi' | 'dp' | 'lunas';
  dp_amount: number | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
}

interface DbBatch {
  id: number;
  product_id: number;
  batch_number: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  purchase_date: string | null;
  initial_quantity: number;
  remaining_quantity: number;
  cost_price: number;
  stock_type: 'belum_bayar' | 'konsinyasi' | 'dp' | 'lunas';
  dp_amount: number | null;
  due_date: string | null;
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
  location_code: string;
  supplier_id: string;
  stock_type: 'belum_bayar' | 'konsinyasi' | 'dp' | 'lunas';
  purchase_date: string;
  dp_amount?: string;
  due_date?: string;
  invoice_number?: string;
  purchase_unit?: string;
  unit_multiplier?: string;
  purchase_unit_stock?: string;
}

// For multiple products
interface ProductItem extends ProductFormData {
  id: string;
}


interface FakturFormData {
  invoice_number: string;
  supplier_id: string;
  purchase_date: string;
  quantity: string;
  cost_price: string;
  stock_type: 'belum_bayar' | 'konsinyasi' | 'dp' | 'lunas';
  dp_amount: string;
  due_date: string;
  notes: string;
}

export default function ProductsPage() {
  const { setSearchInputRef } = useKeyboardShortcuts();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchInputRef(searchRef);
    return () => setSearchInputRef({ current: null });
  }, [setSearchInputRef]);
  // Permission Check
  const { checkActionPermission } = useRequirePermission('Management Product');

  // Local product state (to add new products without server)
  const [allProducts, setAllProducts] = useState<Product[]>([]);
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

  // OffCanvas States
  const [isProductOffCanvasOpen, setIsProductOffCanvasOpen] = useState(false);
  const [isFakturOffCanvasOpen, setIsFakturOffCanvasOpen] = useState(false);
  const [productOffCanvasMode, setProductOffCanvasMode] = useState<'add' | 'edit'>('add');
  const [fakturModalMode, setFakturModalMode] = useState<'add' | 'edit'>('add');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedFaktur, setSelectedFaktur] = useState<Faktur | null>(null);
  const [fakturs, setFakturs] = useState<Faktur[]>([]);
  const [showFakturForm, setShowFakturForm] = useState(false);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '' as string | React.ReactNode,
    onConfirm: () => {},
    onClose: () => {},
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'danger' as 'danger' | 'warning' | 'info'
  });

  // Form States
  const [fakturFormData, setFakturFormData] = useState<FakturFormData>({
    invoice_number: '',
    supplier_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    quantity: '',
    cost_price: '',
    stock_type: 'belum_bayar',
    dp_amount: '',
    due_date: '',
    notes: ''
  });

  // Form State
  const [isMultipleProducts, setIsMultipleProducts] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    cost_price: '',
    selling_price: '',
    stock: '',
    unit: 'Tablet',
    expired_date: '',
    location_code: '',
    supplier_id: '',
    stock_type: 'belum_bayar',
    purchase_date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    dp_amount: '',
    due_date: '',
    purchase_unit: 'Box',
    unit_multiplier: '1'
  });
  const [multipleProducts, setMultipleProducts] = useState<ProductItem[]>([]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = useMemo<Record<string, string>>(() => {
    if (!token) return {} as Record<string, string>;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let url = `http://localhost:5000/api/products?page=${currentPage}&limit=${itemsPerPage}`;
      if (debouncedSearchQuery) {
        url += `&search=${encodeURIComponent(debouncedSearchQuery)}`;
      }
      const res = await fetch(url, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch products');
      const json = await res.json();
      
      setProducts(json.data || []);
      setPagination({
        total: json.pagination?.total || 0,
        page: json.pagination?.page || 1,
        limit: json.pagination?.limit || 10,
        totalPages: json.pagination?.totalPages || 1
      });
      
      // Fetch all products for local reference if needed (optional, but let's keep allProducts updated)
      const allRes = await fetch(`http://localhost:5000/api/products?limit=1000`, { headers: authHeaders });
      if (allRes.ok) {
        const allJson = await allRes.json();
        setAllProducts(allJson.data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearchQuery, authHeaders]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/suppliers?limit=1000`, { headers: authHeaders });
      if (res.ok) {
        const json = await res.json();
        setSuppliers(json.data || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }, [authHeaders]);

  const fetchFakturs = useCallback(async (productId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/batches/${productId}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const json = await res.json();
        // Backend returns `batch_number`, frontend expects `invoice_number` due to refactor
        const mappedFakturs = (json.data || []).map((batch: DbBatch) => ({
          ...batch,
          invoice_number: batch.batch_number,
          quantity: batch.initial_quantity,
          total_amount: batch.cost_price * batch.initial_quantity,
          product_id: productId
        }));
        setFakturs(mappedFakturs);
      }
    } catch (error) {
      console.error('Error fetching fakturs:', error);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, [fetchProducts, fetchSuppliers]);

  // Faktur Handlers
  const handleOpenFakturOffCanvas = (product: Product) => {
    setSelectedProduct(product);
    fetchFakturs(product.id);
    setIsFakturOffCanvasOpen(true);
    setShowFakturForm(false);
  };

  const handleOpenAddFakturModal = () => {
    setFakturModalMode('add');
    setShowFakturForm(true);
    setFakturFormData({
      invoice_number: '',
      supplier_id: selectedProduct?.supplier_id?.toString() || '',
      purchase_date: new Date().toISOString().split('T')[0],
      quantity: '',
      cost_price: selectedProduct?.cost_price.toString() || '',
      stock_type: selectedProduct?.stock_type || 'belum_bayar',
      dp_amount: '',
      due_date: '',
      notes: ''
    });
  };

  const handleOpenEditFakturModal = (faktur: Faktur) => {
    setFakturModalMode('edit');
    setSelectedFaktur(faktur);
    setShowFakturForm(true);

    const formatDateForInput = (dateStr: string | null) => {
      if (!dateStr) return '';
      return dateStr.substring(0, 10);
    };

    setFakturFormData({
      invoice_number: faktur.invoice_number || '',
      supplier_id: faktur.supplier_id?.toString() || '',
      purchase_date: formatDateForInput(faktur.purchase_date),
      quantity: (faktur.quantity / (selectedProduct?.unit_multiplier || 1)).toString(),
      cost_price: faktur.cost_price.toString(),
      stock_type: faktur.stock_type,
      dp_amount: faktur.dp_amount?.toString() || '',
      due_date: formatDateForInput(faktur.due_date),
      notes: faktur.notes || ''
    });
  };

  const handleFakturInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFakturFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveFaktur = async () => {
    if (!selectedProduct) return;

    try {
      const url = fakturModalMode === 'add'
        ? 'http://localhost:5000/api/inventory/batches'
        : `http://localhost:5000/api/inventory/batches/${selectedFaktur?.id}`;
      const method = fakturModalMode === 'add' ? 'POST' : 'PUT';

      // Convert from purchase unit (box) to base unit (tablet)
      // e.g. 20 Box × 2 tablet/box = 40 tablet
      const multiplier = selectedProduct.unit_multiplier || 1;
      const qtyInBaseUnit = (Number(fakturFormData.quantity) || 0) * multiplier;

      const payload = {
        product_id: selectedProduct.id,
        supplier_id: fakturFormData.supplier_id ? Number(fakturFormData.supplier_id) : null,
        batch_number: fakturFormData.invoice_number || null,
        stock_type: fakturFormData.stock_type,
        purchase_date: fakturFormData.purchase_date || null,
        initial_quantity: qtyInBaseUnit,
        remaining_quantity: qtyInBaseUnit,
        cost_price: Number(fakturFormData.cost_price) || 0,
        expired_date: null,
        dp_amount: fakturFormData.stock_type === 'dp' && fakturFormData.dp_amount ? Number(fakturFormData.dp_amount) : null,
        due_date: fakturFormData.stock_type === 'dp' && fakturFormData.due_date ? fakturFormData.due_date : null
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
        goeyToast.success(`Faktur ${fakturModalMode === 'add' ? 'ditambahkan' : 'diperbarui'}!`);
        fetchFakturs(selectedProduct.id);
        fetchProducts(); // refresh product stock
        setFakturFormData({
          invoice_number: '',
          supplier_id: '',
          purchase_date: new Date().toISOString().split('T')[0],
          quantity: '',
          cost_price: '',
          stock_type: 'belum_bayar',
          dp_amount: '',
          due_date: '',
          notes: ''
        });
        setSelectedFaktur(null);
        setFakturModalMode('add');
        setShowFakturForm(false);
      } else {
        goeyToast.error('Gagal menyimpan faktur');
      }
    } catch (error) {
      console.error('Error saving faktur:', error);
      goeyToast.error('Gagal menyimpan faktur');
    }
  };

  const handleDeleteFaktur = async (faktur: Faktur) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Faktur',
      message: `Anda yakin ingin menghapus faktur ${faktur.invoice_number}?`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/inventory/batches/${faktur.id}`, {
            method: 'DELETE',
            headers: authHeaders
          });
          if (res.ok) {
            goeyToast.success('Faktur berhasil dihapus!');
            if (selectedProduct) {
              fetchFakturs(selectedProduct.id);
              fetchProducts(); // refresh product stock
            }
          } else {
            goeyToast.error('Gagal menghapus faktur');
          }
        } catch (error) {
          console.error('Error deleting faktur:', error);
          goeyToast.error('Gagal menghapus faktur');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      onClose: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      confirmText: 'Hapus',
      cancelText: 'Batal'
    });
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

  const formatStock = (stock: number, multiplier: number, purchaseUnit: string, baseUnit: string) => {
    return `${stock} ${baseUnit || 'Tablet'}`;
  };

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
  const handleOpenAddOffCanvas = () => {
    setProductOffCanvasMode('add');
    setIsMultipleProducts(false);
    setMultipleProducts([]);
    setFormData({
      name: '',
      cost_price: '',
      selling_price: '',
      stock: '',
      unit: 'Tablet',
      expired_date: '',
      location_code: '',
      supplier_id: '',
      stock_type: 'belum_bayar',
      purchase_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      purchase_unit: 'Box',
      unit_multiplier: '1',
      purchase_unit_stock: ''
    });
    setIsProductOffCanvasOpen(true);
  };

  const handleOpenEditOffCanvas = (product: Product) => {
    setProductOffCanvasMode('edit');
    setIsMultipleProducts(false);
    setSelectedProduct(product);
    const multiplier = product.unit_multiplier || 1;
    const calculatedPurchaseStock = (product.stock / multiplier).toString();
    setFormData({
      name: product.name,
      cost_price: product.cost_price.toString(),
      selling_price: product.selling_price.toString(),
      stock: product.stock.toString(),
      unit: product.unit || 'Tablet',
      expired_date: product.expired_date ? new Date(product.expired_date).toISOString().split('T')[0] : '',
      location_code: product.location_code || '',
      supplier_id: product.supplier_id?.toString() || '',
      stock_type: product.stock_type || 'belum_bayar',
      purchase_date: product.purchase_date ? new Date(product.purchase_date).toISOString().split('T')[0] : '',
      dp_amount: product.dp_amount?.toString() || '',
      due_date: product.due_date ? new Date(product.due_date).toISOString().split('T')[0] : '',
      invoice_number: product.invoice_number || '',
      purchase_unit: product.purchase_unit || 'Box',
      unit_multiplier: multiplier.toString(),
      purchase_unit_stock: calculatedPurchaseStock
    });
    setIsProductOffCanvasOpen(true);
  };

  const handleCloseProductOffCanvas = () => {
    setIsProductOffCanvasOpen(false);
    setSelectedProduct(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'purchase_unit_stock') {
        const pStock = Number(value) || 0;
        const mult = Number(updated.unit_multiplier) || 1;
        updated.stock = value === '' ? '' : Math.round(pStock * mult).toString();
      } else if (name === 'unit_multiplier') {
        const pStock = Number(updated.purchase_unit_stock) || 0;
        const mult = Number(value) || 1;
        updated.stock = updated.purchase_unit_stock === '' ? '' : Math.round(pStock * mult).toString();
      } else if (name === 'stock') {
        const bStock = Number(value) || 0;
        const mult = Number(updated.unit_multiplier) || 1;
        updated.purchase_unit_stock = value === '' ? '' : (bStock / mult).toString();
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Permission check
    if (productOffCanvasMode === 'add' && !checkActionPermission('create')) {
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk menambah produk baru."
        });
        return;
    }
    if (productOffCanvasMode === 'edit' && !checkActionPermission('edit')) {
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk mengubah data produk."
        });
        return;
    }

    if (productOffCanvasMode === 'edit' && selectedProduct) {
      try {
        const multiplier = Number(formData.unit_multiplier) || 1;
        const payload = {
          name: formData.name,
          cost_price: Number(formData.cost_price),
          selling_price: Number(formData.selling_price) || 0,
          stock: Number(formData.stock),
          unit: formData.unit || 'Tablet',
          expired_date: formData.expired_date || null,
          location_code: formData.location_code || null,
          purchase_unit: formData.purchase_unit || 'Box',
          unit_multiplier: multiplier
        };
        const res = await fetch(`http://localhost:5000/api/products/${selectedProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to update product');
        
        handleCloseProductOffCanvas();
        fetchProducts();
        goeyToast.success('Produk berhasil diperbarui');
      } catch (error) {
        console.error('Error updating product:', error);
        goeyToast.error('Gagal memperbarui produk');
      }
    } else {
      // Add mode
      try {
        const saveProductAndBatch = async (item: ProductFormData) => {
          // Check if product with same name exists in database
          const existingProduct = allProducts.find(
            p => p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );

          const multiplier = Number(item.unit_multiplier) || 1;
          const calculatedStock = Number(item.stock);

          let productId = null;
          if (existingProduct) {
            productId = existingProduct.id;
            // Update existing product details
            const payload = {
              name: existingProduct.name,
              cost_price: Number(item.cost_price) || existingProduct.cost_price,
              selling_price: Number(item.selling_price) || existingProduct.selling_price || 0,
              stock: item.supplier_id ? Number(existingProduct.stock) : Number(existingProduct.stock) + calculatedStock,
              unit: item.unit || existingProduct.unit || 'Tablet',
              expired_date: item.expired_date || existingProduct.expired_date || null,
              location_code: item.location_code || existingProduct.location_code || null,
              purchase_unit: item.purchase_unit || existingProduct.purchase_unit || 'Box',
              unit_multiplier: multiplier
            };
            await fetch(`http://localhost:5000/api/products/${productId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify(payload)
            });
          } else {
            // Create new product
            const payload = {
              name: item.name,
              cost_price: Number(item.cost_price),
              selling_price: Number(item.selling_price) || 0,
              stock: item.supplier_id ? 0 : calculatedStock,
              unit: item.unit || 'Tablet',
              expired_date: item.expired_date || null,
              location_code: item.location_code || null,
              purchase_unit: item.purchase_unit || 'Box',
              unit_multiplier: multiplier
            };
            const res = await fetch(`http://localhost:5000/api/products`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify(payload)
            });
            const json = await res.json();
            productId = json.id;
          }

          // Create batch/faktur if supplier info is present
          if (productId && item.supplier_id) {
            const batchPayload = {
              product_id: productId,
              supplier_id: Number(item.supplier_id),
              batch_number: item.invoice_number || null,
              stock_type: item.stock_type || 'belum_bayar',
              purchase_date: item.purchase_date || null,
              initial_quantity: calculatedStock,
              cost_price: Number(item.cost_price) || 0,
              expired_date: item.expired_date || null
            };
            await fetch(`http://localhost:5000/api/inventory/batches`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify(batchPayload)
            });
          }
        };

        if (isMultipleProducts) {
          if (multipleProducts.length === 0) {
            goeyToast.error('Daftar produk kosong', { description: 'Silakan tambahkan setidaknya satu produk.' });
            return;
          }
          for (const item of multipleProducts) {
            await saveProductAndBatch(item);
          }
        } else {
          // Single product add
          await saveProductAndBatch(formData);
        }
        
        handleCloseProductOffCanvas();
        fetchProducts();
        goeyToast.success('Produk berhasil disimpan');
      } catch (error) {
        console.error('Error adding product:', error);
        goeyToast.error('Gagal menambahkan produk');
      }
    }
  };

  const handleOpenDeleteModal = (product: Product) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Product',
      message: `Are you sure you want to delete ${product.name}? This action cannot be undone.`,
      variant: 'danger',
      onClose: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      confirmText: 'Delete',
      cancelText: 'Cancel',
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
      if (!res.ok) throw new Error('Failed to delete product');
      
      fetchProducts();
      goeyToast.success('Produk Berhasil Dihapus', {
        description: `Produk "${product.name}" telah berhasil dihapus dari katalog.`
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      goeyToast.error('Terjadi Kesalahan', {
        description: 'Gagal menghapus produk.'
      });
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <PageHeader 
        title="Products"
        subtitle={`All Products: ${pagination.total}`}
        rightContent={
          checkPermission('create') && (
            <button 
              onClick={handleOpenAddOffCanvas}
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
                ref={searchRef}
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
                <th className="px-6 py-4 cursor-pointer hover:text-gray-700">Kode Lokasi </th>
                <th className="px-6 py-4 cursor-pointer hover:text-gray-700">Supplier </th>
                <th className="px-6 py-4 cursor-pointer hover:text-gray-700">Stock Type </th>
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
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                    {/* <td className="px-6 py-4 text-gray-500">#{product.id}</td> */}
                    <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{product.location_code || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{product.supplier_name || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.stock_type === 'lunas' 
                          ? 'bg-green-100 text-green-700' 
                          : product.stock_type === 'belum_bayar'
                          ? 'bg-yellow-100 text-yellow-700'
                          : product.stock_type === 'konsinyasi'
                          ? 'bg-purple-100 text-purple-700'
                          : product.stock_type === 'dp'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {product.stock_type === 'lunas' ? 'Lunas' : 
                         product.stock_type === 'belum_bayar' ? 'Belum Bayar' : 
                         product.stock_type === 'konsinyasi' ? 'Konsinyasi' : 
                         product.stock_type === 'dp' ? 'DP' : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatCurrency(product.cost_price)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatCurrency(product.selling_price)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getExpiredStatusColor(product.expired_date)}`}>
                        {formatDate(product.expired_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatStock(product.stock, product.unit_multiplier || 1, product.purchase_unit || 'Box', product.unit || 'Tablet')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {checkPermission('edit') && (
                        <button 
                          onClick={() => handleOpenFakturOffCanvas(product)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Faktur"
                        >
                          <FileText size={16} />
                        </button>
                        )}
                        {checkPermission('edit') && (
                        <button 
                          onClick={() => handleOpenEditOffCanvas(product)}
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

      {/* Add/Edit Product OffCanvas */}
      <OffCanvas
        isOpen={isProductOffCanvasOpen}
        onClose={handleCloseProductOffCanvas}
        title={productOffCanvasMode === 'add' ? 'Add New Product' : 'Edit Product'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Single/Multiple Toggle (only when adding) */}
            {productOffCanvasMode === 'add' && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setIsMultipleProducts(false)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${!isMultipleProducts ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  1 Product
                </button>
                <button
                  type="button"
                  onClick={() => setIsMultipleProducts(true)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${isMultipleProducts ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  Multiple Products
                </button>
              </div>
            )}

            {/* Invoice Number */}
            {productOffCanvasMode === 'add' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Faktur</label>
                <input
                  type="text"
                  name="invoice_number"
                  value={formData.invoice_number ?? ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="FKT-001"
                />
              </div>
            )}

            {/* Render form based on single/multiple */}
            {productOffCanvasMode === 'edit' || !isMultipleProducts ? (
              <React.Fragment>
                <div>
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
                
                <div className="grid grid-cols-2 gap-4">
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
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Pembelian</label>
                    <select
                      name="purchase_unit"
                      value={formData.purchase_unit}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="Box">Box</option>
                      <option value="Strip">Strip</option>
                      <option value="Botol">Botol</option>
                      <option value="Tube">Tube</option>
                      <option value="Pcs">Pcs</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Dasar</label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="Tablet">Tablet</option>
                      <option value="Kapsul">Kapsul</option>
                      <option value="Kaplet">Kaplet</option>
                      <option value="Pil">Pil</option>
                      <option value="Lozenges (hisap)">Lozenges (hisap)</option>
                      <option value="Sachet (serbuk)">Sachet (serbuk)</option>
                      <option value="Tube">Tube</option>
                      <option value="Botol">Botol</option>
                      <option value="Pcs">Pcs</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Isi per Unit Pembelian</label>
                    <input
                      type="number"
                      name="unit_multiplier"
                      required
                      min="1"
                      value={formData.unit_multiplier}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stok (Dalam {formData.purchase_unit || 'Box'})</label>
                    <input
                      type="number"
                      name="purchase_unit_stock"
                      min="0"
                      value={formData.purchase_unit_stock}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stok (Dalam {formData.unit || 'Tablet'}) <span className="text-xs text-gray-400 font-normal">(Unit Dasar)</span>
                    </label>
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
                    {/* Placeholder to balance the row */}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Kode Lokasi
                    <button
                      type="button"
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                      onClick={() => setConfirmModal({
                        isOpen: true,
                        title: "Format Kode Lokasi",
                        message: (
                          <ul className="text-sm text-gray-600 space-y-2 mt-2">
                            <li><span className="font-medium">A-01-03:</span> Rak A, Baris 01, Kolom 03</li>
                            <li><span className="font-medium">B-02-T:</span> Rak B, Baris 02, Tingkat Atas (T)</li>
                            <li><span className="font-medium">C-01-M:</span> Rak C, Baris 01, Tingkat Tengah (M)</li>
                            <li><span className="font-medium">G-01-05:</span> Gudang (G), Rak 01, Slot 05</li>
                            <li><span className="font-medium">CH-01:</span> Chiller/Kulkas (CH), Rak 01</li>
                          </ul>
                        ),
                        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
                        onClose: () => setConfirmModal({ ...confirmModal, isOpen: false }),
                        confirmText: "Tutup",
                        cancelText: "Tutup",
                        variant: "info"
                      })}
                    >
                      <Info size={16} />
                    </button>
                  </label>
                  <select
                    name="location_code"
                    value={formData.location_code}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Pilih Kode Lokasi</option>
                    <option value="A-01-03">A-01-03 (Rak A, Baris 01, Kolom 03)</option>
                    <option value="A-02-01">A-02-01 (Rak A, Baris 02, Kolom 01)</option>
                    <option value="B-01-03">B-01-03 (Rak B, Baris 01, Kolom 03)</option>
                    <option value="C-01-02">C-01-02 (Rak C, Baris 01, Kolom 02)</option>
                    <option value="CH-01">CH-01 (Chiller 01)</option>
                    <option value="CH-02">CH-02 (Chiller 02)</option>
                    <option value="G-01-01">G-01-01 (Gudang, Rak 01)</option>
                    <option value="G-01-05">G-01-05 (Gudang, Rak 05)</option>
                  </select>
                </div>

                {productOffCanvasMode === 'add' && (
                  <React.Fragment>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                        <select
                          name="supplier_id"
                          value={formData.supplier_id}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="">Select Supplier</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stock Type</label>
                        <select
                          name="stock_type"
                          value={formData.stock_type}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="belum_bayar">Belum Bayar</option>
                          <option value="konsinyasi">Konsinyasi</option>
                          <option value="dp">DP</option>
                          <option value="lunas">Lunas</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                      <input
                        type="date"
                        name="purchase_date"
                        value={formData.purchase_date}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </React.Fragment>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expired Date</label>
                  <input
                    type="date"
                    name="expired_date"
                    value={formData.expired_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* DP Fields (only show if stock type is DP and in ADD mode) */}
                {productOffCanvasMode === 'add' && formData.stock_type === 'dp' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">DP Amount (IDR)</label>
                      <input
                        type="number"
                        name="dp_amount"
                        min="0"
                        value={formData.dp_amount ?? ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                      <input
                        type="date"
                        name="due_date"
                        value={formData.due_date ?? ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </React.Fragment>
            ) : (
              // Multiple Products Section
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Pilih Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <h3 className="font-medium text-gray-700 mb-3">Tambahkan Produk</h3>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Nama Produk</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        placeholder="Nama Produk"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Kode Lokasi</label>
                      <select
                        value={formData.location_code}
                        onChange={(e) => setFormData({ ...formData, location_code: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">Pilih Lokasi</option>
                        <option value="A-01-03">A-01-03</option>
                        <option value="A-02-01">A-02-01</option>
                        <option value="B-01-03">B-01-03</option>
                        <option value="C-01-02">C-01-02</option>
                        <option value="CH-01">CH-01</option>
                        <option value="CH-02">CH-02</option>
                        <option value="G-01-01">G-01-01</option>
                        <option value="G-01-05">G-01-05</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Harga Beli</label>
                      <input
                        type="number"
                        value={formData.cost_price}
                        onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Harga Jual</label>
                      <input
                        type="number"
                        value={formData.selling_price}
                        onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Unit Pembelian</label>
                      <select
                        value={formData.purchase_unit}
                        onChange={(e) => setFormData({ ...formData, purchase_unit: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="Box">Box</option>
                        <option value="Strip">Strip</option>
                        <option value="Botol">Botol</option>
                        <option value="Tube">Tube</option>
                        <option value="Pcs">Pcs</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Unit Dasar</label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="Tablet">Tablet</option>
                        <option value="Kapsul">Kapsul</option>
                        <option value="Kaplet">Kaplet</option>
                        <option value="Pil">Pil</option>
                        <option value="Lozenges (hisap)">Lozenges (hisap)</option>
                        <option value="Sachet (serbuk)">Sachet (serbuk)</option>
                        <option value="Tube">Tube</option>
                        <option value="Botol">Botol</option>
                        <option value="Pcs">Pcs</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Isi per Unit Pembelian</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.unit_multiplier}
                        onChange={(e) => {
                          const multVal = e.target.value;
                          const mult = Number(multVal) || 1;
                          const pStock = Number(formData.purchase_unit_stock) || 0;
                          setFormData({
                            ...formData,
                            unit_multiplier: multVal,
                            stock: formData.purchase_unit_stock === '' ? '' : Math.round(pStock * mult).toString()
                          });
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Stock ({formData.purchase_unit || 'Box'})</label>
                      <input
                        type="number"
                        value={formData.purchase_unit_stock || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const pStock = Number(val) || 0;
                          const mult = Number(formData.unit_multiplier) || 1;
                          setFormData({
                            ...formData,
                            purchase_unit_stock: val,
                            stock: val === '' ? '' : Math.round(pStock * mult).toString()
                          });
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Stock ({formData.unit || 'Tablet'}) <span className="text-[10px] text-gray-400 font-normal">(Unit Dasar)</span></label>
                      <input
                        type="number"
                        value={formData.stock || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const bStock = Number(val) || 0;
                          const mult = Number(formData.unit_multiplier) || 1;
                          setFormData({
                            ...formData,
                            stock: val,
                            purchase_unit_stock: val === '' ? '' : (bStock / mult).toString()
                          });
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tgl Kadaluarsa</label>
                      <input
                        type="date"
                        value={formData.expired_date}
                        onChange={(e) => setFormData({ ...formData, expired_date: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Stock Type</label>
                      <select
                        value={formData.stock_type}
                        onChange={(e) => setFormData({ ...formData, stock_type: e.target.value as ProductFormData['stock_type'] })}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="belum_bayar">Belum Bayar</option>
                        <option value="konsinyasi">Konsinyasi</option>
                        <option value="dp">DP</option>
                        <option value="lunas">Lunas</option>
                      </select>
                    </div>
                  </div>
                  {/* DP Fields for multiple products */}
                  {formData.stock_type === 'dp' && (
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">DP Amount (IDR)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.dp_amount ?? ''}
                          onChange={(e) => setFormData({ ...formData, dp_amount: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={formData.due_date ?? ''}
                          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.name || !formData.cost_price || !formData.stock) return;
                      
                      // Check if product with same name already exists in multipleProducts list
                      const existingIndex = multipleProducts.findIndex(
                        p => p.name.trim().toLowerCase() === formData.name.trim().toLowerCase()
                      );

                      if (existingIndex > -1) {
                        const updatedList = [...multipleProducts];
                        const existingItem = updatedList[existingIndex];
                        updatedList[existingIndex] = {
                          ...existingItem,
                          stock: (Number(existingItem.stock) + Number(formData.stock)).toString(),
                          cost_price: formData.cost_price, // Update with the latest cost price
                          selling_price: formData.selling_price || existingItem.selling_price // Update with latest selling price
                        };
                        setMultipleProducts(updatedList);
                      } else {
                        setMultipleProducts([
                          ...multipleProducts,
                          {
                            ...formData,
                            id: Date.now().toString()
                          }
                        ]);
                      }

                      // Reset form for next product
                      setFormData({
                        ...formData,
                        name: '',
                        location_code: '',
                        cost_price: '',
                        selling_price: '',
                        stock: '',
                        expired_date: '',
                        dp_amount: '',
                        due_date: '',
                        purchase_unit: 'Box',
                        unit_multiplier: '1',
                        purchase_unit_stock: ''
                      });
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                  >
                    + Tambahkan ke Daftar
                  </button>
                </div>

                {/* Product List */}
                {multipleProducts.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Daftar Produk ({multipleProducts.length})</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {multipleProducts.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div className="text-sm">
                            <div className="font-medium text-gray-800">{index + 1}. {item.name}</div>
                             <div className="text-gray-600 text-xs">
                              {formatCurrency(Number(item.cost_price))} | Stok: {item.stock} {item.purchase_unit} (isi: {item.unit_multiplier} {item.unit}) | {(() => {
                                const typeMap: Record<string, string> = {
                                  belum_bayar: 'Belum Bayar',
                                  konsinyasi: 'Konsinyasi',
                                  dp: 'DP',
                                  lunas: 'Lunas'
                                };
                                return typeMap[item.stock_type] || item.stock_type;
                              })()}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setMultipleProducts(multipleProducts.filter(p => p.id !== item.id));
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={handleCloseProductOffCanvas}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              {productOffCanvasMode === 'add' ? 'Create Product' : 'Save Changes'}
            </button>
          </div>
        </form>
      </OffCanvas>

      {/* Faktur OffCanvas */}
      {isFakturOffCanvasOpen && selectedProduct && (
        <OffCanvas
          isOpen={isFakturOffCanvasOpen}
          onClose={() => setIsFakturOffCanvasOpen(false)}
          title={`Faktur - ${selectedProduct.name}`}
          width="800px"
        >
          <div className="mb-4">
            <p className="text-sm text-gray-500">Total stock: {formatStock(selectedProduct.stock, selectedProduct.unit_multiplier || 1, selectedProduct.purchase_unit || 'Box', selectedProduct.unit || 'Tablet')}</p>
          </div>

          <div className="mb-4 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Daftar Faktur</h3>
            <button
              onClick={handleOpenAddFakturModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Tambah Faktur
            </button>
          </div>

          {fakturs.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Belum ada faktur. Tambahkan faktur pertama!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                  <tr>
                    <th className="px-4 py-3">No. Faktur</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Tipe Stok</th>
                    <th className="px-4 py-3">Tgl Pembelian</th>
                    <th className="px-4 py-3">Baru Bayar</th>
                    <th className="px-4 py-3">Jatuh Tempo</th>
                    <th className="px-4 py-3">Jumlah</th>
                    <th className="px-4 py-3">Harga Beli</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {fakturs.map((faktur) => (
                    <tr key={faktur.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{faktur.invoice_number}</td>
                      <td className="px-4 py-3">{faktur.supplier_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          faktur.stock_type === 'lunas'
                            ? 'bg-green-100 text-green-700'
                            : faktur.stock_type === 'belum_bayar'
                            ? 'bg-yellow-100 text-yellow-700'
                            : faktur.stock_type === 'konsinyasi'
                            ? 'bg-purple-100 text-purple-700'
                            : faktur.stock_type === 'dp'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {faktur.stock_type === 'lunas' ? 'Lunas' :
                           faktur.stock_type === 'belum_bayar' ? 'Belum Bayar' :
                           faktur.stock_type === 'konsinyasi' ? 'Konsinyasi' :
                           faktur.stock_type === 'dp' ? 'DP' : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{faktur.purchase_date ? new Date(faktur.purchase_date).toLocaleDateString('id-ID') : '-'}</td>
                      <td className="px-4 py-3">
                        {faktur.stock_type === 'dp' && faktur.dp_amount 
                          ? formatCurrency(faktur.dp_amount) 
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {faktur.stock_type === 'dp' && faktur.due_date 
                          ? new Date(faktur.due_date).toLocaleDateString('id-ID') 
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span>{faktur.quantity} {selectedProduct?.unit || 'Tablet'}</span>
                      </td>
                      <td className="px-4 py-3">{formatCurrency(faktur.cost_price)}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(faktur.total_amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditFakturModal(faktur)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteFaktur(faktur)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Hapus"
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

          {/* Faktur Form */}
          {showFakturForm && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="font-semibold text-gray-700 mb-4">
                {fakturModalMode === 'add' ? 'Tambah Faktur Baru' : 'Edit Faktur'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. Faktur</label>
                  <input
                    type="text"
                    name="invoice_number"
                    value={fakturFormData.invoice_number}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="FKT-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select
                    name="supplier_id"
                    value={fakturFormData.supplier_id}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Pilih Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Stok</label>
                  <select
                    name="stock_type"
                    value={fakturFormData.stock_type}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="belum_bayar">Belum Bayar</option>
                    <option value="konsinyasi">Konsinyasi</option>
                    <option value="dp">DP</option>
                    <option value="lunas">Lunas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tgl Pembelian</label>
                  <input
                    type="date"
                    name="purchase_date"
                    value={fakturFormData.purchase_date}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jumlah (dalam {selectedProduct?.purchase_unit || 'Box'})
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={fakturFormData.quantity}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0"
                    min="0"
                  />
                  {(selectedProduct?.unit_multiplier || 1) > 1 && fakturFormData.quantity && (
                    <p className="text-xs text-blue-600 mt-1">
                      = {Number(fakturFormData.quantity) * (selectedProduct?.unit_multiplier || 1)} {selectedProduct?.unit || 'Tablet'} (total satuan dasar)
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Beli</label>
                  <input
                    type="number"
                    name="cost_price"
                    value={fakturFormData.cost_price}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0"
                  />
                </div>
                {fakturFormData.stock_type === 'dp' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah DP (IDR)</label>
                      <input
                        type="number"
                        name="dp_amount"
                        min="0"
                        value={fakturFormData.dp_amount}
                        onChange={handleFakturInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Jatuh Tempo</label>
                      <input
                        type="date"
                        name="due_date"
                        value={fakturFormData.due_date}
                        onChange={handleFakturInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </>
                )}
                <div className="col-span-2 md:col-span-3">
                  
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setFakturFormData({
                      invoice_number: '',
                      supplier_id: '',
                      purchase_date: new Date().toISOString().split('T')[0],
                      quantity: '',
                      cost_price: '',
                      stock_type: 'belum_bayar',
                      dp_amount: '',
                      due_date: '',
                      notes: ''
                    });
                    setSelectedFaktur(null);
                    setFakturModalMode('add');
                    setShowFakturForm(false);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveFaktur}
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {fakturModalMode === 'add' ? 'Tambah Faktur' : 'Simpan Faktur'}
                </button>
              </div>
            </div>
          )}
        </OffCanvas>
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
