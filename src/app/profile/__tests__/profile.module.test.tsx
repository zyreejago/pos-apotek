import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';
import ProfilePage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/profile',
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

jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));

jest.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="loader-icon" />,
  Save: () => <span data-testid="save-icon" />,
  Key: () => <span data-testid="key-icon" />,
  User: () => <span data-testid="user-icon" />,
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
    if (url.includes('/api/profile/password')) return okJson({ success: true });
    if (url.includes('/api/dashboard')) return okJson({ stockRecommendations: [], earnings: [], cashiers: [] });
    return okJson({});
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('profile module', () => {
  test('renders Profile page', async () => {
    const { getByText } = render(<ProfilePage />);
    await waitFor(() => {
      expect(getByText('Personal Information')).toBeInTheDocument();
    });
  });

  test('handles fetchProfile error (non-Error)', async () => {
    global.fetch = jest.fn().mockRejectedValue('String error');
    const { getByText } = render(<ProfilePage />);
    await waitFor(() => {
      expect(getByText('Personal Information')).toBeInTheDocument();
    });
  });

  test('updates profile successfully', async () => {
    const { getByText, getByRole, container } = render(<ProfilePage />);
    await waitFor(() => expect(getByText('Personal Information')).toBeInTheDocument());
    
    const inputs = container.querySelectorAll('input[type="text"], input[type="email"]');
    fireEvent.change(inputs[0], { target: { value: 'newusername' } }); // Username
    fireEvent.change(inputs[1], { target: { value: 'newemail@test.com' } }); // Email
    
    const saveBtn = getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/profile'),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  test('handles profile update error', async () => {
    global.fetch = jest.fn().mockResolvedValue(errorJson({ message: 'Test error' }));
    
    const { getByText, getByRole, container } = render(<ProfilePage />);
    await waitFor(() => expect(getByText('Personal Information')).toBeInTheDocument());
    
    const inputs = container.querySelectorAll('input[type="text"], input[type="email"]');
    fireEvent.change(inputs[0], { target: { value: 'newusername' } });
    
    const saveBtn = getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  test('handles profile update with no user in localStorage', async () => {
    localStorage.removeItem('user');
    
    const { getByText, getByRole, container } = render(<ProfilePage />);
    await waitFor(() => expect(getByText('Personal Information')).toBeInTheDocument());
    
    const inputs = container.querySelectorAll('input[type="text"], input[type="email"]');
    fireEvent.change(inputs[0], { target: { value: 'newusername' } });
    
    const saveBtn = getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  test('handles profile update with non-Error object', async () => {
    global.fetch = jest.fn().mockRejectedValue('This is a string error');
    
    const { getByText, getByRole, container } = render(<ProfilePage />);
    await waitFor(() => expect(getByText('Personal Information')).toBeInTheDocument());
    
    const inputs = container.querySelectorAll('input[type="text"], input[type="email"]');
    fireEvent.change(inputs[0], { target: { value: 'newusername' } });
    
    const saveBtn = getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  test('changes password successfully', async () => {
    const { getByText, getByLabelText, getByRole, getByPlaceholderText } = render(<ProfilePage />);
    await waitFor(() => expect(getByText('Change Password')).toBeInTheDocument());
    
    const oldPasswordInput = getByPlaceholderText('Enter current password to verify');
    fireEvent.change(oldPasswordInput, { target: { value: 'oldpass123' } });
    
    const newPasswordInput = getByPlaceholderText('Min. 6 characters');
    fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
    
    const confirmPasswordInput = getByPlaceholderText('Re-enter new password');
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } });
    
    const updateBtn = getByRole('button', { name: /Update Password/i });
    fireEvent.click(updateBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/profile/password'),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  test('handles password mismatch', async () => {
    const { getByText, getByPlaceholderText, getByRole } = render(<ProfilePage />);
    await waitFor(() => expect(getByText('Change Password')).toBeInTheDocument());
    
    const oldPasswordInput = getByPlaceholderText('Enter current password to verify');
    fireEvent.change(oldPasswordInput, { target: { value: 'oldpass123' } });
    
    const newPasswordInput = getByPlaceholderText('Min. 6 characters');
    fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
    
    const confirmPasswordInput = getByPlaceholderText('Re-enter new password');
    fireEvent.change(confirmPasswordInput, { target: { value: 'wrongpass123' } });
    
    const updateBtn = getByRole('button', { name: /Update Password/i });
    fireEvent.click(updateBtn);
    
    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/profile/password'),
        expect.anything()
      );
    });
  });

  test('handles password change error', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/profile/password')) return errorJson({ message: 'Test error' });
      return okJson({ id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' });
    }) as unknown as typeof fetch;
    
    const { getByText, getByPlaceholderText, getByRole } = render(<ProfilePage />);
    await waitFor(() => expect(getByText('Change Password')).toBeInTheDocument());
    
    const oldPasswordInput = getByPlaceholderText('Enter current password to verify');
    fireEvent.change(oldPasswordInput, { target: { value: 'oldpass123' } });
    
    const newPasswordInput = getByPlaceholderText('Min. 6 characters');
    fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
    
    const confirmPasswordInput = getByPlaceholderText('Re-enter new password');
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } });
    
    const updateBtn = getByRole('button', { name: /Update Password/i });
    fireEvent.click(updateBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  test('handles password change with non-Error object', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/profile/password')) return Promise.reject('This is a string error');
      return okJson({ id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' });
    }) as unknown as typeof fetch;
    
    const { getByText, getByPlaceholderText, getByRole } = render(<ProfilePage />);
    await waitFor(() => expect(getByText('Change Password')).toBeInTheDocument());
    
    const oldPasswordInput = getByPlaceholderText('Enter current password to verify');
    fireEvent.change(oldPasswordInput, { target: { value: 'oldpass123' } });
    
    const newPasswordInput = getByPlaceholderText('Min. 6 characters');
    fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
    
    const confirmPasswordInput = getByPlaceholderText('Re-enter new password');
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } });
    
    const updateBtn = getByRole('button', { name: /Update Password/i });
    fireEvent.click(updateBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
