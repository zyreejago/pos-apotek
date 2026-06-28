"use client";

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { goeyToast } from '@/components/ui/goey-toaster';
import { Download, Calendar, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_URL } from '@/lib/api-config';

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  normal_balance: string;
  total_debit: number;
  total_credit: number;
}

export default function BalanceSheetAccountingPage() {
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
      const res = await fetch(`${API_URL}/api/reports/balance-accounting?month=${month}&year=${year}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      } else {
        const err = await res.json();
        goeyToast.error(err.message || 'Gagal mengambil neraca keuangan', {
          description: 'Terjadi kesalahan saat mengambil data laporan.'
        });
      }
    } catch (error) {
      console.error('Error fetching balance sheet accounting:', error);
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
    const num = Number(amount);
    if (!num) return '';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const getMonthName = (m: number) => {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[m - 1] || '';
  };

  // Calculate account balance
  const getAccountBalance = (account: Account) => {
    if (account.normal_balance === 'debit') {
      return account.total_debit - account.total_credit;
    } else {
      return account.total_credit - account.total_debit;
    }
  };

  // Filter accounts
  const assetAccounts = accounts.filter(a => a.type === 'aktiva');
  const liabilityAccounts = accounts.filter(a => a.type === 'pasiva');
  const equityAccounts = accounts.filter(a => a.type === 'modal');

  // Calculate totals
  const totalAssets = assetAccounts.reduce((sum, a) => sum + getAccountBalance(a), 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + getAccountBalance(a), 0);
  const totalEquity = equityAccounts.reduce((sum, a) => sum + getAccountBalance(a), 0);
  const totalLiabilitiesEquity = totalLiabilities + totalEquity;

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
      doc.text('NERACA KEUANGAN', 105, 45, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Periode: ${getMonthName(month)} ${year}`, 105, 52, { align: 'center' });
      doc.text(`Tanggal Rilis: ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}`, 105, 58, { align: 'center' });

      // Table Content - Left (Assets) and Right (Liabilities & Equity)
      const tableColumnLeft = ['AKTIVA', 'Debit', 'Kredit'];
      const tableRowsLeft: (string | number)[][] = [];
      
      assetAccounts.forEach((a, index) => {
        tableRowsLeft.push([a.name, a.normal_balance === 'debit' ? formatCurrency(getAccountBalance(a)) : '', a.normal_balance === 'kredit' ? formatCurrency(getAccountBalance(a)) : '']);
      });
      tableRowsLeft.push(['TOTAL AKTIVA', formatCurrency(totalAssets), '']);

      const tableColumnRight = ['PASIVA & MODAL', 'Debit', 'Kredit'];
      const tableRowsRight: (string | number)[][] = [];
      
      tableRowsRight.push(['PASIVA', '', '']);
      liabilityAccounts.forEach((a, index) => {
        tableRowsRight.push([a.name, a.normal_balance === 'debit' ? formatCurrency(getAccountBalance(a)) : '', a.normal_balance === 'kredit' ? formatCurrency(getAccountBalance(a)) : '']);
      });
      tableRowsRight.push(['TOTAL PASIVA', '', formatCurrency(totalLiabilities)]);

      tableRowsRight.push(['MODAL', '', '']);
      equityAccounts.forEach((a, index) => {
        tableRowsRight.push([a.name, a.normal_balance === 'debit' ? formatCurrency(getAccountBalance(a)) : '', a.normal_balance === 'kredit' ? formatCurrency(getAccountBalance(a)) : '']);
      });
      tableRowsRight.push(['TOTAL PASIVA & MODAL', '', formatCurrency(totalLiabilitiesEquity)]);

      // Create two tables side by side
      autoTable(doc, {
        head: [tableColumnLeft],
        body: tableRowsLeft,
        startY: 70,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' }
        },
        tableWidth: 85
      });

      autoTable(doc, {
        head: [tableColumnRight],
        body: tableRowsRight,
        startY: 70,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129] },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' }
        },
        tableWidth: 85,
        margin: { left: 105 }
      });

      // Footer
      const finalY = Math.max(
        (doc as any).lastAutoTable.finalY,
        150
      ) + 20;
      
      doc.setFontSize(10);
      doc.text(`Karangasem, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 140, finalY);
      doc.text('Dibuat oleh,', 140, finalY + 6);
      
      doc.setFont('helvetica', 'bold');
      doc.text(username, 140, finalY + 30);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Staff Admin', 140, finalY + 36);

      doc.save(`Neraca_Keuangan_${getMonthName(month)}_${year}.pdf`);
      goeyToast.success('PDF berhasil diunduh', {
        description: `Neraca Keuangan periode ${getMonthName(month)} ${year} telah berhasil disimpan.`
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
        title="Neraca Keuangan"
        subtitle="Laporan Keuangan"
        breadcrumbs={[{ label: 'Sales Report' }, { label: 'Neraca Keuangan' }]}
        rightContent={
           <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
               <div className="flex items-center bg-white border border-gray-200 rounded-lg px-1 sm:px-3 py-0.5 sm:py-1.5 shadow-sm">
                 <Calendar size={12} className="text-gray-500 mr-1 sm:mr-2" />
                 <select 
                   value={month} 
                   onChange={(e) => setMonth(parseInt(e.target.value))}
                   className="text-xs sm:text-sm border-none focus:ring-0 text-gray-700 bg-transparent cursor-pointer outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{getMonthName(m)}</option>
                  ))}
                </select>
                <span className="text-gray-300 mx-2">|</span>
                 <select 
                   value={year} 
                   onChange={(e) => setYear(parseInt(e.target.value))}
                   className="text-xs sm:text-sm border-none focus:ring-0 text-gray-700 bg-transparent cursor-pointer outline-none"
                >
                  {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map((y) => (
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
            <p className="text-gray-500 text-sm">Memuat neraca keuangan...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Assets Column */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 text-center bg-blue-50">
                <h2 className="text-lg font-bold text-blue-900">AKTIVA</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                      <th className="px-3 sm:px-6 py-1.5 sm:py-3">Keterangan</th>
                      <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Debit</th>
                      <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Kredit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {assetAccounts.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-2 sm:px-6 py-1 sm:py-3 text-gray-600">{a.name}</td>
                        <td className="px-2 sm:px-6 py-1 sm:py-3 text-right text-gray-600">
                          {a.normal_balance === 'debit' ? formatCurrency(getAccountBalance(a)) : ''}
                        </td>
                        <td className="px-2 sm:px-6 py-1 sm:py-3 text-right text-gray-600">
                          {a.normal_balance === 'kredit' ? formatCurrency(getAccountBalance(a)) : ''}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-gray-100">
                      <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-gray-900">Total Aktiva</td>
                      <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-right text-gray-900">{formatCurrency(totalAssets)}</td>
                      <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-right text-gray-900"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Liabilities & Equity Column */}
            <div className="space-y-6">
              {/* Liabilities */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 text-center bg-orange-50">
                  <h2 className="text-lg font-bold text-orange-900">PASIVA</h2>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                        <th className="px-3 sm:px-6 py-1.5 sm:py-3">Keterangan</th>
                        <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Debit</th>
                        <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Kredit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {liabilityAccounts.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-2 sm:px-6 py-1 sm:py-3 text-gray-600">{a.name}</td>
                          <td className="px-2 sm:px-6 py-1 sm:py-3 text-right text-gray-600">
                            {a.normal_balance === 'debit' ? formatCurrency(getAccountBalance(a)) : ''}
                          </td>
                          <td className="px-2 sm:px-6 py-1 sm:py-3 text-right text-gray-600">
                            {a.normal_balance === 'kredit' ? formatCurrency(getAccountBalance(a)) : ''}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-gray-100">
                        <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-gray-900">Total Pasiva</td>
                        <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-right text-gray-900"></td>
                        <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-right text-gray-900">{formatCurrency(totalLiabilities)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Equity */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 text-center bg-green-50">
                  <h2 className="text-lg font-bold text-green-900">MODAL</h2>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                        <th className="px-3 sm:px-6 py-1.5 sm:py-3">Keterangan</th>
                        <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Debit</th>
                        <th className="px-2 sm:px-6 py-1.5 sm:py-4 text-right">Kredit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {equityAccounts.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-2 sm:px-6 py-1 sm:py-3 text-gray-600">{a.name}</td>
                          <td className="px-2 sm:px-6 py-1 sm:py-3 text-right text-gray-600">
                            {a.normal_balance === 'debit' ? formatCurrency(getAccountBalance(a)) : ''}
                          </td>
                          <td className="px-2 sm:px-6 py-1 sm:py-3 text-right text-gray-600">
                            {a.normal_balance === 'kredit' ? formatCurrency(getAccountBalance(a)) : ''}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-gray-100">
                        <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-gray-900">Total Modal</td>
                        <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-right text-gray-900"></td>
                        <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-right text-gray-900">{formatCurrency(totalEquity)}</td>
                      </tr>
                      <tr className="font-bold bg-blue-100 border-t-2 border-blue-200">
                        <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-gray-900">Total Pasiva & Modal</td>
                        <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-right text-gray-900"></td>
                        <td className="px-2 sm:px-6 py-1.5 sm:py-4 text-right text-gray-900">{formatCurrency(totalLiabilitiesEquity)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
