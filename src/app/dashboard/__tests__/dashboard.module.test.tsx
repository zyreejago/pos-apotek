import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';
import Dashboard from '@/app/dashboard/page';
import { SidebarProvider } from '@/context/SidebarContext';
import { KeyboardShortcutsProvider } from '@/context/KeyboardShortcutsContext';
import { HeaderProvider } from '@/context/HeaderContext';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockPush = jest.fn();
const mockUseRouter = jest.requireMock('next/navigation').useRouter;

jest.mock('recharts', () => {
  let savedTooltipFormatter: ((value: number | undefined) => string) | undefined;
  return {
    LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
    Line: () => <div />,
    XAxis: () => <div />,
    YAxis: ({ tickFormatter }: { tickFormatter?: (value: number) => string }) => {
      if (tickFormatter) tickFormatter(50);
      return <div />;
    },
    CartesianGrid: () => <div />,
    Tooltip: ({ formatter }: { formatter?: (value: number | undefined) => string }) => {
      if (formatter) { savedTooltipFormatter = formatter; formatter(12345); }
      return <div />;
    },
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    __getSavedTooltipFormatter: () => savedTooltipFormatter,
  };
});

jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <SidebarProvider>
      <KeyboardShortcutsProvider>
        <HeaderProvider>
          {ui}
        </HeaderProvider>
      </KeyboardShortcutsProvider>
    </SidebarProvider>
  );
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
    localStorage.clear();
  });

  test('shows loading state initially', async () => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
    const { getByText } = renderWithProviders(<Dashboard />);
    expect(getByText('Loading dashboard...')).toBeInTheDocument();
  });

  test('shows error when no token', async () => {
    const { getByText } = renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(getByText(/No authentication token found/)).toBeInTheDocument();
    });
  });

  test('redirects to login on 401', async () => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
    });

    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  test('shows dashboard data when fetch is successful', async () => {
    localStorage.setItem('token', 'test-token');
    const testData = {
      stockRecommendations: [{ name: 'Paracetamol', count: 10 }],
      earnings: [{ name: 'Jan', value: '100000' }], // string value to test parsing
      cashiers: [{ id: 1, username: 'cashier1', description: 'test' }],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => testData,
    });

    const { getByText } = renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      expect(getByText('Peramalan Stock')).toBeInTheDocument();
      expect(getByText('Paracetamol')).toBeInTheDocument();
      expect(getByText('cashier1')).toBeInTheDocument();
    });
  });

  test('handles search query', async () => {
    localStorage.setItem('token', 'test-token');
    const testData = {
      stockRecommendations: [],
      earnings: [],
      cashiers: [
        { id: 1, username: 'John', description: 'test 1' },
        { id: 2, username: 'Jane', description: 'test 2' },
      ],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => testData,
    });

    const { getByPlaceholderText, getByText, queryByText } = renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      expect(getByText('John')).toBeInTheDocument();
      expect(getByText('Jane')).toBeInTheDocument();
    });

    const searchInput = getByPlaceholderText('Search Cashier');
    fireEvent.change(searchInput, { target: { value: 'John' } });
    
    expect(getByText('John')).toBeInTheDocument();
    expect(queryByText('Jane')).not.toBeInTheDocument();
  });

  test('handles pagination and items per page', async () => {
    localStorage.setItem('token', 'test-token');
    const testData = {
      stockRecommendations: [],
      earnings: [],
      cashiers: Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        username: `Cashier ${i + 1}`,
        description: 'test',
      })),
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => testData,
    });

    const { getByText, getByRole, getByPlaceholderText } = renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      expect(getByText('Cashier 1')).toBeInTheDocument();
    });

    // Change items per page
    const itemsPerPageSelect = getByRole('combobox');
    fireEvent.change(itemsPerPageSelect, { target: { value: '10' } });
    
    // Test next page
    const nextPageBtn = getByText('→');
    fireEvent.click(nextPageBtn);
    
    // Test prev page
    const prevPageBtn = getByText('←');
    fireEvent.click(prevPageBtn);

    // Test search query changes
    const searchInput = getByPlaceholderText('Search Cashier');
    fireEvent.change(searchInput, { target: { value: 'test' } });
  });

  test('shows error when fetch fails', async () => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { getByText } = renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      expect(getByText(/Failed to load dashboard data/)).toBeInTheDocument();
    });
  });

  test('clicking stock card navigates to /recommendations', async () => {
    localStorage.setItem('token', 'test-token');
    const testData = {
      stockRecommendations: [{ name: 'Paracetamol', count: 10 }],
      earnings: [],
      cashiers: [{ id: 1, username: 'cashier1', description: 'test' }],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => testData,
    });

    const { getByText } = renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(getByText('Peramalan Stock')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Peramalan Stock'));
    expect(mockPush).toHaveBeenCalledWith('/recommendations');
  });

  test('covers tickFormatter and Tooltip formatter in recharts', async () => {
    localStorage.setItem('token', 'test-token');
    const testData = {
      stockRecommendations: [{ name: 'Paracetamol', count: 10 }],
      earnings: [{ name: 'Jan', value: 50000 }],
      cashiers: [{ id: 1, username: 'cashier1', description: 'test' }],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => testData,
    });

    renderWithProviders(<Dashboard />);
    const rechartsMock = jest.requireMock('recharts');
    await waitFor(() => {
      expect(rechartsMock.__getSavedTooltipFormatter()).toBeDefined();
    });
    const formatter = rechartsMock.__getSavedTooltipFormatter();
    expect(formatter(100000)).toBe('Rp 100.000');
  });

  test('renders with null/undefined dashboard fields (branches 93-95)', async () => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        stockRecommendations: null,
        earnings: null,
        cashiers: null,
      }),
    });

    const { getByText } = renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(getByText('No recommendations available.')).toBeInTheDocument();
    });
  });

  test('renders with empty arrays for all data (branches 93-95)', async () => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        stockRecommendations: [],
        earnings: [],
        cashiers: [],
      }),
    });

    const { getByText } = renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(getByText('Peramalan Stock')).toBeInTheDocument();
      expect(getByText('No recommendations available.')).toBeInTheDocument();
    });
  });

  test('renders stock with zero count (branch count > 0 false)', async () => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        stockRecommendations: [{ name: 'Obat A', count: 0 }],
        earnings: [],
        cashiers: [],
      }),
    });

    const { getByText } = renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(getByText('Obat A')).toBeInTheDocument();
    });
  });

  test('renders stock with null count (branch count != null false)', async () => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        stockRecommendations: [{ name: 'Obat B', count: null }],
        earnings: [],
        cashiers: [],
      }),
    });

    const { getByText } = renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(getByText('Obat B')).toBeInTheDocument();
    });
  });

  test('renders stock with undefined count (branch count != null false)', async () => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        stockRecommendations: [{ name: 'Obat C' }],
        earnings: [],
        cashiers: [],
      }),
    });

    const { getByText } = renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(getByText('Obat C')).toBeInTheDocument();
    });
  });

  test('renders earnings with string values (parseFloat branch)', async () => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        stockRecommendations: [],
        earnings: [{ name: 'Jan', value: '100000' }],
        cashiers: [],
      }),
    });

    const { findByText } = renderWithProviders(<Dashboard />);
    await expect(findByText(/100.000/)).resolves.toBeInTheDocument();
  });

  test('renders pagination controls with more than itemsPerPage cashiers', async () => {
    localStorage.setItem('token', 'test-token');
    const testData = {
      stockRecommendations: [],
      earnings: [{ name: 'Jan', value: 50000 }],
      cashiers: Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        username: `Cashier ${i + 1}`,
        description: 'test',
      })),
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => testData,
    });

    const { getByText } = renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(getByText('Cashier 1')).toBeInTheDocument();
    });

    // Should show pagination (7 > 5)
    expect(getByText('→')).toBeInTheDocument();
    expect(getByText('←')).toBeInTheDocument();
  });

  test('covers Tooltip formatter branch with value=0 (line 212)', async () => {
    localStorage.setItem('token', 'test-token');
    const testData = {
      stockRecommendations: [],
      earnings: [{ name: 'Jan', value: 50000 }],
      cashiers: [],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => testData,
    });

    renderWithProviders(<Dashboard />);
    const rechartsMock = jest.requireMock('recharts');
    await waitFor(() => {
      expect(rechartsMock.__getSavedTooltipFormatter()).toBeDefined();
    });
    const formatter = rechartsMock.__getSavedTooltipFormatter();
    expect(formatter(0)).toBe('Rp 0');
    expect(formatter(undefined)).toBe('Rp 0');
  });
});
