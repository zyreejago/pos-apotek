import { renderHook, waitFor, act } from '@testing-library/react';
import { useRequirePermission } from '../useRequirePermission';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockUseRouter = jest.requireMock('next/navigation').useRouter;

const defaultPermissions = [
  { module: 'products', create: true, edit: true, delete: false, show: true },
];

function createMockResponse(status: number, data: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 401 ? 'Unauthorized' : status === 500 ? 'Server Error' : 'OK',
    json: async () => data,
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => createMockResponse(status, data),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => JSON.stringify(data),
  } as Response;
}

describe('useRequirePermission', () => {
  let push: jest.Mock;

  beforeEach(() => {
    push = jest.fn();
    mockUseRouter.mockReturnValue({ push });
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authentication checks', () => {
    test('redirects to login when no token or user in localStorage', async () => {
      renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/login');
      });
    });

    test('returns loading initially', () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));

      const { result } = renderHook(() => useRequirePermission('products'));

      expect(result.current.loading).toBe(true);
    });
  });

  describe('superadmin bypass', () => {
    test('superadmin bypasses for Role & Permission module without fetch', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));

      const { result } = renderHook(() => useRequirePermission('Role & Permission'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.hasPermission).toBe(true);
      });

      expect(result.current.checkActionPermission('create')).toBe(true);
      expect(result.current.checkActionPermission('edit')).toBe(true);
      expect(result.current.checkActionPermission('delete')).toBe(true);
      expect(result.current.checkActionPermission('show')).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('superadmin bypasses for Transaction Setting module without fetch', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));

      const { result } = renderHook(() => useRequirePermission('Transaction Setting'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.hasPermission).toBe(true);
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('superadmin still fetches for non-critical modules', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(200, defaultPermissions));

      const { result } = renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.hasPermission).toBe(true);
      });

      expect(global.fetch).toHaveBeenCalled();
      expect(result.current.currentUserRole).toBe('superadmin');
    });
  });

  describe('checkActionPermission with superadmin', () => {
    test('checkActionPermission for superadmin with critical module returns true', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));

      const { result } = renderHook(() => useRequirePermission('Role & Permission'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.checkActionPermission('show')).toBe(true);
    });

    test('checkActionPermission for superadmin with empty permissions returns true (fallback)', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(200, []));

      const { result } = renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.checkActionPermission('create')).toBe(true);
      expect(result.current.checkActionPermission('show')).toBe(true);
    });

    test('checkActionPermission for superadmin with existing permissions follows permissions', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'admin' }));
      const perms = [
        { module: 'products', create: false, edit: false, delete: false, show: false },
      ];
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(200, perms));

      const { result } = renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.checkActionPermission('create')).toBe(false);
    });
  });

  describe('fetch response handling', () => {
    test('redirects to login when fetch returns 401', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(401, {}));

      renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/login');
      });

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });

    test('grants permission when module has show permission', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(200, defaultPermissions));

      const { result } = renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.hasPermission).toBe(true);
      });

      expect(result.current.checkActionPermission('show')).toBe(true);
      expect(result.current.checkActionPermission('delete')).toBe(false);
    });

    test('redirects to dashboard when no show permission', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      const noPerm = [{ module: 'products', create: true, edit: true, delete: false, show: false }];
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(200, noPerm));

      renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/dashboard');
      });
    });

    test('redirects to dashboard when fetch returns non-ok status', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(500, {}));

      renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/dashboard');
      });
    });

    test('redirects to dashboard on fetch network error', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/dashboard');
      });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('checkActionPermission behavior', () => {
    test('returns false when still loading', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      let resolveFetch!: (value: Response) => void;
      global.fetch = jest.fn(() => new Promise(resolve => { resolveFetch = resolve; }));

      const { result } = renderHook(() => useRequirePermission('products'));

      expect(result.current.checkActionPermission('create')).toBe(false);

      act(() => { resolveFetch(createMockResponse(200, defaultPermissions)); });
    });

    test('handles numeric and string permission values', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      const perms = [{ module: 'products', create: 1, edit: '1', delete: 0, show: '1' }];
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(200, perms));

      const { result } = renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.checkActionPermission('create')).toBe(true);
      expect(result.current.checkActionPermission('edit')).toBe(true);
      expect(result.current.checkActionPermission('delete')).toBe(false);
      expect(result.current.checkActionPermission('show')).toBe(true);
    });

    test('returns false when module not found in permissions', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      const perms = [{ module: 'other', create: true, edit: true, delete: true, show: true }];
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(200, perms));

      const { result } = renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.checkActionPermission('create')).toBe(false);
    });

    test('returns false when permission exists but action is not set', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
      const perms = [{ module: 'products', create: false, edit: false, delete: false, show: true }];
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(200, perms));

      const { result } = renderHook(() => useRequirePermission('products'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.checkActionPermission('create')).toBe(false);
    });
  });
});
