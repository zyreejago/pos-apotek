import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import StockopnamePage from '../page';
import { HeaderProvider, useHeader } from '@/context/HeaderContext';
import { goeyToast } from '@/components/ui/goey-toaster';

function HeaderDisplay() {
  const { headerState } = useHeader();
  if (!headerState.title && !headerState.rightContent) return null;
  return (
    <div data-testid="header">
      <h1>{headerState.title}</h1>
      {headerState.subtitle && <p>{headerState.subtitle}</p>}
      {headerState.rightContent}
    </div>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <HeaderProvider>
      <HeaderDisplay />
      {ui}
    </HeaderProvider>
  );
}

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/stock-opname',
}));

jest.mock('next/link', () => {
  return function Link({ href, children }: { href: string; children: React.ReactNode }) {
    return <a href={href}>{children}</a>;
  };
});

var _checkPermReturnValue = true;

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: () => ({
    loading: false,
    hasPermission: true,
    permissions: [],
    checkActionPermission: () => _checkPermReturnValue,
    currentUserRole: 'superadmin',
  }),
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

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 1, role: 'superadmin' },
    authHeaders: { 'Authorization': 'Bearer test' },
  }),
}));

jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon" />,
  Filter: () => <span data-testid="filter-icon" />,
  Save: () => <span data-testid="save-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
}));

jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: ({ title, rightContent }: { title: string; rightContent?: React.ReactNode }) => (
    <div data-testid="header">
      <h1>{title}</h1>
      {rightContent}
    </div>
  ),
}));

jest.mock('@/components/Sidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="sidebar" />,
}));

jest.mock('@/components/ProfileDropdown', () => ({
  __esModule: true,
  default: () => <div data-testid="profile-dropdown" />,
}));

