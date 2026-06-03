import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';
import Sidebar from '@/components/Sidebar';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

const mockPush = jest.fn();
const mockUseRouter = jest.requireMock('next/navigation').useRouter;
const mockUsePathname = jest.requireMock('next/navigation').usePathname;

jest.mock('next/link', () => {
  return function Link({ href, children }: { href: string; children: React.ReactNode }) {
    return <a href={href}>{children}</a>;
  };
});

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
    mockUsePathname.mockReturnValue('/dashboard');
    localStorage.clear();
  });

  test('returns null on auth pages', () => {
    mockUsePathname.mockReturnValue('/login');
    const { container } = render(<Sidebar />);
    expect(container.firstChild).toBeNull();
  });

  test('renders sidebar when authenticated as superadmin', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'test' }));
    const { getByText, getByTitle, container } = render(<Sidebar />);
    
    await waitFor(() => {
      expect(getByText('Apotek Sumber Waras')).toBeInTheDocument();
    });

    const collapseBtn = container.querySelector('button');
    if (collapseBtn) {
      fireEvent.click(collapseBtn);
      fireEvent.click(collapseBtn);
    }
  });

  test('renders sidebar when authenticated as regular user', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    
    const { getByText } = render(<Sidebar />);
    
    await waitFor(() => {
      expect(getByText('Apotek Sumber Waras')).toBeInTheDocument();
    });
  });

  test('handles 401 from permissions endpoint', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
    });
    
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  test('handles no token', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  test('handles auth changed event', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    
    render(<Sidebar />);
    
    window.dispatchEvent(new Event('auth:changed'));
  });

  test('handles storage event', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    
    render(<Sidebar />);
    
    window.dispatchEvent(new StorageEvent('storage', { key: 'token' }));
  });

  test('renders sales report expandable menu', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ module: 'Sales Report', show: true }],
    });
    
    const { getByText, getByTitle } = render(<Sidebar />);
    
    await waitFor(() => {
      expect(getByText('Apotek Sumber Waras')).toBeInTheDocument();
    });
  });

  test('renders system settings expandable menu for regular user', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ module: 'System Settings', show: true }],
    });
    
    const { getByText, getByTitle, getByRole } = render(<Sidebar />);
    
    await waitFor(() => {
      expect(getByText('Apotek Sumber Waras')).toBeInTheDocument();
    });
  });

  test('handles fetch error', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch error'));
    
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  test('handles invalid user JSON', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', 'invalid-json');
    
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
