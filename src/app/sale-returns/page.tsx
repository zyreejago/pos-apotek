'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowLeft, ShoppingCart, RotateCcw, History, Eye, X, Info, Calendar, DollarSign, TrendingUp, AlertCircle, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import { useRequirePermission } from '@/hooks/useRequirePermission';
import PageHeader from '@/components/PageHeader';

interface SaleItem {
  sale_item_ids: number[];
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  qty_already_returned: number;
  qty_returnable: number;
  expired_date: string | null;
}

interface LookupResult {
  sale: { id: number; date: string; total: number; payment_method: string };
  items: SaleItem[];
}

export default function SaleReturnsPage() {
  const router = useRouter();
  const { checkActionPermission } = useRequirePermission('Retur Penjualan');

  const [saleId, setSaleId] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'credit_note'>('cash');
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [returnConditions, setReturnConditions] = useState<Record<number, string>>({});
  const [searched, setSearched] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch('http://localhost:5000/api/returns/sales', { headers: authHeaders })
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
    if (!saleId.trim()) {
      goeyToast.error('Masukkan ID transaksi', { description: 'ID transaksi wajib diisi' });
      return;
    }
    setLoading(true);
    setSearched(true);
    setLookupResult(null);
    setReturnQuantities({});
    try {
      const res = await fetch(`http://localhost:5000/api/returns/sales/lookup?sale_id=${encodeURIComponent(saleId.trim())}`, {
        headers: authHeaders,
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (res.status === 404) {
        goeyToast.error('Transaksi tidak ditemukan', { description: 'Periksa kembali ID transaksi' });
        return;
      }
      const data = await res.json();
      setLookupResult(data);
      setReturnQuantities({});
      setReturnConditions({});
    } catch {
      goeyToast.error('Gagal terhubung ke server', {});
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (productId: number, value: string) => {
    const num = parseInt(value) || 0;
    setReturnQuantities(prev => ({ ...prev, [productId]: num }));
    if (num <= 0) {
      setReturnConditions(prev => { const c = { ...prev }; delete c[productId]; return c; });
    } else if (!returnConditions[productId]) {
      setReturnConditions(prev => ({ ...prev, [productId]: 'baik' }));
    }
  };
  
  const handleConditionChange = (productId: number, condition: string) => {
    setReturnConditions(prev => ({ ...prev, [productId]: condition }));
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

    if (!refundMethod) {
      goeyToast.error('Pilih metode refund', {});
      return;
    }

    const invalidItems = lookupResult.items.filter(item => {
      const qty = returnQuantities[item.product_id] || 0;
      if (qty <= 0) return false;
      if (!Number.isInteger(qty) || qty < 1) return true;
      if (qty > item.qty_returnable) return true;
      return false;
    });

    if (invalidItems.length > 0) {
      const names = invalidItems.map(i => i.product_name).join(', ');
      goeyToast.error('Quantity retur tidak valid', {
        description: `Periksa kembali: ${names}. Quantity harus 1 - ${invalidItems[0]?.qty_returnable ?? 0}`,
      });
      return;
    }

    const items = lookupResult.items
      .filter(item => (returnQuantities[item.product_id] || 0) > 0)
      .map(item => ({
        product_id: item.product_id,
        qty_returned: returnQuantities[item.product_id],
        condition: returnConditions[item.product_id] || 'baik',
      }));

    if (items.length === 0) {
      goeyToast.error('Tidak ada item yang diretur', { description: 'Isi quantity retur minimal 1' });
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    if (!lookupResult) return;
    setShowConfirm(false);
    setSubmitting(true);

    const items = lookupResult.items
      .filter(item => (returnQuantities[item.product_id] || 0) > 0)
      .map(item => ({
        product_id: item.product_id,
        qty_returned: returnQuantities[item.product_id],
        condition: returnConditions[item.product_id] || 'baik',
      }));

    try {
      const res = await fetch('http://localhost:5000/api/returns/sales', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          sale_id: lookupResult.sale.id,
          reason,
          refund_method: refundMethod,
          items,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        goeyToast.success('Retur berhasil', { description: `Return No: ${data.return_no}` });
        setLookupResult(null);
        setSaleId('');
        setReason('');
        setRefundMethod('cash');
        setReturnQuantities({});
        setSearched(false);
        fetch('http://localhost:5000/api/returns/sales', { headers: authHeaders })
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

  const totalRefund = lookupResult?.items.reduce((sum, item) => {
    const qty = returnQuantities[item.product_id] || 0;
    return sum + qty * item.price;
  }, 0) || 0;

  const stats = useMemo(() => {
    if (historyList.length === 0) return null;
    const total = historyList.reduce((s, r) => s + Number(r.total_refund), 0);
    const count = historyList.length;
    const thisMonth = historyList.filter(r => {
      const d = new Date(r.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return { total, count, monthCount: thisMonth.length, monthTotal: thisMonth.reduce((s, r) => s + Number(r.total_refund), 0) };
  }, [historyList]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <PageHeader title="Retur Penjualan" subtitle="Retur barang dari pelanggan" breadcrumbs={[{ label: 'Retur Penjualan' }]} />

      <div className="p-8 pt-0 max-w-full sm:max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <TrendingUp size={20} className="text-blue-600" />
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
                <p className="text-xs text-gray-500">Total Refund</p>
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
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <Search size={18} className="text-emerald-600" />
                </div>
                Cari Transaksi Penjualan
              </h2>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  placeholder="Masukkan ID transaksi..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  value={saleId}
                  onChange={e => setSaleId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                />
              </div>
              <button
                onClick={handleLookup}
                disabled={loading}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-all"
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
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                <ShoppingCart size={36} className="text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Retur Penjualan</h3>
              <p className="text-gray-400 max-w-full sm:max-w-md mx-auto mb-6">
                Masukkan ID transaksi penjualan di atas untuk mencari transaksi yang akan diretur.
                Sistem akan menampilkan daftar barang yang bisa diretur beserta status pembayaran.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-xl mx-auto">
                <div className="bg-emerald-50 rounded-xl p-4 text-left">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mb-2">
                    <Search size={16} className="text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-emerald-800">1. Cari Transaksi</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Masukkan ID transaksi penjualan</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-left">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                    <Package size={16} className="text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-blue-800">2. Pilih Barang</p>
                  <p className="text-xs text-blue-600 mt-0.5">Tentukan qty retur setiap item</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-left">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                    <CheckCircle size={16} className="text-purple-600" />
                  </div>
                  <p className="text-sm font-medium text-purple-800">3. Proses Retur</p>
                  <p className="text-xs text-purple-600 mt-0.5">Pilih refund & konfirmasi</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lookup Result */}
        {lookupResult && (
          <>
            <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <ShoppingCart size={24} className="text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Transaksi #{lookupResult.sale.id}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(lookupResult.sale.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        <span className="mx-2">&middot;</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          lookupResult.sale.payment_method === 'midtrans' ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {lookupResult.sale.payment_method === 'midtrans' ? 'Non-Tunai' : 'Tunai'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right bg-gray-50 rounded-xl px-4 py-2">
                    <p className="text-xs text-gray-500">Total Transaksi</p>
                    <p className="text-lg font-bold text-gray-800">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(lookupResult.sale.total)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Produk</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Terjual</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Harga</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Sudah Retur</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Bisa Retur</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Qty Retur</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Kondisi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lookupResult.items.map(item => {
                        const disabled = item.qty_returnable <= 0;
                        return (
                          <tr key={item.product_id} className={`hover:bg-gray-50/50 transition-colors ${disabled ? 'opacity-40' : ''}`}>
                            <td className="px-4 py-3 font-medium">{item.product_name}</td>
                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-center">
                              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.price)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.qty_already_returned > 0 ? (
                                <span className="text-orange-600 font-medium">{item.qty_already_returned}</span>
                              ) : (
                                <span className="text-gray-300">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold">{item.qty_returnable}</td>
                            {/* <td className="px-4 py-3 text-center text-xs">
                              {item.expired_date ? new Date(item.expired_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                            </td> */}
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={item.qty_returnable}
                                disabled={disabled}
                                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                                value={returnQuantities[item.product_id] || ''}
                                onChange={e => handleQtyChange(item.product_id, e.target.value)}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              {disabled ? (
                                <span className="text-gray-300">-</span>
                              ) : (
                                <select
                                  value={returnConditions[item.product_id] || 'baik'}
                                  onChange={e => handleConditionChange(item.product_id, e.target.value)}
                                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                  <option value="baik">Baik</option>
                                  <option value="rusak">Rusak</option>
                                </select>
                              )}
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
              <div className="p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <RotateCcw size={18} className="text-emerald-600" />
                  Konfirmasi Retur
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Alasan Retur</label>
                    <textarea
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                      rows={3}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Contoh: Barang tidak sesuai pesanan..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Metode Refund</label>
                    <select
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      value={refundMethod}
                      onChange={e => setRefundMethod(e.target.value as any)}
                    >
                      <option value="cash">Tunai (Kembalikan Uang ke Pelanggan)</option>
                      <option value="credit_note">Credit Note (Catat Piutang Pelanggan)</option>
                    </select>
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm text-gray-600 flex items-center justify-between">
                        <span className="font-medium">Total Refund</span>
                        <span className="text-xl font-bold text-emerald-700">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalRefund)}</span>
                      </p>
                       <p className="text-xs text-gray-400 mt-1">{lookupResult.items.filter(i => (returnQuantities[i.product_id] || 0) > 0).length} item dipilih</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => { setLookupResult(null); setSearched(false); }}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 flex items-center gap-2 transition-all"
                  >
                    <ArrowLeft size={16} /> Batal
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || totalRefund <= 0}
                    className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-all"
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
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-orange-300" />
              </div>
              <p className="text-lg font-medium text-gray-700">Transaksi tidak ditemukan</p>
              <p className="text-sm text-gray-400 mt-1">Pastikan ID transaksi benar dan statusnya completed</p>
              <button
                onClick={() => { setSearched(false); setSaleId(''); }}
                className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Cari ulang
              </button>
            </div>
          </div>
        )}

        {/* Riwayat Retur Penjualan */}
        <div className="mt-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-5 py-4 bg-white rounded-xl shadow-sm hover:bg-gray-50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <History size={18} className="text-emerald-600" />
              </div>
              <div className="text-left">
                <span className="font-medium text-gray-700">Riwayat Retur Penjualan</span>
                {historyList.length > 0 && (
                  <span className="text-xs text-gray-400 ml-2">({historyList.length} data)</span>
                )}
              </div>
              {historyLoading && <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
            </div>
            <div className={`w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center transition-transform ${showHistory ? 'rotate-180' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </button>

          {showHistory && (
            <div className="mt-3 space-y-3">
              {historyList.length === 0 && !historyLoading && (
                <div className="bg-white rounded-xl shadow-sm p-10 text-center">
                  <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <History size={28} className="text-gray-300" />
                  </div>
                  <p className="text-gray-400 text-sm">Belum ada riwayat retur penjualan</p>
                </div>
              )}
              {historyList.map((ret: any) => (
                <div key={ret.id} className="bg-white rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                          <RotateCcw size={18} className="text-emerald-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-emerald-700">{ret.return_no}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              ret.refund_method === 'cash' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {ret.refund_method === 'cash' ? 'Tunai' : 'Credit Note'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Transaksi #{ret.original_sale_id} &middot; {ret.returned_by_name || '-'}
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
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(ret.total_refund)}
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`http://localhost:5000/api/returns/sales/${ret.id}`, { headers: authHeaders });
                              if (res.ok) {
                                const data = await res.json();
                                setSelectedHistory(data);
                              }
                            } catch {}
                          }}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-1 inline-flex items-center gap-1"
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
                              <span className="text-gray-500">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.price)}
                              </span>
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
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Konfirmasi Retur</h3>
              <p className="text-sm text-gray-500 mb-4">
                Yakin ingin memproses retur penjualan senilai{' '}
                <span className="font-semibold text-gray-800">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalRefund)}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
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
