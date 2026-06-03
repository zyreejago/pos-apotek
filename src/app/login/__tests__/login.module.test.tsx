import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';
import LoginPage from '@/app/login/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockPush = jest.fn();
const mockUseRouter = jest.requireMock('next/navigation').useRouter;

jest.mock('next/link', () => {
  return function Link({ href, children }: { href: string; children: React.ReactNode }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/components/ui/goey-toaster', () => ({
  goeyToast: {
    error: jest.fn(),
  },
}));

describe('Login Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
    localStorage.clear();
  });

  test('renders login form', () => {
    const { getByText, getByPlaceholderText } = render(<LoginPage />);
    expect(getByText('Sign in')).toBeInTheDocument();
    expect(getByPlaceholderText('email@email.com')).toBeInTheDocument();
    expect(getByPlaceholderText('Enter Password')).toBeInTheDocument();
  });

  test('toggles password visibility', () => {
    const { getByPlaceholderText, container } = render(<LoginPage />);
    const passwordInput = getByPlaceholderText('Enter Password');
    const toggleBtn = container.querySelector('button[class*="absolute right-3"]');
    if (!toggleBtn) throw new Error('Toggle button not found');

    expect(passwordInput).toHaveAttribute('type', 'password');
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('handles successful login', async () => {
    const testData = {
      token: 'test-token',
      user: { id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => testData,
    });

    const { getByPlaceholderText, getByText } = render(<LoginPage />);
    
    fireEvent.change(getByPlaceholderText('email@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(getByPlaceholderText('Enter Password'), { target: { value: 'password123' } });
    fireEvent.click(getByText('Sign In'));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toEqual(testData.token);
      expect(localStorage.getItem('user')).toEqual(JSON.stringify(testData.user));
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('handles login error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Invalid credentials' }),
    });

    const { getByPlaceholderText, getByText } = render(<LoginPage />);
    
    fireEvent.change(getByPlaceholderText('email@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(getByPlaceholderText('Enter Password'), { target: { value: 'wrongpassword' } });
    fireEvent.click(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  test('handles network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { getByPlaceholderText, getByText } = render(<LoginPage />);
    
    fireEvent.change(getByPlaceholderText('email@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(getByPlaceholderText('Enter Password'), { target: { value: 'password123' } });
    fireEvent.click(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText(/Something went wrong/)).toBeInTheDocument();
    });
  });

  test('handles login error without message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { getByPlaceholderText, getByText } = render(<LoginPage />);
    
    fireEvent.change(getByPlaceholderText('email@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(getByPlaceholderText('Enter Password'), { target: { value: 'wrongpassword' } });
    fireEvent.click(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Login failed')).toBeInTheDocument();
    });
  });
});
