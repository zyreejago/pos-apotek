'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Edit, Trash2, Eye, FileText, ShoppingBag } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import ConfirmModal from '@/components/ConfirmModal';
import OffCanvas from '@/components/OffCanvas';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import PageHeader from '@/components/PageHeader';

interface Supplier {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  address: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SupplierFormData {
  name: string;
  contact_person: string;
  phone: string;
  address: string;
}

export default function SuppliersPage() {
  const router = useRouter();
  // Permission Check
  const { checkActionPermission } = useRequirePermission('Suppliers');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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

  // OffCanvas States
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [offCanvasMode, setOffCanvasMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [supplierDetails, setSupplierDetails] = useState<any>(null);
  const [expandedFaktur, setExpandedFaktur] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIdx, setPreviewImageIdx] = useState(0);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger' as 'danger' | 'warning' | 'info'
  });

  // Form State
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    contact_person: '',
    phone: '',
    address: ''
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = useMemo<Record<string, string>>(() => {
    if (!token) return {} as Record<string, string>;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/suppliers?page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}`, {
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
      setSuppliers(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchQuery, authHeaders, router]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchSuppliers();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, currentPage, fetchSuppliers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openAddOffCanvas = () => {
    setOffCanvasMode('add');
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      address: ''
    });
    setIsOffCanvasOpen(true);
  };

  const openEditOffCanvas = (supplier: Supplier) => {
    setOffCanvasMode('edit');
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      address: supplier.address || ''
    });
    setIsOffCanvasOpen(true);
  };

  const openViewOffCanvas = async (supplier: Supplier) => {
    setOffCanvasMode('view');
    setSelectedSupplier(supplier);
    setIsOffCanvasOpen(true);
    
    try {
      const res = await fetch(`http://localhost:5000/api/suppliers/${supplier.id}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Supplier details:', data); // Debug log
        setSupplierDetails(data);
      }
    } catch (error) {
      console.error('Error fetching supplier details:', error);
    }
  };

  const openDeleteModal = (supplier: Supplier) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Supplier',
      message: `Are you sure you want to delete ${supplier.name}? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await handleDelete(supplier);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Permission check
    if (offCanvasMode === 'add' && !checkActionPermission('create')) {
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk menambahkan supplier baru."
        });
        return;
    }
    if (offCanvasMode === 'edit' && !checkActionPermission('edit')) {
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk mengubah data supplier ini."
        });
        return;
    }

    try {
      const url = offCanvasMode === 'add' 
        ? 'http://localhost:5000/api/suppliers' 
        : `http://localhost:5000/api/suppliers/${selectedSupplier?.id}`;
      
      const method = offCanvasMode === 'add' ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsOffCanvasOpen(false);
        fetchSuppliers();
        goeyToast.success(`Supplier berhasil ${offCanvasMode === 'add' ? 'ditambahkan' : 'diperbarui'}`, {
          description: `Data supplier "${formData.name}" ${formData.contact_person ? `(CP: ${formData.contact_person})` : ''} telah berhasil ${offCanvasMode === 'add' ? 'disimpan ke dalam sistem' : 'diperbarui'}.`
        });
      } else {
        goeyToast.error(offCanvasMode === 'add' ? 'Gagal Menambah Supplier' : 'Gagal Memperbarui Supplier', {
            description: "Terjadi kesalahan saat menyimpan data. Silakan periksa kembali input Anda."
        });
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
      goeyToast.error('Terjadi kesalahan sistem', {
          description: "Gagal terhubung ke server. Silakan coba lagi."
      });
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    // Permission check
    if (!checkActionPermission('delete')) {
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk menghapus supplier."
        });
        return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/suppliers/${supplier.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });

      if (res.ok) {
        fetchSuppliers();
        goeyToast.success('Supplier Berhasil Dihapus', {
          description: `Supplier "${supplier.name}" telah dihapus permanen dari sistem.`
        });
      } else {
        goeyToast.error('Gagal Menghapus Supplier', {
            description: "Terjadi kesalahan saat mencoba menghapus data supplier."
        });
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      goeyToast.error('Terjadi kesalahan sistem', {
          description: "Gagal terhubung ke server. Silakan coba lagi."
      });
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <PageHeader 
        title="Supplier"
        subtitle="Management Supplier"
        breadcrumbs={[{ label: 'Supplier' }, { label: 'Management Supplier' }]}
       
      />

      <div className="p-3 sm:p-4 md:p-8 pt-0">
      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="w-full md:w-auto flex items-center gap-3">
                {/* Checkbox placeholder */}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                    type="text" 
                    placeholder="Search Supplier" 
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                
                {checkActionPermission('create') && (
                <button 
                    onClick={openAddOffCanvas}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm shadow-blue-200"
                >
                    Add Supplier
                </button>
                )}
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50 text-gray-500 font-medium text-sm">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-4 text-left">Name</th>
                <th className="px-3 sm:px-6 py-2 sm:py-4 text-left">Phone</th>
                <th className="px-3 sm:px-6 py-2 sm:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 sm:px-6 py-4 sm:py-8 text-center text-gray-500">
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 sm:px-6 py-4 sm:py-8 text-center text-gray-500">
                    No suppliers found
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-3 sm:px-6 py-2 sm:py-4">
                      <div className="font-medium text-gray-900">{supplier.name}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-600">{supplier.phone || '-'}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-right">
                      <div className="flex justify-end gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openViewOffCanvas(supplier)}
                          className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {checkActionPermission('edit') && (
                          <button 
                            onClick={() => openEditOffCanvas(supplier)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {checkActionPermission('delete') && (
                          <button 
                            onClick={() => openDeleteModal(supplier)}
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

      {/* Add/Edit OffCanvas */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => setIsOffCanvasOpen(false)}
        title={offCanvasMode === 'add' ? 'Add Supplier' : offCanvasMode === 'edit' ? 'Edit Supplier' : 'Supplier Details'}
      >
        {offCanvasMode === 'view' ? (
          <div className="space-y-6">
            {supplierDetails && (
              <>
                {/* Supplier Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">{supplierDetails.supplier.name}</h3>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Contact Person:</span> {supplierDetails.supplier.contact_person || '-'}
                  </p>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Phone:</span> {supplierDetails.supplier.phone || '-'}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Address:</span> {supplierDetails.supplier.address || '-'}
                  </p>
                </div>

                {/* Products List */}
                {/* <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <ShoppingBag size={20} className="text-blue-600" />
                    Products from This Supplier
                  </h3>
                  {supplierDetails.products && supplierDetails.products.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {supplierDetails.products.map((product: any) => (
                        <div key={product.id} className="border border-gray-200 p-3 rounded-lg flex justify-between items-center">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-gray-500">Stock: {product.stock} {product.unit}</p>
                          </div>
                          <p className="font-medium text-blue-600">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(product.selling_price)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No products from this supplier yet.</p>
                  )}
                </div> */}

                {/* Faktur (grouped by invoice_number) */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <FileText size={20} className="text-purple-600" />
                    Bukti Faktur Pembelian 
                  </h3>
                  {/* eslint-disable @typescript-eslint/no-explicit-any */}
                  {(() => {
                    const batches = supplierDetails.batches || [];
                    if (batches.length === 0) return <p className="text-gray-500 italic">Belum ada bukti faktur pembelian dari supplier ini.</p>;

                    const grouped: Record<string, any[]> = {};
                    for (const b of batches) {
                      const key = b.invoice_number || '__NO_INVOICE__';
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(b);
                    }

                    const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
                    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID') : '-';

                    const renderBatchDetail = (batch: any, fakturImages: string[]) => (
                      <div key={batch.id} className="border border-gray-100 bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-medium text-sm">{batch.product_name}</p>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            batch.status === 'approved' ? 'bg-green-100 text-green-700' : 
                            batch.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                            batch.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {batch.status === 'approved' ? 'Disetujui' : 
                             batch.status === 'pending' ? 'Menunggu' : 
                             batch.status === 'rejected' ? 'Ditolak' : 'Revisi'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600 mt-1">
                          <span>Pembelian: {formatDate(batch.purchase_date)}</span>
                          {batch.expired_date && <span>Exp: {formatDate(batch.expired_date)}</span>}
                          <span>Stok masuk: <strong>{batch.initial_quantity}</strong></span>
                          <span>Sisa: <strong>{batch.remaining_quantity}</strong></span>
                          <span>Harga: {formatIDR(batch.cost_price)}</span>
                          <span>Total: {formatIDR(batch.cost_price * batch.initial_quantity)}</span>
                          <span className="col-span-2">
                            Bayar: <span className={`font-medium ${
                              batch.stock_type === 'lunas' ? 'text-green-600' : 
                              batch.stock_type === 'dp' || batch.stock_type === 'DP' ? 'text-yellow-600' :
                              batch.stock_type === 'consignment' || batch.stock_type === 'konsinyasi' ? 'text-blue-600' :
                              batch.stock_type === 'retur' ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {batch.stock_type === 'lunas' ? 'Lunas' : 
                               batch.stock_type === 'dp' || batch.stock_type === 'DP' ? 'DP' : 
                               batch.stock_type === 'consignment' || batch.stock_type === 'konsinyasi' ? 'Konsinyasi' : 
                               batch.stock_type === 'retur' ? 'Retur' : 'Belum Lunas'}
                            </span>
                          </span>
                        </div>
                        {(() => {
                          let dpList: any[] = [];
                          if (batch.dp_payments?.length > 0) dpList = batch.dp_payments;
                          else if (batch.dp_amount) dpList = [{ id: -1, amount: batch.dp_amount, payment_date: batch.purchase_date }];
                          if (dpList.length > 0) {
                            const totalDp = dpList.reduce((s: number, d: any) => s + Number(d.amount), 0);
                            const remaining = (batch.cost_price * batch.initial_quantity) - totalDp;
                            return (
                              <div className="border-t border-gray-200 pt-1.5 mt-1.5 space-y-0.5">
                                {dpList.map((dp: any, idx: number) => (
                                  <div key={dp.id} className="text-xs">
                                    <span className="text-yellow-600 font-medium">DP {idx + 1}:</span>
                                    <span className={`ml-1 text-[10px] px-1 py-0.5 rounded ${dp.payment_method === 'transfer' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                      {dp.payment_method === 'transfer' ? 'TF' : 'Cash'}
                                    </span>
                                    <span className="text-blue-600 font-semibold ml-1">{formatIDR(dp.amount)}</span>
                                    {dp.payment_date && <span className="text-gray-400 ml-1">({formatDate(dp.payment_date)})</span>}
                                  </div>
                                ))}
                                {remaining > 0 ? <div className="text-xs text-orange-600 font-medium">Sisa hutang: {formatIDR(remaining)}</div> : totalDp > 0 ? <div className="text-xs text-green-600 font-medium">Lunas</div> : null}
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {batch.notes && <p className="text-xs text-gray-400 italic mt-1">{batch.notes}</p>}
                        {batch.image_url && (
                          <div className="mt-2">
                            <img src={`http://localhost:5000${batch.image_url}`} alt="Bukti"
                              className="h-20 w-auto object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                const idx = fakturImages.indexOf(`http://localhost:5000${batch.image_url}`);
                                setPreviewImageIdx(idx >= 0 ? idx : 0);
                                setPreviewImages(fakturImages);
                              }} />
                          </div>
                        )}
                      </div>
                    );

                    const renderFakturCard = (invoiceNumber: string, items: any[]) => {
                      const totalQty = items.reduce((s, b) => s + Number(b.initial_quantity), 0);
                      const totalCost = items.reduce((s, b) => s + Number(b.cost_price) * Number(b.initial_quantity), 0);
                      const fakturImages = items.map(b => b.image_url ? `http://localhost:5000${b.image_url}` : '').filter(Boolean);
                      const statusCounts: Record<string, number> = {};
                      items.forEach(b => { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1; });
                      const isExpanded = expandedFaktur === invoiceNumber;
                      const displayLabel = invoiceNumber === '__NO_INVOICE__' ? 'Tanpa No. Faktur' : invoiceNumber;

                      return (
                        <div key={invoiceNumber} className="border border-purple-200 rounded-xl overflow-hidden">
                          <button onClick={() => setExpandedFaktur(isExpanded ? null : invoiceNumber)}
                            className="w-full flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 transition-colors text-left">
                            <FileText size={18} className="text-purple-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-800">{displayLabel}</p>
                              <p className="text-xs text-gray-500">{items.length} produk · Total {totalQty} pcs · {formatIDR(totalCost)}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {Object.entries(statusCounts).map(([s, c]) => (
                                <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  s === 'approved' ? 'bg-green-100 text-green-700' :
                                  s === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                  s === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                }`}>{c} {s === 'approved' ? '✓' : s === 'pending' ? '⏳' : s === 'rejected' ? '✗' : '?'}</span>
                              ))}
                            </div>
                            <svg className={`w-4 h-4 text-purple-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                          {isExpanded && (
                            <div className="p-3 space-y-2 bg-white border-t border-purple-100">
                              {items.map(b => renderBatchDetail(b, fakturImages))}
                            </div>
                          )}
                        </div>
                      );
                    };

                    const fakturKeys = Object.keys(grouped);
                    const hasInvoiceSection = fakturKeys.some(k => k !== '__NO_INVOICE__');
                    const noInvoiceItems = grouped['__NO_INVOICE__'] || [];

                    return (
                      <div className="space-y-3">
                        {fakturKeys.filter(k => k !== '__NO_INVOICE__').sort().map(k => renderFakturCard(k, grouped[k]))}
                        {hasInvoiceSection && noInvoiceItems.length > 0 && <hr className="my-2" />}
                        {noInvoiceItems.length > 0 && renderFakturCard('__NO_INVOICE__', noInvoiceItems)}
                      </div>
                    );
                  })()}
                </div>

                {/* Purchases List */}
                {/* <div className="mt-6">
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <FileText size={20} className="text-green-600" />
                    Purchase Invoices
                  </h3>
                  {supplierDetails.purchases && supplierDetails.purchases.length > 0 ? (
                    <div className="space-y-3">
                      {supplierDetails.purchases.map((purchase: any) => (
                        <div key={purchase.id} className="border border-gray-200 p-4 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <p className="font-medium">Invoice #{purchase.id}</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              purchase.payment_status === 'lunas' ? 'bg-green-100 text-green-700' : 
                              purchase.payment_status === 'dp' ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {purchase.payment_status === 'lunas' ? 'Lunas' : 
                               purchase.payment_status === 'dp' ? 'DP' : 
                               purchase.payment_status === 'cicilan' ? 'Cicilan' : 'Belum Lunas'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mb-2">
                            Date: {new Date(purchase.created_at).toLocaleDateString('id-ID')}
                          </p>
                          {purchase.due_date && (
                            <p className="text-sm text-orange-600 mb-2">
                              Due Date: {new Date(purchase.due_date).toLocaleDateString('id-ID')}
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
                            <div>
                              <span className="text-gray-500">Total:</span>
                              <span className="ml-1 font-medium">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(purchase.total_amount)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">DP:</span>
                              <span className="ml-1 font-medium">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(purchase.down_payment || 0)}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-500">Remaining Debt:</span>
                              <span className={`ml-1 font-medium ${purchase.remaining_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(purchase.remaining_debt || 0)}
                              </span>
                            </div>
                          </div>
                          
                          {purchase.items && purchase.items.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-sm font-medium mb-2">Items:</p>
                              <div className="space-y-1">
                                {purchase.items.map((item: any) => (
                                  <div key={item.id} className="flex justify-between text-sm">
                                    <span>{item.product_name} x {item.quantity}</span>
                                    <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.cost_price * item.quantity)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {purchase.payments && purchase.payments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-sm font-medium mb-2">Payment History:</p>
                              <div className="space-y-2">
                                {purchase.payments.map((payment: any) => (
                                  <div key={payment.id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                                    <div>
                                      <p className="font-medium">{new Date(payment.payment_date).toLocaleDateString('id-ID')}</p>
                                      <p className="text-gray-500">{payment.payment_method}</p>
                                    </div>
                                    <p className="font-medium text-green-600">
                                      +{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(payment.amount)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No purchases from this supplier yet.</p>
                  )}
                </div> */}
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
              <input 
                type="text" 
                name="name"
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. PT. Sumber Makmur"
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input 
                type="text" 
                name="contact_person"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. John Doe"
                value={formData.contact_person}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input 
                type="text" 
                name="phone"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 08123456789"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea 
                name="address"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Jl. Sudirman No. 1"
                rows={3}
                value={formData.address}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                type="button"
                onClick={() => setIsOffCanvasOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
              >
                {offCanvasMode === 'add' ? 'Add Supplier' : 'Save Changes'}
              </button>
            </div>
          </form>
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

      {/* Image Preview Modal */}
      {previewImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setPreviewImages([]); setPreviewImageIdx(0); }}>
          <div className="relative max-w-2xl w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setPreviewImages([]); setPreviewImageIdx(0); }}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 z-10">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            {previewImages.length > 1 && (
              <>
                <button onClick={() => setPreviewImageIdx(i => (i - 1 + previewImages.length) % previewImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full shadow-lg flex items-center justify-center z-10">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => setPreviewImageIdx(i => (i + 1) % previewImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full shadow-lg flex items-center justify-center z-10">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                  {previewImageIdx + 1} / {previewImages.length}
                </div>
              </>
            )}
            <img src={previewImages[previewImageIdx]} alt="Preview" className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}