import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import StockopnamePage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/stock-opname',
}));

jest.mock('next/link', () => {
  return function Link({ href, children }: { href: string; children: React.ReactNode }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: () => ({
    loading: false,
    hasPermission: true,
    permissions: [],
    checkActionPermission: () => true,
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
    const { getByText } = render(<StockopnamePage />);
    await waitFor(() => {
      expect(getByText('Paracetamol')).toBeInTheDocument();
    });
  });

  test('starts stock opname', async () => {
    const { getByText } = render(<StockopnamePage />);
    await waitFor(() => expect(getByText('Mulai Stock Opname')).toBeInTheDocument());
    
    fireEvent.click(getByText('Mulai Stock Opname'));
    
    expect(getByText('Cancel')).toBeInTheDocument();
    expect(getByText('Submit Opname')).toBeInTheDocument();
  });

  test('cancels stock opname', async () => {
    const { getByText, getByRole } = render(<StockopnamePage />);
    await waitFor(() => expect(getByText('Mulai Stock Opname')).toBeInTheDocument());
    
    fireEvent.click(getByText('Mulai Stock Opname'));
    fireEvent.click(getByText('Cancel'));
    
    const confirmBtn = getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmBtn);
    
    await waitFor(() => expect(getByText('Mulai Stock Opname')).toBeInTheDocument());
  });

  test('submits stock opname', async () => {
    const { getByText, getByPlaceholderText, getByRole } = render(<StockopnamePage />);
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
    const { getByPlaceholderText } = render(<StockopnamePage />);
    
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
    const { getByText, getByRole } = render(<StockopnamePage />);
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
});
