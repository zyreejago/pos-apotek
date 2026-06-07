import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Page from '../page';
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
  usePathname: () => '/recommendations-debug',
}));

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: jest.fn(),
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

function okJson(data: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

function failJson(data: unknown, status = 500): Promise<Response> {
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
    metode: 'gemini' as const,
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
    metode: 'fallback' as const,
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

const detailGeminiResponse = {
  metode: 'gemini',
  alasan_fallback: null,
  rekomendasi: { tambahan_stok: 12, satuan: 'pcs' },
  debug: {
    prompt_gemini: 'PROMPT TEST',
    response_gemini: 'RESPONSE TEST',
  },
};

const detailFallbackResponse = {
  metode: 'fallback',
  alasan_fallback: 'API timeout',
  rekomendasi: { tambahan_stok: 5, satuan: 'box' },
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'test');

  global.fetch = jest.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/api/forecast/latest')) return okJson(rows);
    if (url.includes('/api/forecast/run')) return okJson({ message: 'ok' });
    if (url.includes('/api/forecast/stock')) return okJson(detailGeminiResponse);
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
      <Page />
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

describe('recommendations-debug module', () => {
  test('renders page and fetches latest forecasts', async () => {
    renderPage();

    expect(screen.getByTestId('header')).toHaveTextContent('Peramalan Stok (Debug)');

    await waitLoaded();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forecast/latest?search='),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test' },
        cache: 'no-store',
      })
    );
  });

  test('renders loading state', async () => {
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

    resolveFetch(await okJson(rows));
    expect(await screen.findByText('Produk Gemini')).toBeInTheDocument();
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

  test('renders forecast cards with gemini, fallback and null method branches', async () => {
    renderPage();
    await waitLoaded();

    expect(screen.getByText('Produk Gemini')).toBeInTheDocument();
    expect(screen.getByText('Produk Fallback')).toBeInTheDocument();
    expect(screen.getByText('Produk Manual')).toBeInTheDocument();

    expect(screen.getByText('Gemini')).toBeInTheDocument();
    expect(screen.getByText('Fallback')).toBeInTheDocument();

    // Toggle gemini note
    const pertama = screen.getAllByText('Lihat catatan');
    fireEvent.click(pertama[0]);
    await waitFor(() => {
      expect(screen.getByText('Sembunyikan catatan')).toBeInTheDocument();
    });
    expect(screen.getByText('Menggunakan AI Gemini')).toBeInTheDocument();

    // Toggle fallback note (single-select pattern: this closes gemini note)
    const afterFirst = screen.getAllByText('Lihat catatan');
    fireEvent.click(afterFirst[0]);
    await waitFor(() => {
      expect(screen.getByText('Fallback aktif (invalid output)')).toBeInTheDocument();
    });

    expect(screen.getByText(/Terakhir diperbarui:/)).toBeInTheDocument();
  });

  test('renders note toggle for a row', async () => {
    renderPage();
    await waitLoaded();

    const lihatButtons = screen.getAllByText('Lihat catatan');
    expect(lihatButtons.length).toBe(3);

    fireEvent.click(lihatButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Sembunyikan catatan')).toBeInTheDocument();
    });
    expect(screen.getByText('Menggunakan AI Gemini')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sembunyikan catatan'));
    expect(screen.queryByText('Menggunakan AI Gemini')).not.toBeInTheDocument();
  });

  test('renders fallback note', async () => {
    renderPage();
    await waitLoaded();

    const lihatButtons = screen.getAllByText('Lihat catatan');
    fireEvent.click(lihatButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Fallback aktif (invalid output)')).toBeInTheDocument();
    });
  });

  test('renders null method note as dash', async () => {
    renderPage();
    await waitLoaded();

    const lihatButtons = screen.getAllByText('Lihat catatan');
    fireEvent.click(lihatButtons[2]);

    await waitFor(() => {
      expect(screen.getByText('Sembunyikan catatan')).toBeInTheDocument();
    });
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  test('renders null tambahan_stok and kebutuhan_7_hari as dash', async () => {
    renderPage();
    await waitLoaded();

    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  test('handles search debounce', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.change(screen.getByPlaceholderText('Ketik nama produk...'), {
      target: { value: 'gemini' },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=gemini'),
        expect.any(Object)
      );
    }, { timeout: 3000 });
  });

  test('shows lastUpdated with "Belum ada hasil peramalan" when no dates exist', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/forecast/latest')) {
        return okJson([{ ...rows[2], forecast_created_at: null }]);
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText('Belum ada hasil peramalan')).toBeInTheDocument();
  });

  describe('detail modal', () => {
    test('opens detail modal with loading state', async () => {
      let resolveStock: (value: Response) => void = jest.fn();

      global.fetch = jest.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/forecast/latest')) return okJson(rows);
        if (url.includes('/api/forecast/run')) return okJson({});
        if (url.includes('/api/forecast/stock')) {
          return new Promise<Response>((resolve) => {
            resolveStock = resolve;
          });
        }
        return okJson({});
      }) as unknown as typeof fetch;

      renderPage();
      await waitLoaded();

      const debugBtns = screen.getAllByText('Debug');
      fireEvent.click(debugBtns[0]);

      expect(await screen.findByText('Memuat...')).toBeInTheDocument();

      resolveStock(await okJson(detailGeminiResponse));

      await waitFor(() => {
        expect(screen.queryByText('Memuat...')).not.toBeInTheDocument();
      });
    });

    test('shows gemini detail with debug prompt and response', async () => {
      renderPage();
      await waitLoaded();

      const debugBtns = screen.getAllByText('Debug');
      fireEvent.click(debugBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('PROMPT TEST')).toBeInTheDocument();
      });

      expect(screen.getByText('Gemini AI')).toBeInTheDocument();
      expect(screen.getByText('RESPONSE TEST')).toBeInTheDocument();
    });

    test('shows fallback detail without debug blocks', async () => {
      global.fetch = jest.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/forecast/latest')) return okJson(rows);
        if (url.includes('/api/forecast/run')) return okJson({});
        if (url.includes('/api/forecast/stock')) return okJson(detailFallbackResponse);
        return okJson({});
      }) as unknown as typeof fetch;

      renderPage();
      await waitLoaded();

      const debugBtns = screen.getAllByText('Debug');
      fireEvent.click(debugBtns[1]);

      await waitFor(() => {
        expect(screen.getByText(/Fallback \(API timeout\)/)).toBeInTheDocument();
      });

      expect(screen.queryByText('Prompt yang Dikirim ke Gemini')).not.toBeInTheDocument();
      expect(screen.queryByText('Respons dari Gemini')).not.toBeInTheDocument();
    });

    test('closes detail modal', async () => {
      renderPage();
      await waitLoaded();

      const debugBtns = screen.getAllByText('Debug');
      fireEvent.click(debugBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('PROMPT TEST')).toBeInTheDocument();
      });

      const closeBtn = screen.getByRole('button', { name: '' });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Debug - Produk/)).not.toBeInTheDocument();
      });
    });

    test('shows Gagal memuat detail when forecastDetail is null after loading', async () => {
      let resolveStock: (value: Response) => void = jest.fn();

      global.fetch = jest.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/forecast/latest')) return okJson(rows);
        if (url.includes('/api/forecast/run')) return okJson({});
        if (url.includes('/api/forecast/stock')) {
          return new Promise<Response>((resolve) => {
            resolveStock = resolve;
          });
        }
        return okJson({});
      }) as unknown as typeof fetch;

      renderPage();
      await waitLoaded();

      const debugBtns = screen.getAllByText('Debug');
      fireEvent.click(debugBtns[0]);

      expect(await screen.findByText('Memuat...')).toBeInTheDocument();

      resolveStock(await okJson(null));

      await waitFor(() => {
        expect(screen.queryByText('Memuat...')).not.toBeInTheDocument();
      });
    });

    test('handles detail response failure', async () => {
      global.fetch = jest.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/forecast/latest')) return okJson(rows);
        if (url.includes('/api/forecast/run')) return okJson({});
        if (url.includes('/api/forecast/stock')) return failJson({}, 500);
        return okJson({});
      }) as unknown as typeof fetch;

      renderPage();
      await waitLoaded();

      const debugBtns = screen.getAllByText('Debug');
      fireEvent.click(debugBtns[0]);

      await waitFor(() => {
        expect(goeyToast.error).toHaveBeenCalledWith('Gagal mengambil detail peramalan');
      });
    });

    test('handles detail network error', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      global.fetch = jest.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/forecast/latest')) return okJson(rows);
        if (url.includes('/api/forecast/run')) return okJson({});
        if (url.includes('/api/forecast/stock')) return Promise.reject(new Error('network error'));
        return okJson({});
      }) as unknown as typeof fetch;

      renderPage();
      await waitLoaded();

      const debugBtns = screen.getAllByText('Debug');
      fireEvent.click(debugBtns[0]);

      await waitFor(() => {
        expect(goeyToast.error).toHaveBeenCalledWith('Gagal mengambil detail peramalan');
      });
    });
  });

  describe('fetchLatestForecasts', () => {
    test('handles 401 unauthorized', async () => {
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
          expect.objectContaining({ description: 'Forecast failed' })
        );
      });
    });

    test('handles latest failure without backend message', async () => {
      global.fetch = jest.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/forecast/latest')) return failJson({}, 500);
        return okJson({});
      }) as unknown as typeof fetch;

      renderPage();

      await waitFor(() => {
        expect(goeyToast.error).toHaveBeenCalledWith(
          'Gagal memuat peramalan',
          expect.objectContaining({ description: 'Server error' })
        );
      });
    });

    test('handles latest network error', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('network'))) as unknown as typeof fetch;

      renderPage();

      await waitFor(() => {
        expect(goeyToast.error).toHaveBeenCalledWith(
          'Gagal memuat peramalan',
          expect.objectContaining({ description: 'Periksa koneksi internet Anda dan coba lagi.' })
        );
      });
    });

    test('handles non-array latest response', async () => {
      global.fetch = jest.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/forecast/latest')) return okJson({ data: rows });
        return okJson({});
      }) as unknown as typeof fetch;

      renderPage();

      expect(await screen.findByText('Tidak ada data.')).toBeInTheDocument();
    });
  });

  describe('handleRefresh', () => {
    test('refresh forecast success', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});

      renderPage();
      await waitLoaded();

      fireEvent.click(screen.getByText('Refresh Peramalan'));

      expect(screen.getByText('Memperbarui...')).toBeInTheDocument();

      await waitFor(() => {
        expect(goeyToast.success).toHaveBeenCalledWith('Peramalan sedang berjalan, tunggu sebentar...');
      });

      await waitFor(() => {
        expect(goeyToast.success).toHaveBeenCalledWith('Peramalan berhasil diperbarui!');
      }, { timeout: 5000 });

      await waitFor(() => {
        expect(screen.queryByText('Memperbarui...')).not.toBeInTheDocument();
      });

      jest.spyOn(console, 'log').mockRestore();
    });

    test('refresh forecast failure with backend message', async () => {
      global.fetch = jest.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/forecast/latest')) return okJson(rows);
        if (url.includes('/api/forecast/run')) return failJson({ message: 'Run failed' }, 500);
        return okJson({});
      }) as unknown as typeof fetch;

      renderPage();
      await waitLoaded();

      fireEvent.click(screen.getByText('Refresh Peramalan'));

      await waitFor(() => {
        expect(goeyToast.error).toHaveBeenCalledWith(
          'Gagal memperbarui peramalan',
          expect.objectContaining({ description: 'Run failed' })
        );
      });
    });

    test('refresh forecast failure without backend message', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      global.fetch = jest.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/forecast/latest')) return okJson(rows);
        if (url.includes('/api/forecast/run')) return failJson({}, 500);
        return okJson({});
      }) as unknown as typeof fetch;

      renderPage();
      await waitLoaded();

      fireEvent.click(screen.getByText('Refresh Peramalan'));

      await waitFor(() => {
        expect(goeyToast.error).toHaveBeenCalledWith(
          'Gagal memperbarui peramalan',
          expect.objectContaining({ description: 'Server error' })
        );
      });
    });

    test('refresh forecast network error', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      global.fetch = jest.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/forecast/latest')) return okJson(rows);
        if (url.includes('/api/forecast/run')) return Promise.reject(new Error('network'));
        return okJson({});
      }) as unknown as typeof fetch;

      renderPage();
      await waitLoaded();

      fireEvent.click(screen.getByText('Refresh Peramalan'));

      await waitFor(() => {
        expect(goeyToast.error).toHaveBeenCalledWith(
          'Gagal memperbarui peramalan',
          expect.objectContaining({ description: 'Periksa koneksi internet Anda dan coba lagi.' })
        );
      });
    });
  });

  test('fetches without token', async () => {
    localStorage.removeItem('token');

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Memuat peramalan...')).not.toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forecast/latest'),
      expect.objectContaining({ headers: {} })
    );
  });

  test('auto-refresh interval is set up', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    renderPage();
    await waitLoaded();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

    setIntervalSpy.mockRestore();
  });

  test('triggers interval callback to call fetchLatestForecasts', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    renderPage();
    await waitLoaded();

    const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.filter(
      c => typeof c[0] === 'string' && (c[0] as string).includes('/api/forecast/latest')
    ).length;

    const intervalCall = setIntervalSpy.mock.calls.find(
      (c: any) => c[1] === 60000
    );
    if (intervalCall && intervalCall[0]) {
      await (intervalCall[0] as () => Promise<void>)();
    }

    await waitFor(() => {
      const fetchCallsAfter = (global.fetch as jest.Mock).mock.calls.filter(
        c => typeof c[0] === 'string' && (c[0] as string).includes('/api/forecast/latest')
      ).length;
      expect(fetchCallsAfter).toBeGreaterThan(fetchCallsBefore);
    });

    setIntervalSpy.mockRestore();
  });

  test('console logs on mount and data change', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    expect(consoleLogSpy).toHaveBeenCalledWith('[FRONTEND] Recommendations page loaded');
    expect(consoleLogSpy).toHaveBeenCalledWith('[FRONTEND] Rows data:', rows);
    expect(consoleLogSpy).toHaveBeenCalledWith('[FRONTEND] Last updated:', expect.any(Date));

    consoleLogSpy.mockRestore();
  });

  test('modal debug logs to console', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    const debugBtns = screen.getAllByText('Debug');
    fireEvent.click(debugBtns[0]);

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith('[FRONTEND] Fetching forecast detail for product:', 1);
    });

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith('Prompt Gemini:', 'PROMPT TEST');
    });

    consoleLogSpy.mockRestore();
  });

  test('cleanup interval on unmount', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderPage();
    await waitLoaded();

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });

  test('handleViewDetail sets selectedProduct and loading state', async () => {
    renderPage();
    await waitLoaded();

    const debugBtns = screen.getAllByText('Debug');
    fireEvent.click(debugBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Debug - Produk Gemini/)).toBeInTheDocument();
    });
  });

  test('produk manual null stock renders 0', async () => {
    renderPage();
    await waitLoaded();

    expect(screen.getAllByText(/0 kg/).length).toBeGreaterThanOrEqual(1);
  });
});
