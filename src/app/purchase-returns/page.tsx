'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowLeft, AlertTriangle, Package, RotateCcw, History, Eye, X, Info, TrendingDown, DollarSign, Calendar, ShoppingBag, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import { useRequirePermission } from '@/hooks/useRequirePermission';
import PageHeader from '@/components/PageHeader';

interface PurchaseItem {
  purchase_item_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  buy_price: number;
  batch_id: number;
  batch_number: string | null;
  expired_date: string | null;
  current_stock: number;
  qty_already_returned: number;
  qty_returnable: number;
}

interface LookupResult {
  purchase: { id: number; invoice_no: string; date: string; total: number };
  supplier: { id: number; name: string; accepts_return: boolean; return_notes: string | null };
  items: PurchaseItem[];
}

export default function PurchaseReturnsPage() {
  const router = useRouter();
  const { checkActionPermission } = useRequirePermission('Retur Pembelian');

  const [invoiceNo, setInvoiceNo] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [handling, setHandling] = useState<'reduce_payable' | 'credit_note' | 'write_off_loss'>('reduce_payable');
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [conditions, setConditions] = useState<Record<number, string>>({});
  const [searched, setSearched] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch('http://localhost:5000/api/returns/purchases', { headers: authHeaders })
      .then(res => res.json())
      .then(data => setHistoryList(data.data || []))
      .catch(() => {});
  }, []);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = useMemo<Record<string, string>>(() => {
    if (!token) return {} as Record<string, string>;
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [token]);

  const handleLookup = async () => {
    if (!invoiceNo.trim()) {
      goeyToast.error('Masukkan nomor faktur', { description: 'Invoice number wajib diisi' });
      return;
    }
    setLoading(true);
    setSearched(true);
    setLookupResult(null);
    setReturnQuantities({});
    setConditions({});
    try {
      const res = await fetch(`http://localhost:5000/api/returns/purchases/lookup?invoice_no=${encodeURIComponent(invoiceNo.trim())}`, {
        headers: authHeaders,
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (res.status === 404) {
        goeyToast.error('Faktur tidak ditemukan', { description: 'Periksa kembali nomor faktur' });
        return;
      }
      const data = await res.json();
      setLookupResult(data);
    } catch {
      goeyToast.error('Gagal terhubung ke server', {});
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (batchId: number, value: string) => {
    const num = parseInt(value) || 0;
    setReturnQuantities(prev => ({ ...prev, [batchId]: num }));
  };

  const handleConditionChange = (batchId: number, value: string) => {
    setConditions(prev => ({ ...prev, [batchId]: value }));
  };

  const handleSubmit = async () => {
    if (!lookupResult) return;

    if (!checkActionPermission('create')) {
      goeyToast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin' });
      return;
    }

    if (!reason.trim()) {
      goeyToast.error('Alasan retur wajib diisi', { description: 'Isi alasan mengapa barang diretur' });
      return;
    }

    if (!handling) {
      goeyToast.error('Pilih metode penanganan', {});
      return;
    }

    const invalidItems = lookupResult.items.filter(item => {
      const qty = returnQuantities[item.batch_id] || 0;
      if (qty <= 0) return false;
      const max = Math.min(item.qty_returnable, item.current_stock);
      if (!Number.isInteger(qty) || qty < 1) return true;
      if (qty > max) return true;
      return false;
    });

    if (invalidItems.length > 0) {
      const names = invalidItems.map(i => i.product_name).join(', ');
      goeyToast.error('Quantity retur tidak valid', {
        description: `Periksa kembali: ${names}. Quantity harus 1 - ${Math.min(invalidItems[0]?.qty_returnable ?? 0, invalidItems[0]?.current_stock ?? 0)}`,
      });
      return;
    }

    const items = lookupResult.items
      .filter(item => (returnQuantities[item.batch_id] || 0) > 0)
      .map(item => ({
        batch_id: item.batch_id,
        qty_returned: returnQuantities[item.batch_id],
        condition: conditions[item.batch_id] || 'damaged',
      }));

    if (items.length === 0) {
      goeyToast.error('Tidak ada item yang diretur', { description: 'Isi quantity retur minimal 1' });
      return;
    }

    setShowConfirm(true);
    return;
  };

  const handleConfirmSubmit = async () => {
    if (!lookupResult) return;
    setShowConfirm(false);
    setSubmitting(true);

    const items = lookupResult.items
      .filter(item => (returnQuantities[item.batch_id] || 0) > 0)
      .map(item => ({
        batch_id: item.batch_id,
        qty_returned: returnQuantities[item.batch_id],
        condition: conditions[item.batch_id] || 'damaged',
      }));

    try {
      const res = await fetch('http://localhost:5000/api/returns/purchases', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          invoice_no: lookupResult.purchase.invoice_no,
          reason,
          handling,
          items,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        goeyToast.success('Retur berhasil', { description: `Return No: ${data.return_no}` });
        setLookupResult(null);
        setInvoiceNo('');
        setReason('');
        setHandling('reduce_payable');
        setReturnQuantities({});
        setConditions({});
        setSearched(false);
        fetch('http://localhost:5000/api/returns/purchases', { headers: authHeaders })
          .then(res => res.json())
          .then(data => setHistoryList(data.data || []))
          .catch(() => {});
      } else {
        const err = await res.json();
        goeyToast.error('Gagal', { description: err.message || 'Terjadi kesalahan' });
      }
    } catch {
      goeyToast.error('Gagal terhubung ke server', {});
    } finally {
      setSubmitting(false);
    }
  };

  const totalReturn = lookupResult?.items.reduce((sum, item) => {
    const qty = returnQuantities[item.batch_id] || 0;
    return sum + qty * item.buy_price;
  }, 0) || 0;

  const stats = useMemo(() => {
    if (historyList.length === 0) return null;
    const total = historyList.reduce((s, r) => s + Number(r.total_value), 0);
    const count = historyList.length;
    const thisMonth = historyList.filter(r => {
      const d = new Date(r.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return { total, count, monthCount: thisMonth.length, monthTotal: thisMonth.reduce((s, r) => s + Number(r.total_value), 0) };
  }, [historyList]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <PageHeader title="Retur Pembelian" subtitle="Retur barang ke supplier" breadcrumbs={[{ label: 'Retur Pembelian' }]} />

      <div className="p-3 sm:p-4 md:p-8 pt-0 max-w-full sm:max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <TrendingDown size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Retur</p>
                <p className="text-lg font-bold">{stats?.count ?? 0}x</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <DollarSign size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Nilai</p>
                {mounted ? (
                  <p className="text-lg font-bold text-gray-800">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(stats?.total ?? 0)}</p>
                ) : (
                  <p className="text-lg font-bold text-gray-800">Rp 0</p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <Calendar size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Bulan Ini</p>
                <p className="text-lg font-bold">{stats?.monthCount ?? 0}x</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <Package size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Nilai Bulan Ini</p>
                {mounted ? (
                  <p className="text-lg font-bold text-gray-800">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(stats?.monthTotal ?? 0)}</p>
                ) : (
                  <p className="text-lg font-bold text-gray-800">Rp 0</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lookup Section */}
          <div className="bg-white rounded-xl shadow-sm mb-6 relative overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Search size={18} className="text-blue-600" />
                </div>
                Cari Faktur Pembelian
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Masukkan nomor faktur supplier..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={invoiceNo}
                  onChange={e => setInvoiceNo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                />
              </div>
              <button
                onClick={handleLookup}
                disabled={loading}
                className="w-full sm:w-auto px-4 sm:px-6 py-1.5 sm:py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Mencari...</>
                ) : 'Cari'}
              </button>
            </div>
          </div>
        </div>

        {!searched && !lookupResult && (
          <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="p-6 sm:p-10 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                <RotateCcw size={36} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Retur Pembelian</h3>
              <p className="text-gray-400 max-w-full sm:max-w-md mx-auto mb-6">
                Masukkan nomor faktur supplier di atas untuk mencari pembelian yang akan diretur. 
                Sistem akan menampilkan daftar barang yang bisa diretur beserta stok yang tersedia.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-xl mx-auto">
                <div className="bg-blue-50 rounded-xl p-4 text-left">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                    <Search size={16} className="text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-blue-800">1. Cari Faktur</p>
                  <p className="text-xs text-blue-600 mt-0.5">Masukkan nomor faktur supplier</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-left">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                    <ShoppingBag size={16} className="text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-green-800">2. Pilih Barang</p>
                  <p className="text-xs text-green-600 mt-0.5">Tentukan qty & kondisi retur</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-left">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                    <CheckCircle size={16} className="text-purple-600" />
                  </div>
                  <p className="text-sm font-medium text-purple-800">3. Proses Retur</p>
                  <p className="text-xs text-purple-600 mt-0.5">Pilih metode & konfirmasi</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lookup Result */}
        {lookupResult && (
          <>
            <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
                  <div className="flex items-start gap-3 w-full sm:w-auto">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                      <Package size={24} className="text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold truncate">{lookupResult.supplier.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">
                        Faktur: <span className="font-medium text-gray-700">{lookupResult.purchase.invoice_no}</span>
                        <span className="mx-2">&middot;</span>
                        {new Date(lookupResult.purchase.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right bg-gray-50 rounded-xl px-4 py-2 w-full sm:w-auto">
                    <p className="text-xs text-gray-500">Total Faktur</p>
                    <p className="text-lg font-bold text-gray-800">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(lookupResult.purchase.total)}</p>
                  </div>
                </div>

                {!lookupResult.supplier.accepts_return && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-4">
                    <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Supplier tidak menerima retur barang</p>
                      <p className="text-sm text-red-600 mt-0.5">
                        Hanya metode <strong>Write-off</strong> yang tersedia.
                        {lookupResult.supplier.return_notes && ` Kebijakan: ${lookupResult.supplier.return_notes}`}
                      </p>
                    </div>
                  </div>
                )}

                {lookupResult.supplier.return_notes && lookupResult.supplier.accepts_return && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 mb-4">
                    <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Kebijakan Retur Supplier</p>
                      <p className="text-sm text-blue-600 mt-0.5">{lookupResult.supplier.return_notes}</p>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 sm:px-4 py-1 sm:py-3 text-left font-medium text-gray-600">Produk</th>
                        <th className="px-2 sm:px-4 py-1 sm:py-3 text-left font-medium text-gray-600">Batch</th>
                        <th className="px-2 sm:px-4 py-1 sm:py-3 text-left font-medium text-gray-600">Exp</th>
                        <th className="px-2 sm:px-4 py-1 sm:py-3 text-center font-medium text-gray-600">Stok</th>
                        <th className="px-2 sm:px-4 py-1 sm:py-3 text-center font-medium text-gray-600">Dibeli</th>
                        <th className="px-2 sm:px-4 py-1 sm:py-3 text-center font-medium text-gray-600">Sudah Retur</th>
                        <th className="px-2 sm:px-4 py-1 sm:py-3 text-center font-medium text-gray-600">Bisa Retur</th>
                        <th className="px-2 sm:px-4 py-1 sm:py-3 text-center font-medium text-gray-600">Qty Retur</th>
                        <th className="px-2 sm:px-4 py-1 sm:py-3 text-left font-medium text-gray-600">Kondisi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lookupResult.items.map(item => {
                        const disabled = item.qty_returnable <= 0 || item.current_stock <= 0;
                        return (
                          <tr key={item.batch_id} className={`hover:bg-gray-50/50 transition-colors ${disabled ? 'opacity-40' : ''}`}>
                            <td className="px-2 sm:px-4 py-1 sm:py-3 font-medium">{item.product_name}</td>
                            <td className="px-2 sm:px-4 py-1 sm:py-3">
                              <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 font-mono">{item.batch_number || '-'}</span>
                            </td>
                            <td className="px-2 sm:px-4 py-1 sm:py-3 text-gray-500">{item.expired_date ? new Date(item.expired_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                            <td className="px-2 sm:px-4 py-1 sm:py-3 text-center">{item.current_stock}</td>
                            <td className="px-2 sm:px-4 py-1 sm:py-3 text-center">{item.quantity}</td>
                            <td className="px-2 sm:px-4 py-1 sm:py-3 text-center">
                              {item.qty_already_returned > 0 ? (
                                <span className="text-orange-600 font-medium">{item.qty_already_returned}</span>
                              ) : (
                                <span className="text-gray-300">0</span>
                              )}
                            </td>
                            <td className="px-2 sm:px-4 py-1 sm:py-3 text-center font-semibold">{item.qty_returnable}</td>
                            <td className="px-2 sm:px-4 py-1 sm:py-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={Math.min(item.qty_returnable, item.current_stock)}
                                disabled={disabled}
                                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                                value={returnQuantities[item.batch_id] || ''}
                                onChange={e => handleQtyChange(item.batch_id, e.target.value)}
                              />
                            </td>
                            <td className="px-2 sm:px-4 py-1 sm:py-3">
                              <select
                                disabled={disabled}
                                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                                value={conditions[item.batch_id] || 'damaged'}
                                onChange={e => handleConditionChange(item.batch_id, e.target.value)}
                              >
                                <option value="damaged">Rusak</option>
                                <option value="expired">Kadaluarsa</option>
                                <option value="wrong_item">Salah Barang</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Submit Section */}
            <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
              <div className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <RotateCcw size={18} className="text-blue-600" />
                  Konfirmasi Retur
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Alasan Retur</label>
                    <textarea
                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                      rows={3}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Contoh: Barang rusak saat pengiriman..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Metode Penanganan</label>
                    <select
                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      value={handling}
                      onChange={e => setHandling(e.target.value as any)}
                    >
                      <option value="reduce_payable">Kurangi Hutang (Supplier Terima Barang)</option>
                      <option value="credit_note">Credit Note (Catat Piutang ke Supplier)</option>
                      <option value="write_off_loss">Write-off (Supplier Tolak / Barang Rusak)</option>
                    </select>
                    <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-blue-100">
                      <p className="text-sm text-gray-600 flex items-center justify-between">
                        <span className="font-medium">Total Nilai Retur</span>
                        <span className="text-xl font-bold text-blue-700">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalReturn)}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{lookupResult.items.filter(i => (returnQuantities[i.batch_id] || 0) > 0).length} item dipilih</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => { setLookupResult(null); setSearched(false); }}
                    className="w-full sm:w-auto px-3 sm:px-5 py-1.5 sm:py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 flex items-center justify-center gap-2 transition-all"
                  >
                    <ArrowLeft size={16} /> Batal
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || totalReturn <= 0}
                    className="w-full sm:w-auto px-4 sm:px-6 py-1.5 sm:py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-blue-200 transition-all"
                  >
                    {submitting ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Memproses...</>
                    ) : (
                      <><RotateCcw size={16} /> Proses Retur</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {searched && !lookupResult && !loading && (
          <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
            <div className="p-6 sm:p-12 text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-orange-300" />
              </div>
              <p className="text-lg font-medium text-gray-700">Faktur tidak ditemukan</p>
              <p className="text-sm text-gray-400 mt-1">Periksa kembali nomor faktur atau coba faktur lain</p>
              <button
                onClick={() => { setSearched(false); setInvoiceNo(''); }}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Cari ulang
              </button>
            </div>
          </div>
        )}

        {/* Riwayat Retur Pembelian */}
        <div className="mt-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-5 py-4 bg-white rounded-xl shadow-sm hover:bg-gray-50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <History size={18} className="text-blue-600" />
              </div>
              <div className="text-left">
                <span className="font-medium text-gray-700">Riwayat Retur Pembelian</span>
                {historyList.length > 0 && (
                  <span className="text-xs text-gray-400 ml-2">({historyList.length} data)</span>
                )}
              </div>
              {historyLoading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            </div>
            <div className={`w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center transition-transform ${showHistory ? 'rotate-180' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </button>

          {showHistory && (
            <div className="mt-3 space-y-3">
              {historyList.length === 0 && !historyLoading && (
                <div className="bg-white rounded-xl shadow-sm p-6 sm:p-10 text-center">
                  <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <History size={28} className="text-gray-300" />
                  </div>
                  <p className="text-gray-400 text-sm">Belum ada riwayat retur pembelian</p>
                </div>
              )}
              {historyList.map((ret: any) => (
                <div key={ret.id} className="bg-white rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                          <RotateCcw size={18} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-blue-700">{ret.return_no}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              ret.handling === 'reduce_payable' ? 'bg-green-100 text-green-700' :
                              ret.handling === 'credit_note' ? 'bg-purple-100 text-purple-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {ret.handling === 'reduce_payable' ? 'Kurang Hutang' :
                               ret.handling === 'credit_note' ? 'Credit Note' : 'Write-off'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {ret.supplier_name || '-'} &middot; Faktur: {ret.invoice_no || '-'}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={11} />
                            {new Date(ret.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {ret.reason && <><span className="mx-1">&middot;</span>{ret.reason}</>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(ret.total_value)}
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`http://localhost:5000/api/returns/purchases/${ret.id}`, { headers: authHeaders });
                              if (res.ok) {
                                const data = await res.json();
                                setSelectedHistory(data);
                              }
                            } catch {}
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1 inline-flex items-center gap-1"
                        >
                          <Eye size={12} /> Detail
                        </button>
                      </div>
                    </div>

                    {selectedHistory?.id === ret.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-medium text-gray-700">Item Retur</span>
                          <button onClick={() => setSelectedHistory(null)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                            <X size={12} className="text-gray-500" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {selectedHistory.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Package size={14} className="text-gray-400" />
                                <span>{item.product_name}</span>
                                <span className="text-gray-400">x{item.qty_returned}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-500">
                                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.buy_price)}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  item.condition === 'damaged' ? 'bg-red-50 text-red-600' :
                                  item.condition === 'expired' ? 'bg-orange-50 text-orange-600' :
                                  'bg-blue-50 text-blue-600'
                                }`}>
                                  {item.condition === 'damaged' ? 'Rusak' : item.condition === 'expired' ? 'Kadaluarsa' : 'Salah Barang'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-full sm:max-w-sm mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Konfirmasi Retur</h3>
              <p className="text-sm text-gray-500 mb-4">
                Yakin ingin memproses retur pembelian senilai{' '}
                <span className="font-semibold text-gray-800">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalReturn)}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={submitting}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {submitting ? 'Memproses...' : 'Ya, Proses'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
