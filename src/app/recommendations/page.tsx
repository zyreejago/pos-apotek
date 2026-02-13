'use client';

import { useRequirePermission } from '@/hooks/useRequirePermission';
import Header from '@/components/Header';

export default function Page() {
  useRequirePermission('Peramalan Stok');

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <Header
        title="Peramalan Stok"
        breadcrumbs={[{ label: 'Peramalan Stok' }, { label: 'Detail Peramalan' }]}
      />
      <div className="p-8 pt-0">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Detail Peramalan</h2>
          <p className="text-gray-600">Tidak ada peramalan tersedia saat ini.</p>
        </div>
      </div>
    </div>
  );
}
