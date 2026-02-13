'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit, Trash2, X, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import ConfirmModal from '@/components/ConfirmModal';

interface Supplier {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  address: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SupplierFormData {
  name: string;
  contact_person: string;
  phone: string;
  address: string;
}

export default function SuppliersPage() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger' as 'danger' | 'warning' | 'info'
  });

  // Form State
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    contact_person: '',
    phone: '',
    address: ''
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/suppliers?page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}`);
      const data = await res.json();
      setSuppliers(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [currentPage, itemsPerPage]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchSuppliers();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      address: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setModalMode('edit');
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      address: supplier.address || ''
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Supplier',
      message: `Are you sure you want to delete ${supplier.name}? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await handleDelete(supplier);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = modalMode === 'add' 
        ? 'http://localhost:5000/api/suppliers' 
        : `http://localhost:5000/api/suppliers/${selectedSupplier?.id}`;
      
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchSuppliers();
        showToast(`Supplier ${modalMode === 'add' ? 'added' : 'updated'} successfully`, 'success');
      } else {
        showToast('Failed to save supplier', 'error');
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
      showToast('Error saving supplier', 'error');
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    try {
      const res = await fetch(`http://localhost:5000/api/suppliers/${supplier.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchSuppliers();
        showToast('Supplier deleted successfully', 'success');
      } else {
        showToast('Failed to delete supplier', 'error');
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      showToast('Error deleting supplier', 'error');
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <span>Supplier</span>
            <span>/</span>
            <span className="font-semibold text-gray-900">Management Supplier</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier</h1>
        </div>
        <div className="flex items-center gap-3">
            <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                <Filter size={16} />
                Select Outlets
            </button>
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                <img src="https://ui-avatars.com/api/?name=Admin" alt="User" />
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="w-full md:w-auto flex items-center gap-3">
                {/* Checkbox placeholder */}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                    type="text" 
                    placeholder="Search Supplier" 
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center gap-2">
                    <Filter size={16} />
                    Filters
                </button>
                <button 
                    onClick={openAddModal}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm shadow-blue-200"
                >
                    Add Supplier
                </button>
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-500 font-medium text-sm">
              <tr>
                <th className="px-6 py-4 text-left w-10">
                  <input type="checkbox" className="rounded border-gray-300" />
                </th>
                <th className="px-6 py-4 text-left">Name</th>
                <th className="px-6 py-4 text-left">Phone</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No suppliers found
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{supplier.name}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{supplier.phone || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(supplier)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => openDeleteModal(supplier)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
                <span>Show</span>
                <select 
                className="border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                </select>
                <span>per page</span>
            </div>

            <div className="flex items-center gap-2">
                <span>
                    {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
                <div className="flex gap-1">
                    <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    &larr;
                    </button>
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
                        <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 flex items-center justify-center rounded border ${
                            currentPage === page 
                            ? 'bg-gray-100 border-gray-300 font-medium text-gray-900' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        >
                        {page}
                        </button>
                    ))}
                    <button 
                    onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                    disabled={currentPage === pagination.totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    &rarr;
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">
                {modalMode === 'add' ? 'Add Supplier' : 'Edit Supplier'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. PT. Sumber Makmur"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input 
                  type="text" 
                  name="phone"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 08123456789"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
                >
                  {modalMode === 'add' ? 'Add Supplier' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />
    </div>
  );
}