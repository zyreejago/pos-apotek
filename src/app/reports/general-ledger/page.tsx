'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { goeyToast } from '@/components/ui/goey-toaster';
import { Download, Calendar, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  normal_balance: string;
}

interface LedgerItem {
  id: number;
  date: string;
  description: string;
  code: string;
  name: string;
  type: string;
  normal_balance: string;
  debit: number;
  credit: number;
}

export default function GeneralLedgerPage() {
  const [loading, setLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState<LedgerItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
  const username = user.username || user.name || 'Admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
        ...(selectedAccountId && { accountId: selectedAccountId })
      });
      
      const res = await fetch(`http://localhost:5000/api/accounting/general-ledger?${queryParams}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        const result = await res.json();
        setLedgerData(result.ledger || []);
        setAccounts(result.accounts || []);
      } else {
        const err = await res.json();
        goeyToast.error(err.message || 'Gagal mengambil buku besar', {
          description: 'Terjadi kesalahan saat mengambil data buku besar.'
        });
      }
    } catch (error) {
      console.error('Error fetching general ledger:', error);
      goeyToast.error('Gagal terhubung ke server', {
        description: 'Periksa koneksi internet Anda dan coba lagi.'
      });
    } finally {
      setLoading(false);
    }
  }, [month, year, selectedAccountId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getMonthName = (m: number) => {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[m - 1] || '';
  };

  // Calculate running balance
  const ledgerWithBalance = () => {
    let balance = 0;
    return ledgerData.map(item => {
      if (item.normal_balance === 'debit') {
        balance += item.debit - item.credit;
      } else {
        balance += item.credit - item.debit;
      }
      return { ...item, balance };
    });
  };

  const handleDownloadPDF = async () => {
    try {
      goeyToast.info('Sedang membuat PDF...', {
        description: 'Mohon tunggu sebentar, laporan sedang diproses.'
      });
      
      const doc = new jsPDF();

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('APOTEK SUMBER WARAS', 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Jl. Kesehatan No. 123, Karangasem', 105, 26, { align: 'center' });
      doc.text('Telp: (021) 12345678 | Email: info@sumberwaras.com', 105, 30, { align: 'center' });
      
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);

      // Report Info
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('BUKU BESAR', 105, 45, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Periode: ${getMonthName(month)} ${year}`, 105, 52, { align: 'center' });
      doc.text(`Tanggal Rilis: ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}`, 105, 58, { align: 'center' });

      // Table Content
      const tableColumn = ['Tanggal', 'Keterangan', 'Debit', 'Kredit', 'Saldo'];
      const tableRows: (string | number)[][] = [];

      const ledgerWithBal = ledgerWithBalance();
      ledgerWithBal.forEach((item) => {
        tableRows.push([
          formatDate(item.date),
          item.description,
          item.debit > 0 ? formatCurrency(item.debit) : '',
          item.credit > 0 ? formatCurrency(item.credit) : '',
          formatCurrency(Math.abs(item.balance)) + (item.balance >= 0 ? (item.normal_balance === 'debit' ? ' Dr' : ' Cr') : (item.normal_balance === 'debit' ? ' Cr' : ' Dr'))
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 70,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' }
        }
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(10);
      doc.text(`Karangasem, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 140, finalY);
      doc.text('Dibuat oleh,', 140, finalY + 6);
      
      doc.setFont('helvetica', 'bold');
      doc.text(username, 140, finalY + 30);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Staff Admin', 140, finalY + 36);

      doc.save(`Buku_Besar_${getMonthName(month)}_${year}.pdf`);
      goeyToast.success('PDF berhasil diunduh', {
        description: `Buku Besar periode ${getMonthName(month)} ${year} telah berhasil disimpan.`
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      goeyToast.error('Gagal membuat PDF', {
        description: 'Terjadi kesalahan saat membuat file PDF. Silakan coba lagi.'
      });
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <PageHeader
        title="Buku Besar"
        subtitle="Laporan Keuangan"
        breadcrumbs={[{ label: 'Sales Report' }, { label: 'Buku Besar' }]}
        rightContent={
           <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
               <div className="flex items-center bg-white border border-gray-200 rounded-lg px-1 sm:px-3 py-0.5 sm:py-1.5 shadow-sm gap-1 sm:gap-2">
                  <select 
                    value={selectedAccountId} 
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="text-xs sm:text-sm border-none focus:ring-0 text-gray-700 bg-transparent cursor-pointer outline-none"
                 >
                   <option value="">Semua Akun</option>
                   {accounts.map(acc => (
                     <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                   ))}
                 </select>
               </div>
               <div className="flex items-center bg-white border border-gray-200 rounded-lg px-1 sm:px-3 py-0.5 sm:py-1.5 shadow-sm">
                 <Calendar size={12} className="text-gray-500 mr-1 sm:mr-2" />
                <select 
                  value={month} 
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="text-xs sm:text-sm border-none focus:ring-0 text-gray-700 bg-transparent cursor-pointer outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{getMonthName(m)}</option>
                  ))}
                </select>
                <span className="text-gray-300 mx-2">|</span>
                <select 
                  value={year} 
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="text-xs sm:text-sm border-none focus:ring-0 text-gray-700 bg-transparent cursor-pointer outline-none"
                >
                  {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleDownloadPDF}
                className="flex items-center gap-1 sm:gap-2 bg-blue-600 text-white px-1.5 sm:px-4 py-0.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Download size={12} />
               Download PDF
             </button>
          </div>
        }
      />
      
      <div className="p-3 sm:p-4 md:p-8 pt-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
            <p className="text-gray-500 text-sm">Memuat buku besar...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                      <th className="px-3 sm:px-6 py-1.5 sm:py-3">Tanggal</th>
                      <th className="px-3 sm:px-6 py-1.5 sm:py-3">Keterangan</th>
                      <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Debit</th>
                      <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Kredit</th>
                      <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ledgerWithBalance().map((item, index) => (
                      <tr key={`${item.id}-${index}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-2 sm:px-6 py-1 sm:py-3 text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                        <td className="px-2 sm:px-6 py-1 sm:py-3 text-gray-600">{item.description}</td>
                        <td className="px-2 sm:px-6 py-1 sm:py-3 text-right text-gray-600">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</td>
                        <td className="px-2 sm:px-6 py-1 sm:py-3 text-right text-gray-600">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</td>
                        <td className={`px-2 sm:px-6 py-1 sm:py-3 text-right font-medium ${item.balance >= 0 ? (item.normal_balance === 'debit' ? 'text-blue-600' : 'text-green-600') : (item.normal_balance === 'debit' ? 'text-red-600' : 'text-orange-600')}`}>
                          {formatCurrency(Math.abs(item.balance))} {item.balance >= 0 ? (item.normal_balance === 'debit' ? 'Dr' : 'Cr') : (item.normal_balance === 'debit' ? 'Cr' : 'Dr')}
                        </td>
                      </tr>
                    ))}
                  {ledgerData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 sm:px-6 py-3 sm:py-8 text-center text-gray-500">Tidak ada transaksi pada periode ini</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
