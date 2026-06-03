import React from 'react';
import { render, waitFor } from '@testing-library/react';

import DashboardPage from '../dashboard/page';
import ForgotPasswordPage from '../forgot-password/page';
import HomePage from '../page';
import LoginPage from '../login/page';
import ProductsPage from '../products/page';
import ProfilePage from '../profile/page';
import RecommendationsPage from '../recommendations/page';
import RecommendationsOpenRouterPage from '../recommendations-openrouter/page';
import RegisterPage from '../register/page';
import ReportsBalancePage from '../reports/balance/page';
import ReportsFinancialPage from '../reports/financial/page';
import ReportsTransactionsPage from '../reports/transactions/page';
import SettingsPage from '../settings/page';
import RolePermissionsPage from '../settings/role-permissions/page';
import TransactionSettingsPage from '../settings/transaction-settings/page';
import StockOpnamePage from '../stock-opname/page';
import SubstitutionsPage from '../substitutions/page';
import SuppliersPage from '../suppliers/page';
import TransactionsPage from '../transactions/page';
import UsersPage from '../users/page';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    refresh: jest.fn(),
    back: jest.fn(),
  }),
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

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

beforeEach(() => {
  localStorage.setItem('token', 'test');
  localStorage.setItem('user', JSON.stringify({ role: 'superadmin' }));
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
    if (url.includes('/api/profile')) return okJson({ id: 1, username: 'u', email: 'u@u.com', role: 'superadmin' });
    if (url.includes('/api/dashboard')) return okJson({ stockRecommendations: [], earnings: [], cashiers: [] });

    return okJson({});
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('pages smoke', () => {
  const pages: Array<[string, React.ComponentType]> = [
    ['/dashboard', DashboardPage],
    ['/forgot-password', ForgotPasswordPage],
    ['/login', LoginPage],
    ['/products', ProductsPage],
    ['/profile', ProfilePage],
    ['/recommendations', RecommendationsPage],
    ['/recommendations-openrouter', RecommendationsOpenRouterPage],
    ['/register', RegisterPage],
    ['/reports/balance', ReportsBalancePage],
    ['/reports/financial', ReportsFinancialPage],
    ['/reports/transactions', ReportsTransactionsPage],
    ['/settings', SettingsPage],
    ['/settings/role-permissions', RolePermissionsPage],
    ['/settings/transaction-settings', TransactionSettingsPage],
    ['/stock-opname', StockOpnamePage],
    ['/substitutions', SubstitutionsPage],
    ['/suppliers', SuppliersPage],
    ['/transactions', TransactionsPage],
    ['/users', UsersPage],
  ];

  test.each(pages)('renders %s', async (_route, Page) => {
    expect(() => render(<Page />)).not.toThrow();
  });

  test('HomePage redirects to dashboard', async () => {
    render(<HomePage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });
});
