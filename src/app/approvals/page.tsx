'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, X, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import PageHeader from '@/components/PageHeader';
import { useRequirePermission } from '@/hooks/useRequirePermission';

interface PendingFaktur {
  id: number;
  product_id: number;
  product_name: string;
  product_status: 'active' | 'pending';
  product_unit: string;
  product_purchase_unit: string;
  product_unit_multiplier: number;
  batch_number: string | null;
  invoice_number?: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  purchase_date: string | null;
  initial_quantity: number;
  cost_price: number;
  stock_type: string;
  dp_amount: number | null;
  due_date: string | null;
  image_url: string | null;
  status: 'pending' | 'revision' | 'rejected';
  notes: string | null;
  created_at: string;
}

export default function ApprovalsPage() {
  const { checkActionPermission } = useRequirePermission('Approval Faktur');
  const [pendingFakturs, setPendingFakturs] = useState<PendingFaktur[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // Revision Modal States
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionInvoice, setRevisionInvoice] = useState<string | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`
  }), [token]);

  const fetchPendingFakturs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/inventory/pending-batches', {
        headers: authHeaders
      });
      if (res.ok) {
        const json = await res.json();
        setPendingFakturs(json.data || []);
      }
    } catch (error) {
      console.error('Error fetching pending fakturs:', error);
      goeyToast.error('Gagal memuat data approval');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchPendingFakturs();
  }, [fetchPendingFakturs]);

  const handleApprove = async (items: PendingFaktur[]) => {
    try {
      for (const item of items) {
        await fetch(`http://localhost:5000/api/inventory/batches/${item.id}/approve`, {
          method: 'PUT', headers: authHeaders
        });
      }
      goeyToast.success(`${items.length} faktur disetujui`);
      fetchPendingFakturs();
    } catch (error) {
      console.error(error);
      goeyToast.error('Terjadi kesalahan');
    }
  };

  const handleReject = async (items: PendingFaktur[]) => {
    try {
      for (const item of items) {
        await fetch(`http://localhost:5000/api/inventory/batches/${item.id}/reject`, {
          method: 'PUT', headers: authHeaders
        });
      }
      goeyToast.success(`${items.length} faktur ditolak`);
      fetchPendingFakturs();
    } catch (error) {
      console.error(error);
      goeyToast.error('Terjadi kesalahan');
    }
  };

  const handleDelete = async (items: PendingFaktur[]) => {
    const label = items[0]?.invoice_number || items[0]?.batch_number || 'ini';
    if (!window.confirm(`Hapus semua batch pada faktur ${label}?`)) return;
    try {
      for (const item of items) {
        await fetch(`http://localhost:5000/api/inventory/batches/${item.id}`, {
          method: 'DELETE', headers: authHeaders
        });
      }
      goeyToast.success('Faktur berhasil dihapus');
      fetchPendingFakturs();
    } catch (error) {
      console.error(error);
      goeyToast.error('Terjadi kesalahan');
    }
  };

  const handleRevision = (invoiceKey: string) => {
    setRevisionInvoice(invoiceKey);
    setRevisionNotes('');
    setIsRevisionModalOpen(true);
  };

  const submitRevision = async () => {
    if (!revisionInvoice) return;
    if (!revisionNotes.trim()) {
      goeyToast.error('Catatan perbaikan harus diisi');
      return;
    }

    const items = pendingFakturs.filter(f => (f.invoice_number || '__NO_INVOICE__') === revisionInvoice);
    setIsSubmittingRevision(true);
    try {
      for (const item of items) {
        await fetch(`http://localhost:5000/api/inventory/batches/${item.id}/revision`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: revisionNotes })
        });
      }
      goeyToast.success('Permintaan perbaikan dikirim');
      setIsRevisionModalOpen(false);
      fetchPendingFakturs();
    } catch (error) {
      console.error(error);
      goeyToast.error('Terjadi kesalahan');
    } finally {
      setIsSubmittingRevision(false);
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <PageHeader 
        title="Approval Faktur" 
        subtitle="Daftar faktur yang memerlukan persetujuan nominal > Rp 2.000.000"
      />

      <div className="p-3 sm:p-4 md:p-8 pt-0">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : pendingFakturs.length === 0 ? (
          <div className="bg-white rounded-xl p-20 text-center shadow-sm">
            <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="text-green-600" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Semua Beres!</h3>
            <p className="text-gray-500">Tidak ada faktur yang menunggu persetujuan saat ini.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">No. Faktur</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const grouped: Record<string, PendingFaktur[]> = {};
                    for (const f of pendingFakturs) {
                      const key = f.invoice_number || `__BATCH_${f.batch_number || f.id}`;
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(f);
                    }

                    const formatIDR = (v: number) => formatCurrency(v);
                    const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

                    return Object.entries(grouped).map(([invoiceKey, items]) => {
                      const first = items[0];
                      const totalQty = items.reduce((s, i) => s + i.initial_quantity / (i.product_unit_multiplier || 1), 0);
                      const totalCost = items.reduce((s, i) => s + i.cost_price * i.initial_quantity, 0);
                      const allStatuses = [...new Set(items.map(i => i.status))];
                      const displayStatus = allStatuses.includes('pending') ? 'pending' : allStatuses.includes('revision') ? 'revision' : 'rejected';
                      const isExpanded = expandedInvoice === invoiceKey;
                      const invoiceLabel = first.invoice_number || `Batch: ${first.batch_number || '#' + first.id}`

                      return (
                        <React.Fragment key={invoiceKey}>
                          <tr className="hover:bg-purple-50 transition-colors cursor-pointer" onClick={() => setExpandedInvoice(isExpanded ? null : invoiceKey)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <svg className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                <span className="font-semibold text-gray-900">{invoiceLabel}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5 ml-5">{items.length} produk</div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{first.supplier_name || '-'}</td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{first.purchase_date ? formatDate(first.purchase_date) : '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-medium">{totalQty}</span>
                              <span className="text-gray-400 ml-1">{first.product_purchase_unit}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-blue-600">{formatIDR(totalCost)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                displayStatus === 'pending' 
                                  ? 'bg-yellow-100 text-yellow-700 border-yellow-200' 
                                  : displayStatus === 'rejected'
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : 'bg-orange-100 text-orange-700 border-orange-200'
                              }`}>
                                {displayStatus === 'pending' ? 'Pending' : displayStatus === 'rejected' ? 'Ditolak' : 'Revisi'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                {items.some(i => i.image_url) && (
                                  <button onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(`http://localhost:5000${items.find(i => i.image_url)!.image_url}`); }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Lihat Bukti">
                                    <FileText size={14} />
                                  </button>
                                )}
                                {displayStatus === 'pending' ? (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); handleApprove(items); }}
                                      className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors">
                                      <Check size={14} className="inline mr-0.5" />Setujui
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleRevision(invoiceKey); }}
                                      className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors">
                                      <AlertCircle size={14} className="inline mr-0.5" />Perbaiki
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleReject(items); }}
                                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors">
                                      <X size={14} className="inline mr-0.5" />Tolak
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">{displayStatus === 'rejected' ? 'Ditolak' : 'Menunggu kasir'}</span>
                                )}
                                {displayStatus === 'rejected' && (
                                  <button onClick={(e) => { e.stopPropagation(); handleDelete(items); }}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Hapus">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && items.map(item => (
                            <tr key={item.id} className="bg-gray-50 text-xs text-gray-600">
                              <td colSpan={7} className="px-4 py-2">
                                <div className="ml-5 flex items-center gap-4">
                                  <span className="font-medium text-gray-800 min-w-[150px]">{item.product_name}</span>
                                  <span>{item.initial_quantity / (item.product_unit_multiplier || 1)} {item.product_purchase_unit}</span>
                                  <span className="text-blue-600">@ {formatCurrency(item.cost_price)}</span>
                                  <span className="font-semibold">= {formatCurrency(item.cost_price * item.initial_quantity)}</span>
                                  {item.notes && <span className="text-orange-600 ml-2">✱ {item.notes}</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-2 sm:p-4 md:p-8" 
          onClick={() => setPreviewImageUrl(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-full sm:max-w-4xl max-h-full overflow-hidden flex flex-col" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">Bukti Faktur</h3>
              <button 
                onClick={() => setPreviewImageUrl(null)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
              >
                <X size={20} />
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

      {/* Revision Note Modal */}
      {isRevisionModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-full sm:max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <AlertCircle size={20} className="text-orange-500" />
                Minta Perbaikan
              </h3>
              <button onClick={() => setIsRevisionModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Berikan alasan atau instruksi spesifik mengenai bagian mana yang perlu diperbaiki oleh user.
              </p>
              <textarea
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                placeholder="Contoh: Harga beli salah, tolong cek kembali fakturnya..."
                rows={4}
                autoFocus
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 flex gap-3">
              <button
                onClick={() => setIsRevisionModalOpen(false)}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={submitRevision}
                disabled={isSubmittingRevision || !revisionNotes.trim()}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingRevision ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>Perbarui</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
