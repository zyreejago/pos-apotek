import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import RecommendationsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';

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

function renderPage() {
  return render(<RecommendationsPage />);
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

    expect(screen.getByText('Gemini')).toBeInTheDocument();
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    // expect(screen.getByText('-')).toBeInTheDocument();

    expect(screen.getByText('15 pcs')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(screen.getByText('20 pcs')).toBeInTheDocument();
    expect(screen.getByText('2 pcs')).toBeInTheDocument();
    expect(screen.getByText('3 kg')).toBeInTheDocument();
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

 test('opens and closes note for gemini row', async () => {
  renderPage();

  await waitLoaded();

  fireEvent.click((await screen.findAllByText('Lihat catatan'))[0]);

  expect(await screen.findByText('Sembunyikan catatan')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Sembunyikan catatan'));

  await waitFor(() => {
    expect(screen.queryByText('Sembunyikan catatan')).not.toBeInTheDocument();
  });
});

  test('opens fallback note', async () => {
  renderPage();

  await waitLoaded();

  await waitFor(() => {
    expect(screen.queryByText('Memuat peramalan...')).not.toBeInTheDocument();
  });

  const noteButtons = await screen.findAllByText('Lihat catatan');

  fireEvent.click(noteButtons[1]);

  expect(await screen.findByText(/Fallback aktif/)).toBeInTheDocument();
});

  test('opens detail modal success with debug data and closes modal', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getAllByText('Debug')[0]);

    expect(await screen.findByText('Debug - Produk Gemini')).toBeInTheDocument();
    expect(screen.getByText('Gemini AI')).toBeInTheDocument();
    expect(screen.getByText('PROMPT TEST')).toBeInTheDocument();
    expect(screen.getByText('RESPONSE TEST')).toBeInTheDocument();
    expect(screen.getByText('12 pcs')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', {
      name: '',
    });

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Debug - Produk Gemini')).not.toBeInTheDocument();
    });
  });

  test('opens detail modal fallback without debug blocks', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) return okJson(rows);

      if (url.includes('/api/forecast/stock') && init?.method === 'POST') {
        return okJson({
          metode: 'fallback',
          alasan_fallback: 'unknown',
          rekomendasi: {
            tambahan_stok: 8,
            satuan: 'box',
          },
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getAllByText('Debug')[1]);

    expect(await screen.findByText('Debug - Produk Fallback')).toBeInTheDocument();
    expect(screen.getByText('Fallback (unknown)')).toBeInTheDocument();
    expect(screen.getByText('8 box')).toBeInTheDocument();
  });

  test('shows detail loading state', async () => {
    let resolveDetail: (value: Response) => void = jest.fn();

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) return okJson(rows);

      if (url.includes('/api/forecast/stock') && init?.method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolveDetail = resolve;
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getAllByText('Debug')[0]);

    expect(await screen.findByText('Memuat...')).toBeInTheDocument();

    resolveDetail({
      ok: true,
      status: 200,
      json: async () => ({
        metode: 'gemini',
        alasan_fallback: null,
        rekomendasi: {
          tambahan_stok: 3,
          satuan: 'pcs',
        },
      }),
      text: async () => '',
    } as Response);

    expect(await screen.findByText('Gemini AI')).toBeInTheDocument();
  });

  test('handles detail response failure', async () => {
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/forecast/stock') && init?.method === 'POST') {
      return failJson({}, 500);
    }

    if (url.includes('/api/forecast/latest')) {
      return okJson(rows);
    }

    return okJson({});
  }) as unknown as typeof fetch;

  renderPage();

  await waitLoaded();

  fireEvent.click(screen.getAllByText('Debug')[0]);

  await waitFor(() => {
    expect(goeyToast.error).toHaveBeenCalledWith('Gagal mengambil detail peramalan');
  });

  expect(screen.getByText('Gagal memuat detail')).toBeInTheDocument();
});

  test('handles detail network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) return okJson(rows);

      if (url.includes('/api/forecast/stock') && init?.method === 'POST') {
        return Promise.reject(new Error('detail error'));
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getAllByText('Debug')[0]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal mengambil detail peramalan');
    });
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
  test('closes detail modal with empty failed detail state', async () => {
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/forecast/latest')) return okJson(rows);

    if (url.includes('/api/forecast/stock') && init?.method === 'POST') {
      return failJson({}, 500);
    }

    return okJson({});
  }) as unknown as typeof fetch;

  renderPage();

  await waitLoaded();

  fireEvent.click((await screen.findAllByText('Debug'))[0]);

  expect(await screen.findByText('Gagal memuat detail')).toBeInTheDocument();

  const closeButtons = screen.getAllByRole('button');
  fireEvent.click(closeButtons[closeButtons.length - 1]);

  await waitFor(() => {
    expect(screen.queryByText('Debug - Produk Gemini')).not.toBeInTheDocument();
  });
});

test('refresh forecast success', async () => {
  renderPage();

  await waitLoaded();

  fireEvent.click(screen.getByText('Refresh Peramalan'));

  expect(await screen.findByText('Memperbarui...')).toBeInTheDocument();

  await waitFor(() => {
    expect(goeyToast.success).toHaveBeenCalledWith(
      'Peramalan sedang berjalan, tunggu sebentar...'
    );
  });

  await waitFor(
    () => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Peramalan berhasil diperbarui!'
      );
    },
    { timeout: 3500 }
  );
});
  test('refresh forecast failure with backend message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) return okJson(rows);

      if (url.includes('/api/forecast/run') && init?.method === 'POST') {
        return failJson({ message: 'Run failed' }, 500);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Refresh Peramalan'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal memperbarui peramalan',
        expect.objectContaining({
          description: 'Run failed',
        })
      );
    });
  });

  test('refresh forecast failure without backend message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) return okJson(rows);

      if (url.includes('/api/forecast/run') && init?.method === 'POST') {
        return failJson({}, 500);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Refresh Peramalan'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal memperbarui peramalan',
        expect.objectContaining({
          description: 'Server error',
        })
      );
    });
  });

  test('refresh forecast network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/forecast/latest')) return okJson(rows);

      if (url.includes('/api/forecast/run') && init?.method === 'POST') {
        return Promise.reject(new Error('run error'));
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Refresh Peramalan'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal memperbarui peramalan',
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
});

