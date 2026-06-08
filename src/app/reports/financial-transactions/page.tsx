'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { goeyToast } from '@/components/ui/goey-toaster';
import { Wallet, Landmark, TrendingUp, Cpu, Truck, UserCheck, RefreshCw, Send, Ban } from 'lucide-react';
import { useRequirePermission } from '@/hooks/useRequirePermission';

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  normal_balance: string;
}

export default function FinancialTransactionsPage() {
  const [activeTab, setActiveTab] = useState<'expense' | 'equity' | 'asset'>('expense');
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { checkActionPermission } = useRequirePermission('Sales Report');
  const canCreate = checkActionPermission('create');

  // Auth tokens
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };

  // Common forms state
  const today = new Date().toISOString().split('T')[0];

  // 1. Operational Expense Form
  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [expensePaymentAccountId, setExpensePaymentAccountId] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');

  // 2. Capital / Equity Form
  const [equityType, setEquityType] = useState<'setor' | 'tarik'>('setor');
  const [equityDate, setEquityDate] = useState(today);
  const [equityPaymentAccountId, setEquityPaymentAccountId] = useState('');
  const [equityAmount, setEquityAmount] = useState('');
  const [equityDescription, setEquityDescription] = useState('');

  // 3. Fixed Asset Form
  const [assetDate, setAssetDate] = useState(today);
  const [assetAccountId, setAssetAccountId] = useState('');
  const [assetPaymentMethod, setAssetPaymentMethod] = useState<'tunai' | 'kredit'>('tunai');
  const [assetPaymentAccountId, setAssetPaymentAccountId] = useState(''); // for cash/bank
  const [assetAmount, setAssetAmount] = useState('');
  const [assetDescription, setAssetDescription] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      const now = new Date();
      const m = now.getMonth() + 1;
      const y = now.getFullYear();
      const res = await fetch(`http://localhost:5000/api/accounting/general-ledger?month=${m}&year=${y}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const json = await res.json();
        setAccounts(json.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Helper helper to find account by code
  const getAccountByCode = (code: string) => accounts.find(a => a.code === code);

  // Lists of accounts for dropdowns based on schema
  const expenseAccounts = accounts.filter(a => a.code.startsWith('5') && !['501', '502', '525', '527'].includes(a.code)); // Beban Operasional (excludes HPP & Expired/Selisih Beban)
  const cashAndBankAccounts = accounts.filter(a => a.code === '101' || a.code === '102'); // Kas / Bank
  const assetAccountsList = accounts.filter(a => a.code === '121' || a.code === '122' || a.code === '123'); // Peralatan Apotek, Komputer, Kendaraan

  const resetForms = () => {
    setExpenseDate(today);
    setExpenseAccountId('');
    setExpensePaymentAccountId('');
    setExpenseAmount('');
    setExpenseDescription('');

    setEquityType('setor');
    setEquityDate(today);
    setEquityPaymentAccountId('');
    setEquityAmount('');
    setEquityDescription('');

    setAssetDate(today);
    setAssetAccountId('');
    setAssetPaymentMethod('tunai');
    setAssetPaymentAccountId('');
    setAssetAmount('');
    setAssetDescription('');
  };

  const handlePostTransaction = async (date: string, description: string, items: { account_id: number; debit: number; credit: number }[]) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/accounting/journal-entries', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ date, description, items })
      });

      if (res.ok) {
        goeyToast.success('Transaksi Keuangan berhasil diposting!');
        resetForms();
      } else {
        const err = await res.json();
        goeyToast.error(err.message || 'Gagal menyimpan transaksi');
      }
    } catch (error) {
      console.error('Error posting transaction:', error);
      goeyToast.error('Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  };

  // Submit Expense
  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAccountId || !expensePaymentAccountId || !expenseAmount || Number(expenseAmount) <= 0) {
      goeyToast.error('Harap lengkapi semua field dengan benar');
      return;
    }

    const expenseAcc = accounts.find(a => a.id === parseInt(expenseAccountId));
    const payAcc = accounts.find(a => a.id === parseInt(expensePaymentAccountId));
    if (!expenseAcc || !payAcc) return;

    const items = [
      { account_id: expenseAcc.id, debit: Number(expenseAmount), credit: 0 },
      { account_id: payAcc.id, debit: 0, credit: Number(expenseAmount) }
    ];

    handlePostTransaction(
      expenseDate,
      expenseDescription || `Biaya Operasional - ${expenseAcc.name}`,
      items
    );
  };

  // Submit Equity
  const handleEquitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equityPaymentAccountId || !equityAmount || Number(equityAmount) <= 0) {
      goeyToast.error('Harap lengkapi semua field dengan benar');
      return;
    }

    const payAcc = accounts.find(a => a.id === parseInt(equityPaymentAccountId));
    const modalAcc = getAccountByCode('301'); // Modal Pemilik
    const priveAcc = getAccountByCode('302'); // Prive Pemilik

    if (!payAcc || !modalAcc || !priveAcc) {
      goeyToast.error('Akun modal/prive tidak ditemukan di database.');
      return;
    }

    let items = [];
    let desc = equityDescription;

    if (equityType === 'setor') {
      // Setor Modal: Debit Kas/Bank, Kredit Modal Pemilik
      items = [
        { account_id: payAcc.id, debit: Number(equityAmount), credit: 0 },
        { account_id: modalAcc.id, debit: 0, credit: Number(equityAmount) }
      ];
      desc = desc || 'Penyetoran modal oleh pemilik';
    } else {
      // Tarik Prive: Debit Prive Pemilik, Kredit Kas/Bank
      items = [
        { account_id: priveAcc.id, debit: Number(equityAmount), credit: 0 },
        { account_id: payAcc.id, debit: 0, credit: Number(equityAmount) }
      ];
      desc = desc || 'Penarikan prive oleh pemilik';
    }

    handlePostTransaction(equityDate, desc, items);
  };

  // Submit Asset Purchase
  const handleAssetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetAccountId || !assetAmount || Number(assetAmount) <= 0) {
      goeyToast.error('Harap lengkapi semua field dengan benar');
      return;
    }

    const assetAcc = accounts.find(a => a.id === parseInt(assetAccountId));
    if (!assetAcc) return;

    let creditAccId = 0;
    if (assetPaymentMethod === 'tunai') {
      if (!assetPaymentAccountId) {
        goeyToast.error('Pilih akun kas atau bank pembayar');
        return;
      }
      creditAccId = parseInt(assetPaymentAccountId);
    } else {
      const debtAcc = getAccountByCode('201'); // Hutang Usaha Supplier
      if (!debtAcc) {
        goeyToast.error('Akun Hutang Usaha tidak ditemukan');
        return;
      }
      creditAccId = debtAcc.id;
    }

    const items = [
      { account_id: assetAcc.id, debit: Number(assetAmount), credit: 0 },
      { account_id: creditAccId, debit: 0, credit: Number(assetAmount) }
    ];

    handlePostTransaction(
      assetDate,
      assetDescription || `Pembelian Aset Tetap - ${assetAcc.name}`,
      items
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen p-8 relative">
      <PageHeader
        title="Pencatatan Transaksi Keuangan"
        subtitle="Wizard transaksi otomatis untuk mencatat pengeluaran operasional, permodalan, dan pembelian aset tanpa entri manual jurnal debit/kredit."
      />

      {/* Tabs Menu */}
      <div className="flex gap-4 mb-8 bg-white p-2 rounded-xl shadow-sm border border-gray-100 max-w-full sm:max-w-2xl mx-auto">
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'expense'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Wallet size={16} />
          Biaya Operasional
        </button>
        <button
          onClick={() => setActiveTab('equity')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'equity'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Landmark size={16} />
          Modal & Prive
        </button>
        <button
          onClick={() => setActiveTab('asset')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'asset'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <TrendingUp size={16} />
          Aset Tetap
        </button>
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-full sm:max-w-2xl mx-auto">
        {activeTab === 'expense' && (
          <form onSubmit={handleExpenseSubmit} className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Wallet className="text-blue-600" /> Catat Biaya Operasional
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Akun Pengeluaran (Beban)</label>
                <select
                  required
                  value={expenseAccountId}
                  onChange={(e) => setExpenseAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">-- Pilih Beban --</option>
                  {expenseAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dibayar Menggunakan</label>
                <select
                  required
                  value={expensePaymentAccountId}
                  onChange={(e) => setExpensePaymentAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">-- Pilih Kas/Bank --</option>
                  {cashAndBankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rupiah)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi / Keterangan Tambahan</label>
              <textarea
                rows={3}
                placeholder="Contoh: Bayar air PAM bulan Juni"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !canCreate}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? <RefreshCw className="animate-spin" size={16} /> : !canCreate ? <Ban size={16} /> : <Send size={16} />}
              {!canCreate ? 'Akses Ditolak' : 'Posting Biaya'}
            </button>
          </form>
        )}

        {activeTab === 'equity' && (
          <form onSubmit={handleEquitySubmit} className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Landmark className="text-blue-600" /> Catat Modal & Prive
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Transaksi</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setEquityType('setor')}
                    className={`flex-1 py-1 px-3 text-xs font-semibold rounded-md transition-all ${
                      equityType === 'setor' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    Setor Modal
                  </button>
                  <button
                    type="button"
                    onClick={() => setEquityType('tarik')}
                    className={`flex-1 py-1 px-3 text-xs font-semibold rounded-md transition-all ${
                      equityType === 'tarik' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    Prive (Tarik Tunai)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  required
                  value={equityDate}
                  onChange={(e) => setEquityDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Akun Kas / Bank Tujuan</label>
                <select
                  required
                  value={equityPaymentAccountId}
                  onChange={(e) => setEquityPaymentAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">-- Pilih Kas/Bank --</option>
                  {cashAndBankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rupiah)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={equityAmount}
                  onChange={(e) => setEquityAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi / Keterangan</label>
              <textarea
                rows={3}
                placeholder={equityType === 'setor' ? 'Contoh: Setoran tambahan modal awal apotek' : 'Contoh: Ambil kas apotek keperluan mendesak pemilik'}
                value={equityDescription}
                onChange={(e) => setEquityDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !canCreate}
              className={`w-full py-3 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed ${
                !canCreate ? '' : equityType === 'setor' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? <RefreshCw className="animate-spin" size={16} /> : !canCreate ? <Ban size={16} /> : <Send size={16} />}
              {!canCreate ? 'Akses Ditolak' : `Posting Permodalan (${equityType === 'setor' ? 'Setor Modal' : 'Tarik Prive'})`}
            </button>
          </form>
        )}

        {activeTab === 'asset' && (
          <form onSubmit={handleAssetSubmit} className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-3">
              <TrendingUp className="text-blue-600" /> Beli Aset Tetap
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  required
                  value={assetDate}
                  onChange={(e) => setAssetDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Aset Tetap</label>
                <select
                  required
                  value={assetAccountId}
                  onChange={(e) => setAssetAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">-- Pilih Jenis Aset --</option>
                  {assetAccountsList.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setAssetPaymentMethod('tunai')}
                    className={`flex-1 py-1 px-3 text-xs font-semibold rounded-md transition-all ${
                      assetPaymentMethod === 'tunai' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    Tunai (Kas/Bank)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetPaymentMethod('kredit')}
                    className={`flex-1 py-1 px-3 text-xs font-semibold rounded-md transition-all ${
                      assetPaymentMethod === 'kredit' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    Kredit (Hutang)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga Pembelian (Nominal)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={assetAmount}
                  onChange={(e) => setAssetAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {assetPaymentMethod === 'tunai' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dibayar Menggunakan</label>
                <select
                  required
                  value={assetPaymentAccountId}
                  onChange={(e) => setAssetPaymentAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">-- Pilih Kas/Bank --</option>
                  {cashAndBankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-purple-50 border border-purple-200 text-purple-800 rounded-lg p-3 text-sm">
                <strong>Catatan:</strong> Pembelian secara kredit akan secara otomatis dicatat ke akun <strong>Hutang Usaha Supplier (201)</strong>.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi / Keterangan</label>
              <textarea
                rows={3}
                placeholder="Contoh: Beli AC Sharp untuk Apotek baru"
                value={assetDescription}
                onChange={(e) => setAssetDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !canCreate}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? <RefreshCw className="animate-spin" size={16} /> : !canCreate ? <Ban size={16} /> : <Send size={16} />}
              {!canCreate ? 'Akses Ditolak' : 'Posting Pembelian Aset'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