jest.mock('@/components/ConfirmModal', () => ({
  __esModule: true,
  default: ({ isOpen, onConfirm, onClose, title, message }: any) => (
    isOpen ? (
      <div data-testid="confirm-modal">
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null
  ),
}));

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

function errorJson(data: unknown, status = 500) {
  return Promise.resolve({
    ok: false,
    status: status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

beforeEach(() => {
  _checkPermReturnValue = true;
  localStorage.setItem('token', 'test');
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' }));

  global.fetch = jest.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/api/users')) return okJson({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } });
    if (url.includes('/api/products')) return okJson({ 
      data: [
        { id: 1, name: 'Paracetamol', stock: 10, unit: 'tablet', category: 'Obat' },
        { id: 2, name: 'Ibuprofen', stock: 20, unit: 'tablet', category: 'Obat' },
      ], 
      pagination: { total: 2, page: 1, limit: 10, totalPages: 1 } 
    });
    if (url.includes('/api/stock-opname')) return okJson({ success: true });
    if (url.includes('/api/suppliers')) return okJson({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } });
    if (url.includes('/api/transactions')) return okJson({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } });
    if (url.includes('/api/reports/transactions')) return okJson({ transactions: [], chartData: [] });
    if (url.includes('/api/reports/balance')) return okJson({ assets: { cash: 0, inventory: 0, receivables: 0, total: 0 }, liabilities: { total: 0 }, equity: { total: 0 } });
    if (url.includes('/api/financial/profit-loss')) return okJson({ revenue: { total: 0, details: [] }, cogs: { total: 0, details: [] }, gross_profit: 0, expenses: { total: 0, details: [] }, net_profit: 0 });
    if (url.includes('/api/settings')) return okJson({ ppn_rate: '0.11', discount_rate: '0.05' });
    if (url.includes('/api/rbac/modules')) return okJson([]);
    if (url.includes('/api/rbac/roles')) return okJson([]);
    if (url.includes('/api/rbac/permissions')) return okJson([]);
    if (url.includes('/api/forecast/latest')) return okJson([]);
    if (url.includes('/api/forecast/products')) return okJson([]);
    if (url.includes('/api/forecast-openrouter/latest')) return okJson([]);
    if (url.includes('/api/forecast-openrouter/products')) return okJson([]);
    if (url.includes('/api/substitutions')) return okJson({ recommendations: [], advice: '', sources: [] });
    if (url.includes('/api/profile')) return okJson({ id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' });
    if (url.includes('/api/dashboard')) return okJson({ stockRecommendations: [], earnings: [], cashiers: [] });
    return okJson({});
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('stock-opname module', () => {
  test('renders Stock Opname page', async () => {
    const { getByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => {
      expect(getByText('Paracetamol')).toBeInTheDocument();
    });
  });

  test('starts stock opname', async () => {
    const { getByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Mulai Stock Opname')).toBeInTheDocument());
    
    fireEvent.click(getByText('Mulai Stock Opname'));
    
    expect(getByText('Cancel')).toBeInTheDocument();
    expect(getByText('Submit Opname')).toBeInTheDocument();
  });

  test('cancels stock opname', async () => {
    const { getByText, getByRole } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Mulai Stock Opname')).toBeInTheDocument());
    
    fireEvent.click(getByText('Mulai Stock Opname'));
    fireEvent.click(getByText('Cancel'));
    
    const confirmBtn = getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmBtn);
    
    await waitFor(() => expect(getByText('Mulai Stock Opname')).toBeInTheDocument());
  });

  test('submits stock opname', async () => {
    const { getByText, getByPlaceholderText, getByRole } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Paracetamol')).toBeInTheDocument());
    
    fireEvent.click(getByText('Mulai Stock Opname'));
    
    const stockInput = getByPlaceholderText('10');
    fireEvent.change(stockInput, { target: { value: '15' } });
    
    fireEvent.click(getByText('Submit Opname'));
    
    const confirmBtn = getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/stock-opname'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('handles search query', async () => {
    const { getByPlaceholderText } = renderWithProviders(<StockopnamePage />);
    
    const searchInput = getByPlaceholderText('Search Products');
    fireEvent.change(searchInput, { target: { value: 'Paracetamol' } });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=Paracetamol'),
        expect.anything()
      );
    });
  });

  test('handles pagination', async () => {
    const { getByText, getByRole } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Paracetamol')).toBeInTheDocument());
    
    const itemsPerPageSelect = getByRole('combobox');
    fireEvent.change(itemsPerPageSelect, { target: { value: '20' } });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.anything()
      );
    });
  });

  test('handles 401 on fetch products', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({}),
          text: async () => '',
        } as Response);
      }
      return okJson({});
    });

    renderWithProviders(<StockopnamePage />);

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull();
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });

  test('handles network error on fetch products', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<StockopnamePage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Mengambil Data Produk',
        expect.objectContaining({ description: expect.stringContaining('Terjadi kesalahan') })
      );
    });
  });

  test('does not render start button when permission denied', async () => {
    _checkPermReturnValue = false;
    const { queryByText } = renderWithProviders(<StockopnamePage />);

    await waitFor(() => {
      expect(queryByText('Paracetamol')).toBeInTheDocument();
    });

    expect(queryByText('Mulai Stock Opname')).not.toBeInTheDocument();
  });

  test('shows permission denied toast on start opname', async () => {
    const { getByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Mulai Stock Opname')).toBeInTheDocument());

    _checkPermReturnValue = false;
    fireEvent.click(getByText('Mulai Stock Opname'));

    expect(goeyToast.error).toHaveBeenCalledWith(
      'Akses Ditolak',
      expect.objectContaining({ description: expect.stringContaining('tidak memiliki izin') })
    );
  });

  test('displays red badge for negative difference', async () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Paracetamol')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));

    const stockInput = getByPlaceholderText('10');
    fireEvent.change(stockInput, { target: { value: '5' } });

    const diffBadge = getByText('-5');
    expect(diffBadge.className).toContain('bg-red-100');
  });

  test('displays yellow badge for zero difference', async () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Paracetamol')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));

    const stockInput = getByPlaceholderText('10');
    fireEvent.change(stockInput, { target: { value: '10' } });

    const diffBadge = getByText('0');
    expect(diffBadge.className).toContain('bg-yellow-100');
  });

  test('shows permission denied toast on submit', async () => {
    const { getByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Mulai Stock Opname')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));

    _checkPermReturnValue = false;
    fireEvent.click(getByText('Submit Opname'));

    expect(goeyToast.error).toHaveBeenCalledWith(
      'Anda tidak memiliki izin untuk mengirimkan stock opname',
      expect.objectContaining({ description: expect.stringContaining('Hubungi administrator') })
    );
  });

  test('shows empty changes toast when submitting without changes', async () => {
    const { getByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Mulai Stock Opname')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));
    fireEvent.click(getByText('Submit Opname'));

    expect(goeyToast.info).toHaveBeenCalledWith(
      'Tidak Ada Perubahan',
      expect.objectContaining({ description: expect.stringContaining('Belum ada data') })
    );
  });

  test('handles 401 on submit opname', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/stock-opname')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({}),
          text: async () => '',
        } as Response);
      }
      if (url.includes('/api/products')) {
        return okJson({
          data: [
            { id: 1, name: 'Paracetamol', stock: 10, unit: 'tablet', category: 'Obat' },
          ],
          pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
        });
      }
      return okJson({});
    });

    const { getByText, getByPlaceholderText, getByRole } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Paracetamol')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));

    const stockInput = getByPlaceholderText('10');
    fireEvent.change(stockInput, { target: { value: '15' } });

    fireEvent.click(getByText('Submit Opname'));
    fireEvent.click(getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull();
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });

  test('handles server error on submit opname', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/stock-opname')) {
        return errorJson({}, 500);
      }
      if (url.includes('/api/products')) {
        return okJson({
          data: [
            { id: 1, name: 'Paracetamol', stock: 10, unit: 'tablet', category: 'Obat' },
          ],
          pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
        });
      }
      return okJson({});
    });

    const { getByText, getByPlaceholderText, getByRole } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Paracetamol')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));

    const stockInput = getByPlaceholderText('10');
    fireEvent.change(stockInput, { target: { value: '15' } });

    fireEvent.click(getByText('Submit Opname'));
    fireEvent.click(getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Mengirim Data',
        expect.objectContaining({ description: expect.stringContaining('Terjadi kesalahan') })
      );
    });
  });

  test('handles network error on submit opname', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/stock-opname')) {
        return Promise.reject(new Error('Network down'));
      }
      if (url.includes('/api/products')) {
        return okJson({
          data: [
            { id: 1, name: 'Paracetamol', stock: 10, unit: 'tablet', category: 'Obat' },
          ],
          pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
        });
      }
      return okJson({});
    });

    const { getByText, getByPlaceholderText, getByRole } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Paracetamol')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));

    const stockInput = getByPlaceholderText('10');
    fireEvent.change(stockInput, { target: { value: '15' } });

    fireEvent.click(getByText('Submit Opname'));
    fireEvent.click(getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Terjadi kesalahan sistem',
        expect.objectContaining({ description: expect.stringContaining('Silakan coba lagi') })
      );
    });
  });

  test('clears opname entry when input is emptied', async () => {
    const { getByText, getByPlaceholderText, getAllByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Paracetamol')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));

    const stockInput = getByPlaceholderText('10');
    fireEvent.change(stockInput, { target: { value: '15' } });

    expect(getByText('+5')).toBeInTheDocument();

    fireEvent.change(stockInput, { target: { value: '' } });

    // After clearing, the diff column should show '-' (the default placeholder)
    const dashElements = getAllByText('-');
    expect(dashElements.length).toBeGreaterThan(0);
  });

  test('search resets page to 1 when not on first page', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) {
        const urlObj = new URL(url);
        const page = parseInt(urlObj.searchParams.get('page') || '1');
        return okJson({
          data: [
            { id: page * 10 + 1, name: `Product ${page * 10 + 1}`, stock: 10, unit: 'pcs', category: 'Cat' },
          ],
          pagination: { total: 30, page, limit: 10, totalPages: 3 }
        });
      }
      if (url.includes('/api/stock-opname')) return okJson({ success: true });
      return okJson({});
    });

    const { getByText, getByPlaceholderText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Product 11')).toBeInTheDocument());

    const nextBtn = getByText('→');
    fireEvent.click(nextBtn);

    await waitFor(() => expect(getByText('Product 21')).toBeInTheDocument());

    const callCountBefore = (global.fetch as jest.Mock).mock.calls.length;

    const searchInput = getByPlaceholderText('Search Products');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callCountBefore);
    }, { timeout: 2000 });

    const lastCall = (global.fetch as jest.Mock).mock.calls[(global.fetch as jest.Mock).mock.calls.length - 1];
    expect(lastCall[0]).toContain('page=1');
    expect(lastCall[0]).toContain('search=test');
  });

  test('navigates to next page via arrow button', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) {
        const urlObj = new URL(url);
        const page = parseInt(urlObj.searchParams.get('page') || '1');
        return okJson({
          data: [
            { id: page, name: `Product ${page}`, stock: 10, unit: 'pcs', category: 'Cat' },
          ],
          pagination: { total: 30, page, limit: 10, totalPages: 3 }
        });
      }
      if (url.includes('/api/stock-opname')) return okJson({ success: true });
      return okJson({});
    });

    const { getByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Product 1')).toBeInTheDocument());

    const nextBtn = getByText('→');
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.anything()
      );
    });
  });

  test('navigates to previous page via arrow button', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) {
        const urlObj = new URL(url);
        const page = parseInt(urlObj.searchParams.get('page') || '1');
        return okJson({
          data: [
            { id: page, name: `Product ${page}`, stock: 10, unit: 'pcs', category: 'Cat' },
          ],
          pagination: { total: 30, page, limit: 10, totalPages: 3 }
        });
      }
      if (url.includes('/api/stock-opname')) return okJson({ success: true });
      return okJson({});
    });

    const { getByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Product 1')).toBeInTheDocument());

    fireEvent.click(getByText('→'));
    await waitFor(() => expect(getByText('Product 2')).toBeInTheDocument());

    fireEvent.click(getByText('←'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.anything()
      );
    });
  });

  test('previous page button disabled on first page', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) {
        return okJson({
          data: [
            { id: 1, name: 'Product 1', stock: 10, unit: 'pcs', category: 'Cat' },
          ],
          pagination: { total: 30, page: 1, limit: 10, totalPages: 3 }
        });
      }
      if (url.includes('/api/stock-opname')) return okJson({ success: true });
      return okJson({});
    });

    const { getByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Product 1')).toBeInTheDocument());

    const prevBtn = getByText('←');
    expect(prevBtn).toBeDisabled();
  });

  test('clicks page number button to navigate', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) {
        const urlObj = new URL(url);
        const page = parseInt(urlObj.searchParams.get('page') || '1');
        return okJson({
          data: [
            { id: page, name: `Product ${page}`, stock: 10, unit: 'pcs', category: 'Cat' },
          ],
          pagination: { total: 30, page, limit: 10, totalPages: 3 }
        });
      }
      if (url.includes('/api/stock-opname')) return okJson({ success: true });
      return okJson({});
    });

    const { getByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Product 1')).toBeInTheDocument());

    fireEvent.click(getByText('2'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.anything()
      );
    });
  });

  test('closes confirm modal via modal cancel button', async () => {
    const { getByText, getByTestId, queryByTestId } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Mulai Stock Opname')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));
    expect(getByText('Submit Opname')).toBeInTheDocument();

    fireEvent.click(getByText('Cancel'));
    expect(getByTestId('confirm-modal')).toBeInTheDocument();

    const modal = getByTestId('confirm-modal');
    const modalCancelBtn = modal.querySelectorAll('button')[1];
    fireEvent.click(modalCancelBtn);

    expect(queryByTestId('confirm-modal')).toBeNull();
    expect(getByText('Submit Opname')).toBeInTheDocument();
  });

  test('handles products API response with missing data fields', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) {
        return okJson({});
      }
      return okJson({});
    });

    const { queryByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => {
      expect(queryByText('No products found')).toBeInTheDocument();
    });
  });

  test('ignores non-numeric input for stock opname entry', async () => {
    const { getByText, getByPlaceholderText, getAllByText } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Paracetamol')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));

    const stockInput = getByPlaceholderText('10');
    fireEvent.change(stockInput, { target: { value: '.5' } });

    const dashElements = getAllByText('-');
    expect(dashElements.length).toBeGreaterThan(0);
  });

  test('shows success toast with remaining count for 4+ products', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) {
        return okJson({
          data: [
            { id: 1, name: 'Product A', stock: 10, unit: 'pcs', category: 'Cat' },
            { id: 2, name: 'Product B', stock: 20, unit: 'pcs', category: 'Cat' },
            { id: 3, name: 'Product C', stock: 30, unit: 'pcs', category: 'Cat' },
            { id: 4, name: 'Product D', stock: 40, unit: 'pcs', category: 'Cat' },
          ],
          pagination: { total: 4, page: 1, limit: 10, totalPages: 1 }
        });
      }
      if (url.includes('/api/stock-opname')) return okJson({ success: true });
      return okJson({});
    });

    const { getByText, getByPlaceholderText, getByRole } = renderWithProviders(<StockopnamePage />);
    await waitFor(() => expect(getByText('Product A')).toBeInTheDocument());

    fireEvent.click(getByText('Mulai Stock Opname'));

    fireEvent.change(getByPlaceholderText('10'), { target: { value: '15' } });
    fireEvent.change(getByPlaceholderText('20'), { target: { value: '25' } });
    fireEvent.change(getByPlaceholderText('30'), { target: { value: '35' } });
    fireEvent.change(getByPlaceholderText('40'), { target: { value: '45' } });

    fireEvent.click(getByText('Submit Opname'));
    fireEvent.click(getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Stock Opname Selesai',
        expect.objectContaining({
          description: expect.stringContaining('dan 1 lainnya')
        })
      );
    });
  });

  test('fetches products without authorization header when token missing', async () => {
    localStorage.removeItem('token');

    renderWithProviders(<StockopnamePage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products'),
        expect.objectContaining({
          headers: {},
        })
      );
    });
  });
});
