"use client";

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  ChevronDown, 
  Filter, 
  X,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2
} from 'lucide-react';
import Header from '@/components/Header';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { goeyToast } from '@/components/ui/goey-toaster';

interface Outlet {
  id: number;
  name: string;
  location: string;
  status: string;
}

export default function OutletsPage() {
  // Permission Check
  const { checkActionPermission } = useRequirePermission('Outlets');

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchOutlets();
  }, []);

  const fetchOutlets = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('http://localhost:5000/api/outlets', { headers });
      if (response.ok) {
        const data = await response.json();
        setOutlets(data);
      }
    } catch (error) {
      console.error('Failed to fetch outlets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setSelectedOutlet(null);
    setName('');
    setLocation('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (outlet: Outlet) => {
    setModalMode('edit');
    setSelectedOutlet(outlet);
    setName(outlet.name);
    setLocation(outlet.location);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Permission Check
    if (modalMode === 'add' && !checkActionPermission('create')) {
      goeyToast.error('Akses Ditolak', {
        description: 'Anda tidak memiliki izin untuk membuat outlet baru.'
      });
      return;
    }
    if (modalMode === 'edit' && !checkActionPermission('edit')) {
      goeyToast.error('Akses Ditolak', {
        description: 'Anda tidak memiliki izin untuk mengedit outlet.'
      });
      return;
    }

    setIsSubmitting(true);
    
    const url = modalMode === 'add' 
        ? 'http://localhost:5000/api/outlets' 
        : `http://localhost:5000/api/outlets/${selectedOutlet?.id}`;
    
    const method = modalMode === 'add' ? 'POST' : 'PUT';

    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ name, location }),
      });

      if (response.ok) {
        await fetchOutlets();
        setIsModalOpen(false);
        setName('');
        setLocation('');
        goeyToast.success(modalMode === 'add' ? 'Outlet Berhasil Ditambahkan' : 'Outlet Berhasil Diperbarui', {
          description: `Outlet "${name}" yang berlokasi di ${location} telah berhasil ${modalMode === 'add' ? 'ditambahkan ke sistem' : 'diperbarui'}.`
        });
      } else {
        const data = await response.json();
        goeyToast.error('Gagal Menyimpan Outlet', {
          description: data.message || 'Terjadi kesalahan saat menyimpan data outlet. Silakan coba lagi.'
        });
      }
    } catch (error) {
      console.error('Error saving outlet:', error);
      goeyToast.error('Terjadi Kesalahan', {
        description: 'Gagal menyimpan outlet. Periksa koneksi internet Anda.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (outlet: Outlet) => {
    if (!checkActionPermission('delete')) {
        goeyToast.error('Akses Ditolak', {
          description: 'Anda tidak memiliki izin untuk menghapus outlet.'
        });
        return;
    }
    
    if (!confirm(`Are you sure you want to delete outlet ${outlet.name}?`)) return;

    try {
        const token = localStorage.getItem('token');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        const response = await fetch(`http://localhost:5000/api/outlets/${outlet.id}`, {
            method: 'DELETE',
            headers
        });
        
        if (response.ok) {
            fetchOutlets();
            goeyToast.success('Outlet Berhasil Dihapus', {
                description: `Outlet "${outlet.name}" yang berlokasi di ${outlet.location} telah dihapus dari sistem.`
            });
        } else {
            const data = await response.json();
            goeyToast.error('Gagal Menghapus Outlet', {
                description: data.message || 'Terjadi kesalahan saat menghapus outlet.'
            });
        }
    } catch (error) {
        console.error('Error deleting outlet:', error);
        goeyToast.error('Terjadi Kesalahan', {
            description: 'Gagal menghapus outlet. Periksa koneksi internet Anda.'
        });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans relative">
      <Header 
        title="Outlets"
        breadcrumbs={[{ label: 'Outlets' }, { label: 'Management Outlets' }]}
        rightContent={
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-gray-50 shadow-sm">
            <MessageSquare size={16} />
            <span>Select Outlets</span>
          </button>
        }
      />

      <div className="p-8 pt-0">
      {/* Page Actions */}
      <div className="flex justify-end mb-6">
        {checkActionPermission('create') && (
          <button 
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Add Outlets
          </button>
        )}
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        
        {/* Card Header / Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-sm font-medium text-slate-700">
            Showing {outlets.length} of {outlets.length} outlets
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search users" 
                className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            
            <div className="flex items-center gap-2">
              {/* <div className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-slate-600">
                <span className="text-gray-400">Status</span>
                <span className="font-medium text-slate-800">Active</span>
                <button className="ml-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div> */}
              
              {/* <div className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-slate-600">
                <span className="text-gray-400">Sort</span>
                <span className="font-medium text-slate-800">Latest</span>
                <button className="ml-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div> */}

              {/* <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-blue-600 hover:bg-blue-50 font-medium">
                <Filter size={16} />
                <span>Filters</span>
              </button> */}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="p-4 text-sm font-semibold text-gray-500">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                    Outlets <ChevronDown size={14} />
                  </div>
                </th>
                <th className="p-4 text-sm font-semibold text-gray-500">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                    Location <ChevronDown size={14} />
                  </div>
                </th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">Loading outlets...</td>
                </tr>
              ) : outlets.map((outlet) => (
                <tr key={outlet.id} className="hover:bg-gray-50 group transition-colors">
                  <td className="p-4">
                    <span className="font-medium text-slate-800">{outlet.name}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-600">{outlet.location}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {checkActionPermission('edit') && (
                        <button 
                          onClick={() => handleOpenEditModal(outlet)}
                          className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                      {checkActionPermission('delete') && (
                        <button 
                          onClick={() => handleDelete(outlet)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              
              {!loading && outlets.length === 0 && (
                 <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">No outlets found. Add one to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show</span>
            <select className="border border-gray-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option>10</option>
              <option>20</option>
              <option>50</option>
            </select>
            <span>per page</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">1 of 1</span>
            <div className="flex items-center gap-1">
              <button className="p-1 rounded border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-50" disabled>
                <ChevronLeft size={16} />
              </button>
              <button className="w-8 h-8 rounded bg-gray-100 text-slate-800 font-medium text-sm flex items-center justify-center">
                1
              </button>
              <button className="p-1 rounded border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-50" disabled>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">
                {modalMode === 'add' ? 'Add New Outlet' : 'Edit Outlet'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Outlet Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Cabang Jakarta"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input 
                  type="text" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Jakarta Selatan"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-slate-700 hover:bg-gray-50 font-medium text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : (modalMode === 'add' ? 'Save Outlet' : 'Update Outlet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
