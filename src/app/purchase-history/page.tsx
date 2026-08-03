'use client';

import { API_URL } from '@/lib/api-config';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileText, Package, Filter } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import PageHeader from '@/components/PageHeader';
import { useRequirePermission } from '@/hooks/useRequirePermission';

interface DpPayment {
  id: number;
  amount: number;
  payment_date: string;
  payment_method?: string | null;
  notes?: string | null;
  created_at: string;
}

interface HistoryFaktur {
  id: number;
  product_id: number;
  product_name: string;
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
  invoice_number: string | null;
  status: string;
  is_archived: number;
  notes: string | null;
  created_at: string;
  return_qty?: number;
  dp_payments?: DpPayment[];
}

export default function PurchaseHistoryPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { checkActionPermission } = useRequirePermission('Riwayat Pembelian');
  const [fakturs, setFakturs] = useState<HistoryFaktur[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageList, setPreviewImageList] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [expandedFaktur, setExpandedFaktur] = useState<string | null>(null);

  const getImageUrls = (url: string | null): string[] => {
    if (!url) return [];
    try { const parsed = JSON.parse(url); return Array.isArray(parsed) ? parsed : [url]; }
    catch { return [url]; }
  };

  // Sorting and Filtering
  const [sortField] = useState<keyof HistoryFaktur | 'total_price'>('created_at');
  const [sortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`
  }), [token]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/inventory/history`, {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.sort((a: any, b: any) => {
      let valA;
      let valB;

      if (sortField === 'total_price') {
        valA = a.cost_price * a.initial_quantity;
        valB = b.cost_price * b.initial_quantity;
      } else {
        valA = a[sortField];
        valB = b[sortField];

        // Handle nulls
        if (valA === null) valA = '';
        if (valB === null) valB = '';
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
  }, [fakturs, searchQuery, sortField, sortDirection, statusFilter]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <PageHeader 
        title="Riwayat Pembelian" 
        subtitle="Lihat semua riwayat pembelian, faktur, dan stok masuk."
      />

      <div className="p-3 sm:p-4 md:p-8 pt-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
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
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg w-full sm:w-auto">
                <Filter size={16} className="text-gray-400" />
                <select 
                  className="bg-transparent border-none focus:outline-none cursor-pointer w-full sm:w-auto"
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

          {/* Faktur List */}
          <div className="p-4">
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading riwayat pembelian...</div>
            ) : filteredAndSortedFakturs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Package size={32} className="text-gray-300 mb-3" />
                <p>Tidak ada riwayat pembelian yang ditemukan.</p>
              </div>
            ) : (() => {
              const grouped: Record<string, HistoryFaktur[]> = {};
              for (const f of filteredAndSortedFakturs) {
                const key = f.invoice_number || f.batch_number || '__NO_INVOICE__';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(f);
              }

              const renderBatchRow = (batch: HistoryFaktur) => {
                const soldQty = batch.initial_quantity - batch.remaining_quantity - (batch.return_qty || 0);
                let dpList: DpPayment[] = [];
                if (batch.dp_payments && batch.dp_payments.length > 0) {
                  dpList = batch.dp_payments;
                } else if (batch.dp_amount) {
                  dpList = [{ id: -1, amount: batch.dp_amount, payment_date: batch.purchase_date || '', payment_method: 'cash', created_at: batch.created_at }];
                }
                const totalAmount = batch.cost_price * batch.initial_quantity;
                const totalDp = dpList.reduce((sum, dp) => sum + Number(dp.amount), 0);
                const remainingDebt = totalAmount - totalDp;

                return (
                  <div key={batch.id} className="border border-gray-200 bg-white p-3 rounded-lg text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-gray-900 truncate">{batch.product_name}</span>
                        <span className="text-gray-400 shrink-0">#{batch.batch_number || '-'}</span>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                        batch.status === 'approved' ? 'bg-green-100 text-green-700' : 
                        batch.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                        batch.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {batch.status === 'approved' ? 'Disetujui' : 
                         batch.status === 'pending' ? 'Menunggu' : 
                         batch.status === 'rejected' ? 'Ditolak' : 'Revisi'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600 mb-1.5">
                      {batch.purchase_date && <span>Pembelian: <strong>{new Date(batch.purchase_date).toLocaleDateString('id-ID')}</strong></span>}
                      {batch.expired_date && <span>Exp: <strong>{new Date(batch.expired_date).toLocaleDateString('id-ID')}</strong></span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-gray-600">
                      <span>Stok Awal: <strong>{batch.initial_quantity}</strong></span>
                      <span className="text-gray-300">|</span>
                      <span>Sisa: <strong>{batch.remaining_quantity}</strong></span>
                      <span className="text-gray-300">|</span>
                      <span className={soldQty > 0 ? 'text-blue-600' : ''}>Terjual: <strong>{soldQty}</strong></span>
                      {(batch.return_qty || 0) > 0 && <>
                        <span className="text-gray-300">|</span>
                        <span className="text-red-600">Retur: <strong>{batch.return_qty}</strong></span>
                      </>}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-gray-600">
                      <span>Harga: <strong className="text-blue-600">{formatCurrency(totalAmount)}</strong></span>
                      <span className="text-gray-300">|</span>
                      <span>@ {formatCurrency(batch.cost_price)} / pcs</span>
                    </div>

                    {dpList.length > 0 && (
                      <div className="border-t border-gray-100 pt-1.5 mt-2 space-y-0.5">
                        {dpList.map((dp, idx) => (
                          <div key={dp.id} className="flex items-center gap-1.5 text-gray-600">
                            <span className="font-medium text-yellow-600">DP {idx + 1}:</span>
                            <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${dp.payment_method === 'transfer' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                              {dp.payment_method === 'transfer' ? 'TF' : 'Cash'}
                            </span>
                            <span className="text-blue-600 font-semibold">{formatCurrency(dp.amount)}</span>
                            {dp.payment_date && <span className="text-gray-400">({new Date(dp.payment_date).toLocaleDateString('id-ID')})</span>}
                          </div>
                        ))}
                        {remainingDebt > 0 ? (
                          <div className="text-orange-600 font-medium">Sisa hutang: {formatCurrency(remainingDebt)}</div>
                        ) : remainingDebt <= 0 && totalDp > 0 ? (
                          <div className="text-green-600 font-medium">Lunas ✓</div>
                        ) : null}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      {batch.is_archived ? (
                        <span className="text-red-500 font-medium border border-red-200 bg-red-50 px-1.5 py-0.5 rounded">Diarsipkan</span>
                      ) : (
                        <span className="text-green-600 font-medium">Aktif</span>
                      )}
                    </div>

                    {batch.image_url && (
                      <div className="mt-2">
                        <img src={(() => { const urls = getImageUrls(batch.image_url); return urls[0]?.startsWith('http') ? urls[0] : `${API_URL}${urls[0]}`; })()}
                          alt="Bukti" className="h-16 w-auto object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            const urls = getImageUrls(batch.image_url).map((u: string) => u.startsWith('http') ? u : `${API_URL}${u}`);
                            setPreviewImageList(urls);
                            setPreviewImageIndex(0);
                            setPreviewImageUrl(urls[0]);
                          }} />
                      </div>
                    )}
                  </div>
                );
              };

              const renderFakturCard = (invoiceNumber: string, items: HistoryFaktur[]) => {
                const totalQty = items.reduce((s, b) => s + Number(b.initial_quantity), 0);
                const totalCost = items.reduce((s, b) => s + Number(b.cost_price) * Number(b.initial_quantity), 0);
                const statusCounts: Record<string, number> = {};
                items.forEach(b => { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1; });
                const isExpanded = expandedFaktur === invoiceNumber;
                const displayLabel = invoiceNumber === '__NO_INVOICE__' ? 'Tanpa No. Faktur' : invoiceNumber;
                const supplierName = items[0]?.supplier_name || '-';
                const firstDate = items.reduce((latest, b) => b.created_at > latest ? b.created_at : latest, items[0]?.created_at || '');

                return (
                  <div key={invoiceNumber} className="border border-purple-200 rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedFaktur(isExpanded ? null : invoiceNumber)}
                      className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-purple-50 hover:bg-purple-100 transition-colors text-left">
                      <FileText size={18} className="text-purple-600 shrink-0 hidden sm:block" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-gray-800 truncate">{displayLabel}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 truncate">{supplierName} · {items.length} produk · {totalQty} pcs · {formatCurrency(totalCost)}</p>
                      </div>
                      <div className="text-[10px] text-gray-400 shrink-0 hidden sm:block">{new Date(firstDate).toLocaleDateString('id-ID')}</div>
                      <div className="flex gap-1 shrink-0">
                        {Object.entries(statusCounts).map(([s, c]) => (
                          <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            s === 'approved' ? 'bg-green-100 text-green-700' :
                            s === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            s === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}>{c} {s === 'approved' ? '✓' : s === 'pending' ? '⏳' : s === 'rejected' ? '✗' : '?'}</span>
                        ))}
                      </div>
                      <svg className={`w-4 h-4 text-purple-600 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isExpanded && (
                      <div className="p-3 space-y-2 bg-white border-t border-purple-100">
                        {items.map(renderBatchRow)}
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
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImageList.length > 0 && previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setPreviewImageUrl(null); setPreviewImageList([]); }}>
          <div className="relative max-w-2xl w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setPreviewImageUrl(null); setPreviewImageList([]); }}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 z-10">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            {previewImageList.length > 1 && (
              <>
                <button onClick={() => {
                  const newIdx = previewImageIndex > 0 ? previewImageIndex - 1 : previewImageList.length - 1;
                  setPreviewImageIndex(newIdx);
                  setPreviewImageUrl(previewImageList[newIdx]);
                }} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full shadow-lg flex items-center justify-center z-10">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => {
                  const newIdx = previewImageIndex < previewImageList.length - 1 ? previewImageIndex + 1 : 0;
                  setPreviewImageIndex(newIdx);
                  setPreviewImageUrl(previewImageList[newIdx]);
                }} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full shadow-lg flex items-center justify-center z-10">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                  {previewImageIndex + 1} / {previewImageList.length}
                </div>
              </>
            )}
            <img src={previewImageUrl} alt="Bukti Faktur" className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
