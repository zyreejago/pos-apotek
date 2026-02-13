"use client";

import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { useToast } from '@/components/ToastProvider';
import { Download, Calendar, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable (optional if you want strict typing)
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

export default function TransactionReportPage() {
  const { showToast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ transactions: any[], chartData: any[] }>({ transactions: [], chartData: [] });
  
  // Default to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  
  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || '{}') : {};
  const username = user.username || user.name || "Admin";

  const processChartData = (rawChartData: any[], start: string, end: string) => {
    if (!start || !end) return rawChartData;
    
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    const filledData = [];
    const dataMap = new Map(rawChartData.map(item => [item.date, item.total]));
    
    for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      filledData.push({
        date: dateStr,
        total: dataMap.get(dateStr) || 0
      });
    }
    return filledData;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/reports/transactions?startDate=${startDate}&endDate=${endDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        const result = await res.json();
        const filledChartData = processChartData(result.chartData, startDate, endDate);
        setData({ ...result, chartData: filledChartData });
      } else {
        const err = await res.json();
        showToast(err.message || "Failed to fetch transaction report", "error");
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
  }, []); // Initial load

  const handleFilter = () => {
    fetchData();
  };

  const toggleRow = (id: number) => {
    if (expandedRows.includes(id)) {
      setExpandedRows(expandedRows.filter(rowId => rowId !== id));
    } else {
      setExpandedRows([...expandedRows, id]);
    }
  };

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
      doc.text("Jl. Kesehatan No. 123, Karangasem", 105, 26, { align: "center" });
      doc.text("Telp: (021) 12345678 | Email: info@sumberwaras.com", 105, 30, { align: "center" });
      
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);

      // 2. Report Info
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("LAPORAN TRANSAKSI", 105, 45, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`, 105, 52, { align: "center" });
      doc.text(`Tanggal Rilis: ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}`, 105, 58, { align: "center" });

      // 3. Table Content
      const tableColumn = ["No", "Waktu", "Outlet", "Total", "Detail Item"];
      const tableRows: any[] = [];

      data.transactions.forEach((t, index) => {
        const transactionData = [
          index + 1,
          formatDate(t.transaction_date),
          t.outlet_name || '-',
          formatCurrency(t.total_amount),
          // Format items as a simple list string
          t.items.map((i: any) => `${i.product_name} (${i.quantity}x)`).join(', ')
        ];
        tableRows.push(transactionData);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 65,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] }, // Blue header
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          3: { halign: 'right' },
          4: { cellWidth: 60 }
        }
      });

      // 4. Footer (Signature)
      const finalY = doc.lastAutoTable.finalY + 20;
      
      // Check if we need a new page for signature
      if (finalY > 250) {
        doc.addPage();
        // Reset Y for new page
        // But for simplicity let's just write at bottom if possible or new page top
      }

      const signatureY = finalY > 250 ? 40 : finalY;
      
      doc.setFontSize(10);
      doc.text(`Karangasem, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 140, signatureY);
      doc.text("Dibuat oleh,", 140, signatureY + 6);
      
      doc.setFont("helvetica", "bold");
      doc.text(username, 140, signatureY + 30);
      doc.setLineWidth(0.2);
      
      doc.setFont("helvetica", "normal");
      doc.text("Staff Admin", 140, signatureY + 36);

      doc.save(`Laporan_Transaksi_${startDate}_${endDate}.pdf`);
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate totals
  const totalSales = data.transactions.reduce((sum, t) => sum + Number(t.total_amount), 0);
  const totalTransactions = data.transactions.length;

  return (
    <div className="bg-gray-50 min-h-screen relative pb-10">
      <Header
        title="Laporan Transaksi"
        subtitle="Sales Report"
        breadcrumbs={[{ label: 'Sales Report' }, { label: 'Laporan Transaksi' }]}
        rightContent={
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
               <Calendar size={16} className="text-gray-500 mr-2" />
               <input 
                 type="date" 
                 value={startDate}
                 onChange={(e) => setStartDate(e.target.value)}
                 className="text-sm text-gray-700 focus:outline-none border-r border-gray-200 pr-2 mr-2"
               />
               <span className="text-gray-400 mx-1">-</span>
               <input 
                 type="date" 
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
                 className="text-sm text-gray-700 focus:outline-none pl-2"
               />
            </div>
            
            <button 
              onClick={handleFilter}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors shadow-sm"
              title="Filter Data"
            >
              <Search size={18} />
            </button>

            <button 
              onClick={handleDownloadPDF}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
            >
              <Download size={18} />
              Download PDF
            </button>
          </div>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6" ref={reportRef}>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Penjualan</h3>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalSales)}</p>
                <p className="text-xs text-gray-400 mt-2">Periode {startDate} s/d {endDate}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Transaksi</h3>
                <p className="text-2xl font-bold text-emerald-600">{totalTransactions}</p>
                <p className="text-xs text-gray-400 mt-2">Transaksi berhasil</p>
            </div>
        </div>

        {/* Chart Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Grafik Penjualan Harian</h3>
            <div className="h-[300px] w-full">
                {data.chartData && data.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis 
                              dataKey="date" 
                              tick={{fontSize: 12, fill: '#9ca3af'}} 
                              tickLine={false} 
                              axisLine={false}
                              tickFormatter={(value) => new Date(value).toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}
                          />
                          <YAxis 
                              tick={{fontSize: 12, fill: '#9ca3af'}} 
                              tickLine={false} 
                              axisLine={false}
                              tickFormatter={(value) => `${value / 1000}k`}
                          />
                          <Tooltip 
                              contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #f0f0f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                              formatter={(value: number) => [formatCurrency(value), 'Penjualan']}
                              labelFormatter={(label) => new Date(label).toLocaleDateString('id-ID', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                          />
                          <Line 
                              type="monotone" 
                              dataKey="total" 
                              stroke="#3b82f6" 
                              strokeWidth={3} 
                              dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}}
                              activeDot={{r: 6, fill: '#2563eb'}} 
                          />
                      </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    Tidak ada data grafik untuk periode ini
                  </div>
                )}
            </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">Rincian Transaksi</h3>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <th className="px-6 py-4">Waktu</th>
                            <th className="px-6 py-4">Outlet</th>
                            <th className="px-6 py-4">Detail Item</th>
                            <th className="px-6 py-4 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading data...</td>
                            </tr>
                        ) : data.transactions.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Tidak ada transaksi pada periode ini</td>
                            </tr>
                        ) : (
                            data.transactions.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-gray-600 align-top whitespace-nowrap">{formatDate(t.transaction_date)}</td>
                                    <td className="px-6 py-4 text-gray-600 align-top">{t.outlet_name || '-'}</td>
                                    <td className="px-6 py-4 text-gray-600 align-top">
                                      <ul className="list-disc list-inside space-y-1">
                                        {t.items.map((item: any, idx: number) => (
                                          <li key={idx} className="text-sm">
                                            <span className="font-medium text-gray-800">{item.product_name}</span>
                                            <span className="text-gray-500 ml-1">x {item.quantity}</span>
                                            <span className="text-gray-400 text-xs ml-2">(@ {formatCurrency(item.price)})</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900 align-top">{formatCurrency(t.total_amount)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}