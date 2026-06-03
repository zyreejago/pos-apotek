import React from 'react';
import { render } from '@testing-library/react';
import RecommendationsopenrouterPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/recommendations-openrouter',
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
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' }));

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

describe('recommendations-openrouter module', () => {
  test('renders Recommendations OpenRouter page', () => {
    expect(() => render(<RecommendationsopenrouterPage />)).not.toThrow();
  });
});
