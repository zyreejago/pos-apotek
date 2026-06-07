import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AuditTrailsPage, { formatDate } from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';
import { SidebarProvider } from '@/context/SidebarContext';
import { HeaderProvider, useHeader } from '@/context/HeaderContext';
import { KeyboardShortcutsProvider } from '@/context/KeyboardShortcutsContext';

function HeaderDisplay() {
  const { headerState } = useHeader();
  return (
    <div data-testid="header">
      <h1>{headerState.title}</h1>
      {headerState.subtitle && <p>{headerState.subtitle}</p>}
    </div>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <SidebarProvider>
      <HeaderProvider>
        <KeyboardShortcutsProvider>
          <HeaderDisplay />
          {ui}
        </KeyboardShortcutsProvider>
      </HeaderProvider>
    </SidebarProvider>
  );
}

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/audit-trails',
}));

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: () => ({
    loading: false,
    hasPermission: true,
    permissions: [],
    checkActionPermission: jest.fn(() => true),
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

jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon" />,
  Calendar: () => <span data-testid="calendar-icon" />,
  User: () => <span data-testid="user-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
  Activity: () => <span data-testid="activity-icon" />,
}));

const auditData = [
  {
    id: 1,
    user_id: 1,
    username: 'Admin',
    role: 'superadmin',
    module: 'Products',
    action: 'create',
    description: 'Created a product',
    ip_address: '127.0.0.1',
    user_agent: 'Mozilla',
    created_at: '2024-01-15T10:30:00Z',
  },
  {
    id: 2,
    user_id: 2,
    username: 'Staff',
    role: 'staff',
    module: 'Users',
    action: 'update',
    description: 'Updated user profile',
    ip_address: '192.168.1.1',
    user_agent: 'Chrome',
    created_at: '2024-01-16T14:20:00Z',
  },
  {
    id: 3,
    user_id: null,
    username: null,
    role: null,
    module: 'Settings',
    action: 'delete',
    description: 'Deleted a setting',
    ip_address: '10.0.0.1',
    user_agent: 'Safari',
    created_at: '2024-01-17T09:15:00Z',
  },
  {
    id: 4,
    user_id: 4,
    username: 'Viewer',
    role: 'viewer',
    module: 'Settings',
    action: 'view',
    description: 'Viewed settings page',
    ip_address: '10.0.0.2',
    user_agent: 'Firefox',
    created_at: '2024-01-18T16:45:00Z',
  },
  {
    id: 5,
    user_id: 5,
    username: 'Tester',
    role: 'tester',
    module: 'Products',
    action: 'login',
    description: 'User logged in',
    ip_address: '10.0.0.3',
    user_agent: 'Edge',
    created_at: '2024-01-19T08:00:00Z',
  },
];

const auditPayload = {
  data: auditData,
  total: 5,
  page: 1,
  limit: 20,
  total_pages: 1,
};

const emptyPayload = {
  data: [],
  total: 0,
  page: 1,
  limit: 20,
  total_pages: 1,
};

function mockFetchSuccess(data: unknown = auditPayload) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => data,
      text: async () => JSON.stringify(data),
    } as Response)
  ) as unknown as typeof fetch;
}

function mockFetchFailure() {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => JSON.stringify({}),
    } as Response)
  ) as unknown as typeof fetch;
}

function renderPage() {
  return renderWithProviders(<AuditTrailsPage />);
}

