
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
  source: string | null;
  source_end_date: string | null;
  lead_time: number;
  window_size: number;
  metode: 'gemini' | 'fallback' | null;
  alasan_fallback: string | null;
  kebutuhan_7_hari: number | null;
  perkiraan_penjualan_per_hari: number | string | null;
  tambahan_stok: number | null;
  forecast_created_at: string | null;
};

type ForecastDetail = {
  metode: string;
  alasan_fallback: string | null;
  rekomendasi: {
    tambahan_stok: number;
    satuan: string;
  };
  debug?: {
    prompt_gemini?: string;
    response_gemini?: string;
  };
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
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<{ id: number; name: string; stock: number; unit: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [forecastDetail, setForecastDetail] = useState<ForecastDetail | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchLatestForecasts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/forecast-openrouter/latest?search=${encodeURIComponent(debouncedSearchQuery)}&t=${Date.now()}`,
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

  const handleRefresh = useCallback(async () => {
    setRefreshLoading(true);
    try {
      console.log('[FRONTEND] Running forecast with OpenRouter...');
      const runRes = await fetch('http://localhost:5000/api/forecast-openrouter/run', {
        method: 'POST',
        headers: authHeaders,
      });

      console.log('[FRONTEND] Forecast response status:', runRes.status);

      if (runRes.ok) {
        console.log('[FRONTEND] Forecast successful, fetching latest...');
        goeyToast.success('Peramalan sedang berjalan, tunggu sebentar...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchLatestForecasts();
        goeyToast.success('Peramalan berhasil diperbarui!');
      } else {
        const data = await runRes.json().catch(() => ({}));
        console.error('[FRONTEND] Forecast error:', data);
        goeyToast.error('Gagal memperbarui peramalan', { description: data.message || 'Server error' });
      }
    } catch (e) {
      console.error('[FRONTEND] Refresh error:', e);
      goeyToast.error('Gagal memperbarui peramalan', { description: 'Periksa koneksi internet Anda dan coba lagi.' });
    } finally {
      setRefreshLoading(false);
    }
  }, [authHeaders, fetchLatestForecasts]);

  const handleViewDetail = useCallback(async (product: ForecastRow) => {
    setSelectedProduct({ id: product.id, name: product.name, stock: product.stock, unit: product.unit });
    setDetailLoading(true);
    setForecastDetail(null);
    
    try {
      console.log('[FRONTEND] Fetching forecast detail for product:', product.id);
      const res = await fetch('http://localhost:5000/api/forecast-openrouter/stock', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: product.id,
          lead_time: 7,
          window_size: 7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[FRONTEND] Forecast detail response:', data);
        setForecastDetail(data);
        
        console.log('========== DEBUG INFO FROM API (OpenRouter) ==========');
        console.log('Prompt OpenRouter:', data.debug?.prompt_gemini);
        console.log('Response OpenRouter:', data.debug?.response_gemini);
        console.log('======================================================');
      } else {
        goeyToast.error('Gagal mengambil detail peramalan');
      }
    } catch (e) {
      console.error('[FRONTEND] Detail error:', e);
      goeyToast.error('Gagal mengambil detail peramalan');
    } finally {
      setDetailLoading(false);
    }
  }, [authHeaders]);

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

  useEffect(() => {
    console.log('[FRONTEND] Recommendations OpenRouter page loaded');
    console.log('[FRONTEND] Rows data:', rows);
    console.log('[FRONTEND] Last updated:', lastUpdated);
  }, [rows, lastUpdated]);

  const formatInt = useCallback((value: number) => value.toLocaleString('id-ID'), []);

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <PageHeader
        title="Peramalan Stok (OpenRouter)"
        breadcrumbs={[{ label: 'Peramalan Stok' }, { label: 'Rekomendasi Stok (OpenRouter)' }]}
      />
      <div className="p-3 sm:p-4 md:p-8 pt-0">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">Cari Produk</label>
                <input
                  type="text"
                  placeholder="Ketik nama produk..."
                  className="w-full px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
                <div className="text-xs sm:text-sm text-gray-600">
                  {lastUpdated ? `Terakhir diperbarui: ${lastUpdated.toLocaleString()}` : 'Belum ada hasil peramalan'}
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshLoading}
                  className="w-full sm:w-auto px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {refreshLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Memperbarui...
                    </>
                  ) : (
                    'Refresh Peramalan (OpenRouter)'
                  )}
                </button>
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
                  const methodLabel =
                    r.metode === 'fallback' ? 'Fallback' : r.metode === 'gemini' ? 'OpenRouter' : '-';
                  const methodClass =
                    r.metode === 'fallback'
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : r.metode === 'gemini'
                        ? 'bg-purple-50 text-purple-700 border-purple-100'
                        : 'bg-gray-50 text-gray-700 border-gray-100';

                  const noteText =
                    r.metode === 'fallback'
                      ? `Fallback aktif (${r.alasan_fallback || 'invalid output'})`
                      : r.metode === 'gemini'
                        ? 'Menggunakan OpenRouter'
                        : '-';
                  const isNoteOpen = openNoteId === r.id;

                  return (
                    <div
                      key={r.id}
                      className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 sm:p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{r.name}</div>
                          
                        </div>
                        <span className={`shrink-0 text-xs px-2 py-1 rounded-full border ${methodClass}`}>
                          {methodLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 sm:p-3">
                          <div className="text-xs text-gray-500">Stok saat ini</div>
                          <div className="font-semibold text-gray-900">
                            {formatInt(Number(r.stock || 0))} {r.unit}
                          </div>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 sm:p-3">
                          <div className="text-xs text-gray-500">Tambahan</div>
                          <div className="font-semibold text-purple-700">
                            {r.tambahan_stok === null ? '-' : `${formatInt(r.tambahan_stok)} ${r.unit}`}
                          </div>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 sm:p-3">
                          <div className="text-xs text-gray-500">Kebutuhan 7 hari</div>
                          <div className="font-semibold text-gray-900">
                            {r.kebutuhan_7_hari === null ? '-' : `${formatInt(r.kebutuhan_7_hari)} ${r.unit}`}
                          </div>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 sm:p-3">
                          <div className="text-xs text-gray-500">Per hari</div>
                          <div className="font-semibold text-gray-900">
                            {formatInt(Math.round(Number(r.perkiraan_penjualan_per_hari ?? 0)))} {r.unit}
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenNoteId(prev => (prev === r.id ? null : r.id))}
                          className="flex-1 text-left text-xs font-medium text-gray-700 border border-gray-100 rounded-lg px-2 py-1 sm:px-3 sm:py-2 bg-white hover:bg-gray-50 transition-colors"
                        >
                          {isNoteOpen ? 'Sembunyikan catatan' : 'Lihat catatan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewDetail(r)}
                          className="text-xs font-medium text-purple-700 border border-purple-200 rounded-lg px-2 py-1 sm:px-3 sm:py-2 bg-purple-50 hover:bg-purple-100 transition-colors"
                        >
                          Debug
                        </button>
                      </div>
                      {isNoteOpen ? (
                        <div className="mt-2 text-xs text-gray-600 border border-gray-100 rounded-lg bg-gray-50 px-3 py-2">
                          {noteText}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Debug */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Debug - {selectedProduct.name}</h3>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setForecastDetail(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {detailLoading ? (
                <div className="text-center py-8 text-gray-500">Memuat...</div>
              ) : forecastDetail ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Metode Peramalan</h4>
                    <p className="text-sm text-gray-600">
                      {forecastDetail.metode === 'gemini' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          OpenRouter
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Fallback ({forecastDetail.alasan_fallback || 'unknown'})
                        </span>
                      )}
                    </p>
                  </div>

                  {forecastDetail.debug?.prompt_gemini && (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Prompt yang Dikirim ke OpenRouter</h4>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                        {forecastDetail.debug.prompt_gemini}
                      </pre>
                    </div>
                  )}

                  {forecastDetail.debug?.response_gemini && (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Respons dari OpenRouter</h4>
                      <pre className="bg-purple-900 text-purple-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                        {forecastDetail.debug.response_gemini}
                      </pre>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Hasil Peramalan</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Stok saat ini</div>
                        <div className="font-semibold text-gray-900">{selectedProduct.stock} {selectedProduct.unit}</div>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="text-xs text-purple-600 mb-1">Tambahan stok</div>
                        <div className="font-semibold text-purple-900">{forecastDetail.rekomendasi.tambahan_stok} {forecastDetail.rekomendasi.satuan}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">Gagal memuat detail</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
