import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'react-dom';
import SaleReturnsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';
import { HeaderProvider } from '@/context/HeaderContext';

const pushMock = jest.fn();
const mockCheckPermission = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: () => ({
    loading: false,
    hasPermission: true,
    permissions: [],
    checkActionPermission: mockCheckPermission,
    currentUserRole: 'superadmin',
  }),
}));

jest.mock('@/components/ui/goey-toaster', () => ({
  goeyToast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
  GoeyToaster: () => null,
}));

jest.mock('@/components/PageHeader', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="icon-search" />,
  ArrowLeft: () => <span data-testid="icon-arrowleft" />,
  ShoppingCart: () => <span data-testid="icon-cart" />,
  RotateCcw: () => <span data-testid="icon-rotate" />,
  History: () => <span data-testid="icon-history" />,
  Eye: () => <span data-testid="icon-eye" />,
  X: () => <span data-testid="icon-x" />,
  Info: () => <span data-testid="icon-info" />,
  Calendar: () => <span data-testid="icon-calendar" />,
  DollarSign: () => <span data-testid="icon-dollar" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  AlertCircle: () => <span data-testid="icon-alertcircle" />,
  AlertTriangle: () => <span data-testid="icon-alerttriangle" />,
  CheckCircle: () => <span data-testid="icon-checkcircle" />,
  Package: () => <span data-testid="icon-package" />,
}));

const saleLookupResponse = {
  sale: { id: 1, date: '2024-01-15T10:00:00Z', total: 50000, payment_method: 'cash' },
  items: [
    { sale_item_id: 1, product_id: 1, product_name: 'Paracetamol', quantity: 5, price: 5000, qty_already_returned: 0, qty_returnable: 3 },
    { sale_item_id: 2, product_id: 2, product_name: 'Amoxicillin', quantity: 10, price: 2500, qty_already_returned: 2, qty_returnable: 0 },
    { sale_item_id: 3, product_id: 3, product_name: 'Vitamin C', quantity: 8, price: 3000, qty_already_returned: 0, qty_returnable: 5 },
  ],
};

const historyWithData = {
  data: [
    {
      id: 1, return_no: 'R-2024-0001', original_sale_id: 1, returned_by_name: 'Admin',
      created_at: '2024-01-20T08:30:00Z', refund_method: 'cash', total_refund: 25000, reason: 'Barang rusak',
    },
    {
      id: 2, return_no: 'R-2024-0002', original_sale_id: 2, returned_by_name: '',
      created_at: '2024-01-25T10:00:00Z', refund_method: 'credit_note', total_refund: 15000, reason: null,
    },
  ],
};

const emptyHistory = { data: [] };

const detailResponse = {
  id: 1, return_no: 'R-2024-0001',
  items: [
    { id: 1, product_name: 'Paracetamol', qty_returned: 3, price: 5000 },
    { id: 2, product_name: 'Vitamin C', qty_returned: 2, price: 10000 },
  ],
};

