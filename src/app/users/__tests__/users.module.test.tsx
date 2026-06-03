import React from 'react';
import { render, waitFor, fireEvent, screen, act } from '@testing-library/react';
import UsersPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';

jest.setTimeout(30000);

const pushMock = jest.fn();
const mockCheckPermission = jest.fn((action?: string) => true);

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/users',
}));

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: () => ({
    loading: false,
    hasPermission: true,
    permissions: [],
    checkActionPermission: mockCheckPermission,
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

jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: ({ title, rightContent }: any) => (
    <div>
      <div data-testid="header">{title}</div>
      {rightContent}
    </div>
  ),
}));

jest.mock('@/components/ConfirmModal', () => ({
  __esModule: true,
  default: ({ isOpen, onConfirm, onClose, title }: any) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <span>{title}</span>
        <button type="button" onClick={onConfirm}>
          confirm-delete
        </button>
        <button type="button" onClick={onClose}>
          close-delete
        </button>
      </div>
    ) : null,
}));

jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon" />,
  Filter: () => <span data-testid="filter-icon" />,
  Plus: () => <span data-testid="plus-icon" />,
  Edit: () => <span data-testid="edit-icon" />,
  X: () => <span data-testid="x-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
}));

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

function failJson(data: unknown, status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

const usersPayload = {
  data: [
    {
      id: 2,
      username: 'john',
      email: 'john@test.com',
      role: 'Admin',
      created_at: '2026-01-01',
      status: 'active',
    },
    {
      id: 3,
      username: 'doe',
      email: 'doe@test.com',
      role: 'Cashier',
      created_at: '2026-01-01',
      status: 'inactive',
    },
  ],
  pagination: {
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
  },
};

function renderUsersPage() {
  return render(<UsersPage />);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockCheckPermission.mockImplementation(() => true);

  localStorage.clear();
  localStorage.setItem('token', 'test');
  localStorage.setItem(
    'user',
    JSON.stringify({
      id: 1,
      username: 'admin',
      role: 'superadmin',
      email: 'admin@test.com',
    })
  );

  global.fetch = jest.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/rbac/roles')) {
      return okJson([
        { id: 1, name: 'Admin' },
        { id: 2, name: 'Cashier' },
      ]);
    }

    if (url.includes('/api/users')) {
      return okJson(usersPayload);
    }

    return okJson({});
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('users module', () => {
  test('renders users page', async () => {
    renderUsersPage();

    expect(await screen.findByTestId('header')).toBeInTheDocument();
    expect(screen.getByText('Manage Pengguna')).toBeInTheDocument();
  });

  test('fetches users and roles on load', async () => {
    renderUsersPage();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users'),
        expect.any(Object)
      );
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rbac/roles'),
      expect.any(Object)
    );
  });

  test('renders users data', async () => {
    renderUsersPage();

    expect(await screen.findByText('john')).toBeInTheDocument();
    expect(screen.getByText('doe')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
    expect(screen.getByText('doe@test.com')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('JO')).toBeInTheDocument();
    expect(screen.getByText('DO')).toBeInTheDocument();
  });

  test('renders no users found state', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([]);

      if (url.includes('/api/users')) {
        return okJson({
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 1,
          },
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    expect(await screen.findByText('No users found.')).toBeInTheDocument();
    expect(screen.getByText('Menampilkan 0 pengguna')).toBeInTheDocument();
  });

  test('handles search query debounce', async () => {
  renderUsersPage();

  const searchInput = await screen.findByPlaceholderText('Cari pengguna...');

  fireEvent.change(searchInput, {
    target: { value: 'john' },
  });

  await waitFor(
    () => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=john'),
        expect.any(Object)
      );
    },
    { timeout: 1500 }
  );
});

  test('changes items per page', async () => {
    renderUsersPage();

    const select = await screen.findByDisplayValue('10');

    fireEvent.change(select, {
      target: { value: '20' },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
    });
  });

  test('opens add modal', async () => {
    renderUsersPage();

    fireEvent.click(await screen.findByText('Add Pengguna'));

    expect(screen.getByText('Add User')).toBeInTheDocument();
  });

  test('closes modal', async () => {
    renderUsersPage();

    fireEvent.click(await screen.findByText('Add Pengguna'));
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Add User')).not.toBeInTheDocument();
    });
  });

  test('opens edit modal', async () => {
    renderUsersPage();

    const editButtons = await screen.findAllByTitle('Edit User');

    fireEvent.click(editButtons[0]);

    expect(screen.getByText('Edit User')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john')).toBeInTheDocument();
  });

  test('renders fallback Cashier role option when roles are empty', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([]);
      if (url.includes('/api/users')) return okJson(usersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    fireEvent.click(await screen.findByText('Add Pengguna'));

    expect(screen.getByDisplayValue('Cashier')).toBeInTheDocument();
  });

  test('changes form fields in add modal', async () => {
    renderUsersPage();

    fireEvent.click(await screen.findByText('Add Pengguna'));

    fireEvent.change(screen.getByPlaceholderText('Enter username'), {
      target: { value: 'newuser' },
    });

    fireEvent.change(screen.getByPlaceholderText('Enter email'), {
      target: { value: 'new@test.com' },
    });

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: '123456' },
    });

    fireEvent.change(screen.getByDisplayValue('Cashier'), {
      target: { value: 'Admin' },
    });

    fireEvent.change(screen.getByDisplayValue('Active'), {
      target: { value: 'inactive' },
    });

    expect(screen.getByDisplayValue('newuser')).toBeInTheDocument();
    expect(screen.getByDisplayValue('new@test.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123456')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Admin')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Inactive')).toBeInTheDocument();
  });

  test('submits add user successfully', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([{ id: 1, name: 'Admin' }]);

      if (url.endsWith('/api/users') && init?.method === 'POST') {
        return okJson({ message: 'success' });
      }

      if (url.includes('/api/users')) return okJson(usersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    fireEvent.click(await screen.findByText('Add Pengguna'));

    fireEvent.change(screen.getByPlaceholderText('Enter username'), {
      target: { value: 'newuser' },
    });

    fireEvent.change(screen.getByPlaceholderText('Enter email'), {
      target: { value: 'new@test.com' },
    });

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: '123456' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Pengguna Berhasil Ditambahkan',
        expect.any(Object)
      );
    });
  });

  test('handles save user failure', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([{ id: 1, name: 'Admin' }]);

      if (url.endsWith('/api/users') && init?.method === 'POST') {
        return failJson({ message: 'save failed' }, 400);
      }

      if (url.includes('/api/users')) return okJson(usersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    fireEvent.click(await screen.findByText('Add Pengguna'));

    fireEvent.change(screen.getByPlaceholderText('Enter username'), {
      target: { value: 'newuser' },
    });

    fireEvent.change(screen.getByPlaceholderText('Enter email'), {
      target: { value: 'new@test.com' },
    });

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: '123456' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Menyimpan Pengguna',
        expect.any(Object)
      );
    });
  });

  test('handles save user network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([{ id: 1, name: 'Admin' }]);

      if (url.endsWith('/api/users') && init?.method === 'POST') {
        return Promise.reject(new Error('save network'));
      }

      if (url.includes('/api/users')) return okJson(usersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    fireEvent.click(await screen.findByText('Add Pengguna'));

    fireEvent.change(screen.getByPlaceholderText('Enter username'), {
      target: { value: 'newuser' },
    });

    fireEvent.change(screen.getByPlaceholderText('Enter email'), {
      target: { value: 'new@test.com' },
    });

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: '123456' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Terjadi Kesalahan',
        expect.any(Object)
      );
    });
  });

  test('submits edit user successfully without password', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([{ id: 1, name: 'Admin' }]);

      if (url.includes('/api/users/2') && init?.method === 'PUT') {
        return okJson({ message: 'updated' });
      }

      if (url.includes('/api/users')) return okJson(usersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    const editButtons = await screen.findAllByTitle('Edit User');

    fireEvent.click(editButtons[0]);

    fireEvent.change(screen.getByPlaceholderText('Enter email'), {
      target: { value: 'john-updated@test.com' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Pengguna Berhasil Diperbarui',
        expect.any(Object)
      );
    });
  });

  test('submits edit user successfully with password', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([{ id: 1, name: 'Admin' }]);

      if (url.includes('/api/users/2') && init?.method === 'PUT') {
        return okJson({ message: 'updated' });
      }

      if (url.includes('/api/users')) return okJson(usersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    const editButtons = await screen.findAllByTitle('Edit User');

    fireEvent.click(editButtons[0]);

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'new-password' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalled();
    });
  });

  test('opens delete modal', async () => {
    renderUsersPage();

    const deleteButtons = await screen.findAllByTitle('Delete User');

    fireEvent.click(deleteButtons[0]);

    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
  });

  test('closes delete modal', async () => {
    renderUsersPage();

    const deleteButtons = await screen.findAllByTitle('Delete User');

    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('close-delete'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });
  });

  test('deletes user successfully', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([]);

      if (init?.method === 'DELETE') {
        return okJson({ success: true });
      }

      if (url.includes('/api/users')) return okJson(usersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    const deleteButtons = await screen.findAllByTitle('Delete User');

    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Pengguna Berhasil Dihapus',
        expect.any(Object)
      );
    });
  });

  test('handles delete failure', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([]);

      if (init?.method === 'DELETE') {
        return failJson({ message: 'delete failed' }, 400);
      }

      if (url.includes('/api/users')) return okJson(usersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    const deleteButtons = await screen.findAllByTitle('Delete User');

    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Menghapus Pengguna',
        expect.any(Object)
      );
    });
  });

  test('handles delete network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([]);

      if (init?.method === 'DELETE') {
        return Promise.reject(new Error('delete network'));
      }

      if (url.includes('/api/users')) return okJson(usersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    const deleteButtons = await screen.findAllByTitle('Delete User');

    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Terjadi Kesalahan',
        expect.any(Object)
      );
    });
  });

  test('handles invalid current user localStorage', async () => {
    localStorage.setItem('user', '{bad-json');

    renderUsersPage();

    expect(await screen.findByText('john')).toBeInTheDocument();
  });

  test('fetches without token', async () => {
    localStorage.removeItem('token');

    renderUsersPage();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users'),
        expect.objectContaining({
          headers: {},
        })
      );
    });
  });

  test('handles unauthorized users fetch', async () => {
    global.fetch = jest.fn(() => failJson({}, 401)) as unknown as typeof fetch;

    renderUsersPage();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles forbidden users fetch', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([]);

      if (url.includes('/api/users')) return failJson({}, 403);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });
  });

  test('handles fetch users network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() =>
      Promise.reject(new Error('network'))
    ) as unknown as typeof fetch;

    renderUsersPage();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalled();
    });
  });

  test('handles fetch roles network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) {
        return Promise.reject(new Error('roles error'));
      }

      if (url.includes('/api/users')) return okJson(usersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalled();
    });
  });

  test('handles create permission denied after modal opened', async () => {
  mockCheckPermission.mockImplementation(() => true);

  renderUsersPage();

  fireEvent.click(await screen.findByText('Add Pengguna'));

  fireEvent.change(screen.getByPlaceholderText('Enter username'), {
    target: { value: 'newuser' },
  });

  fireEvent.change(screen.getByPlaceholderText('Enter email'), {
    target: { value: 'new@test.com' },
  });

  fireEvent.change(screen.getByPlaceholderText('Enter password'), {
    target: { value: '123456' },
  });

  mockCheckPermission.mockImplementation((action?: string) => {
    if (action === 'create') return false;
    return true;
  });

  fireEvent.click(screen.getByText('Save'));

  await waitFor(() => {
    expect(goeyToast.error).toHaveBeenCalledWith(
      'Akses Ditolak',
      expect.any(Object)
    );
  });
});

  test('handles edit permission denied after modal opened', async () => {
    renderUsersPage();

    const editButtons = await screen.findAllByTitle('Edit User');

    fireEvent.click(editButtons[0]);

    mockCheckPermission.mockImplementation((action?: string) => {
      if (action === 'edit') return false;
      return true;
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });
  });

  test('handles delete permission denied after modal opened', async () => {
    renderUsersPage();

    const deleteButtons = await screen.findAllByTitle('Delete User');

    fireEvent.click(deleteButtons[0]);

    mockCheckPermission.mockImplementation((action?: string) => {
      if (action === 'delete') return false;
      return true;
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });
  });

  test('hides create button when create permission is false', async () => {
    mockCheckPermission.mockImplementation((action?: string) => action !== 'create');

    renderUsersPage();

    expect(await screen.findByTestId('header')).toBeInTheDocument();
    expect(screen.queryByText('Add Pengguna')).not.toBeInTheDocument();
  });

  test('hides edit button when edit permission is false', async () => {
    mockCheckPermission.mockImplementation((action?: string) => action !== 'edit');

    renderUsersPage();

    expect(await screen.findByText('john')).toBeInTheDocument();
    expect(screen.queryByTitle('Edit User')).not.toBeInTheDocument();
  });

  test('hides delete button when delete permission is false', async () => {
    mockCheckPermission.mockImplementation((action?: string) => action !== 'delete');

    renderUsersPage();

    expect(await screen.findByText('john')).toBeInTheDocument();
    expect(screen.queryByTitle('Delete User')).not.toBeInTheDocument();
  });

  test('renders default active status and unknown initials fallback', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson([]);

      if (url.includes('/api/users')) {
        return okJson({
          data: [
            {
              id: 4,
              username: '',
              email: 'empty@test.com',
              role: 'Cashier',
              created_at: '2026',
            },
          ],
          pagination: {
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
          },
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderUsersPage();

    expect(await screen.findByText('??')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});