'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Search, Plus, Edit, Trash2, FileText, Info, UploadCloud, Camera, X, Check, AlertCircle, CheckCircle, Package, Users, Calendar, AlertTriangle, ArrowUpDown, Wallet } from 'lucide-react';
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
  stock_type: 'belum_bayar' | 'konsinyasi' | 'dp' | 'lunas' | 'retur' | null;
  purchase_date: string | null;
  dp_amount?: number;
  due_date?: string | null;
  invoice_number?: string | null;
  purchase_unit?: string | null;
  unit_multiplier?: number;
  product_category?: 'OBAT' | 'NON_OBAT';
}

interface DpPayment {
  id: number;
  amount: number;
  payment_date: string;
  notes?: string | null;
  created_at: string;
}

interface Faktur {
  id: number;
  product_id: number;
  product_name?: string;
  product_status?: 'active' | 'pending';
  product_unit?: string;
  product_purchase_unit?: string;
  product_unit_multiplier?: number;
  invoice_number: string;
  supplier_id: number | null;
  supplier_name: string | null;
  purchase_date: string | null;
  quantity: number;
  initial_quantity: number;
  remaining_quantity: number;
  cost_price: number;
  total_amount: number;
  stock_type: 'belum_bayar' | 'konsinyasi' | 'dp' | 'lunas' | 'retur';
  dp_amount: number | null;
  due_date: string | null;
  expired_date: string | null;
  notes: string | null;
  image_url: string | null;
  status: 'approved' | 'pending' | 'rejected' | 'revision';
  created_at: string;
  dp_payments?: DpPayment[];
  qty_returned?: number;
  created_by_username?: string;
  created_by_role?: string;
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
  stock_type: 'belum_bayar' | 'konsinyasi' | 'dp' | 'lunas' | 'retur';
  dp_amount: number | null;
  due_date: string | null;
  expired_date: string | null;
  image_url: string | null;
  status: 'approved' | 'pending' | 'rejected' | 'revision';
  created_at: string;
  dp_payments?: DpPayment[];
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
  stock_type: 'belum_bayar' | 'konsinyasi' | 'dp' | 'lunas' | 'retur';
  purchase_date: string;
  dp_amount?: string;
  due_date?: string;
  invoice_number?: string;
  purchase_unit?: string;
  unit_multiplier?: string;
  purchase_unit_stock?: string;
  product_category: 'OBAT' | 'NON_OBAT';
}

// For multiple products
interface ProductItem extends ProductFormData {
  id: string;
  imageFiles: File[];
}


interface FakturFormData {
  invoice_number: string;
  supplier_id: string;
  purchase_date: string;
  quantity: string;
  cost_price: string;
  selling_price: string;
  purchase_unit: string;
  unit: string;
  unit_multiplier: string;
  stock_type: 'belum_bayar' | 'konsinyasi' | 'dp' | 'lunas' | 'retur';
  dp_amount: string;
  due_date: string;
  expired_date: string;
  notes: string;
}

