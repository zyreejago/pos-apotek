'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Plus, Edit, Trash2, X, FileText, Image as ImageIcon } from 'lucide-react';
import { goeyToast } from "@/components/ui/goey-toaster";
import ConfirmModal from '@/components/ConfirmModal';
import Header from '@/components/Header';
import { useRequirePermission } from '@/hooks/useRequirePermission';

interface Prescription {
  id: number;
  prescription_code: string | null;
  image_url: string | null;
  prescription_date: string | null;
  entered_by: number | null;
  transaction_id: number | null;
  notes: string | null;
  created_at: string;
  entered_by_name: string | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PrescriptionFormData {
  prescription_code: string;
  image: File | null;
  image_url: string;
  prescription_date: string;
  notes: string;
}

export default function PrescriptionsPage() {
  const router = useRouter();
  // Permission Check
  const { checkActionPermission } = useRequirePermission('Resep Dokter');

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
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
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger' as 'danger' | 'warning' | 'info'
  });

  // Form State
  const [formData, setFormData] = useState<PrescriptionFormData>({
    prescription_code: '',
    image: null,
    image_url: '',
    prescription_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const currentUser = useMemo(() => userStr ? JSON.parse(userStr) : null, [userStr]);
  const authHeaders = useMemo<Record<string, string>>(() => {
    if (!token) return {} as Record<string, string>;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/prescriptions`, {
        headers: authHeaders
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push('/login');
        return;
      }

      const data = await res.json();
      setPrescriptions(data.data || []);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, router]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'file') {
      const fileInput = e.target as HTMLInputElement;
      const file = fileInput.files?.[0] || null;
      setFormData(prev => ({ ...prev, image: file }));
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null);
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({
      prescription_code: '',
      image: null,
      image_url: '',
      prescription_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prescription: Prescription) => {
    setModalMode('edit');
    setSelectedPrescription(prescription);
    setFormData({
      prescription_code: prescription.prescription_code || '',
      image: null,
      image_url: prescription.image_url || '',
      prescription_date: prescription.prescription_date || new Date().toISOString().split('T')[0],
      notes: prescription.notes || ''
    });
    setImagePreview(prescription.image_url ? `http://localhost:5000${prescription.image_url}` : null);
    setIsModalOpen(true);
  };

  const handleOpenDeleteModal = (prescription: Prescription) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Resep',
      message: `Apakah Anda yakin ingin menghapus resep ${prescription.prescription_code || 'ini'}? Tindakan ini tidak dapat dibatalkan.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await handleDelete(prescription);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Permission check
    if (modalMode === 'add' && !checkActionPermission('create')) {
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk menambahkan resep baru."
        });
        return;
    }
    if (modalMode === 'edit' && !checkActionPermission('edit')) {
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk mengubah data resep ini."
        });
        return;
    }

    try {
      const url = modalMode === 'add' 
        ? 'http://localhost:5000/api/inventory/prescriptions' 
        : `http://localhost:5000/api/inventory/prescriptions/${selectedPrescription?.id}`;
      
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      
      const formDataToSend = new FormData();
      formDataToSend.append('prescription_code', formData.prescription_code);
      formDataToSend.append('prescription_date', formData.prescription_date);
      formDataToSend.append('notes', formData.notes);
      formDataToSend.append('entered_by', currentUser?.id || '');
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }
      
      const headers: Record<string, string> = { ...authHeaders };
      // Don't set Content-Type, let fetch set it with boundary for FormData
      
      const res = await fetch(url, {
        method,
        headers,
        body: formDataToSend
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchPrescriptions();
        goeyToast.success(`Resep berhasil ${modalMode === 'add' ? 'ditambahkan' : 'diperbarui'}`, {
          description: `Data resep telah berhasil ${modalMode === 'add' ? 'disimpan ke dalam sistem' : 'diperbarui'}.`
        });
      } else {
        goeyToast.error(modalMode === 'add' ? 'Gagal Menambah Resep' : 'Gagal Memperbarui Resep', {
            description: "Terjadi kesalahan saat menyimpan data. Silakan periksa kembali input Anda."
        });
      }
    } catch (error) {
      console.error('Error saving prescription:', error);
      goeyToast.error('Terjadi kesalahan sistem', {
          description: "Gagal terhubung ke server. Silakan coba lagi."
      });
    }
  };

  const handleDelete = async (prescription: Prescription) => {
    // Permission check
    if (!checkActionPermission('delete')) {
        goeyToast.error('Akses Ditolak', {
            description: "Anda tidak memiliki izin untuk menghapus resep."
        });
        return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/inventory/prescriptions/${prescription.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });

      if (res.ok) {
        fetchPrescriptions();
        goeyToast.success('Resep Berhasil Dihapus', {
          description: `Resep telah dihapus permanen dari sistem.`
        });
      } else {
        goeyToast.error('Gagal Menghapus Resep', {
            description: "Terjadi kesalahan saat mencoba menghapus data resep."
        });
      }
    } catch (error) {
      console.error('Error deleting prescription:', error);
      goeyToast.error('Terjadi kesalahan sistem', {
          description: "Gagal terhubung ke server. Silakan coba lagi."
      });
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <Header 
        title="Resep Dokter"
        subtitle="Data Resep Dokter"
        rightContent={
          checkActionPermission('create') && (
            <button 
              onClick={handleOpenAddModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Tambah Resep
            </button>
          )
        }
      />

      {/* Main Content */}
      <div className="p-8 pt-0">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600 font-medium">
              Menampilkan {prescriptions.length} Resep
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Cari Resep..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-4">Kode Resep</th>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Diupload Oleh</th>
                  <th className="px-6 py-4">Gambar</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Memuat resep...
                    </td>
                  </tr>
                ) : prescriptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Belum ada resep yang ditambahkan
                    </td>
                  </tr>
                ) : (
                  prescriptions.map((prescription) => (
                    <tr key={prescription.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {prescription.prescription_code || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(prescription.prescription_date)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {prescription.entered_by_name || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {prescription.image_url ? (
                          <a 
                            href={`http://localhost:5000${prescription.image_url}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <ImageIcon size={16} />
                            Lihat Gambar
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {checkActionPermission('edit') && (
                            <button 
                              onClick={() => handleOpenEditModal(prescription)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          {checkActionPermission('delete') && (
                            <button 
                              onClick={() => handleOpenDeleteModal(prescription)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">
                {modalMode === 'add' ? 'Tambah Resep Baru' : 'Edit Resep'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode Resep</label>
                <input 
                  type="text" 
                  name="prescription_code"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Masukkan kode resep"
                  value={formData.prescription_code}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Resep</label>
                <input 
                  type="date" 
                  name="prescription_date"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.prescription_date}
                  onChange={handleInputChange}
                />
              </div>

              <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Upload Gambar Resep</label>
        <input 
          type="file" 
          name="image"
          accept="image/*"
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={handleInputChange}
        />
        {imagePreview && (
          <div className="mt-2">
            <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg border" />
          </div>
        )}
      </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                <textarea 
                  name="notes"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Catatan tambahan..."
                  rows={3}
                  value={formData.notes}
                  onChange={handleInputChange}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {modalMode === 'add' ? 'Tambah Resep' : 'Simpan Perubahan'}
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
