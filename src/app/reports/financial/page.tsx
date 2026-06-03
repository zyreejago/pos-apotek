"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { goeyToast } from '@/components/ui/goey-toaster';
import { Download, Calendar, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Account {
  code: string;
  name: string;
  type: string;
  normal_balance: string;
  total_debit: number;
  total_credit: number;
}

export default function ProfitLossAccountingPage() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
  const username = user.username || user.name || 'Admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/financial/profit-loss-accounting?month=${month}&year=${year}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      } else {
        const err = await res.json();
        goeyToast.error(err.message || 'Gagal mengambil laporan laba rugi', {
          description: 'Terjadi kesalahan saat mengambil data laporan.'
        });
      }
    } catch (error) {
      console.error('Error fetching profit loss accounting:', error);
      goeyToast.error('Gagal terhubung ke server', {
        description: 'Periksa koneksi internet Anda dan coba lagi.'
      });
    } finally {
      setLoading(false);
    }
  }, [month, year, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Filter accounts for profit and loss
  const revenueAccounts = accounts.filter(a => a.type === 'pendapatan');
  const expenseAccounts = accounts.filter(a => a.type === 'beban');

  // Calculate totals
  const totalRevenue = revenueAccounts.reduce((sum, a) => sum + (a.total_credit - a.total_debit), 0);
  const totalExpenses = expenseAccounts.reduce((sum, a) => sum + (a.total_debit - a.total_credit), 0);
  const netProfit = totalRevenue - totalExpenses;

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
      doc.text('LAPORAN LABA RUGI', 105, 45, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Periode: ${getMonthName(month)} ${year}`, 105, 52, { align: 'center' });
      doc.text(`Tanggal Rilis: ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}`, 105, 58, { align: 'center' });

      // Table Content
      const tableColumn = ['No', 'Keterangan', 'Debit', 'Kredit'];
      const tableRows: (string | number)[][] = [];

      // Revenue accounts
      tableRows.push(['', 'PENDAPATAN', '', '']);
      revenueAccounts.forEach((a, index) => {
        tableRows.push([index + 1, a.name, formatCurrency(a.total_debit), formatCurrency(a.total_credit)]);
      });
      tableRows.push(['', 'Total Pendapatan', '', formatCurrency(totalRevenue)]);

      // Expense accounts
      tableRows.push(['', 'BEBAN', '', '']);
      expenseAccounts.forEach((a, index) => {
        tableRows.push([revenueAccounts.length + index + 1, a.name, formatCurrency(a.total_debit), formatCurrency(a.total_credit)]);
      });
      tableRows.push(['', 'Total Beban', formatCurrency(totalExpenses), '']);

      // Net Profit
      tableRows.push(['', 'LABA BERSIH', netProfit < 0 ? formatCurrency(Math.abs(netProfit)) : '', netProfit >= 0 ? formatCurrency(netProfit) : '']);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 70,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' }
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

      doc.save(`Laporan_Laba_Rugi_${getMonthName(month)}_${year}.pdf`);
      goeyToast.success('PDF berhasil diunduh', {
        description: `Laporan Laba Rugi periode ${getMonthName(month)} ${year} telah berhasil disimpan.`
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
      <Header
        title="Laporan Laba Rugi"
        subtitle="Laporan Keuangan"
        breadcrumbs={[{ label: 'Sales Report' }, { label: 'Laporan Laba Rugi' }]}
        rightContent={
          <div className="flex items-center gap-3">
             <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
               <Calendar size={16} className="text-gray-500 mr-2" />
               <select 
                 value={month} 
                 onChange={(e) => setMonth(parseInt(e.target.value))}
                 className="text-sm border-none focus:ring-0 text-gray-700 bg-transparent cursor-pointer outline-none"
               >
                 {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                   <option key={m} value={m}>{getMonthName(m)}</option>
                 ))}
               </select>
               <span className="text-gray-300 mx-2">|</span>
               <select 
                 value={year} 
                 onChange={(e) => setYear(parseInt(e.target.value))}
                 className="text-sm border-none focus:ring-0 text-gray-700 bg-transparent cursor-pointer outline-none"
               >
                 {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map((y) => (
                   <option key={y} value={y}>{y}</option>
                 ))}
               </select>
             </div>
             <button 
               onClick={handleDownloadPDF}
               className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
             >
               <Download size={16} />
               Download PDF
             </button>
          </div>
        }
      />
      
      <div className="p-8 pt-0 flex justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
            <p className="text-gray-500 text-sm">Memuat laporan laba rugi...</p>
          </div>
        ) : (
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 text-center">
              <h2 className="text-xl font-bold text-gray-900">Laporan Laba Rugi</h2>
              <p className="text-gray-500 text-sm mt-2">Periode: {getMonthName(month)} {year}</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                    <th className="px-6 py-4">No</th>
                    <th className="px-6 py-4">Keterangan</th>
                    <th className="px-6 py-4 text-right">Debit</th>
                    <th className="px-6 py-4 text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* Revenue Section */}
                  <tr className="bg-blue-50">
                    <td colSpan={4} className="px-6 py-4 font-bold text-blue-700">PENDAPATAN</td>
                  </tr>
                  {revenueAccounts.map((a, index) => (
                    <tr key={a.code} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-600">{index + 1}</td>
                      <td className="px-6 py-3 text-gray-600">{a.name}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(a.total_debit)}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(a.total_credit)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-gray-50">
                    <td colSpan={2} className="px-6 py-4 text-gray-900">Total Pendapatan</td>
                    <td className="px-6 py-4 text-right text-gray-900"></td>
                    <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(totalRevenue)}</td>
                  </tr>

                  {/* Expense Section */}
                  <tr className="bg-orange-50">
                    <td colSpan={4} className="px-6 py-4 font-bold text-orange-700">BEBAN</td>
                  </tr>
                  {expenseAccounts.map((a, index) => (
                    <tr key={a.code} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-600">{revenueAccounts.length + index + 1}</td>
                      <td className="px-6 py-3 text-gray-600">{a.name}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(a.total_debit)}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(a.total_credit)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-gray-50">
                    <td colSpan={2} className="px-6 py-4 text-gray-900">Total Beban</td>
                    <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(totalExpenses)}</td>
                    <td className="px-6 py-4 text-right text-gray-900"></td>
                  </tr>

                  {/* Net Profit */}
                  <tr className="font-bold bg-gray-100">
                    <td colSpan={2} className="px-6 py-4 text-gray-900 text-lg">LABA BERSIH</td>
                    <td className="px-6 py-4 text-right text-gray-900 text-lg">{netProfit < 0 ? formatCurrency(Math.abs(netProfit)) : ''}</td>
                    <td className="px-6 py-4 text-right text-gray-900 text-lg">{netProfit >= 0 ? formatCurrency(netProfit) : ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
