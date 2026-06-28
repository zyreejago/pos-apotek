'use client';

import { API_URL } from '@/lib/api-config';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import ConfirmModal from '@/components/ConfirmModal';
import OffCanvas from '@/components/OffCanvas';
import PageHeader from '@/components/PageHeader';
import { useRequirePermission } from '@/hooks/useRequirePermission';

interface UserData {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
  status?: string;
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
  email?: string;
  role?: string;
};

type ModalMode = 'add' | 'edit';

type UserFormData = {
  username: string;
  email: string;
  password: string;
  role: string;
  status: 'active' | 'inactive';
};

export default function UsersPage() {
  const router = useRouter();
  const { checkActionPermission } = useRequirePermission('Management Pengguna');

  const [users, setUsers] = useState<UserData[]>([]);
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

  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [offCanvasMode, setOffCanvasMode] = useState<ModalMode>('add');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    password: '',
    role: 'Cashier',
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
      const res = await fetch(`${API_URL}/api/users?page=${currentPage}&limit=${itemsPerPage}&search=${debouncedSearchQuery}`, {
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

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rbac/roles`, { headers: authHeaders });
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
    fetchRoles();
  }, [fetchRoles]);

  const normalizeStatus = (status?: string): 'active' | 'inactive' => {
    return status === 'inactive' ? 'inactive' : 'active';
  };
  
  const handleOpenAddOffCanvas = () => {
    setOffCanvasMode('add');
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'Cashier',
      status: 'active'
    });
    setIsOffCanvasOpen(true);
  };

  const handleOpenEditOffCanvas = (user: UserData) => {
    setOffCanvasMode('edit');
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role,
      status: normalizeStatus(user.status)
    });
    setIsOffCanvasOpen(true);
  };

  const handleCloseOffCanvas = () => {
    setIsOffCanvasOpen(false);
    setSelectedUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (offCanvasMode === 'add' && !checkActionPermission('create')) {
      goeyToast.error('Akses Ditolak', {
        description: 'Anda tidak memiliki izin untuk membuat pengguna baru.'
      });
      return;
    }
    if (offCanvasMode === 'edit' && !checkActionPermission('edit')) {
      goeyToast.error('Akses Ditolak', {
        description: 'Anda tidak memiliki izin untuk mengedit pengguna.'
      });
      return;
    }

    const url = offCanvasMode === 'add' 
      ? `${API_URL}/api/users`
      : `${API_URL}/api/users/${selectedUser?.id}`;
    
    const method = offCanvasMode === 'add' ? 'POST' : 'PUT';
    
    try {
      const payload: Record<string, unknown> = {
        username: formData.username,
        email: formData.email,
        role: formData.role,
        status: formData.status
      };

      if (offCanvasMode === 'add' || formData.password.trim().length > 0) {
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
        handleCloseOffCanvas();
        fetchUsers();
        goeyToast.success(offCanvasMode === 'add' ? 'Pengguna Berhasil Ditambahkan' : 'Pengguna Berhasil Diperbarui', {
          description: `Pengguna "${formData.username}" dengan role "${formData.role}" telah berhasil ${offCanvasMode === 'add' ? 'ditambahkan ke sistem' : 'diperbarui'}.`
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
          const res = await fetch(`${API_URL}/api/users/${user.id}`, {
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
      <PageHeader 
        title="Manage Pengguna"
        breadcrumbs={[{ label: 'Pengguna' }, { label: 'Manage Pengguna' }]}
        rightContent={
          checkActionPermission('create') && (
            <button 
              onClick={handleOpenAddOffCanvas}
              className="bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-lg flex items-center gap-2 text-xs sm:text-sm font-medium transition-colors"
            >
              <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              Add Pengguna
            </button>
          )
        }
      />

      <div className="p-3 sm:p-4 md:p-8 pt-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-700">{showingText}</div>
            <div className="flex items-center gap-2 w-full md:w-auto">
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

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-3">Pengguna</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-3">Email</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-3">Role</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-3">Status</th>
                  <th className="px-2 sm:px-4 py-1.5 sm:py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-2 sm:px-4 py-4 sm:py-8 text-center text-gray-500">Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="px-2 sm:px-4 py-4 sm:py-8 text-center text-gray-500">No users found.</td></tr>
                ) : (
                  users.map((user) => {
                    const isActive = user.status !== 'inactive';
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-2 sm:px-4 py-1.5 sm:py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${getAvatarColor(user.username)}`}>
                              {getInitials(user.username)}
                            </div>
                            <span className="font-medium text-gray-900">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-3 text-gray-600">{user.email}</td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-3">
                          <span className="capitalize text-gray-700 font-medium">{user.role}</span>
                        </td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-3">
                          <div className="flex items-center gap-1">
                            {checkActionPermission('edit') && (
                              <button onClick={() => handleOpenEditOffCanvas(user)}
                                className="p-1 sm:p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                <Edit size={14} />
                              </button>
                            )}
                            {checkActionPermission('delete') && (!currentUser || currentUser.id !== user.id) && (
                              <button onClick={() => handleDelete(user)}
                                className="p-1 sm:p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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
              <div className="flex gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
                <button
                  className={`w-8 h-8 flex items-center justify-center rounded border ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ←
                </button>
                <span className="w-8 h-8 flex items-center justify-center rounded bg-blue-600 text-white font-medium shrink-0">
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

      {/* Add/Edit OffCanvas */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={handleCloseOffCanvas}
        title={offCanvasMode === 'add' ? 'Add User' : 'Edit User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Enter email"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{offCanvasMode === 'edit' ? 'Password (opsional)' : 'Password'}</label>
            <input
              type="password"
              required={offCanvasMode === 'add'}
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
        
        
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleCloseOffCanvas}
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
      </OffCanvas>

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