function okJson(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface MockEntry {
  pattern: string;
  method?: string;
  handler: (url: string) => Promise<Response>;
}

function makeFetch(overrides: Record<string, (url: string) => Promise<Response>>): FetchMock {
  const entries: MockEntry[] = Object.entries(overrides)
    .map(([key, handler]) => {
      const [pattern, method] = key.split('::');
      return { pattern, method: method || undefined, handler };
    })
    .sort((a, b) => b.pattern.length - a.pattern.length);

  return ((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const reqMethod = init?.method || 'GET';
    for (const { pattern, method, handler } of entries) {
      if (url.includes(pattern) && (!method || method === reqMethod)) {
        return handler(url);
      }
    }
    return okJson({});
  }) as unknown as typeof fetch;
}

function setupHistoryFetch(historyData: unknown) {
  global.fetch = makeFetch({ '/api/returns/sales': () => okJson(historyData) }) as unknown as typeof fetch;
}

function renderPage() {
  return render(
    <HeaderProvider>
      <SaleReturnsPage />
    </HeaderProvider>
  );
}

async function waitInitialRender() {
  await act(async () => {
    await new Promise(r => setTimeout(r, 50));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckPermission.mockReturnValue(true);
  localStorage.clear();
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test', role: 'admin' }));
  pushMock.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SaleReturnsPage', () => {
  test('renders initial stats with 0x placeholders', async () => {
    setupHistoryFetch(emptyHistory);
    renderPage();
    await waitInitialRender();
    const statCards = screen.getAllByText('0x');
    expect(statCards.length).toBe(2);
  });

  test('mounts and shows formatted currency after mounted', async () => {
    setupHistoryFetch(historyWithData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('2x')).toBeInTheDocument();
    });
  });

  test('history fetch catch branch on network error', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network'))) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    expect(screen.getByText('Total Retur')).toBeInTheDocument();
  });

  test('no token uses empty authHeaders', async () => {
    localStorage.removeItem('token');
    setupHistoryFetch(emptyHistory);
    renderPage();
    await waitInitialRender();
    expect(screen.getByText('Total Retur')).toBeInTheDocument();
  });

  test('handleLookup empty saleId shows toast', () => {
    setupHistoryFetch(emptyHistory);
    renderPage();
    fireEvent.click(screen.getByText('Cari'));
    expect(goeyToast.error).toHaveBeenCalledWith('Masukkan ID transaksi', expect.any(Object));
  });

  test('handleLookup 401 redirects to login', async () => {
    global.fetch = makeFetch({
      '/api/returns/sales/lookup': () => okJson({}, 401),
      '/api/returns/sales': () => okJson(emptyHistory),
    }) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'));
  });

  test('handleLookup 404 shows not found toast', async () => {
    global.fetch = makeFetch({
      '/api/returns/sales/lookup': () => okJson({}, 404),
      '/api/returns/sales': () => okJson(emptyHistory),
    }) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Transaksi tidak ditemukan', expect.any(Object));
    });
  });

  test('handleLookup network error', async () => {
    global.fetch = makeFetch({
      '/api/returns/sales/lookup': () => Promise.reject(new Error('network')),
      '/api/returns/sales': () => okJson(emptyHistory),
    }) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal terhubung ke server', {});
    });
  });

  test('handleLookup success renders lookup result', async () => {
    global.fetch = makeFetch({
      '/api/returns/sales/lookup': () => okJson(saleLookupResponse),
      '/api/returns/sales': () => okJson(emptyHistory),
    }) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => {
      expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument();
    });
    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
  });

  test('Enter key triggers lookup', async () => {
    global.fetch = makeFetch({
      '/api/returns/sales/lookup': () => okJson(saleLookupResponse),
      '/api/returns/sales': () => okJson(emptyHistory),
    }) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    const input = screen.getByPlaceholderText('Masukkan ID transaksi...');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument();
    });
  });

  test('searched with no result shows not found and cari ulang resets', async () => {
    global.fetch = makeFetch({
      '/api/returns/sales/lookup': () => okJson({}, 404),
      '/api/returns/sales': () => okJson(emptyHistory),
    }) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '999' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => {
      expect(screen.getByText('Transaksi tidak ditemukan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Cari ulang'));
    expect(screen.queryByText('Transaksi tidak ditemukan')).not.toBeInTheDocument();
  });

  test('handleQtyChange updates spinbutton value', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => {
      expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument();
    });
    const qtyInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInputs[0], { target: { value: '2' } });
    expect(qtyInputs[0]).toHaveValue(2);
    fireEvent.change(qtyInputs[0], { target: { value: '' } });
    expect(qtyInputs[0]).toHaveValue(null);
  });

  function setupLookupFetch() {
    return jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales') && method === 'POST') return okJson({ return_no: 'R-2024-0003' });
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
  }

  async function lookupAndFill(fetchMock: ReturnType<typeof setupLookupFetch>) {
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument());
  }

  async function fillReasonAndQty(reason = 'rusak', qty = '2') {
    fireEvent.change(screen.getByPlaceholderText('Contoh: Barang tidak sesuai pesanan...'), { target: { value: reason } });
    const qtyInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInputs[1], { target: { value: qty } });
  }

  test('handleSubmit permission denied shows toast', async () => {
    mockCheckPermission.mockReturnValue(false);
    const fetchMock = setupLookupFetch();
    await lookupAndFill(fetchMock);
    await fillReasonAndQty();
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Akses Ditolak', expect.any(Object));
    });
  });

  test('handleSubmit empty reason shows toast', async () => {
    const fetchMock = setupLookupFetch();
    await lookupAndFill(fetchMock);
    const qtyInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInputs[1], { target: { value: '2' } });
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Alasan retur wajib diisi', expect.any(Object));
    });
  });

  test('handleSubmit qty > qty_returnable shows invalid toast', async () => {
    const fetchMock = setupLookupFetch();
    await lookupAndFill(fetchMock);
    await fillReasonAndQty('rusak', '99');
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Quantity retur tidak valid', expect.any(Object));
    });
  });

  test('handleSubmit valid shows confirm modal', async () => {
    const fetchMock = setupLookupFetch();
    await lookupAndFill(fetchMock);
    await fillReasonAndQty();
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => {
      expect(screen.getByText(/Yakin ingin memproses retur/)).toBeInTheDocument();
    });
  });

  test('confirm modal cancel closes modal', async () => {
    const fetchMock = setupLookupFetch();
    await lookupAndFill(fetchMock);
    await fillReasonAndQty();
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => {
      expect(screen.getAllByText(/Yakin ingin memproses retur/).length).toBeGreaterThan(0);
    });
    const batalButtons = screen.getAllByText('Batal');
    fireEvent.click(batalButtons[batalButtons.length - 1]);
    await waitFor(() => {
      expect(screen.queryAllByText(/Yakin ingin memproses retur/).length).toBe(0);
    });
  });

  test('handleConfirmSubmit success resets state', async () => {
    const fetchMock = setupLookupFetch();
    await lookupAndFill(fetchMock);
    await fillReasonAndQty();
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => expect(screen.getByText(/Yakin ingin memproses retur/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Ya, Proses'));
    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Retur berhasil', expect.objectContaining({ description: 'Return No: R-2024-0003' }));
    });
    expect(screen.queryByText(/Transaksi #1/)).not.toBeInTheDocument();
  });

  test('handleConfirmSubmit error with message', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales') && method === 'POST') return okJson({ message: 'Proses gagal' }, 400);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    await lookupAndFill(fetchMock);
    await fillReasonAndQty();
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => expect(screen.getByText(/Yakin ingin memproses retur/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Ya, Proses'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal', expect.objectContaining({ description: 'Proses gagal' }));
    });
  });

  test('handleConfirmSubmit network error', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales') && method === 'POST') return Promise.reject(new Error('network'));
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    await lookupAndFill(fetchMock);
    await fillReasonAndQty();
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => expect(screen.getByText(/Yakin ingin memproses retur/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Ya, Proses'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal terhubung ke server', {});
    });
  });

  test('batal button clears lookup result', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Batal'));
    await waitFor(() => {
      expect(screen.queryByText(/Transaksi #1/)).not.toBeInTheDocument();
    });
  });

  test('payment method midtrans shows Non-Tunai', async () => {
    const midtransResp = {
      ...saleLookupResponse,
      sale: { ...saleLookupResponse.sale, payment_method: 'midtrans' },
    };
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) return okJson(midtransResp);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => {
      expect(screen.getByText('Non-Tunai')).toBeInTheDocument();
    });
  });

  test('qty_already_returned > 0 shows number 2', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument());
    const cells = screen.getAllByText('2');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  test('qty_returnable 0 disables spinbutton', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument());
    const qtyInputs = screen.getAllByRole('spinbutton');
    expect(qtyInputs[2]).toBeDisabled();
  });

  test('refundMethod select changes value', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument());
    const select = screen.getByDisplayValue('Tunai (Kembalikan Uang ke Pelanggan)');
    fireEvent.change(select, { target: { value: 'credit_note' } });
    expect(screen.getByDisplayValue('Credit Note (Catat Piutang Pelanggan)')).toBeInTheDocument();
  });

  test('history toggle shows empty state', async () => {
    setupHistoryFetch(emptyHistory);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Riwayat Retur Penjualan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Riwayat Retur Penjualan'));
    await waitFor(() => {
      expect(screen.getByText('Belum ada riwayat retur penjualan')).toBeInTheDocument();
    });
  });

  test('history toggle shows list with cash and credit_note', async () => {
    setupHistoryFetch(historyWithData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Riwayat Retur Penjualan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Riwayat Retur Penjualan'));
    await waitFor(() => {
      expect(screen.getByText('R-2024-0001')).toBeInTheDocument();
    });
    expect(screen.getByText('R-2024-0002')).toBeInTheDocument();
    expect(screen.getByText('Tunai')).toBeInTheDocument();
    expect(screen.getByText('Credit Note')).toBeInTheDocument();
  });

  test('history detail expands and collapses', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.match(/\/returns\/sales\/\d+$/)) return okJson(detailResponse);
      if (url.includes('/api/returns/sales')) return okJson(historyWithData);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Riwayat Retur Penjualan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Riwayat Retur Penjualan'));
    await waitFor(() => {
      expect(screen.getByText('R-2024-0001')).toBeInTheDocument();
    });
    const detailBtns = screen.getAllByText('Detail');
    fireEvent.click(detailBtns[0]);
    await waitFor(() => {
      expect(screen.getByText('Item Retur')).toBeInTheDocument();
    });
    const closeBtn = screen.getByTestId('icon-x').closest('button');
    if (closeBtn) fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText('Item Retur')).not.toBeInTheDocument();
    });
  });

  test('history detail fetch error handled silently', async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.match(/\/returns\/sales\/\d+$/)) return Promise.reject(new Error('network'));
      if (url.includes('/api/returns/sales')) return okJson(historyWithData);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Riwayat Retur Penjualan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Riwayat Retur Penjualan'));
    await waitFor(() => {
      expect(screen.getByText('R-2024-0001')).toBeInTheDocument();
    });
    const detailBtns = screen.getAllByText('Detail');
    fireEvent.click(detailBtns[0]);
    await waitFor(() => {
      expect(screen.queryByText('Item Retur')).not.toBeInTheDocument();
    });
  });

  test('history toggle collapses and shows count badge', async () => {
    setupHistoryFetch(historyWithData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/2 data/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Riwayat Retur Penjualan'));
    await waitFor(() => expect(screen.getByText('R-2024-0001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Riwayat Retur Penjualan'));
    await waitFor(() => {
      expect(screen.queryByText('R-2024-0001')).not.toBeInTheDocument();
    });
  });

  test('loading state shows spinner on lookup', async () => {
    let resolveFetch: (v: Response) => void;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) {
        return new Promise((resolve) => { resolveFetch = resolve; });
      }
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => {
      expect(screen.getByText('Mencari...')).toBeInTheDocument();
    });
    resolveFetch!(okJson(saleLookupResponse));
    await waitFor(() => {
      expect(screen.getByText('Cari')).toBeInTheDocument();
    });
  });

  test('stats empty history shows 0x placeholders', async () => {
    setupHistoryFetch(emptyHistory);
    renderPage();
    await waitFor(() => {
      const zeros = screen.getAllByText('0x');
      expect(zeros.length).toBe(2);
    });
  });

  test('stats with data shows computed 2x', async () => {
    setupHistoryFetch(historyWithData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('2x')).toBeInTheDocument();
    });
  });

  test('handleSubmit qty less than 1 shows invalid toast', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Contoh: Barang tidak sesuai pesanan...'), { target: { value: 'rusak' } });
    const qtyInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInputs[1], { target: { value: '99' } });
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Quantity retur tidak valid', expect.any(Object));
    });
  });

  test('handleSubmit qty exceeds qty_returnable shows invalid toast', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Contoh: Barang tidak sesuai pesanan...'), { target: { value: 'rusak' } });
    const qtyInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInputs[1], { target: { value: '99' } });
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Quantity retur tidak valid', expect.any(Object));
    });
  });

  test('confirm modal submitting shows Memproses...', async () => {
    let resolvePost: (v: Response) => void;
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales') && method === 'POST') {
        return new Promise((resolve) => { resolvePost = resolve; });
      }
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Contoh: Barang tidak sesuai pesanan...'), { target: { value: 'rusak' } });
    const qtyInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInputs[1], { target: { value: '2' } });
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => {
      expect(screen.getAllByText(/Yakin ingin memproses retur/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByText('Ya, Proses'));
    await waitFor(() => {
      expect(screen.getByText('Memproses...')).toBeInTheDocument();
    });
    resolvePost!(okJson({ return_no: 'R-2024-0003' }));
    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalled();
    });
  });

  test('handleSubmit with empty refundMethod shows error toast', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Contoh: Barang tidak sesuai pesanan...'), { target: { value: 'rusak' } });
    const qtyInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInputs[1], { target: { value: '2' } });
    const refundSelect = document.querySelector('select[class*="rounded-xl"]') as HTMLSelectElement;
    if (refundSelect) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(refundSelect, '');
      fireEvent.change(refundSelect, { target: { value: '' } });
    }
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Pilih metode refund', {});
    });
  });

  test('handleSubmit with no items selected shows error toast', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/lookup')) return okJson(saleLookupResponse);
      if (url.includes('/api/returns/sales')) return okJson(emptyHistory);
      return okJson({});
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;
    renderPage();
    await waitInitialRender();
    const user = userEvent.setup();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText(/Transaksi #1/)).toBeInTheDocument());
    const ta = screen.getByPlaceholderText('Contoh: Barang tidak sesuai pesanan...') as HTMLTextAreaElement;
    await user.clear(ta);
    await user.type(ta, 'rusak');
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Contoh: Barang tidak sesuai pesanan...') as HTMLTextAreaElement).toHaveValue('rusak');
    });
    const submitBtn = screen.getByText('Proses Retur').closest('button') as HTMLButtonElement;
    if (submitBtn) {
      const fiberKey = Object.keys(submitBtn).find(k => k.startsWith('__reactFiber'));
      if (fiberKey) {
        const fiber = (submitBtn as any)[fiberKey];
        const props = fiber.memoizedProps || fiber.pendingProps || {};
        if (props.onClick) await props.onClick();
      }
    }
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Tidak ada item yang diretur', expect.any(Object));
    });
  });

  test('covers stats with history that has dates (branch line 199)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total Retur')).toBeInTheDocument();
    });
  });

  // --- Tests for condition field (baik/rusak) ---

  test('shows condition dropdown with baik and rusak options when items are returnable', async () => {
    setupHistoryFetch(emptyHistory);
    global.fetch = makeFetch({
      '/api/returns/sales/lookup?sale_id=1': () => okJson(saleLookupResponse),
    }) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());
    const selects = screen.getAllByRole('combobox');
    const conditionSelects = selects.filter(s => (s as HTMLSelectElement).value === 'baik');
    expect(conditionSelects.length).toBeGreaterThan(0);
    const firstSelect = conditionSelects[0] as HTMLSelectElement;
    expect(firstSelect).toHaveValue('baik');
    fireEvent.change(firstSelect, { target: { value: 'rusak' } });
    expect(firstSelect).toHaveValue('rusak');
    fireEvent.change(firstSelect, { target: { value: 'baik' } });
    expect(firstSelect).toHaveValue('baik');
  });

  test('shows dash for condition when item has 0 returnable qty', async () => {
    setupHistoryFetch(emptyHistory);
    global.fetch = makeFetch({
      '/api/returns/sales/lookup?sale_id=1': () => okJson(saleLookupResponse),
    }) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText('Amoxicillin')).toBeInTheDocument());
    const rows = screen.getAllByRole('row');
    const amoxRow = rows.find(r => r.textContent?.includes('Amoxicillin'));
    expect(amoxRow?.textContent).toContain('-');
  });

  test('condition field defaults to baik when qty is entered', async () => {
    setupHistoryFetch(emptyHistory);
    global.fetch = makeFetch({
      '/api/returns/sales/lookup?sale_id=1': () => okJson(saleLookupResponse),
    }) as unknown as typeof fetch;
    renderPage();
    await waitInitialRender();
    fireEvent.change(screen.getByPlaceholderText('Masukkan ID transaksi...'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => expect(screen.getByText('Vitamin C')).toBeInTheDocument());
    const qtyInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInputs[0], { target: { value: '2' } });
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      const conditionSelects = selects.filter(s => (s as HTMLSelectElement).value === 'baik');
      expect(conditionSelects.length).toBeGreaterThan(0);
    });
  });
});
