'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileText, Info, Package, Users, Calendar, ArrowUpDown, Filter } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import PageHeader from '@/components/PageHeader';
import { useRequirePermission } from '@/hooks/useRequirePermission';

interface HistoryFaktur {
  id: number;
  product_id: number;
  product_name: string;
  batch_number: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  purchase_date: string | null;
  initial_quantity: number;
  cost_price: number;
  stock_type: string;
  dp_amount: number | null;
  due_date: string | null;
  image_url: string | null;
  status: string;
  is_archived: number;
  notes: string | null;
  created_at: string;
}

export default function PurchaseHistoryPage() {
  const { checkActionPermission } = useRequirePermission('Riwayat Pembelian');
  const [fakturs, setFakturs] = useState<HistoryFaktur[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // Sorting and Filtering
  const [sortField, setSortField] = useState<keyof HistoryFaktur>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`
  }), [token]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/inventory/history', {
        headers: authHeaders
      });
      if (res.ok) {
        const json = await res.json();
        setFakturs(json.data || []);
      } else {
        goeyToast.error('Gagal memuat riwayat pembelian');
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      goeyToast.error('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSort = (field: keyof HistoryFaktur) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const filteredAndSortedFakturs = useMemo(() => {
    let result = [...fakturs];

    // Filter Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f => 
        (f.product_name?.toLowerCase().includes(query)) ||
        (f.supplier_name?.toLowerCase().includes(query)) ||
        (f.batch_number?.toLowerCase().includes(query))
      );
    }

    // Filter Status
    if (statusFilter === 'archived') {
      result = result.filter(f => f.is_archived === 1);
    } else if (statusFilter === 'active') {
      result = result.filter(f => f.is_archived === 0);
    } else if (statusFilter !== 'all') {
      // For specific approval statuses (approved, pending, etc) we only want non-archived ones usually, 
      // or we can just filter by status directly
      result = result.filter(f => f.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle nulls
      if (valA === null) valA = '';
      if (valB === null) valB = '';

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
  }, [fakturs, searchQuery, sortField, sortDirection, statusFilter]);

  const SortableHeader = ({ field, label }: { field: keyof HistoryFaktur, label: string }) => (
    <th 
      className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        <ArrowUpDown size={14} className={`text-gray-400 ${sortField === field ? 'text-blue-500' : ''}`} />
      </div>
    </th>
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      <PageHeader 
        title="Riwayat Pembelian" 
        subtitle="Lihat semua riwayat pembelian, faktur, dan stok masuk."
      />

      <div className="p-8 pt-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari produk, supplier, batch..." 
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg">
                <Filter size={16} className="text-gray-400" />
                <select 
                  className="bg-transparent border-none focus:outline-none cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Semua Aktif</option>
                  <option value="archived">Diarsipkan</option>
                  <option value="approved">Disetujui</option>
                  <option value="pending">Menunggu</option>
                  <option value="revision">Revisi</option>
                  <option value="rejected">Ditolak</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                <tr>
                  <SortableHeader field="created_at" label="Tanggal" />
                  <SortableHeader field="product_name" label="Produk" />
                  <SortableHeader field="supplier_name" label="Supplier" />
                  <SortableHeader field="cost_price" label="Total Harga" />
                  <SortableHeader field="status" label="Status" />
                  <th className="px-6 py-4 text-center">Bukti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Loading riwayat pembelian...
                    </td>
                  </tr>
                ) : filteredAndSortedFakturs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <Package size={32} className="text-gray-300 mb-3" />
                        <p>Tidak ada riwayat pembelian yang ditemukan.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedFakturs.map((faktur) => (
                    <tr key={faktur.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {new Date(faktur.created_at).toLocaleDateString('id-ID')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {faktur.is_archived ? (
                            <span className="text-red-500 font-medium border border-red-200 bg-red-50 px-1.5 py-0.5 rounded">Diarsipkan</span>
                          ) : 'Aktif'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{faktur.product_name}</div>
                        <div className="text-xs text-gray-500 mt-1">Batch: {faktur.batch_number || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-700">{faktur.supplier_name || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-blue-600">
                          {formatCurrency(faktur.cost_price * faktur.initial_quantity)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {faktur.initial_quantity} pcs @ {formatCurrency(faktur.cost_price)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          faktur.status === 'approved' ? 'bg-green-100 text-green-700' : 
                          faktur.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                          faktur.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {faktur.status === 'approved' ? 'Disetujui' : 
                           faktur.status === 'pending' ? 'Menunggu' : 
                           faktur.status === 'rejected' ? 'Ditolak' : 
                           'Revisi'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {faktur.image_url ? (
                          <button 
                            onClick={() => setPreviewImageUrl(`http://localhost:5000${faktur.image_url}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors text-xs font-medium"
                          >
                            <FileText size={14} />
                            Lihat
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Tidak ada</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 md:p-8" 
          onClick={() => setPreviewImageUrl(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-full overflow-hidden flex flex-col" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">Bukti Faktur</h3>
              <button 
                onClick={() => setPreviewImageUrl(null)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
              >
                <div className="text-xl leading-none">&times;</div>
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto bg-gray-50 flex items-center justify-center min-h-0">
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
