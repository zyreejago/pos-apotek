import React from 'react';
import { render, act } from '@testing-library/react';
import AuthProvider from '@/components/AuthProvider';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

const mockUseRouter = jest.requireMock('next/navigation').useRouter;
const mockUsePathname = jest.requireMock('next/navigation').usePathname;

describe('AuthProvider', () => {
  let push: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    push = jest.fn();
    mockUseRouter.mockReturnValue({ push });
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('renders children on login page without token', async () => {
    mockUsePathname.mockReturnValue('/login');
    const { getByText } = render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );
    
    act(() => {
      jest.advanceTimersByTime(0);
    });
    
    expect(getByText('Test Child')).toBeInTheDocument();
  });

  test('renders children on register page without token', async () => {
    mockUsePathname.mockReturnValue('/register');
    const { getByText } = render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );
    
    act(() => {
      jest.advanceTimersByTime(0);
    });
    
    expect(getByText('Test Child')).toBeInTheDocument();
  });

  test('renders children on forgot-password page without token', async () => {
    mockUsePathname.mockReturnValue('/forgot-password');
    const { getByText } = render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );
    
    act(() => {
      jest.advanceTimersByTime(0);
    });
    
    expect(getByText('Test Child')).toBeInTheDocument();
  });

  test('redirects to login when not authenticated on protected page', async () => {
    mockUsePathname.mockReturnValue('/dashboard');
    render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );
    
    act(() => {
      jest.advanceTimersByTime(0);
    });
    
    expect(push).toHaveBeenCalledWith('/login');
  });

  test('redirects to dashboard when authenticated on login page', async () => {
    mockUsePathname.mockReturnValue('/login');
    localStorage.setItem('token', 'test-token');
    render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );
    
    act(() => {
      jest.advanceTimersByTime(0);
    });
    
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  test('redirects to dashboard when authenticated on register page', async () => {
    mockUsePathname.mockReturnValue('/register');
    localStorage.setItem('token', 'test-token');
    render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );
    
    act(() => {
      jest.advanceTimersByTime(0);
    });
    
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  test('redirects to dashboard when authenticated on forgot-password page', async () => {
    mockUsePathname.mockReturnValue('/forgot-password');
    localStorage.setItem('token', 'test-token');
    render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );
    
    act(() => {
      jest.advanceTimersByTime(0);
    });
    
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  test('returns null when not authenticated on protected page after mount', async () => {
    mockUsePathname.mockReturnValue('/dashboard');
    const { container, rerender } = render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );
    
    act(() => {
      jest.advanceTimersByTime(0);
    });
    
    rerender(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );
    
    expect(container.firstChild).toBeNull();
  });
});
