"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { useToast } from '@/components/ToastProvider';
import { Download, Calendar, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

export default function Page() {
  const { showToast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || '{}') : {};
  const username = user.username || user.name || "Admin";

  const fetchData = async () => {
    setLoading(true);
    try {
      // Note: The backend endpoint currently returns current snapshot, ignoring month/year query params
      // but we send them in case we implement historical balance sheets later.
      const res = await fetch(`http://localhost:5000/api/reports/balance?month=${month}&year=${year}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        const err = await res.json();
        showToast(err.message || "Failed to fetch balance sheet", "error");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      showToast("Error connecting to server", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const handleDownloadPDF = async () => {
    try {
      showToast("Generating PDF...", "info");
      
      const doc = new jsPDF();

      // 1. Header (Kop)
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("APOTEK SUMBER WARAS", 105, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Jl. Kesehatan No. 123, Kota Sehat", 105, 26, { align: "center" });
      doc.text("Telp: (021) 12345678 | Email: info@sumberwaras.com", 105, 30, { align: "center" });
      
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);

      // 2. Report Info
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("NERACA KEUANGAN", 105, 45, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Periode: ${getMonthName(month)} ${year}`, 105, 52, { align: "center" });
      doc.text(`Terakhir Update: ${new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}`, 105, 58, { align: "center" });

      let currentY = 70;

      // Helper for sections
      const addSection = (title: string, items: {label: string, amount: number}[], totalLabel: string, total: number) => {
        // Section Title
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(59, 130, 246); // Blue
        doc.text(title, 14, currentY);
        currentY += 8;

        // Items
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0); // Black
        
        items.forEach((item, idx) => {
          doc.text(`${idx + 1}. ${item.label}`, 14, currentY);
          doc.text(formatCurrency(item.amount), 196, currentY, { align: 'right' });
          currentY += 6;
        });

        // Total Line
        doc.setLineWidth(0.1);
        doc.line(14, currentY, 196, currentY);
        currentY += 6;
        
        doc.setFont("helvetica", "bold");
        doc.text(totalLabel, 14, currentY);
        doc.text(formatCurrency(total), 196, currentY, { align: 'right' });
        currentY += 15; // Space before next section
      };

      // 3. Content Sections
      if (data) {
        // Aset
        const assetItems = [
          { label: "Uang Kas", amount: data.assets.cash },
          { label: "Persediaan Barang", amount: data.assets.inventory },
          { label: "Piutang Usaha", amount: data.assets.receivables }
        ];
        addSection("Aset", assetItems, "Total Aset", data.assets.total);

        // Liabilitas
        const liabilityItems = [
          { label: "Hutang Usaha", amount: data.liabilities.payables },
          { label: "Hutang Konsinyasi", amount: data.liabilities.consignmentDebt }
        ];
        addSection("Liabilitas/Beban", liabilityItems, "Total Beban", data.liabilities.total);

        // Ekuitas
        const equityItems = [
          { label: "Ekuitas Awal", amount: data.equity.initial },
          { label: "Penambahan/Pengurangan Modal", amount: data.equity.capitalChanges },
          { label: "Laba/Rugi Tertahan", amount: data.equity.retainedEarnings }
        ];
        addSection("Ekuitas", equityItems, "Total Ekuitas Akhir", data.equity.total);
      }

      // 4. Footer (Signature)
      // Check page break
      if (currentY > 250) {
        doc.addPage();
        currentY = 40;
      }

      const signatureY = currentY + 10;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Kota Sehat, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 140, signatureY);
      doc.text("Dibuat oleh,", 140, signatureY + 6);
      
      doc.setFont("helvetica", "bold");
      doc.text(username, 140, signatureY + 30);
      doc.setLineWidth(0.2);
      // doc.line(140, signatureY + 31, 190, signatureY + 31); // Underline name
      
      doc.setFont("helvetica", "normal");
      doc.text("Staff Admin", 140, signatureY + 36);

      doc.save(`Neraca_Keuangan_${month}_${year}.pdf`);
      showToast("PDF Downloaded successfully", "success");
    } catch (error) {
      console.error("Error generating PDF:", error);
      showToast("Failed to generate PDF", "error");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getMonthName = (m: number) => {
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return months[m - 1] || "";
  };

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <Header
        title="Neraca Keuangan"
        subtitle="Laporan Keuangan"
        breadcrumbs={[{ label: 'Sales Report' }, { label: 'Neraca Keuangan' }]}
        rightContent={
          <div className="flex items-center gap-3">
             <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
               <Calendar size={16} className="text-gray-500 mr-2" />
               <select 
                 value={month} 
                 onChange={(e) => setMonth(parseInt(e.target.value))}
                 className="text-sm border-none focus:ring-0 text-gray-700 bg-transparent cursor-pointer outline-none"
               >
                 {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                   <option key={m} value={m}>{getMonthName(m)}</option>
                 ))}
               </select>
               <span className="text-gray-300 mx-2">|</span>
               <select 
                 value={year} 
                 onChange={(e) => setYear(parseInt(e.target.value))}
                 className="text-sm border-none focus:ring-0 text-gray-700 bg-transparent cursor-pointer outline-none"
               >
                 {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map(y => (
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
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
            <p className="text-gray-500 text-sm">Memuat neraca keuangan...</p>
          </div>
        ) : (
          <div ref={reportRef} className="bg-white w-full max-w-4xl p-10 rounded-xl shadow-sm border border-gray-100 min-h-[800px]">
            {/* Report Header */}
            <div className="text-center mb-10 border-b border-gray-100 pb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Neraca Keuangan</h2>
              <div className="text-gray-500 text-sm">
                <p>Periode: Bulan {getMonthName(month)}, Tahun {year}</p>
                <p className="mt-1">Terakhir Update: {new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
            </div>

            {/* Content */}
            {data && (
              <div className="space-y-10">
                
                {/* Assets Section */}
                <div>
                  <h3 className="text-blue-500 font-semibold mb-4 text-sm uppercase tracking-wide">Aset</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>1. Uang Kas</span>
                      <span>{formatCurrency(data.assets.cash)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>2. Persediaan Barang</span>
                      <span>{formatCurrency(data.assets.inventory)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>3. Piutang Usaha</span>
                      <span>{formatCurrency(data.assets.receivables)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-gray-900 pt-3 border-t border-gray-100 mt-2">
                      <span>Total Aset</span>
                      <span>{formatCurrency(data.assets.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Liabilities Section */}
                <div>
                  <h3 className="text-blue-500 font-semibold mb-4 text-sm uppercase tracking-wide">Liabilitas/Beban</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>1. Hutang Usaha</span>
                      <span>{formatCurrency(data.liabilities.payables)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>2. Hutang Konsinyasi</span>
                      <span>{formatCurrency(data.liabilities.consignmentDebt)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-gray-900 pt-3 border-t border-gray-100 mt-2">
                      <span>Total Beban</span>
                      <span>{formatCurrency(data.liabilities.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Equity Section */}
                <div>
                  <h3 className="text-blue-500 font-semibold mb-4 text-sm uppercase tracking-wide">Ekuitas</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>1. Ekuitas Awal</span>
                      <span>{formatCurrency(data.equity.initial)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>2. Penambahan/Pengurangan Modal</span>
                      <span>{formatCurrency(data.equity.capitalChanges)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>3. Laba/Rugi Tertahan</span>
                      <span>{formatCurrency(data.equity.retainedEarnings)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-gray-900 pt-3 border-t border-gray-100 mt-2">
                      <span>Total Ekuitas Akhir</span>
                      <span>{formatCurrency(data.equity.total)}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}