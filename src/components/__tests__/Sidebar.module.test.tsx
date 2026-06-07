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

jest.mock('@/context/SidebarContext', () => ({
  useSidebar: () => ({
    isCollapsed: false,
    toggleSidebar: jest.fn(),
    setIsCollapsed: jest.fn(),
    userCollapsedState: false,
    setUserCollapsedState: jest.fn(),
  }),
}));

jest.mock('@/context/OffCanvasContext', () => ({
  useOffCanvas: () => ({
    isAnyOffCanvasOpen: false,
  }),
}));

function mockFetchResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockFetchResponse(data, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => JSON.stringify(data),
  } as Response;
}

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
    mockUsePathname.mockReturnValue('/dashboard');
    localStorage.clear();
    global.fetch = jest.fn();
  });

  describe('auth page rendering', () => {
    test('returns null on login page', () => {
      mockUsePathname.mockReturnValue('/login');
      const { container } = render(<Sidebar />);
      expect(container.firstChild).toBeNull();
    });

    test('returns null on register page', () => {
      mockUsePathname.mockReturnValue('/register');
      const { container } = render(<Sidebar />);
      expect(container.firstChild).toBeNull();
    });

    test('returns null on forgot-password page', () => {
      mockUsePathname.mockReturnValue('/forgot-password');
      const { container } = render(<Sidebar />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('superadmin rendering', () => {
    test('renders all menu items for superadmin', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));

      const { getByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('Dashboards')).toBeInTheDocument();
      });

      expect(getByText('Products')).toBeInTheDocument();
      expect(getByText('Stock Opname')).toBeInTheDocument();
      expect(getByText('Suppliers')).toBeInTheDocument();
      expect(getByText('Resep Dokter')).toBeInTheDocument();
      expect(getByText('Transactions')).toBeInTheDocument();
      expect(getByText('Riwayat Pembelian')).toBeInTheDocument();
      expect(getByText('Approval Faktur')).toBeInTheDocument();
      expect(getByText('Management Pengguna')).toBeInTheDocument();
      expect(getByText('Sales Report')).toBeInTheDocument();
      expect(getByText('Peramalan Stok')).toBeInTheDocument();
      expect(getByText('Audit Trail')).toBeInTheDocument();
      expect(getByText('System Settings')).toBeInTheDocument();
    });
  });

  describe('permission-based rendering', () => {
    test('shows only permitted modules for regular user with limited permissions', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Management Product', create: true, edit: true, delete: false, show: true },
        { module: 'Transactions', create: true, edit: false, delete: false, show: true },
      ]));

      const { getByText, queryByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('Dashboards')).toBeInTheDocument();
      });

      expect(getByText('Products')).toBeInTheDocument();
      expect(getByText('Transactions')).toBeInTheDocument();
      expect(queryByText('Stock Opname')).not.toBeInTheDocument();
      expect(queryByText('Suppliers')).not.toBeInTheDocument();
      expect(queryByText('Management Pengguna')).not.toBeInTheDocument();
    });

    test('shows Products when user has Management Product show permission', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Management Product', create: false, edit: false, delete: false, show: true },
      ]));
      const { getByText, queryByText } = render(<Sidebar />);
      await waitFor(() => {
        expect(getByText('Products')).toBeInTheDocument();
      });
      expect(queryByText('Transactions')).not.toBeInTheDocument();
    });

    test('shows Management Pengguna when permitted', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Management Pengguna', create: false, edit: false, delete: false, show: true },
      ]));
      const { getByText, queryByText } = render(<Sidebar />);
      await waitFor(() => {
        expect(getByText('Management Pengguna')).toBeInTheDocument();
      });
      expect(queryByText('Products')).not.toBeInTheDocument();
    });

    test('shows Sales Report when permitted', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Sales Report', create: false, edit: false, delete: false, show: true },
      ]));
      const { getByText, queryByText } = render(<Sidebar />);
      await waitFor(() => {
        expect(getByText('Sales Report')).toBeInTheDocument();
      });
      expect(queryByText('Products')).not.toBeInTheDocument();
    });

    test('shows Peramalan Stok when permitted', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Peramalan Stok', create: false, edit: false, delete: false, show: true },
      ]));
      const { getByText, queryByText } = render(<Sidebar />);
      await waitFor(() => {
        expect(getByText('Peramalan Stok')).toBeInTheDocument();
      });
      expect(queryByText('Products')).not.toBeInTheDocument();
    });

    test('shows Audit Trail when permitted', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Audit Trail', create: false, edit: false, delete: false, show: true },
      ]));
      const { getByText, queryByText } = render(<Sidebar />);
      await waitFor(() => {
        expect(getByText('Audit Trail')).toBeInTheDocument();
      });
      expect(queryByText('Products')).not.toBeInTheDocument();
    });

    test('shows Approval Faktur when permitted', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Approval Faktur', create: false, edit: false, delete: false, show: true },
      ]));
      const { getByText, queryByText } = render(<Sidebar />);
      await waitFor(() => {
        expect(getByText('Approval Faktur')).toBeInTheDocument();
      });
      expect(queryByText('Products')).not.toBeInTheDocument();
    });

    test('shows Riwayat Pembelian when permitted', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Riwayat Pembelian', create: false, edit: false, delete: false, show: true },
      ]));
      const { getByText, queryByText } = render(<Sidebar />);
      await waitFor(() => {
        expect(getByText('Riwayat Pembelian')).toBeInTheDocument();
      });
      expect(queryByText('Products')).not.toBeInTheDocument();
    });

    test('shows Resep Dokter when permitted', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Resep Dokter', create: false, edit: false, delete: false, show: true },
      ]));
      const { getByText, queryByText } = render(<Sidebar />);
      await waitFor(() => {
        expect(getByText('Resep Dokter')).toBeInTheDocument();
      });
      expect(queryByText('Products')).not.toBeInTheDocument();
    });

    test('shows Retur menu when user has Retur Pembelian permission', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Retur Pembelian', create: false, edit: false, delete: false, show: true },
      ]));

      const { getByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('Retur')).toBeInTheDocument();
        expect(getByText('Retur Pembelian')).toBeInTheDocument();
      });
    });

    test('shows Retur menu when user has Retur Penjualan permission', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Retur Penjualan', create: false, edit: false, delete: false, show: true },
      ]));

      const { getByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('Retur')).toBeInTheDocument();
      });
    });

    test('shows System Settings when user has Role & Permission access', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Role & Permission', create: false, edit: false, delete: false, show: true },
      ]));

      const { getByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('System Settings')).toBeInTheDocument();
        expect(getByText('Role & Permission')).toBeInTheDocument();
      });
    });

    test('shows System Settings when user has Transaction Setting access', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([
        { module: 'Transaction Setting', create: false, edit: false, delete: false, show: true },
      ]));

      const { getByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('System Settings')).toBeInTheDocument();
        expect(getByText('Transaction Setting')).toBeInTheDocument();
      });
    });
  });

  describe('superadmin canShow bypass', () => {
    test('superadmin sees all menu items even with empty permissions (fallback)', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([]));

      const { getByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('Products')).toBeInTheDocument();
      });

      expect(getByText('Stock Opname')).toBeInTheDocument();
      expect(getByText('System Settings')).toBeInTheDocument();
    });

    test('superadmin bypass for Role & Permission shows setting items', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([]));

      const { getByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('Role & Permission')).toBeInTheDocument();
      });
    });

    test('superadmin without permissions still sees everything', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([]));

      const { queryByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(queryByText('Products')).toBeInTheDocument();
      });
    });

    test('non-superadmin with zero permissions sees nothing extra', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([]));

      const { queryByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(queryByText('Products')).not.toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    test('handles 401 from permissions endpoint by redirecting to login', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse({}, 401));

      render(<Sidebar />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    test('handles fetch error gracefully', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = jest.fn().mockRejectedValue(new Error('fetch error'));

      render(<Sidebar />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
      consoleSpy.mockRestore();
    });

    test('handles invalid user JSON in localStorage', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', 'invalid-json');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<Sidebar />);

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      });
      consoleSpy.mockRestore();
    });

    test('handles missing role in user object', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test' }));

      render(<Sidebar />);

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });
  });

  describe('no token or user', () => {
    test('does not fetch permissions when no token', async () => {
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));

      render(<Sidebar />);

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    test('does not fetch permissions when no user', async () => {
      localStorage.setItem('token', 'test-token');

      render(<Sidebar />);

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    test('does not fetch permissions when both missing', async () => {
      render(<Sidebar />);

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });
  });

  describe('event listeners', () => {
    test('handles auth:changed event', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([]));

      render(<Sidebar />);

      window.dispatchEvent(new Event('auth:changed'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    test('handles storage event for token key', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([]));

      render(<Sidebar />);

      window.dispatchEvent(new StorageEvent('storage', { key: 'token' }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    test('handles storage event for user key', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse([]));

      render(<Sidebar />);

      window.dispatchEvent(new StorageEvent('storage', { key: 'user' }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    test('handles auth:changed on auth page gracefully', async () => {
      mockUsePathname.mockReturnValue('/login');
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));

      render(<Sidebar />);

      window.dispatchEvent(new Event('auth:changed'));
    });
  });

  describe('toggle expandable menus', () => {
    test('toggles Returns menu', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));

      const { getByText, queryByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('Retur')).toBeInTheDocument();
      });

      expect(getByText('Retur Pembelian')).toBeInTheDocument();
      expect(getByText('Retur Penjualan')).toBeInTheDocument();

      fireEvent.click(getByText('Retur'));

      await waitFor(() => {
        expect(queryByText('Retur Pembelian')).not.toBeInTheDocument();
      });
    });

    test('toggles Sales Report submenu', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));

      const { getByText, queryByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('Laporan Keuangan')).toBeInTheDocument();
      });

      fireEvent.click(getByText('Sales Report'));

      await waitFor(() => {
        expect(queryByText('Laporan Keuangan')).not.toBeInTheDocument();
      });
    });

    test('toggles System Settings submenu', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));

      const { getByText, queryByText } = render(<Sidebar />);

      await waitFor(() => {
        expect(getByText('Role & Permission')).toBeInTheDocument();
      });

      fireEvent.click(getByText('System Settings'));

      await waitFor(() => {
        expect(queryByText('Role & Permission')).not.toBeInTheDocument();
      });
    });
  });
});
