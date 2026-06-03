import { renderHook, waitFor, act } from '@testing-library/react';
import { useRequirePermission } from '../useRequirePermission';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockUseRouter = jest.requireMock('next/navigation').useRouter;

describe('useRequirePermission', () => {
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
    global.fetch = jest.fn();
  });

  test('redirects to login if no token or user', async () => {
    localStorage.clear();
    renderHook(() => useRequirePermission('products'));
    
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/login');
    });
  });

  test('grants permission to superadmin', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'superadmin', username: 'test' }));
    
    const { result } = renderHook(() => useRequirePermission('products'));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.hasPermission).toBe(true);
      expect(result.current.currentUserRole).toBe('superadmin');
    });
    
    expect(result.current.checkActionPermission('create')).toBe(true);
    expect(result.current.checkActionPermission('edit')).toBe(true);
  });

  test('redirects to login on 401', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
    });
    
    renderHook(() => useRequirePermission('products'));
    
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/login');
    });
  });

  test('grants permission when module has show permission', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    
    const testPermissions = [
      { module: 'products', create: true, edit: true, delete: false, show: true },
    ];
    
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => testPermissions,
    });
    
    const { result } = renderHook(() => useRequirePermission('products'));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.hasPermission).toBe(true);
      expect(result.current.permissions).toEqual(testPermissions);
    });
    
    expect(result.current.checkActionPermission('show')).toBe(true);
    expect(result.current.checkActionPermission('delete')).toBe(false);
  });

  test('redirects to dashboard when no show permission', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    
    const testPermissions = [
      { module: 'products', create: true, edit: true, delete: false, show: false },
    ];
    
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => testPermissions,
    });
    
    renderHook(() => useRequirePermission('products'));
    
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('redirects to dashboard on fetch error', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    
    renderHook(() => useRequirePermission('products'));
    
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('redirects to dashboard when fetch is not ok', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    
    global.fetch = jest.fn().mockResolvedValue({
      status: 500,
      ok: false,
    });
    
    renderHook(() => useRequirePermission('products'));
    
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('checkActionPermission returns false when loading', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    
    let resolveFetch: (value: Response) => void;
    global.fetch = jest.fn(() => new Promise(resolve => {
      resolveFetch = resolve;
    }));
    
    const { result } = renderHook(() => useRequirePermission('products'));
    
    expect(result.current.checkActionPermission('create')).toBe(false);
    
    // Complete the fetch to prevent unhandled promise rejection
    act(() => {
      if (resolveFetch) {
        resolveFetch({
          status: 200,
          ok: true,
          json: async () => [],
        } as Response);
      }
    });
  });

  test('checkActionPermission handles numeric and string permission values', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    
    const testPermissions = [
      { module: 'products', create: 1, edit: '1', delete: 0, show: 'true' },
    ];
    
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => testPermissions,
    });
    
    const { result } = renderHook(() => useRequirePermission('products'));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.checkActionPermission('create')).toBe(true);
    expect(result.current.checkActionPermission('edit')).toBe(true);
    expect(result.current.checkActionPermission('delete')).toBe(false);
  });

  test('checkActionPermission returns false when module not found', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user', username: 'test' }));
    
    const testPermissions = [
      { module: 'dashboard', create: true, edit: true, delete: true, show: true },
    ];
    
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => testPermissions,
    });
    
    const { result } = renderHook(() => useRequirePermission('products'));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.checkActionPermission('show')).toBe(false);
  });
});
