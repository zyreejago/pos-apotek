"use client";

import React, { useEffect, useState } from 'react';
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
  MapPin, 
  ArrowUpRight,
  ChevronDown
} from 'lucide-react';

// Interfaces
interface StockRec {
  name: string;
  count: number;
}

interface Earning {
  name: string;
  value: number;
}

interface Outlet {
  id: number;
  name: string;
  location: string;
  cashiers: string[];
}

interface Cashier {
  id: number;
  username: string;
  outlet_name: string;
  description: string;
}

export default function Dashboard() {
  const [stockRecommendations, setStockRecommendations] = useState<StockRec[]>([]);
  const [earningsData, setEarningsData] = useState<Earning[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
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

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const data = await response.json();
        setStockRecommendations(data.stockRecommendations || []);
        setEarningsData((data.earnings || []).map((e: any) => ({ ...e, value: parseFloat(e.value) })));
        setOutlets(data.outlets || []);
        setCashiers(data.cashiers || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
    cashier.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    cashier.outlet_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredCashiers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCashiers = filteredCashiers.slice(startIndex, startIndex + itemsPerPage);
  const endIndex = Math.min(startIndex + itemsPerPage, filteredCashiers.length);

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center text-gray-500 text-sm">
          <span className="hover:text-gray-700 cursor-pointer">Dashboards</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900 font-medium">Default</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="bg-white px-4 py-2 rounded-lg text-sm font-medium text-gray-700 shadow-sm border border-gray-200 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Cabang XYZ
          </button>
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-200">
            {/* Placeholder for User Avatar */}
            <div className="w-full h-full bg-slate-300 flex items-center justify-center text-slate-500">
               👤
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Sales Dashboard</p>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Card 1: Rekomendasi Stock Harian */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-800">Peramalan Stock</h3>
          </div>
          
          <div className="flex justify-between text-xs font-medium text-gray-400 mb-4 border-b pb-2">
            <span>Products</span>
            <span className="text-green-500 flex items-center gap-1">
              <ArrowUpRight size={14} /> Peramalan
            </span>
          </div>

          <div className="space-y-4">
            {stockRecommendations.length > 0 ? stockRecommendations.map((item, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-gray-700 font-medium text-sm">{item.name}</span>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-md text-sm font-bold">
                  {item.count}
                </span>
              </div>
            )) : <p className="text-sm text-gray-500">No recommendations available.</p>}
          </div>
        </div>

        {/* Card 2: Earnings Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-800">Earnings</h3>
            <button className="text-gray-400 text-sm flex items-center gap-1 hover:text-gray-600">
              monts <ChevronDown size={14} />
            </button>
          </div>

          <div className="h-[250px] w-full relative">
            {/* Overlay Tooltip Mockup */}
            <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-lg border border-gray-100 z-10 hidden md:block">
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
                <Tooltip formatter={(value: any) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
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

        {/* Card 3: Outlets */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-800">Outlets</h3>
          </div>

          <div className="space-y-4">
            {outlets.map((outlet, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-xl">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                    <div className="flex items-center gap-1"><MapPin size={12}/> Location</div>
                    <div className="flex items-center gap-1">Casier</div>
                </div>
                <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">{outlet.name}</span>
                    <div className="flex -space-x-2">
                        {outlet.cashiers.slice(0, 3).map((_, i) => (
                             <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                                👤
                             </div>
                        ))}
                        {outlet.cashiers.length > 3 && (
                            <div className="w-8 h-8 rounded-full border-2 border-white bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                                +{outlet.cashiers.length - 3}
                            </div>
                        )}
                    </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 4: Casier Table */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-800">Casier</h3>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Search Casier" 
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-100 text-left">
                        <th className="py-3 px-4 w-10">
                            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        </th>
                        <th className="py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Outlets <ChevronDown size={12} className="inline ml-1" />
                        </th>
                        <th className="py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Casier <ChevronDown size={12} className="inline ml-1" />
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {paginatedCashiers.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                            <td className="py-4 px-4">
                                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            </td>
                            <td className="py-4 px-4">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{item.outlet_name || 'Unassigned'}</p>
                                    <p className="text-xs text-gray-500">{item.description}</p>
                                </div>
                            </td>
                            <td className="py-4 px-4">
                                <div className="flex items-center gap-2">
                                     <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                                         👤
                                     </div>
                                     <span className="text-sm text-gray-700">{item.username}</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
          
          {filteredCashiers.length > itemsPerPage && (
            <div className="flex justify-between items-center mt-6 text-sm text-gray-500">
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
  );
}