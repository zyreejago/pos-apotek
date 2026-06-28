"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useKeyboardShortcuts } from '@/context/KeyboardShortcutsContext';
import { useRouter } from 'next/navigation';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Search, 
  ArrowUpRight,
  ChevronDown
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

// Interfaces
interface StockRec {
  name: string;
  count: number;
}

interface Earning {
  name: string;
  value: number;
}

interface Cashier {
  id: number;
  username: string;
  description: string;
}

interface DashboardData {
  stockRecommendations: StockRec[];
  earnings: { name: string; value: string | number }[];
  cashiers: Cashier[];
}

export default function Dashboard() {
  const router = useRouter();
  const { setSearchInputRef } = useKeyboardShortcuts();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchInputRef(searchRef);
    return () => setSearchInputRef({ current: null });
  }, [setSearchInputRef]);
  const [stockRecommendations, setStockRecommendations] = useState<StockRec[]>([]);
  const [earningsData, setEarningsData] = useState<Earning[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          // Redirect to login if needed, or just show empty state
          setError('No authentication token found');
          setLoading(false);
          return;
        }

        const response = await fetch('http://localhost:5000/api/dashboard', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          router.push('/login');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const data: DashboardData = await response.json();
        setStockRecommendations(data.stockRecommendations || []);
        setEarningsData((data.earnings || []).map((e) => ({ ...e, value: typeof e.value === 'string' ? parseFloat(e.value) : e.value })));
        setCashiers(data.cashiers || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (loading) {
    return <div className="p-8 flex justify-center items-center min-h-screen">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  // Calculate total earnings for the tooltip mockup (just using the last value or sum for now)
  const currentSales = earningsData.length > 0 ? earningsData[earningsData.length - 1].value : 0;
  
  const filteredCashiers = cashiers.filter(cashier => 
    cashier.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredCashiers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCashiers = filteredCashiers.slice(startIndex, startIndex + itemsPerPage);
  const endIndex = Math.min(startIndex + itemsPerPage, filteredCashiers.length);

  return (
    <div className="bg-gray-50 min-h-screen font-sans relative">
      {/* Top Header */}
      <PageHeader 
        title="Dashboard"
        subtitle="Sales Dashboard"
        breadcrumbs={[{ label: 'Dashboards' }, { label: 'Default' }]}
      />

      {/* Main Grid Content */}
      <div className="p-3 sm:p-4 md:p-8 pt-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Rekomendasi Stock Harian */}
        <div 
          className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/recommendations')}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-800">Peramalan Stock</h3>
            <span className="text-blue-600 text-sm flex items-center gap-1">
              Lihat Semua <ArrowUpRight size={14} />
            </span>
          </div>
          
          <div className="flex justify-between text-xs font-medium text-gray-400 mb-4 border-b pb-2">
            <span>Products</span>
            <span className="text-blue-600 flex items-center gap-1">
              Tambahan Stok
            </span>
          </div>

          <div className="space-y-4">
            {stockRecommendations.length > 0 ? stockRecommendations.map((item, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-gray-700 font-medium text-sm">{item.name}</span>
                <span className={`px-3 py-1 rounded-md text-sm font-bold ${item.count && item.count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {item.count !== null && item.count !== undefined ? item.count : '-'}
                </span>
              </div>
            )) : <p className="text-sm text-gray-500">No recommendations available.</p>}
          </div>
        </div>

        {/* Card 2: Earnings Chart */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-800">Earnings</h3>
            <button className="text-gray-400 text-sm flex items-center gap-1 hover:text-gray-600">
              monts <ChevronDown size={14} />
            </button>
          </div>

          <div className="h-[250px] w-full relative">
            {/* Overlay Tooltip Mockup */}
            <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-lg border border-gray-100 z-10 block">
                <p className="text-xs text-gray-500 mb-1">Current Sales</p>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">Rp. {currentSales.toLocaleString('id-ID')}</span>
                    <span className="bg-green-100 text-green-600 text-xs px-1.5 py-0.5 rounded">+24%</span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={earningsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#9ca3af', fontSize: 12}} 
                    dy={10}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#9ca3af', fontSize: 12}} 
                    tickFormatter={(value) => `${value/1000}k`}
                />
                <Tooltip formatter={(value: number | undefined) => `Rp ${(value || 0).toLocaleString('id-ID')}`} />
                <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={false} 
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 3: Casier Table */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-800">Cashier</h3>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    ref={searchRef}
                    type="text" 
                    placeholder="Search Cashier" 
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-100 text-left">
                        <th className="py-2 px-2 sm:py-3 sm:px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Cashier <ChevronDown size={12} className="inline ml-1" />
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {paginatedCashiers.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                            <td className="py-2 px-2 sm:py-4 sm:px-4">
                                <div className="flex items-center gap-2">
                                     <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                                         👤
                                     </div>
                                     <div>
                                        <p className="text-sm font-semibold text-gray-900">{item.username}</p>
                                        <p className="text-xs text-gray-500">{item.description}</p>
                                     </div>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
          
          {filteredCashiers.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 text-sm text-gray-500 gap-3">
               <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select 
                    className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                  </select>
                  <span>per page</span>
               </div>
               <div className="flex items-center gap-2">
                  <span>{startIndex + 1}-{endIndex} of {filteredCashiers.length}</span>
                  <div className="flex gap-1">
                      <button 
                        className={`w-6 h-6 flex items-center justify-center rounded ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        ←
                      </button>
                      <span className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-900 font-medium">
                        {currentPage}
                      </span>
                      <button 
                        className={`w-6 h-6 flex items-center justify-center rounded ${currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        →
                      </button>
                  </div>
               </div>
            </div>
          )}

        </div>

      </div>
      </div>
    </div>
  );
}
