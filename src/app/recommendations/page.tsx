'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import PageHeader from '@/components/PageHeader';
import { goeyToast } from '@/components/ui/goey-toaster';

type ForecastRow = {
  id: number;
  name: string;
  stock: number;
  unit: string;
  metode: 'gemini' | 'fallback' | null;
  tambahan_stok: number | null;
  forecast_created_at: string | null;
};

export default function Page() {
  useRequirePermission('Peramalan Stok');
  const router = useRouter();

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = useMemo(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)),
    [token]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshLoading, setRefreshLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchLatestForecasts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/forecast/latest?search=${encodeURIComponent(debouncedSearchQuery)}&t=${Date.now()}`,
        { headers: authHeaders, cache: 'no-store' }
      );

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = 'token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        router.push('/login');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        goeyToast.error('Gagal memuat peramalan', { description: data.message || 'Server error' });
        return;
      }

      const data = (await res.json()) as ForecastRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch {
      goeyToast.error('Gagal memuat peramalan', { description: 'Periksa koneksi internet Anda dan coba lagi.' });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, debouncedSearchQuery, router]);

  useEffect(() => {
    fetchLatestForecasts();
  }, [fetchLatestForecasts]);

  useEffect(() => {
    const t = setInterval(() => {
      fetchLatestForecasts();
    }, 60_000);
    return () => clearInterval(t);
  }, [fetchLatestForecasts]);

  // const handleRefresh = useCallback(async () => {
  //   setRefreshLoading(true);
  //   try {
  //     console.log('[FRONTEND] Running forecast...');
  //     const runRes = await fetch('http://localhost:5000/api/forecast/run', {
  //       method: 'POST',
  //       headers: authHeaders,
  //     });

  //     console.log('[FRONTEND] Forecast response status:', runRes.status);

  //     if (runRes.ok) {
  //       console.log('[FRONTEND] Forecast successful, fetching latest...');
  //       goeyToast.success('Peramalan sedang berjalan, tunggu sebentar...');
  //       await new Promise(resolve => setTimeout(resolve, 2000));
  //       await fetchLatestForecasts();
  //       goeyToast.success('Peramalan berhasil diperbarui!');
  //     } else {
  //       const data = await runRes.json().catch(() => ({}));
  //       console.error('[FRONTEND] Forecast error:', data);
  //       goeyToast.error('Gagal memperbarui peramalan', { description: data.message || 'Server error' });
  //     }
  //   } catch (e) {
  //     console.error('[FRONTEND] Refresh error:', e);
  //     goeyToast.error('Gagal memperbarui peramalan', { description: 'Periksa koneksi internet Anda dan coba lagi.' });
  //   } finally {
  //     setRefreshLoading(false);
  //   }
  // }, [authHeaders, fetchLatestForecasts]);

  const lastUpdated = useMemo(() => {
    const dates = rows
      .map(r => r.forecast_created_at)
      .filter(Boolean)
      .map(d => new Date(d as string))
      .filter(d => !Number.isNaN(d.getTime()));
    if (dates.length === 0) return null;
    dates.sort((a, b) => b.getTime() - a.getTime());
    return dates[0];
  }, [rows]);

  const formatInt = useCallback((value: number) => value.toLocaleString('id-ID'), []);

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <PageHeader
        title="Peramalan Stok"
        breadcrumbs={[{ label: 'Peramalan Stok' }, { label: 'Peramalan' }]}
      />
      <div className="p-3 sm:p-4 md:p-8 pt-0">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="w-full lg:max-w-full sm:max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">Cari Produk</label>
                <input
                  type="text"
                  placeholder="Ketik nama produk..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600">
                  {lastUpdated ? `Terakhir diperbarui: ${lastUpdated.toLocaleString()}` : 'Belum ada hasil peramalan'}
                </div>
               
              </div>
            </div>

          <div className="mt-6">
            {loading ? (
              <div className="text-sm text-gray-500">Memuat peramalan...</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-gray-500">Tidak ada data.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {rows.map(r => {
                  return (
                    <div
                      key={r.id}
                      className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900 truncate text-base">{r.name}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <div className="text-xs text-gray-500 mb-1.5">Stok Saat Ini</div>
                          <div className="font-bold text-gray-900 text-lg">
                            {formatInt(Number(r.stock || 0))} <span className="text-sm font-normal">{r.unit}</span>
                          </div>
                        </div>
                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                          <div className="text-xs text-blue-600 mb-1.5">Tambahan Stok</div>
                          <div className="font-bold text-blue-700 text-lg">
                            {r.tambahan_stok === null ? '-' : (
                              <>
                                {formatInt(r.tambahan_stok)} <span className="text-sm font-normal">{r.unit}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        {r.tambahan_stok && r.tambahan_stok > 0 ? (
                          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center gap-2">
                            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Perlu restock segera
                          </div>
                        ) : r.tambahan_stok === 0 ? (
                          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-2">
                            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Stok mencukupi
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
