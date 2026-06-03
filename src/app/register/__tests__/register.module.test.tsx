import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';
import RegisterPage from '@/app/register/page';

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
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Register Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
    localStorage.clear();
    document.cookie = 'token=; Max-Age=-99999999;';
  });

  test('renders register form', () => {
    const { getAllByText, getByPlaceholderText, container } = render(<RegisterPage />);
    const headings = getAllByText('Sign up');
    expect(headings.length).toBeGreaterThan(0);
    expect(getByPlaceholderText('email@email.com')).toBeInTheDocument();
    expect(getByPlaceholderText('Enter Password')).toBeInTheDocument();
    expect(getByPlaceholderText('Re-enter Password')).toBeInTheDocument();
    expect(container.querySelector('#terms')).toBeInTheDocument();
  });

  test('toggles password and confirm password visibility', () => {
    const { getByPlaceholderText, container } = render(<RegisterPage />);
    const passwordInput = getByPlaceholderText('Enter Password');
    const confirmPasswordInput = getByPlaceholderText('Re-enter Password');
    
    const toggleBtns = container.querySelectorAll('button[class*="absolute right-2.5"]');
    expect(toggleBtns.length).toBe(2);

    expect(passwordInput).toHaveAttribute('type', 'password');
    fireEvent.click(toggleBtns[0]);
    expect(passwordInput).toHaveAttribute('type', 'text');
    fireEvent.click(toggleBtns[0]);
    expect(passwordInput).toHaveAttribute('type', 'password');

    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    fireEvent.click(toggleBtns[1]);
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');
    fireEvent.click(toggleBtns[1]);
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
  });

  test('shows error when terms are not agreed', async () => {
    const { getByText, getByPlaceholderText, container, getByRole } = render(<RegisterPage />);
    
    fireEvent.change(getByPlaceholderText('email@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(getByPlaceholderText('Enter Password'), { target: { value: 'password123' } });
    fireEvent.change(getByPlaceholderText('Re-enter Password'), { target: { value: 'password123' } });
    
    const termsCheckbox = container.querySelector('#terms');
    if (!termsCheckbox) throw new Error('Terms checkbox not found');
    expect(termsCheckbox).not.toBeChecked();

    fireEvent.click(getByRole('button', { name: /Sign up/i }));

    await waitFor(() => {
      expect(getByText(/Anda harus menyetujui Syarat & Ketentuan/)).toBeInTheDocument();
    });
  });

  test('handles successful register', async () => {
    const testData = {
      token: 'test-token',
      user: { id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => testData,
    });

    const { getByPlaceholderText, container, getByRole } = render(<RegisterPage />);
    
    fireEvent.change(getByPlaceholderText('email@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(getByPlaceholderText('Enter Password'), { target: { value: 'password123' } });
    fireEvent.change(getByPlaceholderText('Re-enter Password'), { target: { value: 'password123' } });
    
    const termsCheckbox = container.querySelector('#terms');
    if (!termsCheckbox) throw new Error('Terms checkbox not found');
    fireEvent.click(termsCheckbox);

    fireEvent.click(getByRole('button', { name: /Sign up/i }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toEqual(testData.token);
      expect(localStorage.getItem('user')).toEqual(JSON.stringify(testData.user));
      expect(document.cookie).toContain('token');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('handles register error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Email already exists' }),
    });

    const { getByText, getByPlaceholderText, container, getByRole } = render(<RegisterPage />);
    
    fireEvent.change(getByPlaceholderText('email@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(getByPlaceholderText('Enter Password'), { target: { value: 'password123' } });
    fireEvent.change(getByPlaceholderText('Re-enter Password'), { target: { value: 'password123' } });
    
    const termsCheckbox = container.querySelector('#terms');
    if (!termsCheckbox) throw new Error('Terms checkbox not found');
    fireEvent.click(termsCheckbox);

    fireEvent.click(getByRole('button', { name: /Sign up/i }));

    await waitFor(() => {
      expect(getByText('Email already exists')).toBeInTheDocument();
    });
  });

  test('handles network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { getByText, getByPlaceholderText, container, getByRole } = render(<RegisterPage />);
    
    fireEvent.change(getByPlaceholderText('email@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(getByPlaceholderText('Enter Password'), { target: { value: 'password123' } });
    fireEvent.change(getByPlaceholderText('Re-enter Password'), { target: { value: 'password123' } });
    
    const termsCheckbox = container.querySelector('#terms');
    if (!termsCheckbox) throw new Error('Terms checkbox not found');
    fireEvent.click(termsCheckbox);

    fireEvent.click(getByRole('button', { name: /Sign up/i }));

    await waitFor(() => {
      expect(getByText(/Something went wrong/)).toBeInTheDocument();
    });
  });

  test('handles register error without message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { getByText, getByPlaceholderText, container, getByRole } = render(<RegisterPage />);
    
    fireEvent.change(getByPlaceholderText('email@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(getByPlaceholderText('Enter Password'), { target: { value: 'password123' } });
    fireEvent.change(getByPlaceholderText('Re-enter Password'), { target: { value: 'password123' } });
    
    const termsCheckbox = container.querySelector('#terms');
    if (!termsCheckbox) throw new Error('Terms checkbox not found');
    fireEvent.click(termsCheckbox);

    fireEvent.click(getByRole('button', { name: /Sign up/i }));

    await waitFor(() => {
      expect(getByText('Registrasi gagal')).toBeInTheDocument();
    });
  });
});
