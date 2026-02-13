'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Settings, X, ChevronLeft, ChevronRight, User, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import ConfirmModal from '@/components/ConfirmModal';

interface UserData {
  id: number;
  username: string;
  role: string;
  outlet_id: number | null;
  outlet_name: string | null;
  created_at: string;
  status?: string; // Optional, might need to add to DB or infer
}

interface Outlet {
  id: number;
  name: string;
}

interface Role {
  id: number;
  name: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'cashier',
    outlet_id: '',
    status: 'active'
  });

  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
    variant: 'danger' as 'danger' | 'warning' | 'info'
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

  useEffect(() => {
    fetchUsers();
    fetchOutlets();
    fetchRoles();
  }, [currentPage, itemsPerPage]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchUsers();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/users?page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOutlets = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/outlets', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOutlets(data);
        } else {
          console.error('Outlets data is not an array:', data);
          setOutlets([]);
        }
      }
    } catch (error) {
      console.error('Error fetching outlets:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/rbac/roles', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };
  
  // Need to fix fetchOutlets. 
  // I will add GET /api/outlets to server/index.js later.
  
  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({
      username: '',
      password: '',
      role: 'cashier',
      outlet_id: '',
      status: 'active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UserData) => {
    setModalMode('edit');
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '', // Don't show password
      role: user.role,
      outlet_id: user.outlet_id ? user.outlet_id.toString() : '',
      status: user.status || 'active'
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const url = modalMode === 'add' 
      ? 'http://localhost:5000/api/users'
      : `http://localhost:5000/api/users/${selectedUser?.id}`;
    
    const method = modalMode === 'add' ? 'POST' : 'PUT';
    
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          ...formData,
          outlet_id: formData.outlet_id ? parseInt(formData.outlet_id) : null,
          status: formData.status
        }),
      });

      const data = await res.json();

      if (res.ok) {
        handleCloseModal();
        fetchUsers();
        showToast(`User ${modalMode === 'add' ? 'created' : 'updated'} successfully`, 'success');
      } else {
        showToast(data.message || 'Failed to save user', 'error');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      showToast('Error saving user', 'error');
    }
  };

  const handleDelete = (user: UserData) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete ${user.username}? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/users/${user.id}`, {
            method: 'DELETE',
            headers: authHeaders
          });
          
          if (res.ok) {
            fetchUsers();
            showToast('User deleted successfully', 'success');
          } else {
            const data = await res.json();
            showToast(data.message || 'Failed to delete user', 'error');
          }
        } catch (error) {
          console.error('Error deleting user:', error);
          showToast('Error deleting user', 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  // Helper to generate a consistent color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-emerald-500', 
      'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 
      'bg-indigo-500', 'bg-cyan-500'
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span>Casier</span>
                <span>/</span>
                <span className="font-semibold text-gray-900">Manage Casier</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Manage pengguna</h1>
        </div>
        <div className="flex items-center gap-3">
            <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                <Settings size={16} />
                Select Outlets
            </button>
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-200">
                <div className="w-full h-full bg-slate-300 flex items-center justify-center text-slate-500">
                   <User size={20} />
                </div>
            </div>
        </div>
      </div>

      <div className="flex justify-end mb-6">
          <button 
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            Add Casier
          </button>
      </div>

      {/* Main Content */}
      <div>
        <div className="flex justify-between items-center mb-4">
            <div className="text-sm font-medium text-gray-700">
                Showing {users.length} Users
            </div>
            <div className="flex gap-2">
                 <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600">
                    Status <span className="font-bold text-gray-900">Active</span> <X size={12} className="cursor-pointer" />
                 </div>
                 <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600">
                    Sort <span className="font-bold text-gray-900">Latest</span> <X size={12} className="cursor-pointer" />
                 </div>
                 <button className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium">
                    <Filter size={12} /> Filters
                 </button>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Type name," 
                        className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-xs w-48 focus:outline-none focus:border-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
            </div>
        </div>

        {/* User List - Cards */}
        <div className="space-y-6">
            {loading ? (
                <div className="text-center py-8 text-gray-500">Loading users...</div>
            ) : users.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No users found.</div>
            ) : (
                users.map((user) => {
                    // Logic for status - for now randomizing or assuming active if not present
                    // In real app, user.status would come from DB
                    const isActive = user.status === 'inactive' ? false : true; 
                    
                    return (
                    <div key={user.id} className="group bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all duration-200 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="relative">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-sm ${getAvatarColor(user.username)}`}>
                                    {getInitials(user.username)}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">{user.username}</h3>
                                <p className="text-xs font-medium text-gray-400 mt-0.5">{user.username.toLowerCase()}@example.com</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                            {/* Role Box */}
                            <div className="flex flex-col items-center justify-center border border-dashed border-gray-300 bg-gray-50/50 rounded-xl px-5 py-2 min-w-[100px]">
                                <span className="text-sm font-bold text-gray-900 capitalize">{user.role}</span>
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Role</span>
                            </div>
                            
                            {/* Status Box */}
                            <div className={`flex flex-col items-center justify-center border border-dashed rounded-xl px-5 py-2 min-w-[100px] ${isActive ? 'border-emerald-200 bg-emerald-50/30' : 'border-rose-200 bg-rose-50/30'}`}>
                                <span className={`text-sm font-bold ${isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isActive ? 'Active' : 'Inactive'}
                                </span>
                                <span className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${isActive ? 'text-emerald-400' : 'text-rose-400'}`}>Status</span>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
                                <button 
                                    onClick={() => handleOpenEditModal(user)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                    title="Edit User"
                                >
                                    <Settings size={18} strokeWidth={2} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(user)}
                                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all duration-200"
                                    title="Delete User"
                                >
                                    <Trash2 size={18} strokeWidth={2} />
                                </button>
                            </div>
                        </div>
                    </div>
                )})
            )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">
                {modalMode === 'add' ? 'Add User' : 'Edit User'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Enter username"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {modalMode === 'edit' ? 'Password (leave blank to keep)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    required={modalMode === 'add'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Enter password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {roles.map(role => (
                        <option key={role.id} value={role.name}>{role.name}</option>
                    ))}
                    {roles.length === 0 && <option value="cashier">Cashier</option>}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Outlet</label>
                  <select
                    value={formData.outlet_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, outlet_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select Outlet</option>
                    {outlets.map(outlet => (
                        <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
