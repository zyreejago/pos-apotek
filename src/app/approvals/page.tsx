'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, X, AlertCircle, FileText, Info, Package, Users, Calendar, Trash2 } from 'lucide-react';
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
  
  // Revision Modal States
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionFakturId, setRevisionFakturId] = useState<number | null>(null);
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

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/batches/${id}/approve`, {
        method: 'PUT',
        headers: authHeaders
      });
      if (res.ok) {
        goeyToast.success('Faktur disetujui');
        fetchPendingFakturs();
      } else {
        goeyToast.error('Gagal menyetujui faktur');
      }
    } catch (error) {
      console.error(error);
      goeyToast.error('Terjadi kesalahan');
    }
  };

  const handleReject = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/batches/${id}/reject`, {
        method: 'PUT',
        headers: authHeaders
      });
      if (res.ok) {
        goeyToast.success('Faktur ditolak');
        fetchPendingFakturs();
      } else {
        goeyToast.error('Gagal menolak faktur');
      }
    } catch (error) {
      console.error(error);
      goeyToast.error('Terjadi kesalahan');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus faktur ini? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/batches/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (res.ok) {
        goeyToast.success('Faktur berhasil dihapus');
        fetchPendingFakturs();
      } else {
        const data = await res.json();
        goeyToast.error(data.message || 'Gagal menghapus faktur');
      }
    } catch (error) {
      console.error(error);
      goeyToast.error('Terjadi kesalahan saat menghapus faktur');
    }
  };

  const handleRevision = (id: number) => {
    setRevisionFakturId(id);
    setRevisionNotes('');
    setIsRevisionModalOpen(true);
  };

  const submitRevision = async () => {
    if (!revisionFakturId) return;
    if (!revisionNotes.trim()) {
      goeyToast.error('Catatan perbaikan harus diisi');
      return;
    }

    setIsSubmittingRevision(true);
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/batches/${revisionFakturId}/revision`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes: revisionNotes })
      });
      if (res.ok) {
        goeyToast.success('Permintaan perbaikan dikirim');
        setIsRevisionModalOpen(false);
        fetchPendingFakturs();
      } else {
        goeyToast.error('Gagal mengirim permintaan perbaikan');
      }
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
          <div className="grid gap-6">
            {pendingFakturs.map((faktur) => (
              <div key={faktur.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow relative">
                {faktur.status === 'rejected' && (
                  <button 
                    onClick={() => handleDelete(faktur.id)}
                    className="absolute top-4 right-4 p-2 text-red-500 hover:text-white bg-red-50 hover:bg-red-600 rounded-lg border border-red-200 hover:border-red-600 transition-all shadow-sm hover:scale-105 duration-200 z-10"
                    title="Hapus Faktur Ditolak"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row justify-between gap-6">
                    {/* Left: Product & Supplier Info */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="bg-blue-50 p-3 rounded-xl text-blue-600 shrink-0">
                          <Package size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">{faktur.product_name}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                              faktur.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse' 
                                : faktur.status === 'rejected'
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : 'bg-orange-100 text-orange-700 border-orange-200'
                            }`}>
                              {faktur.status === 'pending' 
                                ? 'Pending Approval' 
                                : faktur.status === 'rejected'
                                ? 'Ditolak'
                                : 'Menunggu Perbaikan'}
                            </span>
                            {faktur.product_status === 'pending' && (
                              <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                Produk Baru
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">Produk ID: #{faktur.product_id} | Batch: {faktur.batch_number || '-'}</p>
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

                      <div className="grid grid-cols-2 md:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users size={16} className="text-gray-400" />
                          <span>{faktur.supplier_name || 'Tanpa Supplier'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar size={16} className="text-gray-400" />
                          <span>{faktur.purchase_date ? new Date(faktur.purchase_date).toLocaleDateString('id-ID') : '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Info size={16} className="text-gray-400" />
                          <span className="capitalize">{faktur.stock_type.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Financial Details */}
                    <div className="lg:w-64 bg-gray-50 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Jumlah:</span>
                        <span className="font-medium text-gray-900">
                          {faktur.initial_quantity / (faktur.product_unit_multiplier || 1)} {faktur.product_purchase_unit}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Harga Beli:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(faktur.cost_price)}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-400 uppercase">Total:</span>
                        <span className="text-lg font-extrabold text-blue-600">{formatCurrency(faktur.cost_price * faktur.initial_quantity)}</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex lg:flex-col items-center justify-center gap-3 shrink-0">
                      {faktur.image_url && (
                        <button 
                          onClick={() => setPreviewImageUrl(`http://localhost:5000${faktur.image_url}`)}
                          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium w-full justify-center"
                        >
                          <FileText size={18} />
                          Lihat Bukti
                        </button>
                      )}
                      {faktur.status === 'pending' ? (
                        <div className="flex gap-2 w-full">
                          <button 
                            onClick={() => handleApprove(faktur.id)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center gap-1 text-sm font-bold"
                            title="Setujui"
                          >
                            <Check size={18} /> Setujui
                          </button>
                          <button 
                            onClick={() => handleRevision(faktur.id)}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg transition-colors flex items-center justify-center gap-1 text-sm font-bold"
                            title="Perlu Perbaikan"
                          >
                            <AlertCircle size={18} /> Perbaiki
                          </button>
                          <button 
                            onClick={() => handleReject(faktur.id)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center gap-1 text-sm font-bold"
                            title="Tolak"
                          >
                            <X size={18} /> Tolak
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-2 px-4 bg-gray-100 rounded-lg text-xs font-bold text-gray-500 w-full border border-gray-200">
                          {faktur.status === 'rejected' ? 'Telah Ditolak' : 'Menunggu Perbaikan Kasir'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
