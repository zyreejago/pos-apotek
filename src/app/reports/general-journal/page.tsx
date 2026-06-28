'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { goeyToast } from '@/components/ui/goey-toaster';
import { Plus, Trash2, Calendar, Loader2, Save, FileText, X } from 'lucide-react';
import OffCanvas from '@/components/OffCanvas';
import { API_URL } from '@/lib/api-config';

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  normal_balance: string;
}

interface JournalItem {
  id: number;
  debit: number;
  credit: number;
  account_code: string;
  account_name: string;
  account_type: string;
}

interface JournalEntry {
  id: number;
  date: string;
  description: string;
  created_at: string;
  items: JournalItem[];
}

interface InputItem {
  account_id: string;
  debit: string;
  credit: string;
}

export default function GeneralJournalPage() {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);

  // Date filters
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  // Form states
  const [entryDate, setEntryDate] = useState(today);
  const [entryDescription, setEntryDescription] = useState('');
  const [inputItems, setInputItems] = useState<InputItem[]>([
    { account_id: '', debit: '', credit: '' },
    { account_id: '', debit: '', credit: '' }
  ]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };

  const fetchJournalEntries = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        startDate,
        endDate
      });
      const res = await fetch(`${API_URL}/api/accounting/journal-entries?${queryParams}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const json = await res.json();
        setEntries(json.data || []);
      } else {
        const err = await res.json();
        goeyToast.error(err.message || 'Gagal mengambil jurnal umum');
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      goeyToast.error('Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, token]);

  const fetchAccounts = useCallback(async () => {
    try {
      const now = new Date();
      const m = now.getMonth() + 1;
      const y = now.getFullYear();
      const res = await fetch(`${API_URL}/api/accounting/general-ledger?month=${m}&year=${y}`, {
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
    fetchJournalEntries();
    fetchAccounts();
  }, [fetchJournalEntries, fetchAccounts]);

  const handleAddInputRow = () => {
    setInputItems([...inputItems, { account_id: '', debit: '', credit: '' }]);
  };

  const handleRemoveInputRow = (index: number) => {
    if (inputItems.length <= 2) {
      goeyToast.error('Jurnal minimal memiliki 2 baris (Debit & Kredit)');
      return;
    }
    const updated = [...inputItems];
    updated.splice(index, 1);
    setInputItems(updated);
  };

  const handleItemChange = (index: number, field: keyof InputItem, value: string) => {
    const updated = [...inputItems];
    updated[index] = { ...updated[index], [field]: value };
    setInputItems(updated);
  };

  // Calculations for form
  const totalDebit = inputItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
  const totalCredit = inputItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.01 && totalDebit > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      goeyToast.error('Total Debit dan Kredit harus seimbang (dan lebih besar dari 0)');
      return;
    }

    // Filter out rows without selected accounts
    const formattedItems = inputItems
      .filter(item => item.account_id)
      .map(item => ({
        account_id: parseInt(item.account_id),
        debit: Number(item.debit) || 0,
        credit: Number(item.credit) || 0
      }));

    if (formattedItems.length < 2) {
      goeyToast.error('Pilih setidaknya 2 akun valid');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/accounting/journal-entries`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          date: entryDate,
          description: entryDescription,
          items: formattedItems
        })
      });

      if (res.ok) {
        goeyToast.success('Jurnal Umum berhasil disimpan');
        setIsOffCanvasOpen(false);
        setEntryDescription('');
        setEntryDate(today);
        setInputItems([
          { account_id: '', debit: '', credit: '' },
          { account_id: '', debit: '', credit: '' }
        ]);
        fetchJournalEntries();
      } else {
        const err = await res.json();
        goeyToast.error(err.message || 'Gagal menyimpan jurnal');
      }
    } catch (error) {
      console.error('Error creating journal entry:', error);
      goeyToast.error('Terjadi kesalahan koneksi');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-gray-50 min-h-screen relative p-4 sm:p-8">
      <PageHeader
        title="Jurnal Umum (General Journal)"
        subtitle="Pencatatan transaksi manual dan daftar seluruh ayat jurnal sistem"
        rightContent={
          <button
            onClick={() => setIsOffCanvasOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-1.5 sm:px-4 py-0.5 sm:py-2 rounded-lg flex items-center gap-1 sm:gap-2 text-[10px] sm:text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={14} />
            Buat Jurnal Manual
          </button>
        }
      />

      {/* Filter Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row md:items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tanggal Mulai</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tanggal Selesai</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
        </div>
        <button
          onClick={fetchJournalEntries}
          className="px-2 sm:px-6 py-1 sm:py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          Filter Laporan
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center items-center text-gray-500">
            <Loader2 className="animate-spin mr-2" /> Sedang memuat jurnal...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Tidak ada transaksi jurnal pada rentang tanggal ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead className="bg-gray-50 text-gray-500 font-medium uppercase text-xs border-b border-gray-100">
                <tr>
                  <th className="px-3 sm:px-6 py-1.5 sm:py-3">Tanggal & Deskripsi</th>
                  <th className="px-3 sm:px-6 py-1.5 sm:py-3">Akun</th>
                  <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Debit</th>
                  <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Kredit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    {/* Header Row of the entry */}
                    <tr className="bg-gray-50/50">
                      <td colSpan={4} className="px-2 sm:px-6 py-1 sm:py-3 font-semibold text-gray-800 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span>{formatDate(entry.date)}</span>
                          <span className="text-xs text-gray-400 font-normal">ID Jurnal: #{entry.id}</span>
                        </div>
                        <div className="text-xs text-gray-500 font-normal mt-1 italic">
                          Keterangan: {entry.description}
                        </div>
                      </td>
                    </tr>
                    {/* Item lines */}
                    {entry.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-gray-50/30">
                        <td className="px-3 sm:px-6 py-1 sm:py-3"></td>
                        <td className="px-3 sm:px-6 py-1 sm:py-3">
                          <div className={item.credit > 0 ? "pl-8 text-gray-600" : "font-medium text-gray-900"}>
                            <span className="text-xs text-gray-400 font-mono mr-2 bg-gray-100 px-1.5 py-0.5 rounded">{item.account_code}</span>
                            {item.account_name}
                          </div>
                        </td>
                        <td className="px-2 sm:px-6 py-1 sm:py-3 text-right text-gray-950 font-medium">
                          {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                        </td>
                        <td className="px-2 sm:px-6 py-1 sm:py-3 text-right text-gray-950 font-medium">
                          {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Input OffCanvas */}
      {isOffCanvasOpen && (
        <OffCanvas
          isOpen={isOffCanvasOpen}
          onClose={() => setIsOffCanvasOpen(false)}
          title="Buat Jurnal Umum Manual"
          width="700px"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan / Deskripsi</label>
                <input
                  type="text"
                  required
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  placeholder="Contoh: Pembayaran internet bulanan"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Daftar Akun Jurnal (Debits & Credits)</span>
                <button
                  type="button"
                  onClick={handleAddInputRow}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 border border-blue-200 px-1 sm:px-2 py-0.5 sm:py-1 rounded hover:bg-blue-50 transition-colors"
                >
                  + Tambah Baris
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {inputItems.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex-1 min-w-[200px]">
                      <select
                        required
                        value={item.account_id}
                        onChange={(e) => handleItemChange(index, 'account_id', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">-- Pilih Akun --</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full sm:w-32">
                      <input
                        type="number"
                        placeholder="Debit"
                        value={item.debit}
                        disabled={!!item.credit}
                        onChange={(e) => handleItemChange(index, 'debit', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </div>

                    <div className="w-full sm:w-32">
                      <input
                        type="number"
                        placeholder="Kredit"
                        value={item.credit}
                        disabled={!!item.debit}
                        onChange={(e) => handleItemChange(index, 'credit', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveInputRow(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Balancer Check */}
            <div className="bg-gray-100 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Debit:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totalDebit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Kredit:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totalCredit)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-gray-600">Selisih (Balance):</span>
                <span className={`font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(difference)}
                  {isBalanced ? ' (Seimbang)' : ' (Belum Seimbang)'}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsOffCanvasOpen(false)}
                className="px-2 sm:px-4 py-1 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!isBalanced}
                className="px-2 sm:px-4 py-1 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                Simpan Jurnal
              </button>
            </div>
          </form>
        </OffCanvas>
      )}
    </div>
  );
}