export default function ProductsPage() {
  const { setSearchInputRef } = useKeyboardShortcuts();
  const searchRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const productCameraInputRef = useRef<HTMLInputElement>(null);
  const fakturFileInputRef = useRef<HTMLInputElement>(null);
  const fakturCameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchInputRef(searchRef);
    return () => setSearchInputRef({ current: null });
  }, [setSearchInputRef]);
  // Permission Check
  const { checkActionPermission } = useRequirePermission('Management Product');
  const { checkActionPermission: checkApprovalPermission } = useRequirePermission('Approval Faktur');

  // Local product state (to add new products without server)
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Product | 'name'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
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
  
  // Approval Modal States
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [pendingFakturs, setPendingFakturs] = useState<Faktur[]>([]);
  const [isFetchingPending, setIsFetchingPending] = useState(false);

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
    selling_price: '',
    purchase_unit: 'Box',
    unit: 'Tablet',
    unit_multiplier: '1',
    stock_type: 'belum_bayar',
    dp_amount: '',
    due_date: '',
      expired_date: '',
    notes: ''
  });
  const [fakturImageFiles, setFakturImageFiles] = useState<File[]>([]);
  const [fakturImagePreviews, setFakturImagePreviews] = useState<string[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageList, setPreviewImageList] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [detailFaktur, setDetailFaktur] = useState<Faktur | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [newDPAmount, setNewDPAmount] = useState('');
  const [newDPDate, setNewDPDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDPPaymentMethod, setNewDPPaymentMethod] = useState('cash');
  const [showAddDPForm, setShowAddDPForm] = useState(false);

  // Form State
  const [isMultipleProducts, setIsMultipleProducts] = useState(false);
  const [hasPurchaseUnitForm, setHasPurchaseUnitForm] = useState(false);
  const [fakturBatchImages, setFakturBatchImages] = useState<File[]>([]);
  const [fakturBatchPreviews, setFakturBatchPreviews] = useState<string[]>([]);
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
    unit_multiplier: '1',
    product_category: 'OBAT'
  });
  const [productFormImageFiles, setProductFormImageFiles] = useState<File[]>([]);
  const [productFormImagePreviews, setProductFormImagePreviews] = useState<string[]>([]);
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
          product_id: productId,
          image_url: batch.image_url
        }));
        setFakturs(mappedFakturs);
        
        // Update selectedFaktur if it exists to refresh the DP list
        if (selectedFaktur) {
          const updatedFaktur = mappedFakturs.find((f: Faktur) => f.id === selectedFaktur.id);
          if (updatedFaktur) {
            setSelectedFaktur(updatedFaktur);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching fakturs:', error);
    }
  }, [authHeaders, selectedFaktur]);

  const fetchGlobalPendingFakturs = useCallback(async () => {
    setIsFetchingPending(true);
    try {
      const res = await fetch('http://localhost:5000/api/inventory/pending-batches', {
        headers: authHeaders
      });
      if (res.ok) {
        const json = await res.json();
        const mapped = (json.data || []).map((batch: any) => ({
          ...batch,
          invoice_number: batch.batch_number,
          quantity: batch.initial_quantity,
          total_amount: batch.cost_price * batch.initial_quantity
        }));
        setPendingFakturs(mapped);
      }
    } catch (error) {
      console.error('Error fetching pending fakturs:', error);
      goeyToast.error('Gagal memuat data approval');
    } finally {
      setIsFetchingPending(false);
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
    setIsProductOffCanvasOpen(false); // Close product offcanvas first
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
      selling_price: selectedProduct?.selling_price.toString() || '',
      purchase_unit: selectedProduct?.purchase_unit || 'Box',
      unit: selectedProduct?.unit || 'Tablet',
      unit_multiplier: (selectedProduct?.unit_multiplier || 1).toString(),
      stock_type: selectedProduct?.stock_type || 'belum_bayar',
      dp_amount: '',
      due_date: '',
      expired_date: '',
      notes: ''
    });
    setFakturImageFiles([]); setFakturImagePreviews([]);
  };

  const handleOpenEditFakturModal = (faktur: Faktur, customProduct?: Product) => {
    setFakturModalMode('edit');
    setSelectedFaktur(faktur);
    setShowFakturForm(true);
    setIsFakturOffCanvasOpen(true);

    const activeProduct = customProduct || selectedProduct;
    if (activeProduct) {
      fetchFakturs(activeProduct.id);
    }

    const formatDateForInput = (dateStr: string | null) => {
      if (!dateStr) return '';
      return dateStr.substring(0, 10);
    };

    const multiplier = activeProduct?.unit_multiplier || 1;

    setFakturFormData({
      invoice_number: faktur.invoice_number || '',
      supplier_id: faktur.supplier_id?.toString() || '',
      purchase_date: formatDateForInput(faktur.purchase_date),
      quantity: (faktur.quantity / multiplier).toString(),
      cost_price: faktur.cost_price.toString(),
      selling_price: activeProduct?.selling_price.toString() || '',
      purchase_unit: activeProduct?.purchase_unit || 'Box',
      unit: activeProduct?.unit || 'Tablet',
      unit_multiplier: (activeProduct?.unit_multiplier || 1).toString(),
      stock_type: faktur.stock_type as any,
      dp_amount: faktur.dp_amount?.toString() || '',
      due_date: formatDateForInput(faktur.due_date),
      expired_date: formatDateForInput(faktur.expired_date),
      notes: faktur.notes || ''
    });
    setFakturImageFiles([]); setFakturImagePreviews([]);
    if (faktur.image_url) {
      const urls = getImageUrls(faktur.image_url);
      setFakturImagePreviews(urls.map(u => `http://localhost:5000${u}`));
    }
  };

  const handleFakturInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFakturFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setProductFormImageFiles(prev => [...prev, ...files]);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          setProductFormImagePreviews(prev => [...prev, event.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleFakturImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setFakturImageFiles(prev => [...prev, ...files]);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          setFakturImagePreviews(prev => [...prev, event.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFakturImage = (index: number) => {
    setFakturImageFiles(prev => prev.filter((_, i) => i !== index));
    setFakturImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddDP = async () => {
    if (!selectedFaktur?.id || !newDPAmount || Number(newDPAmount) <= 0) {
      goeyToast.error('Jumlah DP harus lebih dari 0');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/inventory/batches/${selectedFaktur.id}/dp-payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          amount: Number(newDPAmount),
          payment_date: newDPDate,
          payment_method: newDPPaymentMethod
        })
      });

      if (res.ok) {
        goeyToast.success('DP berhasil ditambahkan!');
        setNewDPAmount('');
        setNewDPPaymentMethod('cash');
        setShowAddDPForm(false);
        if (selectedProduct) fetchFakturs(selectedProduct.id);
      } else {
        goeyToast.error('Gagal menambahkan DP');
      }
    } catch (error) {
      console.error(error);
      goeyToast.error('Terjadi kesalahan');
    }
  };

  const handleDeleteDP = async (paymentId: number) => {
    if (!selectedFaktur?.id) return;

    // Find the DP amount for the message
    const dpItem = selectedFaktur.dp_payments?.find((dp: any) => dp.id === paymentId);
    const dpAmount = dpItem ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(dpItem.amount)) : '';

    setConfirmModal({
      isOpen: true,
      title: 'Hapus DP',
      message: `Yakin ingin menghapus DP ${dpAmount}? Data yang sudah dihapus tidak dapat dikembalikan.`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`http://localhost:5000/api/inventory/batches/${selectedFaktur.id}/dp-payments/${paymentId}`, {
            method: 'DELETE',
            headers: authHeaders
          });

          if (res.ok) {
            goeyToast.success('DP berhasil dihapus!');
            if (selectedProduct) fetchFakturs(selectedProduct.id);
          } else {
            goeyToast.error('Gagal menghapus DP');
          }
        } catch (error) {
          console.error(error);
          goeyToast.error('Terjadi kesalahan');
        }
      },
      onClose: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
    });
  };

  // const handleApproveFaktur = async (fakturId: number) => {
  //   try {
  //     const res = await fetch(`http://localhost:5000/api/inventory/batches/${fakturId}/approve`, {
  //       method: 'PUT',
  //       headers: authHeaders
  //     });
  //     if (res.ok) {
  //       goeyToast.success('Faktur disetujui!');
  //       if (selectedProduct) fetchFakturs(selectedProduct.id);
  //       if (isApprovalModalOpen) fetchGlobalPendingFakturs();
  //       fetchProducts();
  //     } else {
  //       goeyToast.error('Gagal menyetujui faktur');
  //     }
  //   } catch (error) {
  //     console.error(error);
  //     goeyToast.error('Terjadi kesalahan');
  //   }
  // };

  // const handleRejectFaktur = async (fakturId: number) => {
  //   try {
  //     const res = await fetch(`http://localhost:5000/api/inventory/batches/${fakturId}/reject`, {
  //       method: 'PUT',
  //       headers: authHeaders
  //     });
  //     if (res.ok) {
  //       goeyToast.success('Faktur ditolak');
  //       if (selectedProduct) fetchFakturs(selectedProduct.id);
  //       if (isApprovalModalOpen) fetchGlobalPendingFakturs();
  //     } else {
  //       goeyToast.error('Gagal menolak faktur');
  //     }
  //   } catch (error) {
  //     console.error(error);
  //     goeyToast.error('Terjadi kesalahan');
  //   }
  // };

  // const handleRequestRevision = async (fakturId: number) => {
  //   try {
  //     const res = await fetch(`http://localhost:5000/api/inventory/batches/${fakturId}/revision`, {
  //       method: 'PUT',
  //       headers: authHeaders
  //     });
  //     if (res.ok) {
  //       goeyToast.success('Permintaan perbaikan dikirim');
  //       if (selectedProduct) fetchFakturs(selectedProduct.id);
  //       if (isApprovalModalOpen) fetchGlobalPendingFakturs();
  //     } else {
  //       goeyToast.error('Gagal mengirim permintaan perbaikan');
  //     }
  //   } catch (error) {
  //     console.error(error);
  //     goeyToast.error('Terjadi kesalahan');
  //   }
  // };

  const handleSaveFaktur = async () => {
    if (!selectedProduct) return;

    try {
      // Helper function to format date for MySQL (YYYY-MM-DD)
      const formatDate = (date: string | Date | null) => {
        if (!date) return null;
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().split('T')[0];
      };

      // First, update the product's details
      const productUpdateRes = await fetch(`http://localhost:5000/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          name: selectedProduct.name,
          cost_price: Number(fakturFormData.cost_price) || selectedProduct.cost_price,
          selling_price: Number(fakturFormData.selling_price) || selectedProduct.selling_price,
          stock: selectedProduct.stock,
          unit: fakturFormData.unit || selectedProduct.unit,
          expired_date: formatDate(selectedProduct.expired_date),
          location_code: selectedProduct.location_code,
          supplier_id: fakturFormData.supplier_id ? Number(fakturFormData.supplier_id) : selectedProduct.supplier_id,
          purchase_unit: fakturFormData.purchase_unit || selectedProduct.purchase_unit,
          unit_multiplier: Number(fakturFormData.unit_multiplier) || selectedProduct.unit_multiplier || 1,
          product_category: selectedProduct.product_category || 'OBAT'
        })
      });

      if (!productUpdateRes.ok) {
        goeyToast.error('Gagal memperbarui produk');
        return;
      }

      // Then, save the batch/faktur
      const url = fakturModalMode === 'add'
        ? 'http://localhost:5000/api/inventory/batches'
        : `http://localhost:5000/api/inventory/batches/${selectedFaktur?.id}`;
      const method = fakturModalMode === 'add' ? 'POST' : 'PUT';

      // Convert from purchase unit (box) to base unit (tablet)
      // e.g. 20 Box × 2 tablet/box = 40 tablet
      const multiplier = Number(fakturFormData.unit_multiplier) || 1;
      const qtyInBaseUnit = (Number(fakturFormData.quantity) || 0) * multiplier;

      const formData = new FormData();
      formData.append('product_id', selectedProduct.id.toString());
      formData.append('supplier_id', fakturFormData.supplier_id ? fakturFormData.supplier_id : '');
      formData.append('batch_number', fakturFormData.invoice_number || '');
      formData.append('stock_type', fakturFormData.stock_type);
      formData.append('purchase_date', fakturFormData.purchase_date || '');
      formData.append('initial_quantity', qtyInBaseUnit.toString());
      formData.append('remaining_quantity', qtyInBaseUnit.toString());
      formData.append('cost_price', (Number(fakturFormData.cost_price) || 0).toString());
      formData.append('expired_date', fakturFormData.expired_date || '');
      if (fakturFormData.stock_type === 'dp' && fakturFormData.dp_amount) {
        formData.append('dp_amount', fakturFormData.dp_amount);
      }
      if (fakturFormData.stock_type === 'dp' && fakturFormData.due_date) {
        formData.append('due_date', fakturFormData.due_date);
      }
      formData.append('notes', fakturFormData.notes || '');
      fakturImageFiles.forEach(file => {
        formData.append('images', file);
      });

      const headers = {
        ...authHeaders
      };

      const res = await fetch(url, {
        method,
        headers,
        body: formData
      });

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'pending') {
          goeyToast.info('Persetujuan Diperlukan', {
            description: 'Faktur memerlukan persetujuan karena nominal > Rp 2.000.000. Stok belum akan bertambah sampai disetujui.'
          });
        } else {
          goeyToast.success(`Faktur ${fakturModalMode === 'add' ? 'ditambahkan' : 'diperbarui'}!`);
        }
        fetchFakturs(selectedProduct.id);
        if (isApprovalModalOpen) fetchGlobalPendingFakturs();
        fetchProducts(); // refresh product stock
        setFakturFormData({
          invoice_number: '',
          supplier_id: '',
          purchase_date: new Date().toISOString().split('T')[0],
          quantity: '',
          cost_price: '',
          selling_price: '',
          purchase_unit: 'Box',
          unit: 'Tablet',
          unit_multiplier: '1',
          stock_type: 'belum_bayar',
          dp_amount: '',
          due_date: '',
      expired_date: '',
          notes: ''
        });
        setFakturImageFiles([]); setFakturImagePreviews([]);
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
      message: `Anda yakin ingin menghapus faktur ${faktur.invoice_number || ''}?`,
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
            }
            fetchProducts(); // refresh product stock
            fetchGlobalPendingFakturs(); // refresh global pending/rejected list modal
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

  const handleExpireBatch = async (faktur: Faktur) => {
    setConfirmModal({
      isOpen: true,
      title: 'Tandai Kadaluarsa',
      message: `Apakah Anda yakin ingin menandai faktur/batch ${faktur.invoice_number || ''} sebagai kadaluarsa? Sisa stok akan dinolkan dan dicatat ke beban obat expired/selisih stok.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/inventory/batches/${faktur.id}/expire`, {
            method: 'PUT',
            headers: authHeaders
          });
          if (res.ok) {
            goeyToast.success('Batch berhasil ditandai sebagai kadaluarsa!');
            if (selectedProduct) {
              fetchFakturs(selectedProduct.id);
            }
            fetchProducts(); // refresh product stock
          } else {
            const json = await res.json();
            goeyToast.error(json.message || 'Gagal menandai batch sebagai kadaluarsa');
          }
        } catch (error) {
          console.error('Error expiring batch:', error);
          goeyToast.error('Gagal menandai batch sebagai kadaluarsa');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      onClose: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      confirmText: 'Tandai Kadaluarsa',
      cancelText: 'Batal'
    });
  };

  const handleArchiveFaktur = async (faktur: Faktur) => {
    if (faktur.stock_type !== 'lunas' && faktur.stock_type !== 'retur') {
      goeyToast.error('Hanya faktur dengan tipe stok \"lunas\" atau \"retur\" yang dapat diarsipkan!');
      return;
    }

    if (faktur.stock_type === 'retur' && (faktur.qty_returned ?? 0) < faktur.initial_quantity) {
      goeyToast.error('Barang retur belum lengkap', {
        description: `Arsip hanya bisa dilakukan setelah semua qty diretur (${faktur.qty_returned ?? 0}/${faktur.initial_quantity})`,
      });
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Arsipkan Faktur',
      message: `Apakah Anda yakin ingin mengarsipkan faktur ${faktur.invoice_number || ''}? Faktur yang diarsipkan tidak akan muncul di daftar produk dan supplier, namun tetap ada di Riwayat Pembelian.`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/inventory/batches/${faktur.id}/archive`, {
            method: 'PUT',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_archived: true })
          });
          if (res.ok) {
            goeyToast.success('Faktur berhasil diarsipkan!');
            if (selectedProduct) {
              fetchFakturs(selectedProduct.id);
            }
          } else {
            goeyToast.error('Gagal mengarsipkan faktur');
          }
        } catch (error) {
          console.error('Error archiving faktur:', error);
          goeyToast.error('Gagal mengarsipkan faktur');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      onClose: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      confirmText: 'Arsipkan',
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

  // Reset page when sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortDirection]);

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
      month: 'long',
      year: 'numeric'
    });
  };

  const getImageUrls = (url: string | null): string[] => {
    if (!url) return [];
    try { const parsed = JSON.parse(url); return Array.isArray(parsed) ? parsed : [url]; }
    catch { return [url]; }
  };

  const openImagePreview = (url: string, allUrls: string[]) => {
    const idx = allUrls.indexOf(url);
    setPreviewImageList(allUrls);
    setPreviewImageIndex(idx >= 0 ? idx : 0);
    setPreviewImageUrl(url);
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

  const handleSort = (field: keyof Product | 'name') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      const defaultDirection: Record<string, 'asc' | 'desc'> = {
        expired_date: 'asc',
        cost_price: 'asc',
        selling_price: 'asc',
        stock: 'desc',
        name: 'asc'
      };
      setSortDirection(defaultDirection[field] || 'asc');
    }
  };

  const SortableHeader = ({ field, label }: { field: keyof Product | 'name', label: string }) => (
    <th 
      className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        <ArrowUpDown size={14} className={`text-gray-400 ${sortField === field ? 'text-blue-500' : ''}`} />
      </div>
    </th>
  );

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...allProducts];

    // Filter search
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.supplier_name?.toLowerCase().includes(query)) ||
        (p.location_code?.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      // Handle nulls
      if (valA === null) valA = '';
      if (valB === null) valB = '';

      if (sortField === 'expired_date') {
        const dateA = valA ? new Date(valA).getTime() : Infinity;
        const dateB = valB ? new Date(valB).getTime() : Infinity;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      return 0;
    });

    return result;
  }, [allProducts, debouncedSearchQuery, sortField, sortDirection]);

  // Handlers
  const handleOpenAddOffCanvas = () => {
    setProductOffCanvasMode('add');
    setIsMultipleProducts(false);
    setMultipleProducts([]);
    setHasPurchaseUnitForm(false);
    setFakturImageFiles([]); setFakturImagePreviews([]);
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
      purchase_unit_stock: '',
      product_category: 'OBAT'
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
      purchase_unit_stock: calculatedPurchaseStock,
      product_category: product.product_category || 'OBAT'
    });
    setIsProductOffCanvasOpen(true);
  };

  const handleCloseProductOffCanvas = () => {
    setIsProductOffCanvasOpen(false);
    setSelectedProduct(null);
    setProductFormImageFiles([]);
    setProductFormImagePreviews([]);
    setFakturImageFiles([]); setFakturImagePreviews([]);
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
      dp_amount: '',
      due_date: '',
      purchase_unit: 'Box',
      unit_multiplier: '1',
      product_category: 'OBAT'
    });
    setIsMultipleProducts(false);
    setMultipleProducts([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      let updated = { ...prev, [name]: value };
      
      // Auto-fill fields if name matches existing product
      if (name === 'name') {
        const matchedProduct = allProducts.find(
          p => p.name.trim().toLowerCase() === value.trim().toLowerCase()
        );
        if (matchedProduct) {
          updated.unit = matchedProduct.unit;
          updated.purchase_unit = matchedProduct.purchase_unit || 'Box';
          updated.unit_multiplier = (matchedProduct.unit_multiplier || 1).toString();
          updated.selling_price = matchedProduct.selling_price.toString();
          updated.location_code = matchedProduct.location_code || '';
          updated.cost_price = prev.cost_price; // Keep manual cost price
        }
      }

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
        const formatDate = (date: string) => {
          if (!date) return null;
          return date.split('T')[0];
        };
        const payload = {
          name: formData.name,
          cost_price: Number(formData.cost_price),
          selling_price: Number(formData.selling_price) || 0,
          stock: Number(formData.stock),
          unit: formData.unit || 'Tablet',
          expired_date: formatDate(formData.expired_date),
          location_code: formData.location_code || null,
          purchase_unit: formData.purchase_unit || 'Box',
          unit_multiplier: multiplier,
          product_category: formData.product_category
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
        const saveProductAndBatch = async (item: ProductFormData, imageFiles: File[] = []) => {
          // Check if product with same name exists in database
          const existingProduct = allProducts.find(
            p => p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );

          const multiplier = Number(item.unit_multiplier) || 1;
          const calculatedStock = Number(item.stock);
          const formatDate = (date: string | null | undefined) => {
            if (!date) return null;
            return date.split('T')[0];
          };

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
              expired_date: formatDate(item.expired_date) || formatDate(existingProduct.expired_date),
              location_code: item.location_code || existingProduct.location_code || null,
              purchase_unit: item.purchase_unit || existingProduct.purchase_unit || 'Box',
              unit_multiplier: multiplier,
              product_category: item.product_category
            };
            await fetch(`http://localhost:5000/api/products/${productId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify(payload)
            });
          } else {
            // Create new product
            const multiplier = Number(item.unit_multiplier) || 1;
            const calculatedStock = Number(item.stock);
            const totalAmount = (Number(item.cost_price) || 0) * calculatedStock;
            const needsApproval = totalAmount > 2000000;

            const payload = {
              name: item.name,
              cost_price: Number(item.cost_price),
              selling_price: Number(item.selling_price) || 0,
              stock: item.supplier_id ? 0 : calculatedStock,
              unit: item.unit || 'Tablet',
              expired_date: formatDate(item.expired_date),
              location_code: item.location_code || null,
              purchase_unit: item.purchase_unit || 'Box',
              unit_multiplier: multiplier,
              needsApproval: needsApproval, // Pass flag to backend
              product_category: item.product_category
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
            const batchFormData = new FormData();
            batchFormData.append('product_id', productId.toString());
            batchFormData.append('supplier_id', item.supplier_id.toString());
            if (item.invoice_number) batchFormData.append('batch_number', item.invoice_number);
            batchFormData.append('stock_type', item.stock_type || 'belum_bayar');
            if (item.purchase_date) batchFormData.append('purchase_date', item.purchase_date);
            batchFormData.append('initial_quantity', calculatedStock.toString());
            batchFormData.append('remaining_quantity', calculatedStock.toString());
            batchFormData.append('cost_price', (Number(item.cost_price) || 0).toString());
            if (item.expired_date) batchFormData.append('expired_date', item.expired_date);
            if (item.dp_amount) batchFormData.append('dp_amount', item.dp_amount);
            if (item.due_date) batchFormData.append('due_date', item.due_date);
            imageFiles.forEach(f => batchFormData.append('images', f));

            const res = await fetch(`http://localhost:5000/api/inventory/batches`, {
              method: 'POST',
              headers: {
                ...authHeaders
              },
              body: batchFormData
            });

            if (res.ok) {
              const batchJson = await res.json();
              if (batchJson.data.status === 'pending') {
                goeyToast.info('Persetujuan Diperlukan', {
                  description: `Faktur untuk ${item.name} memerlukan persetujuan karena nominal > Rp 2.000.000.`
                });
              }
            }
          }
        };

        if (isMultipleProducts) {
          if (multipleProducts.length === 0) {
            goeyToast.error('Daftar produk kosong', { description: 'Silakan tambahkan setidaknya satu produk.' });
            return;
          }
          for (const item of multipleProducts) {
            await saveProductAndBatch(item, item.imageFiles || []);
          }
        } else {
          // Single product add
          await saveProductAndBatch(formData, [...productFormImageFiles, ...fakturImageFiles]);
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
      <div className="p-3 sm:p-4 md:p-8 pt-0">
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
                <SortableHeader field="name" label="Name" />
                <SortableHeader field="product_category" label="Kategori" />
                <SortableHeader field="location_code" label="Kode Lokasi" />
                <SortableHeader field="supplier_name" label="Supplier" />
                <SortableHeader field="stock_type" label="Stock Type" />
                <SortableHeader field="cost_price" label="Cost Price" />
                <SortableHeader field="selling_price" label="Selling Price" />
                <SortableHeader field="expired_date" label="Expired Date" />
                <SortableHeader field="stock" label="Stock" />
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    Loading products...
                  </td>
                </tr>
              ) : filteredAndSortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredAndSortedProducts
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                    {/* <td className="px-6 py-4 text-gray-500">#{product.id}</td> */}
                    <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        product.product_category === 'NON_OBAT' 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {product.product_category === 'NON_OBAT' ? 'Non-Obat' : 'Obat'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{product.location_code || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{product.supplier_name || '-'}</td>
                    <td className="px-3 sm:px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.stock_type === 'lunas' 
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : product.stock_type === 'belum_bayar'
                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                          : product.stock_type === 'konsinyasi'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : product.stock_type === 'dp'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : product.stock_type === 'retur'
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                        {product.stock_type === 'lunas' ? 'Lunas' : 
                         product.stock_type === 'belum_bayar' ? 'Belum Bayar' : 
                         product.stock_type === 'konsinyasi' ? 'Konsinyasi' : 
                         product.stock_type === 'dp' ? 'DP' : 
                         product.stock_type === 'retur' ? 'Retur' : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatCurrency(product.cost_price)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatCurrency(product.selling_price)}</td>
                    <td className="px-3 sm:px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getExpiredStatusColor(product.expired_date)}`}>
                        {formatDate(product.expired_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatStock(product.stock, product.unit_multiplier || 1, product.purchase_unit || 'Box', product.unit || 'Tablet')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setDetailProduct(product)}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                          title="Detail Produk"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
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
        <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500 border-t border-gray-100">
          <div className="flex items-center gap-4">
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

            {/* View Pending Approvals Button */}
            <button 
              onClick={() => {
                setIsApprovalModalOpen(true);
                fetchGlobalPendingFakturs();
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors font-medium"
            >
              <CheckCircle size={14} />
              Lihat Approval Tertunda
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <span>
              {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredAndSortedProducts.length)} of {filteredAndSortedProducts.length}
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
                className={`w-8 h-8 flex items-center justify-center rounded border ${currentPage === Math.ceil(filteredAndSortedProducts.length / itemsPerPage) ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredAndSortedProducts.length / itemsPerPage), p + 1))}
                disabled={currentPage === Math.ceil(filteredAndSortedProducts.length / itemsPerPage)}
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

            {/* Invoice Number and Bukti Faktur */}
            {productOffCanvasMode === 'add' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                    <select
                      name="supplier_id"
                      value={formData.supplier_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Pilih Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  {!isMultipleProducts && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Batch (Opsional)</label>
                      <input
                        type="text"
                        name="invoice_number"
                        value={formData.invoice_number ?? ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="Masukkan nomor batch"
                      />
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bukti Faktur</label>
                  <div className="flex flex-col gap-4 items-start">
                    {/* Image Input UI */}
                    <div className="w-full flex flex-col gap-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => productFileInputRef.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-600"
                        >
                          <UploadCloud size={20} className="text-gray-400" />
                          {productFormImagePreviews.length > 0 ? 'Tambah File' : 'Pilih File'}
                        </button>
                        <button
                          type="button"
                          onClick={() => productCameraInputRef.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-600"
                        >
                          <Camera size={20} className="text-gray-400" />
                          Ambil Foto
                        </button>
                      </div>

                      {/* Hidden File Inputs */}
                      <input
                        type="file"
                        ref={productFileInputRef}
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleProductImageChange}
                      />
                      <input
                        type="file"
                        ref={productCameraInputRef}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleProductImageChange}
                      />
                    </div>

                    {/* Preview */}
                    <div className="flex flex-wrap gap-3">
                      {productFormImagePreviews.map((preview, idx) => (
                        <div key={idx} className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden border-2 border-gray-200 group">
                          <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                setProductFormImageFiles(prev => prev.filter((_, i) => i !== idx));
                                setProductFormImagePreviews(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </div>
                {/* DP Fields (only show if stock type is DP) */}
                {formData.stock_type === 'dp' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </>
            )}

            {/* Render form based on single/multiple */}
            {productOffCanvasMode === 'edit' || !isMultipleProducts ? (
              <React.Fragment>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name <span className="text-red-500">*</span></label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Category</label>
                  <select
                    name="product_category"
                    value={formData.product_category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="OBAT">Obat</option>
                    <option value="NON_OBAT">Non-Obat</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (IDR) <span className="text-red-500">*</span></label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (IDR) <span className="text-red-500">*</span></label>
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
                
                {/* Toggle Satuan Besar */}
                <div className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => setHasPurchaseUnitForm(!hasPurchaseUnitForm)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${hasPurchaseUnitForm ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${hasPurchaseUnitForm ? 'translate-x-5' : ''}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">Memiliki satuan besar?</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Dasar <span className="text-red-500">*</span></label>
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

                  {hasPurchaseUnitForm && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit Satuan Besar <span className="text-red-500">*</span></label>
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
                  )}
                </div>

                {hasPurchaseUnitForm && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Isi per Satuan Besar <span className="text-red-500">*</span></label>
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
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stok (Dalam {formData.unit || 'Tablet'}) <span className="text-red-500">*</span> <span className="text-xs text-gray-400 font-normal">(Unit Dasar)</span>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expired Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    name="expired_date"
                    required
                    value={formData.expired_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </React.Fragment>
            ) : (
              // Multiple Products Section
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-3">Tambahkan Produk</h3>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Nama Produk <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        placeholder="Nama Produk"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Kategori Produk</label>
                      <select
                        name="product_category"
                        value={formData.product_category}
                        onChange={handleInputChange}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="OBAT">Obat</option>
                        <option value="NON_OBAT">Non-Obat</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Kode Lokasi</label>
                      <select
                        name="location_code"
                        value={formData.location_code}
                        onChange={handleInputChange}
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
                      <label className="block text-xs text-gray-600 mb-1">Harga Beli <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        name="cost_price"
                        value={formData.cost_price}
                        onChange={handleInputChange}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Harga Jual <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        name="selling_price"
                        value={formData.selling_price}
                        onChange={handleInputChange}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setHasPurchaseUnitForm(!hasPurchaseUnitForm)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${hasPurchaseUnitForm ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${hasPurchaseUnitForm ? 'translate-x-4' : ''}`} />
                        </button>
                        <span className="text-xs font-medium text-gray-600">Memiliki satuan besar?</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Unit Dasar <span className="text-red-500">*</span></label>
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleInputChange}
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
                    {hasPurchaseUnitForm && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Unit Satuan Besar <span className="text-red-500">*</span></label>
                          <select
                            name="purchase_unit"
                            value={formData.purchase_unit}
                            onChange={handleInputChange}
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
                          <label className="block text-xs text-gray-600 mb-1">Isi per Satuan Besar <span className="text-red-500">*</span></label>
                          <input
                            type="number"
                            name="unit_multiplier"
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
                            name="purchase_unit_stock"
                            value={formData.purchase_unit_stock || ''}
                            onChange={handleInputChange}
                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                            placeholder="0"
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Stock ({formData.unit || 'Tablet'}) <span className="text-red-500">*</span> <span className="text-[10px] text-gray-400 font-normal">(Unit Dasar)</span></label>
                      <input
                        type="number"
                        name="stock"
                        value={formData.stock || ''}
                        onChange={handleInputChange}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                    <label className="block text-xs text-gray-600 mb-1">Tgl Kadaluarsa <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      name="expired_date"
                      required
                      value={formData.expired_date}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Nomor Batch (Opsional)</label>
                    <input
                      type="text"
                      name="invoice_number"
                      value={formData.invoice_number ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      placeholder="Masukkan nomor batch"
                    />
                  </div>
                </div>
                  {/* DP Fields for multiple products */}
                
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
                          selling_price: formData.selling_price || existingItem.selling_price, // Update with latest selling price
                          imageFiles: productFormImageFiles
                        };
                        setMultipleProducts(updatedList);
                      } else {
                        setMultipleProducts([
                          ...multipleProducts,
                          {
                            ...formData,
                            id: Date.now().toString(),
                            imageFiles: productFormImageFiles
                          }
                        ]);
                      }

                      // Reset form for next product
                      setFormData({
                        ...formData,
                        name: '',
                        product_category: 'OBAT',
                        location_code: '',
                        cost_price: '',
                        selling_price: '',
                        stock: '',
                        invoice_number: '',
                        dp_amount: '',
                        due_date: '',
      expired_date: '',
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
                              Kategori: {item.product_category === 'NON_OBAT' ? 'Non-Obat' : 'Obat'} | {formatCurrency(Number(item.cost_price))} | Stok: {item.stock} {item.purchase_unit} (isi: {item.unit_multiplier} {item.unit}) | Batch: {item.invoice_number || '-'} | {(() => {
                                const typeMap: Record<string, string> = {
                                  belum_bayar: 'Belum Bayar',
                                  konsinyasi: 'Konsinyasi',
                                  dp: 'DP',
                                  lunas: 'Lunas',
                                  retur: 'Retur'
                                };
                                return typeMap[item.stock_type] || item.stock_type;
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  name: item.name,
                                  cost_price: item.cost_price,
                                  selling_price: item.selling_price,
                                  stock: item.stock,
                                  unit: item.unit,
                                  expired_date: item.expired_date,
                                  location_code: item.location_code,
                                  supplier_id: item.supplier_id,
                                  stock_type: item.stock_type,
                                  purchase_date: item.purchase_date,
                                  invoice_number: item.invoice_number || '',
                                  dp_amount: item.dp_amount || '',
                                  due_date: item.due_date || '',
                                  purchase_unit: item.purchase_unit,
                                  unit_multiplier: item.unit_multiplier,
                                  purchase_unit_stock: item.purchase_unit_stock || '',
                                  product_category: item.product_category
                                });
                                setMultipleProducts(multipleProducts.filter(p => p.id !== item.id));
                              }}
                              className="text-blue-500 hover:text-blue-700"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMultipleProducts(multipleProducts.filter(p => p.id !== item.id));
                              }}
                              className="text-red-500 hover:text-red-700"
                              title="Hapus"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
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
          onClose={() => {
            setIsFakturOffCanvasOpen(false);
            setShowFakturForm(false);
            setSelectedFaktur(null);
            setFakturFormData({
              invoice_number: '',
              supplier_id: '',
              purchase_date: new Date().toISOString().split('T')[0],
              quantity: '',
              cost_price: '',
              selling_price: '',
              purchase_unit: 'Box',
              unit: 'Tablet',
              unit_multiplier: '1',
              stock_type: 'belum_bayar',
              dp_amount: '',
              due_date: '',
      expired_date: '',
              notes: ''
            });
            setFakturImageFiles([]); setFakturImagePreviews([]);
          }}
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
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Qty Awal</th>
                    <th className="px-4 py-3">Qty Tersisa</th>
                    <th className="px-4 py-3">Qty Terjual</th>
                    <th className="px-4 py-3">Qty Retur</th>
                    <th className="px-4 py-3">Expired Date</th>
                    <th className="px-4 py-3">Harga Beli</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {fakturs.map((faktur) => {
                    const initialQty = faktur.initial_quantity || faktur.quantity;
                    const remainingQty = faktur.remaining_quantity ?? faktur.quantity;
                    const soldQty = initialQty - remainingQty;
                    // Calculate total DP
                    let totalDP = 0;
                    if (faktur.dp_payments) {
                      totalDP = faktur.dp_payments.reduce((sum: number, dp: any) => sum + Number(dp.amount), 0);
                    } else if (faktur.dp_amount) {
                      totalDP = Number(faktur.dp_amount);
                    }
                    const totalAmount = Number(faktur.total_amount) || (faktur.cost_price * (faktur.initial_quantity || faktur.quantity));
                    let statusText = 'Belum Bayar';
                    let canArchive = false;

                    // Respect original stock_type first
                    if (faktur.stock_type === 'lunas') {
                      statusText = 'Lunas';
                      canArchive = true;
                    } else if (faktur.stock_type === 'belum_bayar') {
                      statusText = 'Belum Bayar';
                    } else if (faktur.stock_type === 'konsinyasi') {
                      statusText = 'Konsinyasi';
                    } else if (faktur.stock_type === 'dp') {
                      // Only use DP calculation for stock_type 'dp'
                      if (totalDP >= totalAmount) {
                        statusText = 'Lunas';
                        canArchive = true;
                      } else if (totalDP > 0) {
                        statusText = 'DP';
                      } else {
                        statusText = 'Belum Bayar';
                      }
                    }

                    return (
                      <tr key={faktur.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {faktur.invoice_number}
                          {faktur.notes === 'Expired' && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                <AlertTriangle size={10} /> KADALUARSA
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">{faktur.supplier_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            statusText === 'Lunas'
                              ? 'bg-green-100 text-green-700'
                              : statusText === 'DP'
                              ? 'bg-blue-100 text-blue-700'
                              : statusText === 'Belum Bayar'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {statusText}
                          </span>
                        </td>
                        <td className="px-4 py-3">{faktur.purchase_date ? new Date(faktur.purchase_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            faktur.status === 'approved' 
                              ? 'bg-green-100 text-green-700' 
                              : faktur.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700 animate-pulse'
                              : faktur.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-orange-100 text-orange-700 border border-orange-200'
                          }`}>
                            {faktur.status === 'pending' ? 'Pending Approval' : 
                             faktur.status === 'rejected' ? 'Ditolak' :
                             faktur.status === 'revision' ? 'Menunggu Perbaikan' : 'Approved'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span>{initialQty} {selectedProduct?.unit || 'Tablet'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span>{remainingQty} {selectedProduct?.unit || 'Tablet'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={soldQty > 0 ? 'text-blue-600' : ''}>{soldQty} {selectedProduct?.unit || 'Tablet'}</span>
                        </td>
                        <td className="px-4 py-3">
                          {(faktur.qty_returned ?? 0) > 0 ? (
                            <span className="text-red-600 font-medium">{faktur.qty_returned ?? 0} {selectedProduct?.unit || 'Tablet'}</span>
                          ) : (
                            <span className="text-gray-300">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {faktur.expired_date ? new Date(faktur.expired_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3">{formatCurrency(faktur.cost_price)}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(totalAmount)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {faktur.image_url && getImageUrls(faktur.image_url).length > 0 && (
                              <button
                                onClick={() => {
                                  const urls = getImageUrls(faktur.image_url).map(u => `http://localhost:5000${u}`);
                                  openImagePreview(urls[0], urls);
                                }}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Lihat Bukti"
                              >
                                <FileText size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => setDetailFaktur(faktur)}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                              title="Detail Faktur"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <button
                              onClick={() => handleOpenEditFakturModal(faktur)}
                              className={`p-1 rounded ${faktur.status === 'revision' || faktur.status === 'rejected' ? 'text-orange-600 bg-orange-50 border border-orange-200' : 'text-blue-600 hover:bg-blue-50'}`}
                              title={faktur.status === 'revision' || faktur.status === 'rejected' ? 'Perbaiki' : 'Edit'}
                            >
                              <Edit size={14} />
                            </button>
                            {faktur.status === 'approved' && (
                              <button
                                onClick={() => handleExpireBatch(faktur)}
                                className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                                title="Tandai Kadaluarsa"
                              >
                                <AlertTriangle size={14} />
                              </button>
                            )}
                            {canArchive && (
                              <button
                                onClick={() => handleArchiveFaktur(faktur)}
                                className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                title="Arsipkan Faktur"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              <div className="grid grid-cols-2 md:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Batch (Opsional)</label>
                  <input
                    type="text"
                    name="invoice_number"
                    value={fakturFormData.invoice_number}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Masukkan nomor batch"
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
                    Unit Satuan Besar
                  </label>
                  <select
                    name="purchase_unit"
                    value={fakturFormData.purchase_unit}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                    value={fakturFormData.unit}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Isi per Satuan Besar</label>
                  <input
                    type="number"
                    name="unit_multiplier"
                    min="1"
                    value={fakturFormData.unit_multiplier}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jumlah (dalam {fakturFormData.purchase_unit || 'Box'})
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
                  {Number(fakturFormData.unit_multiplier || 1) > 1 && fakturFormData.quantity && (
                    <p className="text-xs text-blue-600 mt-1">
                      = {Number(fakturFormData.quantity) * Number(fakturFormData.unit_multiplier || 1)} {fakturFormData.unit || 'Tablet'} (total satuan dasar)
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual</label>
                  <input
                    type="number"
                    name="selling_price"
                    value={fakturFormData.selling_price}
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
                
                {/* EXPIRED DATE FOR FAKTUR */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tgl Kadaluarsa</label>
                  <input
                    type="date"
                    name="expired_date"
                    value={fakturFormData.expired_date}
                    onChange={handleFakturInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* DP BERTahap - ONLY IN EDIT MODE */}
                {fakturModalMode === 'edit' && selectedFaktur && selectedFaktur.stock_type === 'dp' && (
                  <div className="col-span-1 sm:col-span-2 md:col-span-3 mt-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <Wallet size={18} /> Ringkasan Pembayaran
                    </h4>

                    {/* Total Faktur */}
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-600">Total Faktur</span>
                      <span className="font-bold text-lg text-gray-900">
                        {formatCurrency(Number(selectedFaktur.total_amount || (selectedFaktur.cost_price * (selectedFaktur.initial_quantity || selectedFaktur.quantity))))}
                      </span>
                    </div>

                    {/* List DP Payments */}
                    {(() => {
                      let dpList: any[] = [];
                      if (selectedFaktur.dp_payments) {
                        dpList = selectedFaktur.dp_payments;
                      } else if (selectedFaktur.dp_amount) {
                        dpList = [{ id: -1, amount: Number(selectedFaktur.dp_amount), payment_date: selectedFaktur.purchase_date }];
                      }

                      return dpList.map((dp, index) => (
                        <div key={dp.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                          <div>
                            <span className="text-gray-600">DP {index + 1}</span>
                            {dp.payment_date && (
                              <span className="text-xs text-gray-400 ml-2">
                                {new Date(dp.payment_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              dp.payment_method === 'transfer' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {dp.payment_method === 'transfer' ? 'TF' : 'Cash'}
                            </span>
                            <span className="font-medium text-blue-700">
                              {formatCurrency(Number(dp.amount))}
                            </span>
                            {dp.id !== -1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDP(dp.id)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ));
                    })()}

                    {/* Total DP */}
                    <div className="flex justify-between items-center py-2 border-t border-gray-300 mt-2">
                      <span className="text-gray-700 font-semibold">Total DP</span>
                      <span className="font-bold text-blue-700">
                        {(() => {
                          let totalDP = 0;
                          if (selectedFaktur.dp_payments) {
                            totalDP = selectedFaktur.dp_payments.reduce((sum: number, dp: any) => sum + Number(dp.amount), 0);
                          } else if (selectedFaktur.dp_amount) {
                            totalDP = Number(selectedFaktur.dp_amount);
                          }
                          return formatCurrency(totalDP);
                        })()}
                      </span>
                    </div>

                    {/* Sisa Hutang */}
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-700 font-semibold">Sisa Hutang</span>
                      <span className={`font-bold ${(() => {
                          const totalAmount = Number(selectedFaktur.total_amount || (selectedFaktur.cost_price * (selectedFaktur.initial_quantity || selectedFaktur.quantity)));
                          let totalDP = 0;
                          if (selectedFaktur.dp_payments) {
                            totalDP = selectedFaktur.dp_payments.reduce((sum: number, dp: any) => sum + Number(dp.amount), 0);
                          } else if (selectedFaktur.dp_amount) {
                            totalDP = Number(selectedFaktur.dp_amount);
                          }
                          const sisa = totalAmount - totalDP;
                          return sisa <= 0 ? 'text-green-700' : 'text-orange-600';
                        })()}`}>
                        {(() => {
                          const totalAmount = Number(selectedFaktur.total_amount || (selectedFaktur.cost_price * (selectedFaktur.initial_quantity || selectedFaktur.quantity)));
                          let totalDP = 0;
                          if (selectedFaktur.dp_payments) {
                            totalDP = selectedFaktur.dp_payments.reduce((sum: number, dp: any) => sum + Number(dp.amount), 0);
                          } else if (selectedFaktur.dp_amount) {
                            totalDP = Number(selectedFaktur.dp_amount);
                          }
                          const sisa = totalAmount - totalDP;
                          return sisa <= 0 ? 'Lunas' : formatCurrency(sisa);
                        })()}
                      </span>
                    </div>

                    {/* Add New DP Button/Form */}
                    {!showAddDPForm ? (
                      <button
                        type="button"
                        onClick={() => setShowAddDPForm(true)}
                        className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        <Plus size={16} /> Tambah DP
                      </button>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah DP</label>
                            <input
                              type="number"
                              value={newDPAmount}
                              onChange={(e) => setNewDPAmount(e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Bayar</label>
                            <input
                              type="date"
                              value={newDPDate}
                              onChange={(e) => setNewDPDate(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                            <select
                              value={newDPPaymentMethod}
                              onChange={(e) => setNewDPPaymentMethod(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="cash">Cash</option>
                              <option value="transfer">Transfer</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setShowAddDPForm(false); setNewDPAmount(''); setNewDPPaymentMethod('cash'); }}
                            className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={handleAddDP}
                            className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Simpan DP
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {fakturFormData.notes && (
                  <div className="col-span-1 sm:col-span-2 md:col-span-3 bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                    <div>
                      <h4 className="text-xs font-extrabold text-orange-800 uppercase tracking-wider">Catatan Perbaikan dari Approver</h4>
                      <p className="text-sm text-orange-700 mt-1 leading-relaxed">{fakturFormData.notes}</p>
                    </div>
                  </div>
                )}
                <div className="col-span-1 sm:col-span-2 md:col-span-3 mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bukti Faktur</label>
                  <div className="flex flex-col gap-4 items-start">
                    {/* Image Input UI */}
                    <div className="w-full flex flex-col gap-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fakturFileInputRef.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-600"
                        >
                          <UploadCloud size={20} className="text-gray-400" />
                          {fakturImagePreviews.length > 0 ? 'Tambah File' : 'Pilih File'}
                        </button>
                        <button
                          type="button"
                          onClick={() => fakturCameraInputRef.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-600"
                        >
                          <Camera size={20} className="text-gray-400" />
                          Ambil Foto
                        </button>
                      </div>

                      {/* Hidden File Inputs */}
                      <input
                        type="file"
                        ref={fakturFileInputRef}
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFakturImageChange}
                      />
                      <input
                        type="file"
                        ref={fakturCameraInputRef}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFakturImageChange}
                      />
                    </div>

                    {/* Preview */}
                    <div className="flex flex-wrap gap-3">
                      {fakturImagePreviews.map((preview, idx) => (
                        <div key={idx} className="relative w-32 h-32 shrink-0 rounded-xl overflow-hidden border-2 border-gray-200 group">
                          <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => removeFakturImage(idx)}
                              className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                      selling_price: '',
                      purchase_unit: 'Box',
                      unit: 'Tablet',
                      unit_multiplier: '1',
                      stock_type: 'belum_bayar',
                      dp_amount: '',
                      due_date: '',
      expired_date: '',
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

      {/* Approval Modal */}
      {isApprovalModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-2 sm:p-4" 
          onClick={() => setIsApprovalModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-full sm:max-w-5xl max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <CheckCircle className="text-yellow-600" size={24} />
                  Approval Faktur Pembelian
                </h3>
                <p className="text-sm text-gray-500 mt-1">Daftar faktur yang memerlukan persetujuan nominal {'>'} Rp 2.000.000</p>
              </div>
              <button 
                onClick={() => setIsApprovalModalOpen(false)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-full transition-all border border-transparent hover:border-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-auto custom-scrollbar">
              {isFetchingPending ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="text-gray-500 font-medium">Memuat data approval...</p>
                </div>
              ) : pendingFakturs.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-16 text-center border-2 border-dashed border-gray-200">
                  <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="text-green-600" size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Semua Beres!</h3>
                  <p className="text-gray-500 max-w-xs mx-auto">Tidak ada faktur yang menunggu persetujuan saat ini.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4 min-w-0 overflow-x-auto">
                  {pendingFakturs.map((faktur) => (
                    <div key={faktur.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group relative">
                      {faktur.status === 'rejected' && (
                        <button 
                          onClick={() => handleDeleteFaktur(faktur)}
                          className="absolute top-4 right-4 p-2 text-red-500 hover:text-white bg-red-50 hover:bg-red-600 rounded-lg border border-red-200 hover:border-red-600 transition-all shadow-sm hover:scale-105 duration-200 z-10"
                          title="Hapus Faktur Ditolak"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <div className="p-5">
                        <div className="flex flex-row justify-between items-center gap-5">
                          {/* Product Info */}
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start gap-4">
                              <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 shrink-0 group-hover:bg-blue-100 transition-colors">
                                <Package size={22} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-base font-bold text-gray-900">{faktur.product_name}</h4>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                    faktur.status === 'pending' 
                                      ? 'bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse' 
                                      : faktur.status === 'rejected'
                                      ? 'bg-red-100 text-red-700 border-red-200'
                                      : 'bg-orange-100 text-orange-700 border-orange-200'
                                  }`}>
                                    {faktur.status === 'pending' ? 'Pending Approval' : faktur.status === 'rejected' ? 'Ditolak' : 'Menunggu Perbaikan'}
                                  </span>
                                  {faktur.product_status === 'pending' && (
                                    <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-purple-200">
                                      Produk Baru
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 font-medium">ID: #{faktur.product_id} | Batch: {faktur.invoice_number || '-'}</p>
                              </div>
                            </div>

                            {faktur.notes && (
                              <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex items-start gap-3">
                                <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-[11px] font-bold text-orange-800 uppercase tracking-wider">Catatan Perbaikan:</p>
                                  <p className="text-sm text-orange-700 mt-0.5 leading-relaxed">{faktur.notes}</p>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                              <div className="flex items-center gap-2 text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">
                                <Users size={14} className="text-gray-400" />
                                <span className="truncate">{faktur.supplier_name || 'Tanpa Supplier'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">
                                <Calendar size={14} className="text-gray-400" />
                                <span>{faktur.purchase_date ? new Date(faktur.purchase_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">
                                <Info size={14} className="text-gray-400" />
                                <span className="capitalize">{faktur.stock_type.replace('_', ' ')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Financial Info */}
                          <div className="w-56 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 flex flex-col justify-center gap-1.5 shrink-0">
                            <div className="flex justify-between text-[13px]">
                              <span className="text-gray-500">Jumlah:</span>
                              <span className="font-bold text-gray-900">
                                {faktur.quantity / (faktur.product_unit_multiplier || 1)} {faktur.product_purchase_unit}
                              </span>
                            </div>
                            <div className="flex justify-between text-[13px]">
                              <span className="text-gray-500">Harga:</span>
                              <span className="font-bold text-gray-900">{formatCurrency(faktur.cost_price)}</span>
                            </div>
                            <div className="pt-2 mt-1 border-t border-blue-200/50 flex justify-between items-center">
                              <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest">Total</span>
                              <span className="text-lg font-black text-blue-700">{formatCurrency(faktur.cost_price * faktur.quantity)}</span>
                            </div>
                          </div>

                          {/* Bukti & Edit Button */}
                          <div className={`flex flex-col gap-2 shrink-0 ${faktur.status === 'rejected' ? 'pr-8' : ''}`}>
                            {faktur.image_url && getImageUrls(faktur.image_url).length > 0 && (
                              <button 
                                onClick={() => {
                                  const urls = getImageUrls(faktur.image_url).map(u => `http://localhost:5000${u}`);
                                  openImagePreview(urls[0], urls);
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all text-xs font-bold border border-blue-100"
                              >
                                <FileText size={18} />
                                Lihat Bukti
                              </button>
                            )}
                            {faktur.status === 'revision' && (
                              <button 
                                onClick={() => {
                                  // Mock a product object for handleOpenEditFakturModal
                                  const mockProduct = allProducts.find(p => p.id === faktur.product_id) || {
                                    id: faktur.product_id,
                                    name: faktur.product_name || '',
                                    cost_price: faktur.cost_price || 0,
                                    selling_price: 0,
                                    stock: 0,
                                    unit: faktur.product_unit || 'Tablet',
                                    expired_date: null,
                                    location_code: '',
                                    supplier_id: faktur.supplier_id || null,
                                    supplier_name: faktur.supplier_name || null,
                                    stock_type: faktur.stock_type as any || 'belum_bayar',
                                    purchase_date: faktur.purchase_date || null,
                                    purchase_unit: faktur.product_purchase_unit || 'Box',
                                    unit_multiplier: faktur.product_unit_multiplier || 1
                                  } as Product;
                                  
                                  setSelectedProduct(mockProduct);
                                  fetchFakturs(mockProduct.id);
                                  handleOpenEditFakturModal(faktur, mockProduct);
                                  setIsApprovalModalOpen(false);
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-all text-xs font-bold border border-orange-100"
                              >
                                <Edit size={18} />
                                Perbaiki Data
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0 flex justify-between items-center">
              <p className="text-xs text-gray-400 italic font-medium">*Approval hanya dapat dilakukan di halaman khusus Approval Faktur.</p>
              <div className="flex gap-3">
                <Link 
                  href="/approvals"
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-sm"
                >
                  Ke Halaman Approval
                </Link>
                <button 
                  onClick={() => setIsApprovalModalOpen(false)}
                  className="px-6 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Produk Modal */}
      {detailProduct && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-2 sm:p-4" 
          onClick={() => setDetailProduct(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-full sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Detail Produk
              </h3>
              <button 
                onClick={() => setDetailProduct(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Nama & Kategori */}
              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-xs text-blue-500 font-medium uppercase tracking-wider">Nama Produk</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{detailProduct.name}</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold mt-2 ${detailProduct.product_category === 'NON_OBAT' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {detailProduct.product_category === 'NON_OBAT' ? 'Non-Obat' : 'Obat'}
                </span>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Harga Beli</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(detailProduct.cost_price)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Harga Jual</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(detailProduct.selling_price)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Stok (Unit Dasar)</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{detailProduct.stock} {detailProduct.unit || 'Tablet'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tipe Stok</p>
                  <p className="text-sm font-bold text-gray-900 mt-1 capitalize">{detailProduct.stock_type?.replace(/_/g, ' ') || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Supplier</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{detailProduct.supplier_name || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Kode Lokasi</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{detailProduct.location_code || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Expired Date</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{detailProduct.expired_date ? new Date(detailProduct.expired_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                </div>
              </div>

              {/* Satuan Besar Info */}
              {(detailProduct.purchase_unit || detailProduct.unit_multiplier) && (
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl">
                  <p className="text-xs text-purple-600 font-medium uppercase tracking-wider mb-2">Informasi Satuan Besar</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-700">Unit Pembelian</span>
                      <span className="font-bold text-purple-900">{detailProduct.purchase_unit || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-700">Isi per Unit</span>
                      <span className="font-bold text-purple-900">{detailProduct.unit_multiplier || 1} {detailProduct.unit || 'Tablet'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-700">Stok (Dalam {detailProduct.purchase_unit || 'Box'})</span>
                      <span className="font-bold text-purple-900">{detailProduct.stock ? Math.floor(detailProduct.stock / (detailProduct.unit_multiplier || 1)) : 0} {detailProduct.purchase_unit || 'Box'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setDetailProduct(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Faktur Modal */}
      {detailFaktur && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-2 sm:p-4" 
          onClick={() => setDetailFaktur(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Detail Faktur
              </h3>
              <button 
                onClick={() => setDetailFaktur(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Info Umum */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Nomor Batch</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{detailFaktur.invoice_number || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Supplier</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{detailFaktur.supplier_name || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tipe Stok</p>
                  <p className="text-sm font-bold text-gray-900 mt-1 capitalize">{detailFaktur.stock_type?.replace(/_/g, ' ') || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Status</p>
                  <p className="text-sm font-bold text-gray-900 mt-1 capitalize">{detailFaktur.status || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tgl Pembelian</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{detailFaktur.purchase_date ? new Date(detailFaktur.purchase_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tgl Kadaluarsa</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{detailFaktur.expired_date ? new Date(detailFaktur.expired_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Qty Awal</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{detailFaktur.initial_quantity || detailFaktur.quantity} {selectedProduct?.unit || 'Tablet'}</p>
                </div>
                {selectedProduct?.purchase_unit && selectedProduct?.unit_multiplier && selectedProduct.unit_multiplier > 1 && (
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Qty Awal ({selectedProduct.purchase_unit})</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{Math.floor((detailFaktur.initial_quantity || detailFaktur.quantity) / selectedProduct.unit_multiplier)} {selectedProduct.purchase_unit}</p>
                  </div>
                )}
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Qty Tersisa</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{detailFaktur.remaining_quantity ?? detailFaktur.quantity} {selectedProduct?.unit || 'Tablet'}</p>
                </div>
                {selectedProduct?.purchase_unit && selectedProduct?.unit_multiplier && selectedProduct.unit_multiplier > 1 && (
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Qty Tersisa ({selectedProduct.purchase_unit})</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{Math.floor((detailFaktur.remaining_quantity ?? detailFaktur.quantity) / selectedProduct.unit_multiplier)} {selectedProduct.purchase_unit}</p>
                  </div>
                )}
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Harga Beli</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(detailFaktur.cost_price)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Amount</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(Number(detailFaktur.total_amount) || (detailFaktur.cost_price * (detailFaktur.initial_quantity || detailFaktur.quantity)))}</p>
                </div>
              </div>

              {/* Dibuat Oleh */}
              {(detailFaktur as any).created_by_username && (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Dibuat Oleh</p>
                  <p className="text-sm font-bold text-blue-800 mt-1">
                    {(detailFaktur as any).created_by_username}
                    <span className="text-blue-500 font-normal ml-2">({(detailFaktur as any).created_by_role || '-'})</span>
                  </p>
                </div>
              )}

              {/* Catatan */}
              {detailFaktur.notes && (
                <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl">
                  <p className="text-xs text-orange-600 font-medium uppercase tracking-wider">Catatan</p>
                  <p className="text-sm text-orange-800 mt-1">{detailFaktur.notes}</p>
                </div>
              )}

              {/* DP Payments */}
              {detailFaktur.stock_type === 'dp' && (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    Riwayat Pembayaran DP
                  </h4>
                  <div className="space-y-2">
                    {(detailFaktur.dp_payments && detailFaktur.dp_payments.length > 0 ? detailFaktur.dp_payments : 
                      detailFaktur.dp_amount ? [{ id: -1, amount: detailFaktur.dp_amount, payment_date: detailFaktur.purchase_date, payment_method: 'cash' }] : []
                    ).map((dp: any, i: number) => (
                      <div key={dp.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-gray-800">DP {i + 1}</p>
                          <p className="text-xs text-gray-500">{dp.payment_date ? new Date(dp.payment_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${dp.payment_method === 'transfer' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                            {dp.payment_method === 'transfer' ? 'TF' : 'Cash'}
                          </span>
                          <span className="text-sm font-bold text-blue-700">{formatCurrency(Number(dp.amount))}</span>
                        </div>
                      </div>
                    ))}
                    {(!detailFaktur.dp_payments || detailFaktur.dp_payments.length === 0) && !detailFaktur.dp_amount && (
                      <p className="text-sm text-gray-400 italic">Belum ada pembayaran DP</p>
                    )}
                  </div>
                </div>
              )}

              {/* Bukti Faktur */}
              {detailFaktur.image_url && getImageUrls(detailFaktur.image_url).length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Bukti Faktur ({getImageUrls(detailFaktur.image_url).length})</h4>
                  <div className="flex flex-wrap gap-3">
                    {(() => {
                      const urls = getImageUrls(detailFaktur.image_url).map((u: string) => `http://localhost:5000${u}`);
                      return urls.map((fullUrl: string, idx: number) => (
                      <div key={idx} className="relative inline-block group">
                        <img 
                          src={fullUrl} 
                          alt={`Bukti Faktur ${idx + 1}`} 
                          className="w-40 h-32 object-cover rounded-xl border border-gray-200 cursor-pointer"
                          onClick={() => openImagePreview(fullUrl, urls)}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center gap-2">
                          <button
                            onClick={() => openImagePreview(fullUrl, urls)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white/90 rounded-full shadow-md hover:bg-white"
                            title="Perbesar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                          </button>
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = fullUrl;
                              link.download = `bukti_faktur_${idx + 1}.jpg`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white/90 rounded-full shadow-md hover:bg-white"
                            title="Download"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </button>
                        </div>
                      </div>
                    ));
                  })()}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setDetailFaktur(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-2 sm:p-4 md:p-8" 
          onClick={() => { setPreviewImageUrl(null); setPreviewImageList([]); }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-full sm:max-w-4xl max-h-full overflow-hidden flex flex-col" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">Bukti Faktur {previewImageList.length > 1 ? `(${previewImageIndex + 1}/${previewImageList.length})` : ''}</h3>
              <button 
                 onClick={() => { setPreviewImageUrl(null); setPreviewImageList([]); }} 
                 className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
               >
                 <X size={20} />
               </button>
            </div>
            <div className="p-4 flex-1 overflow-auto bg-gray-50 flex items-center justify-center min-h-0 relative">
              {previewImageList.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      const newIdx = previewImageIndex > 0 ? previewImageIndex - 1 : previewImageList.length - 1;
                      setPreviewImageIndex(newIdx);
                      setPreviewImageUrl(previewImageList[newIdx]);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md z-10 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button
                    onClick={() => {
                      const newIdx = previewImageIndex < previewImageList.length - 1 ? previewImageIndex + 1 : 0;
                      setPreviewImageIndex(newIdx);
                      setPreviewImageUrl(previewImageList[newIdx]);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md z-10 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </>
              )}
              <img 
                src={previewImageUrl} 
                alt="Bukti Faktur" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-sm" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
