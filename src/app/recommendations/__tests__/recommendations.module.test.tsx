import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import RecommendationsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';
import { HeaderProvider, useHeader } from '@/context/HeaderContext';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/recommendations',
}));

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: jest.fn(() => ({
    loading: false,
    hasPermission: true,
    permissions: [],
    checkActionPermission: jest.fn(() => true),
    currentUserRole: 'superadmin',
  })),
}));

jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

jest.mock('@/components/ui/goey-toaster', () => ({
  goeyToast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
  GoeyToaster: () => null,
}));

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

function failJson(data: unknown, status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

const rows = [
  {
    id: 1,
    name: 'Produk Gemini',
    stock: 10,
    unit: 'pcs',
    source: null,
    source_end_date: null,
    lead_time: 7,
    window_size: 7,
    metode: 'gemini',
    alasan_fallback: null,
    kebutuhan_7_hari: 20,
    perkiraan_penjualan_per_hari: 2.4,
    tambahan_stok: 15,
    forecast_created_at: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 2,
    name: 'Produk Fallback',
    stock: 5,
    unit: 'box',
    source: null,
    source_end_date: null,
    lead_time: 7,
    window_size: 7,
    metode: 'fallback',
    alasan_fallback: 'invalid output',
    kebutuhan_7_hari: null,
    perkiraan_penjualan_per_hari: null,
    tambahan_stok: null,
    forecast_created_at: '2026-01-02T10:00:00.000Z',
  },
  {
    id: 3,
    name: 'Produk Manual',
    stock: 0,
    unit: 'kg',
    source: null,
    source_end_date: null,
    lead_time: 7,
    window_size: 7,
    metode: null,
    alasan_fallback: null,
    kebutuhan_7_hari: 0,
    perkiraan_penjualan_per_hari: '3',
    tambahan_stok: 0,
    forecast_created_at: null,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();

  localStorage.clear();
  localStorage.setItem('token', 'test');
  localStorage.setItem(
    'user',
    JSON.stringify({
      id: 1,
      username: 'test',
      role: 'superadmin',
      email: 'test@test.com',
    })
  );

  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/forecast/latest')) {
      return okJson(rows);
    }

    if (url.includes('/api/forecast/run')) {
      return okJson({ message: 'ok' });
    }

    if (url.includes('/api/forecast/stock')) {
      return okJson({
        metode: 'gemini',
        alasan_fallback: null,
        rekomendasi: {
          tambahan_stok: 12,
          satuan: 'pcs',
        },
        debug: {
          prompt_gemini: 'PROMPT TEST',
          response_gemini: 'RESPONSE TEST',
        },
      });
    }

    return okJson({});
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
jest.setTimeout(15000);

function HeaderDisplay() {
  const { headerState } = useHeader();
  return (
    <div data-testid="header">
      <h1>{headerState.title}</h1>
      {headerState.subtitle && <p>{headerState.subtitle}</p>}
      {headerState.rightContent}
    </div>
  );
}

function renderPage() {
  return render(
    <HeaderProvider>
      <HeaderDisplay />
      <RecommendationsPage />
    </HeaderProvider>
  );
}

async function waitLoaded() {
  await waitFor(() => {
    expect(screen.queryByText('Memuat peramalan...')).not.toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText('Produk Gemini')).toBeInTheDocument();
  });
}
describe('recommendations module', () => {
  test('renders page and fetches latest forecasts', async () => {
    renderPage();

    expect(screen.getByTestId('header')).toHaveTextContent('Peramalan Stok');

    await waitLoaded();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forecast/latest?search='),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test',
        },
        cache: 'no-store',
      })
    );
  });

  test('renders forecast cards with gemini fallback and empty method branches', async () => {
    renderPage();

    await waitLoaded();

    expect(screen.getByText('Produk Gemini')).toBeInTheDocument();
    expect(screen.getByText('Produk Fallback')).toBeInTheDocument();
    expect(screen.getByText('Produk Manual')).toBeInTheDocument();

    expect(screen.getByText('Perlu restock segera')).toBeInTheDocument();
    expect(screen.getByText('Stok mencukupi')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(screen.getByText(/Terakhir diperbarui:/)).toBeInTheDocument();
  });

  test('renders empty state', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) return okJson([]);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText('Tidak ada data.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada hasil peramalan')).toBeInTheDocument();
  });

  test('renders loading state before data resolves', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) {
        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    expect(screen.getByText('Memuat peramalan...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => rows,
      text: async () => JSON.stringify(rows),
    } as Response);

    expect(await screen.findByText('Produk Gemini')).toBeInTheDocument();
  });

  test('handles search debounce', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.change(screen.getByPlaceholderText('Ketik nama produk...'), {
      target: { value: 'gemini' },
    });

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=gemini'),
          expect.any(Object)
        );
      },
      { timeout: 2000 }
    );
  });

  test('auto-refresh interval is set up', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    renderPage();
    await waitLoaded();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

    setIntervalSpy.mockRestore();
  });

  test('handles latest unauthorized', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) return failJson({}, 401);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  test('handles latest failure with backend message', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) {
        return failJson({ message: 'Forecast failed' }, 500);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal memuat peramalan',
        expect.objectContaining({
          description: 'Forecast failed',
        })
      );
    });
  });

  test('handles latest failure without backend message', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) {
        return failJson({}, 500);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal memuat peramalan',
        expect.objectContaining({
          description: 'Server error',
        })
      );
    });
  });

  test('handles latest network error', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network'))) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal memuat peramalan',
        expect.objectContaining({
          description: 'Periksa koneksi internet Anda dan coba lagi.',
        })
      );
    });
  });

  test('fetches without token', async () => {
    localStorage.removeItem('token');

    renderPage();

    await waitLoaded();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forecast/latest'),
      expect.objectContaining({
        headers: {},
      })
    );
  });

  test('handles non array latest response as empty rows', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) return okJson({ data: rows });

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText('Tidak ada data.')).toBeInTheDocument();
  });

  test('auto-refresh interval fetchLatestForecasts is called (line 77)', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    renderPage();
    await waitLoaded();

    const initialCalls = (global.fetch as jest.Mock).mock.calls.filter(
      (c: any) => typeof c[0] === 'string' && (c[0] as string).includes('/api/forecast/latest')
    ).length;

    const intervalCall = setIntervalSpy.mock.calls.find(
      (c: any) => c[1] === 60000
    );
    if (intervalCall && intervalCall[0]) {
      await (intervalCall[0] as () => Promise<void>)();
    }

    await waitFor(() => {
      const currentCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && (c[0] as string).includes('/api/forecast/latest')
      ).length;
      expect(currentCalls).toBeGreaterThan(initialCalls);
    });

    setIntervalSpy.mockRestore();
  });
});

