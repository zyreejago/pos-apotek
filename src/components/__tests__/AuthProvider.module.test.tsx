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

  describe('unauthenticated access to public pages', () => {
    test('renders children on login page without token', () => {
      mockUsePathname.mockReturnValue('/login');
      const { getByText } = render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(getByText('Test Child')).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    test('renders children on register page without token', () => {
      mockUsePathname.mockReturnValue('/register');
      const { getByText } = render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(getByText('Test Child')).toBeInTheDocument();
    });

    test('renders children on forgot-password page without token', () => {
      mockUsePathname.mockReturnValue('/forgot-password');
      const { getByText } = render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(getByText('Test Child')).toBeInTheDocument();
    });
  });

  describe('unauthenticated access to protected pages', () => {
    test('redirects to login when not authenticated on dashboard', () => {
      mockUsePathname.mockReturnValue('/dashboard');
      render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(push).toHaveBeenCalledWith('/login');
    });

    test('returns null when not authenticated on protected page after mount', () => {
      mockUsePathname.mockReturnValue('/dashboard');
      const { container } = render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(container.firstChild).toBeNull();
    });

    test('redirects to login on any other protected page', () => {
      mockUsePathname.mockReturnValue('/settings');
      render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(push).toHaveBeenCalledWith('/login');
    });
  });

  describe('authenticated access', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'test-token');
    });

    test('redirects to dashboard when authenticated on login page', () => {
      mockUsePathname.mockReturnValue('/login');
      render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(push).toHaveBeenCalledWith('/dashboard');
    });

    test('redirects to dashboard when authenticated on register page', () => {
      mockUsePathname.mockReturnValue('/register');
      render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(push).toHaveBeenCalledWith('/dashboard');
    });

    test('redirects to dashboard when authenticated on forgot-password page', () => {
      mockUsePathname.mockReturnValue('/forgot-password');
      render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(push).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('mounted state rendering', () => {
    test('shows children when mounted and authenticated on protected page', () => {
      localStorage.setItem('token', 'test-token');
      mockUsePathname.mockReturnValue('/dashboard');
      const { getByText } = render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(getByText('Test Child')).toBeInTheDocument();
    });

    test('shows children when mounted with token on login page redirects to dashboard', () => {
      localStorage.setItem('token', 'test-token');
      mockUsePathname.mockReturnValue('/login');
      const { getByText } = render(
        <AuthProvider><div>Test Child</div></AuthProvider>
      );

      act(() => { jest.advanceTimersByTime(0); });

      expect(push).toHaveBeenCalledWith('/dashboard');
      expect(getByText('Test Child')).toBeInTheDocument();
    });
  });
});
