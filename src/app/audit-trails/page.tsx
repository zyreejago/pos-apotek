'use client';

import { API_URL } from '@/lib/api-config';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Calendar, User, Clock, Activity } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import PageHeader from '@/components/PageHeader';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { useKeyboardShortcuts } from '@/context/KeyboardShortcutsContext';

interface AuditTrail {
  id: number;
  user_id: number | null;
  username: string | null;
  role: string | null;
  module: string;
  action: string;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export default function AuditTrailsPage() {
  const { setSearchInputRef } = useKeyboardShortcuts();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchInputRef(searchRef);
    return () => setSearchInputRef({ current: null });
  }, [setSearchInputRef]);

  // Permission Check
  const { checkActionPermission } = useRequirePermission('Audit Trail');

  // State
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1
  });
  const [filterModule, setFilterModule] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [modules, setModules] = useState<string[]>([]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = useMemo<Record<string, string>>(() => {
    if (!token) return {} as Record<string, string>;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchAuditTrails = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/audit-trails?page=${currentPage}&limit=${itemsPerPage}`;
      if (filterModule) {
        url += `&module=${encodeURIComponent(filterModule)}`;
      }
      if (filterStartDate) {
        url += `&start_date=${encodeURIComponent(filterStartDate)}`;
      }
      if (filterEndDate) {
        url += `&end_date=${encodeURIComponent(filterEndDate)}`;
      }
      const res = await fetch(url, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch audit trails');
      const json = await res.json();
      
      setAuditTrails(json.data || []);
      setPagination({
        total: json.total || 0,
        page: json.page || 1,
        limit: json.limit || 20,
        totalPages: json.total_pages || 1
      });
      
      // Extract unique modules
      const uniqueModules = Array.from(new Set((json.data || []).map((at: AuditTrail) => at.module))) as string[];
      setModules(uniqueModules);
    } catch (error) {
      console.error('Error fetching audit trails:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filterModule, filterStartDate, filterEndDate, authHeaders]);

  useEffect(() => {
    fetchAuditTrails();
  }, [fetchAuditTrails]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionBadgeColor = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (['create', 'add', 'register', 'login'].includes(lowerAction)) return 'bg-green-100 text-green-700';
    if (['edit', 'update'].includes(lowerAction)) return 'bg-blue-100 text-blue-700';
    if (['delete', 'remove'].includes(lowerAction)) return 'bg-red-100 text-red-700';
    if (['show', 'view', 'read'].includes(lowerAction)) return 'bg-gray-100 text-gray-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const handleResetFilters = () => {
    setFilterModule('');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
  };

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <PageHeader 
        title="Audit Trail"
        subtitle={`Total Log Aktivitas: ${pagination.total}`}
      />

      {/* Main Content */}
      <div className="p-3 sm:p-4 md:p-8 pt-0">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100">
            <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Cari aktivitas..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-full sm:w-auto"
                  value={filterModule}
                  onChange={(e) => {
                    setFilterModule(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">Semua Modul</option>
                  {modules.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto">
                  <Calendar size={16} className="text-gray-400 shrink-0" />
                  <input
                    type="date"
                    className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 w-full sm:w-auto"
                    value={filterStartDate}
                    onChange={(e) => {
                      setFilterStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  <span className="text-gray-400">s/d</span>
                  <input
                    type="date"
                    className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 w-full sm:w-auto"
                    value={filterEndDate}
                    onChange={(e) => {
                      setFilterEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {(filterModule || filterStartDate || filterEndDate) && (
                <button
                  onClick={handleResetFilters}
                  className="px-2 sm:px-3 py-1 sm:py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-2 sm:px-6 py-1 sm:py-4">Waktu</th>
                  <th className="px-2 sm:px-6 py-1 sm:py-4">Pengguna</th>
                  <th className="px-2 sm:px-6 py-1 sm:py-4">Modul</th>
                  <th className="px-2 sm:px-6 py-1 sm:py-4">Aksi</th>
                  <th className="px-2 sm:px-6 py-1 sm:py-4">Deskripsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Memuat log aktivitas...
                    </td>
                  </tr>
                ) : auditTrails.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Tidak ada log aktivitas ditemukan.
                    </td>
                  </tr>
                ) : (
                  auditTrails.map((trail) => (
                    <tr key={trail.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 sm:px-6 py-1 sm:py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock size={14} />
                          {formatDateTime(trail.created_at)}
                        </div>
                      </td>
                      <td className="px-2 sm:px-6 py-1 sm:py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User size={16} className="text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{trail.username || '-'}</div>
                            <div className="text-xs text-gray-500">{trail.role || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-6 py-1 sm:py-4">
                        <div className="flex items-center gap-2">
                          <Activity size={14} className="text-gray-400" />
                          <span className="font-medium text-gray-900">{trail.module}</span>
                        </div>
                      </td>
                      <td className="px-2 sm:px-6 py-1 sm:py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeColor(trail.action)}`}>
                          {trail.action}
                        </span>
                      </td>
                      <td className="px-2 sm:px-6 py-1 sm:py-4 text-gray-600 max-w-full sm:max-w-md truncate">
                        {trail.description}
                      </td>
                     
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                className="border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>per page</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span>
                {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total}
              </span>
              <div className="flex gap-1">
                <button
                  className={`w-8 h-8 flex items-center justify-center rounded border ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ←
                </button>
                <span className="w-8 h-8 flex items-center justify-center rounded bg-blue-600 text-white font-medium">
                  {currentPage}
                </span>
                <button
                  className={`w-8 h-8 flex items-center justify-center rounded border ${currentPage === pagination.totalPages ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
