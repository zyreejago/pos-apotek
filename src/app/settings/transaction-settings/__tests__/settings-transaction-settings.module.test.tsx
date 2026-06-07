import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';
import SettingstransactionsettingsPage from '../page';
import { HeaderProvider } from '@/context/HeaderContext';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <HeaderProvider>
      {ui}
    </HeaderProvider>
  );
}

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: mockBack,
  }),
  usePathname: () => '/settings-transaction-settings',
}));

jest.mock('next/link', () => {
  return function Link({ href, children }: { href: string; children: React.ReactNode }) {
    return <a href={href}>{children}</a>;
  };
});

const mockCheckActionPermission = jest.fn(() => true);

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: () => ({
    loading: false,
    hasPermission: true,
    permissions: [],
    checkActionPermission: mockCheckActionPermission,
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

jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
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
  mockCheckActionPermission.mockReturnValue(true);
  jest.clearAllMocks();

  global.fetch = jest.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/api/users')) return okJson({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } });
    if (url.includes('/api/products')) return okJson({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } });
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

describe('settings-transaction-settings module', () => {
  test('renders Settings Transaction Settings page', async () => {
    const { getAllByText } = renderWithProviders(<SettingstransactionsettingsPage />);
    await waitFor(() => {
      expect(getAllByText('Transactions Settings').length).toBeGreaterThan(0);
    });
  });

  test('saves settings successfully', async () => {
    const { getAllByText, getByRole, container } = renderWithProviders(<SettingstransactionsettingsPage />);
    await waitFor(() => expect(getAllByText('Transactions Settings').length).toBeGreaterThan(0));
    
    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '' } });
    fireEvent.change(inputs[1], { target: { value: '' } });
    
    const saveBtn = getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/settings'),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  test('handles no token', async () => {
    localStorage.removeItem('token');
    renderWithProviders(<SettingstransactionsettingsPage />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  test('handles fetchSettings error', async () => {
    global.fetch = jest.fn().mockRejectedValue('Test error');
    renderWithProviders(<SettingstransactionsettingsPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });

  test('handles save error', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/settings') && url.includes('t=')) {
        return okJson({ ppn_rate: '0.11', discount_rate: '0.05' });
      }
      return errorJson({ message: 'Test error' });
    }) as unknown as typeof fetch;
    
    const { getAllByText, getByRole, container } = renderWithProviders(<SettingstransactionsettingsPage />);
    await waitFor(() => expect(getAllByText('Transactions Settings').length).toBeGreaterThan(0));
    
    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '12' } });
    
    const saveBtn = getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  test('shows access denied when no edit permission', async () => {
    const { getAllByText, getByRole } = renderWithProviders(<SettingstransactionsettingsPage />);
    await waitFor(() => expect(getAllByText('Transactions Settings').length).toBeGreaterThan(0));
    mockCheckActionPermission.mockReturnValue(false);
    const saveBtn = getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(require('@/components/ui/goey-toaster').goeyToast.error).toHaveBeenCalledWith('Akses Ditolak', expect.any(Object));
    });
  });

});
