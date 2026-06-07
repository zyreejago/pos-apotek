import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';
import SubstitutionsPage from '../page';
import { HeaderProvider } from '@/context/HeaderContext';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/substitutions',
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

describe('substitutions module', () => {
  test('renders Substitutions page', () => {
    expect(() => render(<HeaderProvider><SubstitutionsPage /></HeaderProvider>)).not.toThrow();
  });

  test('handles search successfully', async () => {
    const testData = {
      recommendations: [
        { name: 'Paracetamol', source: 'https://test.com' },
        { name: 'Ibuprofen' },
      ],
      advice: 'Test advice',
      sources: ['https://test.com'],
    };
    
    global.fetch = jest.fn().mockResolvedValue(okJson(testData));
    
    const { getByPlaceholderText, getByText } = render(<HeaderProvider><SubstitutionsPage /></HeaderProvider>);
    
    const searchInput = getByPlaceholderText('Input Keluhan');
    fireEvent.change(searchInput, { target: { value: 'demam' } });
    
    const searchBtn = getByText('Cari');
    fireEvent.click(searchBtn);
    
    await waitFor(() => {
      expect(getByText('Paracetamol')).toBeInTheDocument();
      expect(getByText('Ibuprofen')).toBeInTheDocument();
    });
  });

  test('handles search error', async () => {
    global.fetch = jest.fn().mockResolvedValue(errorJson({ error: 'Test error' }));
    
    const { getByPlaceholderText, getByText } = render(<HeaderProvider><SubstitutionsPage /></HeaderProvider>);
    
    const searchInput = getByPlaceholderText('Input Keluhan');
    fireEvent.change(searchInput, { target: { value: 'demam' } });
    
    const searchBtn = getByText('Cari');
    fireEvent.click(searchBtn);
    
    await waitFor(() => {
      expect(getByText('Test error')).toBeInTheDocument();
    });
  });

  test('handles search error with non-Error instance', async () => {
    global.fetch = jest.fn().mockRejectedValue('string error');
    
    const { getByPlaceholderText, getByText } = render(<HeaderProvider><SubstitutionsPage /></HeaderProvider>);
    
    const searchInput = getByPlaceholderText('Input Keluhan');
    fireEvent.change(searchInput, { target: { value: 'demam' } });
    
    const searchBtn = getByText('Cari');
    fireEvent.click(searchBtn);
    
    await waitFor(() => {
      expect(getByText('Terjadi kesalahan')).toBeInTheDocument();
    });
  });

  test('handles search error with no error field', async () => {
    global.fetch = jest.fn().mockResolvedValue(errorJson({}));
    
    const { getByPlaceholderText, getByText } = render(<HeaderProvider><SubstitutionsPage /></HeaderProvider>);
    
    const searchInput = getByPlaceholderText('Input Keluhan');
    fireEvent.change(searchInput, { target: { value: 'demam' } });
    
    const searchBtn = getByText('Cari');
    fireEvent.click(searchBtn);
    
    await waitFor(() => {
      expect(getByText('Gagal memuat rekomendasi')).toBeInTheDocument();
    });
  });

  test('search button is disabled when input is empty', () => {
    const { getByText } = render(<HeaderProvider><SubstitutionsPage /></HeaderProvider>);
    const searchBtn = getByText('Cari');
    expect(searchBtn).toBeDisabled();
  });

  test('handles pagination and page size', async () => {
    const testData = {
      recommendations: Array.from({ length: 30 }, (_, i) => ({
        name: `Product ${i + 1}`,
      })),
    };
    
    global.fetch = jest.fn().mockResolvedValue(okJson(testData));
    
    const { getByPlaceholderText, getByText, getByRole } = render(<HeaderProvider><SubstitutionsPage /></HeaderProvider>);
    
    const searchInput = getByPlaceholderText('Input Keluhan');
    fireEvent.change(searchInput, { target: { value: 'demam' } });
    
    const searchBtn = getByText('Cari');
    fireEvent.click(searchBtn);
    
    await waitFor(() => {
      expect(getByText('Product 1')).toBeInTheDocument();
    });

    // Change items per page
    const itemsPerPageSelect = getByRole('combobox');
    fireEvent.change(itemsPerPageSelect, { target: { value: '10' } });
    
    // Test next page
    const nextPageBtn = getByText('>');
    fireEvent.click(nextPageBtn);
    
    // Test prev page
    const prevPageBtn = getByText('<');
    fireEvent.click(prevPageBtn);
  });
});
