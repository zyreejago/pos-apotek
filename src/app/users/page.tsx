'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Plus, Edit, X, Trash2 } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import ConfirmModal from '@/components/ConfirmModal';
import Header from '@/components/Header';
import { useRequirePermission } from '@/hooks/useRequirePermission';

interface UserData {
  id: number;
  username: string;
  role: string;
  outlet_id: number | null;
  outlet_name: string | null;
  created_at: string;
  status?: string;
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

type CurrentUser = {
  id?: number;
  username?: string;
  role?: string;
};

type ModalMode = 'add' | 'edit';

type UserFormData = {
  username: string;
  password: string;
  role: string;
  outlet_id: string;
  status: 'active' | 'inactive';
};

export default function UsersPage() {
  const router = useRouter();
  const { checkActionPermission } = useRequirePermission('Management Pengguna');

  const [users, setUsers] = useState<UserData[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    role: 'Cashier',
    outlet_id: '',
    status: 'active'
  });

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
    variant: 'danger' as 'danger' | 'warning' | 'info'
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const currentUser = useMemo<CurrentUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as CurrentUser;
    } catch {
      return null;
    }
  }, []);
  
  const authHeaders = useMemo((): HeadersInit => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, [token]);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push('/login');
  }, [router]);

  const safeJson = useCallback(async <T,>(res: Response): Promise<T | null> => {
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/users?page=${currentPage}&limit=${itemsPerPage}&search=${debouncedSearchQuery}`, {
        headers: authHeaders
      });
      
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (res.ok) {
        const data = await safeJson<{ data: UserData[]; pagination: Pagination }>(res);
        if (!data) return;
        setUsers(data.data);
        setPagination(data.pagination);
      } else if (res.status === 403) {
        setUsers([]);
        setPagination({ total: 0, page: 1, limit: itemsPerPage, totalPages: 1 });
        goeyToast.error('Akses Ditolak', {
          description: 'Anda tidak memiliki izin untuk melihat daftar pengguna.'
        });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, currentPage, debouncedSearchQuery, handleUnauthorized, itemsPerPage, safeJson]);

  const fetchOutlets = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/outlets', { headers: authHeaders });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await safeJson<unknown>(res);
        if (Array.isArray(data)) {
          setOutlets(data as Outlet[]);
        } else {
          setOutlets([]);
        }
      }
    } catch (error) {
      console.error('Error fetching outlets:', error);
    }
  }, [authHeaders, handleUnauthorized, safeJson]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/rbac/roles', { headers: authHeaders });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await safeJson<Role[]>(res);
        setRoles(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  }, [authHeaders, handleUnauthorized, safeJson]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchOutlets();
    fetchRoles();
  }, [fetchOutlets, fetchRoles]);

  const normalizeStatus = (status?: string): 'active' | 'inactive' => {
    return status === 'inactive' ? 'inactive' : 'active';
  };
  
  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({
      username: '',
      password: '',
      role: 'Cashier',
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
      password: '',
      role: user.role,
      outlet_id: user.outlet_id ? user.outlet_id.toString() : '',
      status: normalizeStatus(user.status)
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (modalMode === 'add' && !checkActionPermission('create')) {
        goeyToast.error('Akses Ditolak', {
          description: 'Anda tidak memiliki izin untuk membuat pengguna baru.'
        });
        return;
    }
    if (modalMode === 'edit' && !checkActionPermission('edit')) {
        goeyToast.error('Akses Ditolak', {
          description: 'Anda tidak memiliki izin untuk mengedit pengguna.'
        });
        return;
    }

    const url = modalMode === 'add' 
      ? 'http://localhost:5000/api/users'
      : `http://localhost:5000/api/users/${selectedUser?.id}`;
    
    const method = modalMode === 'add' ? 'POST' : 'PUT';
    
    try {
      const payload: Record<string, unknown> = {
        username: formData.username,
        role: formData.role,
        outlet_id: formData.outlet_id ? parseInt(formData.outlet_id) : null,
        status: formData.status
      };

      if (modalMode === 'add' || formData.password.trim().length > 0) {
        payload.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await safeJson<{ message?: string }>(res);

      if (res.ok) {
        handleCloseModal();
        fetchUsers();
        goeyToast.success(modalMode === 'add' ? 'Pengguna Berhasil Ditambahkan' : 'Pengguna Berhasil Diperbarui', {
          description: `Pengguna "${formData.username}" dengan role "${formData.role}" telah berhasil ${modalMode === 'add' ? 'ditambahkan ke sistem' : 'diperbarui'}.`
        });
      } else {
        goeyToast.error('Gagal Menyimpan Pengguna', {
          description: data?.message || 'Terjadi kesalahan saat menyimpan data pengguna.'
        });
      }
    } catch (error) {
      console.error('Error saving user:', error);
      goeyToast.error('Terjadi Kesalahan', {
        description: 'Gagal menyimpan pengguna. Periksa koneksi internet Anda.'
      });
    }
  };

  const handleDelete = (user: UserData) => {
    if (currentUser && currentUser.id === user.id) {
        goeyToast.error("Aksi Ditolak", {
          description: "Anda tidak dapat menghapus akun Anda sendiri."
        });
        return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Pengguna',
      message: `Apakah Anda yakin ingin menghapus pengguna "${user.username}"? Tindakan ini tidak dapat dibatalkan.`,
      variant: 'danger',
      onConfirm: async () => {
        if (!checkActionPermission('delete')) {
            goeyToast.error('Akses Ditolak', {
              description: 'Anda tidak memiliki izin untuk menghapus pengguna.'
            });
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            return;
        }
        
        try {
          const res = await fetch(`http://localhost:5000/api/users/${user.id}`, {
            method: 'DELETE',
            headers: authHeaders
          });
          
          if (res.status === 401) {
            handleUnauthorized();
            return;
          }

          if (res.ok) {
            fetchUsers();
            goeyToast.success('Pengguna Berhasil Dihapus', {
              description: `Pengguna "${user.username}" telah berhasil dihapus dari sistem.`
            });
          } else {
            const data = await safeJson<{ message?: string }>(res);
            goeyToast.error('Gagal Menghapus Pengguna', {
              description: data?.message || 'Terjadi kesalahan saat menghapus pengguna.'
            });
          }
        } catch (error) {
          console.error('Error deleting user:', error);
          goeyToast.error('Terjadi Kesalahan', {
            description: 'Gagal menghapus pengguna. Periksa koneksi internet Anda.'
          });
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const getInitials = (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return '??';
    return cleaned.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-emerald-500', 
      'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 
      'bg-indigo-500', 'bg-cyan-500'
    ];
    const sum = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const index = sum % colors.length;
    return colors[index];
  };

  const showingText = useMemo(() => {
    const total = pagination.total;
    if (total === 0) return 'Menampilkan 0 pengguna';
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, total);
    return `Menampilkan ${start}-${end} dari ${total} pengguna`;
  }, [currentPage, itemsPerPage, pagination.total]);

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <Header 
        title="Manage Pengguna"
        breadcrumbs={[{ label: 'Pengguna' }, { label: 'Manage Pengguna' }]}
        rightContent={
          checkActionPermission('create') && (
            <button 
              onClick={handleOpenAddModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Pengguna
            </button>
          )
        }
      />

      <div className="p-8 pt-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-700">{showingText}</div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <Filter size={16} />
                Filters
              </button>
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Cari pengguna..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No users found.</div>
            ) : (
              users.map((user) => {
                const isActive = user.status !== 'inactive';
                const outletLabel = user.outlet_name ? user.outlet_name : 'Tanpa outlet';

                return (
                  <div key={user.id} className="group bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all duration-200 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white shadow-sm ${getAvatarColor(user.username)}`}>
                          {getInitials(user.username)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors truncate">{user.username}</h3>
                        <p className="text-xs font-medium text-gray-400 mt-0.5 truncate">{outletLabel}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex flex-col items-center justify-center border border-dashed border-gray-300 bg-gray-50/50 rounded-xl px-3 py-1 min-w-[88px]">
                        <span className="text-xs font-bold text-gray-900 capitalize">{user.role}</span>
                        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Role</span>
                      </div>
                      
                      <div className={`hidden sm:flex flex-col items-center justify-center border border-dashed rounded-xl px-3 py-1 min-w-[88px] ${isActive ? 'border-emerald-200 bg-emerald-50/30' : 'border-rose-200 bg-rose-50/30'}`}>
                        <span className={`text-xs font-bold ${isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 ${isActive ? 'text-emerald-400' : 'text-rose-400'}`}>Status</span>
                      </div>
                      
                      <div className="flex items-center gap-1 pl-2 border-l border-gray-100">
                        {checkActionPermission('edit') && (
                          <button 
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                            title="Edit User"
                          >
                            <Edit size={16} strokeWidth={2} />
                          </button>
                        )}
                        {checkActionPermission('delete') && (!currentUser || currentUser.id !== user.id) && (
                          <button 
                            onClick={() => handleDelete(user)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all duration-200"
                            title="Delete User"
                          >
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

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
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
              <span>per page</span>
            </div>

            <div className="flex items-center gap-2">
              <span>
                {(pagination.total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1)}-{(pagination.total === 0 ? 0 : Math.min(currentPage * itemsPerPage, pagination.total))} of {pagination.total}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{modalMode === 'edit' ? 'Password (opsional)' : 'Password'}</label>
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
                    {roles.length === 0 && <option value="Cashier">Cashier</option>}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
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