async function waitForData() {
  await waitFor(() => {
    expect(screen.queryByText('Memuat log aktivitas...')).not.toBeInTheDocument();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'Admin', role: 'superadmin' }));
  mockFetchSuccess();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AuditTrailsPage', () => {
  test('renders loading state', async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as unknown as typeof fetch;

    renderPage();

    expect(screen.getByText('Memuat log aktivitas...')).toBeInTheDocument();

    resolveFetch!({
      ok: true,
      status: 200,
      json: async () => auditPayload,
      text: async () => JSON.stringify(auditPayload),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  test('renders empty state', async () => {
    mockFetchSuccess(emptyPayload);

    renderPage();

    await waitForData();
    expect(screen.getByText('Tidak ada log aktivitas ditemukan.')).toBeInTheDocument();
    expect(screen.getByText('Total Log Aktivitas: 0')).toBeInTheDocument();
  });

  test('renders data successfully', async () => {
    renderPage();

    await waitForData();

    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    expect(await screen.findByText('Total Log Aktivitas: 5')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('superadmin')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('staff')).toBeInTheDocument();
    expect(screen.getAllByText('superadmin').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('staff').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('create')).toBeInTheDocument();
    expect(screen.getByText('update')).toBeInTheDocument();
    expect(screen.getByText('delete')).toBeInTheDocument();
    expect(screen.getByText('view')).toBeInTheDocument();
    expect(screen.getByText('login')).toBeInTheDocument();
    expect(screen.getByText('Created a product')).toBeInTheDocument();
    expect(screen.getByText('Updated user profile')).toBeInTheDocument();
  });

  test('handles fetch error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchFailure();

    renderPage();

    await waitForData();
    expect(screen.getByText('Tidak ada log aktivitas ditemukan.')).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith('Error fetching audit trails:', expect.any(Error));
  });

  test('handles fetch network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(() => Promise.reject(new Error('network error'))) as unknown as typeof fetch;

    renderPage();

    await waitForData();
    expect(screen.getByText('Tidak ada log aktivitas ditemukan.')).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith('Error fetching audit trails:', expect.any(Error));
  });

  test('renders null username and role as dash', async () => {
    renderPage();

    await waitForData();

    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  test('shows action badge colors: create/add/register/login', async () => {
    renderPage();

    await waitForData();

    const createBadge = screen.getByText('create');
    const loginBadge = screen.getByText('login');
    expect(createBadge.className).toContain('bg-green-100');
    expect(loginBadge.className).toContain('bg-green-100');
  });

  test('shows action badge color for update', async () => {
    renderPage();

    await waitForData();

    const updateBadge = screen.getByText('update');
    expect(updateBadge.className).toContain('bg-blue-100');
  });

  test('shows action badge color for delete', async () => {
    renderPage();

    await waitForData();

    const deleteBadge = screen.getByText('delete');
    expect(deleteBadge.className).toContain('bg-red-100');
  });

  test('shows action badge color for view', async () => {
    renderPage();

    await waitForData();

    const viewBadge = screen.getByText('view');
    expect(viewBadge.className).toContain('bg-gray-100');
  });

  test('shows action badge color for unknown action', async () => {
    mockFetchSuccess({
      ...auditPayload,
      data: [{
        id: 99,
        user_id: 1,
        username: 'Test',
        role: 'admin',
        module: 'Test',
        action: 'unknown_action',
        description: 'Some unknown action',
        ip_address: null,
        user_agent: null,
        created_at: '2024-01-20T12:00:00Z',
      }],
    });

    renderPage();

    await waitForData();

    const badge = screen.getByText('unknown_action');
    expect(badge.className).toContain('bg-yellow-100');
  });

  test('changes items per page', async () => {
    renderPage();

    await waitForData();

    fireEvent.change(screen.getByDisplayValue('20'), {
      target: { value: '10' },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });
  });

  test('previous page button is disabled on first page', async () => {
    renderPage();

    await waitForData();

    const prevButton = screen.getByText('←');
    expect(prevButton).toBeDisabled();
    expect(prevButton.className).toContain('cursor-not-allowed');
  });

  test('next page button is disabled when on last page', async () => {
    renderPage();

    await waitForData();

    const nextButton = screen.getByText('→');
    expect(nextButton).toBeDisabled();
    expect(nextButton.className).toContain('cursor-not-allowed');
  });

  test('navigates to next and previous page', async () => {
    mockFetchSuccess({
      ...auditPayload,
      total: 50,
      page: 1,
      limit: 20,
      total_pages: 3,
    });

    renderPage();

    await waitForData();

    const nextButton = screen.getByText('→');
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
    });
  });

  test('navigates to next and back to previous page', async () => {
    mockFetchSuccess({
      ...auditPayload,
      total: 50,
      page: 1,
      limit: 20,
      total_pages: 3,
    });

    renderPage();

    await waitForData();

    const nextButton = screen.getByText('→');
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
    });

    mockFetchSuccess({
      ...auditPayload,
      total: 50,
      page: 2,
      limit: 20,
      total_pages: 3,
    });

    await waitForData();

    const prevButton = screen.getByText('←');
    expect(prevButton).not.toBeDisabled();

    fireEvent.click(prevButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.any(Object)
      );
    });
  });

  test('filters by module', async () => {
    renderPage();

    await waitForData();

    fireEvent.change(screen.getByDisplayValue('Semua Modul'), {
      target: { value: 'Products' },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('module=Products'),
        expect.any(Object)
      );
    });
  });

  test('filters by start date', async () => {
    renderPage();

    await waitForData();

    const dateInputs = screen.getAllByDisplayValue('').filter(
      (el) => el.getAttribute('type') === 'date'
    );
    fireEvent.change(dateInputs[0], { target: { value: '2024-01-01' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2024-01-01'),
        expect.any(Object)
      );
    });
  });

  test('filters by end date', async () => {
    renderPage();

    await waitForData();

    const dateInputs = screen.getAllByDisplayValue('').filter(
      (el) => el.getAttribute('type') === 'date'
    );
    fireEvent.change(dateInputs[1], { target: { value: '2024-01-31' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('end_date=2024-01-31'),
        expect.any(Object)
      );
    });
  });

  test('shows reset filter button when filters are active', async () => {
    renderPage();

    await waitForData();

    expect(screen.queryByText('Reset Filter')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Semua Modul'), {
      target: { value: 'Products' },
    });

    await waitFor(() => {
      expect(screen.getByText('Reset Filter')).toBeInTheDocument();
    });
  });

  test('resets all filters', async () => {
    mockFetchSuccess({
      ...auditPayload,
      data: [{ ...auditData[0] }],
    });

    renderPage();

    await waitForData();

    fireEvent.change(screen.getByDisplayValue('Semua Modul'), {
      target: { value: 'Products' },
    });

    await waitFor(() => {
      expect(screen.getByText('Reset Filter')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Reset Filter'));

    await waitFor(() => {
      expect(screen.queryByText('Reset Filter')).not.toBeInTheDocument();
    });
  });

  test('fetches without token', async () => {
    localStorage.removeItem('token');

    renderPage();

    await waitForData();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/audit-trails'),
      expect.objectContaining({ headers: {} })
    );
  });

  test('extracts unique modules from data', async () => {
    renderPage();

    await waitForData();

    const select = screen.getByDisplayValue('Semua Modul');
    const options = Array.from(select.querySelectorAll('option'));
    const optionValues = options.map(o => o.getAttribute('value'));

    expect(optionValues).toContain('Products');
    expect(optionValues).toContain('Users');
    expect(optionValues).toContain('Settings');
  });

  test('pagination display shows correct range', async () => {
    mockFetchSuccess({
      ...auditPayload,
      total: 5,
      page: 1,
      limit: 20,
      total_pages: 1,
    });

    renderPage();

    await waitForData();

    expect(screen.getByText(/1-.* of 5/)).toBeInTheDocument();
  });

  test('formatDate formats correctly', () => {
    const result = formatDate('2024-01-15T10:30:00Z');
    expect(result).toBe('15 Jan 2024');
  });

  test('search input updates searchQuery', async () => {
    renderPage();

    await waitForData();

    const searchInput = screen.getByPlaceholderText('Cari aktivitas...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });

    expect(searchInput).toHaveValue('test query');
  });

  test('pagination display with multiple pages', async () => {
    mockFetchSuccess({
      ...auditPayload,
      total: 50,
      page: 1,
      limit: 20,
      total_pages: 3,
    });

    renderPage();

    await waitForData();

    expect(screen.getByText(/1-20 of 50/)).toBeInTheDocument();

    const nextButton = screen.getByText('→');
    fireEvent.click(nextButton);

    mockFetchSuccess({
      ...auditPayload,
      total: 50,
      page: 2,
      limit: 20,
      total_pages: 3,
    });

    await waitForData();

    expect(screen.getByText(/21-40 of 50/)).toBeInTheDocument();
  });

  test('handles response with null data field (|| [] fallback, line 91)', async () => {
    mockFetchSuccess({ data: null, total: 0, page: 1, limit: 20, total_pages: 1 });

    renderPage();

    await waitForData();
    expect(screen.getByText('Tidak ada log aktivitas ditemukan.')).toBeInTheDocument();
    expect(screen.getByText('Total Log Aktivitas: 0')).toBeInTheDocument();
  });

  test('handles response with missing pagination fields (branch fallbacks, lines 92-97)', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => JSON.stringify({}),
      } as Response)
    ) as unknown as typeof fetch;

    renderPage();

    await waitForData();
    expect(screen.getByText('Tidak ada log aktivitas ditemukan.')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  test('handles response with no data and no total fields (edge fallbacks)', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [], total: undefined, page: undefined, limit: undefined, total_pages: undefined }),
        text: async () => JSON.stringify({}),
      } as Response)
    ) as unknown as typeof fetch;

    renderPage();

    await waitForData();
    expect(screen.getByText('Tidak ada log aktivitas ditemukan.')).toBeInTheDocument();
    expect(screen.getByText('Total Log Aktivitas: 0')).toBeInTheDocument();
  });

  test('extracts unique modules from data with module field (line 100)', async () => {
    const dataWithModules = {
      data: [
        { id: 1, module: 'Products', action: 'create', created_at: '2024-01-15T10:30:00Z', username: 'Admin', role: 'superadmin' },
        { id: 2, module: 'Products', action: 'update', created_at: '2024-01-15T10:30:00Z', username: 'Staff', role: 'staff' },
      ],
      total: 2,
      page: 1,
      limit: 20,
      total_pages: 1,
    };
    mockFetchSuccess(dataWithModules);

    renderPage();

    await waitForData();

    const select = screen.getByDisplayValue('Semua Modul');
    const options = Array.from(select.querySelectorAll('option'));
    const optionValues = options.map(o => o.getAttribute('value'));
    expect(optionValues).toContain('Products');
    expect(optionValues).not.toContain('Users');
    expect(optionValues.length).toBe(2);
  });
});
