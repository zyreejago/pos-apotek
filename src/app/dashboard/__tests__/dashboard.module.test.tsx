import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';
import Dashboard from '@/app/dashboard/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockPush = jest.fn();
const mockUseRouter = jest.requireMock('next/navigation').useRouter;

jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

describe('Dashboard Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
    localStorage.clear();
  });

  test('shows loading state initially', async () => {
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
    const { getByText } = render(<Dashboard />);
    expect(getByText('Loading dashboard...')).toBeInTheDocument();
  });

  test('shows error when no token', async () => {
    const { getByText } = render(<Dashboard />);
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

    render(<Dashboard />);
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

    const { getByText } = render(<Dashboard />);
    
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

    const { getByPlaceholderText, getByText, queryByText } = render(<Dashboard />);
    
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

    const { getByText, getByRole, getByPlaceholderText } = render(<Dashboard />);
    
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

    const { getByText } = render(<Dashboard />);
    
    await waitFor(() => {
      expect(getByText(/Failed to load dashboard data/)).toBeInTheDocument();
    });
  });
});
