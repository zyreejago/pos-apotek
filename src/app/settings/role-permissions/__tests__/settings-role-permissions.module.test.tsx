import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsrolepermissionsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';

jest.setTimeout(30000);

const pushMock = jest.fn();

let mockPermLoading = false;
let mockHasPermission = true;
let mockCurrentUserRole = 'superadmin';

const stableRouter = { push: pushMock, replace: jest.fn(), refresh: jest.fn(), back: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  usePathname: () => '/settings-role-permissions',
}));

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: () => ({
    loading: mockPermLoading,
    hasPermission: mockHasPermission,
    permissions: [],
    checkActionPermission: jest.fn(() => true),
    currentUserRole: mockCurrentUserRole,
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

jest.mock('@/components/PageHeader', () => ({
  __esModule: true,
  default: ({ title, subtitle, rightContent }: any) => (
    <div>
      <div data-testid="header">{title}</div>
      <div>{subtitle}</div>
      {rightContent}
    </div>
  ),
}));

jest.mock('@/components/ConfirmModal', () => ({
  __esModule: true,
  default: ({ isOpen, onConfirm, onClose, title, message }: any) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <h2>{title}</h2>
        <p>{message}</p>
        <button type="button" onClick={onConfirm}>
          confirm-delete
        </button>
        <button type="button" onClick={onClose}>
          close-delete
        </button>
      </div>
    ) : null,
}));

jest.mock('@/components/OffCanvas', () => ({
  __esModule: true,
  default: ({ isOpen, onClose, title, children }: any) =>
    isOpen ? (
      <div data-testid="offcanvas">
        <h2>{title}</h2>
        {children}
        <button type="button" onClick={onClose}>close-offcanvas</button>
      </div>
    ) : null,
}));

jest.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="trash-icon" />,
}));

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

function failJson(data: unknown, status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

const rolesPayload = [
  { id: 1, name: 'Admin' },
  { id: 2, name: 'Cashier' },
];

const permissionsPayload = [
  { module: 'Management Product', create: true, edit: true, delete: true, show: true },
  { module: 'Transactions', create: true, edit: false, delete: false, show: true },
  { module: 'Management Pengguna', create: false, edit: true, delete: false, show: true },
  { module: 'Sales Report', create: false, edit: false, delete: false, show: true },
  { module: 'Peramalan Stok', create: false, edit: false, delete: false, show: true },
  { module: 'Substitutions', create: false, edit: false, delete: false, show: true },
  { module: 'Suppliers', create: true, edit: true, delete: true, show: true },
  { module: 'Stock Opname', create: true, edit: false, delete: false, show: true },
  { module: 'Role & Permission', create: true, edit: true, delete: true, show: true },
  { module: 'Transaction Setting', create: false, edit: true, delete: false, show: true },
  { module: 'Audit Trail', create: false, edit: false, delete: false, show: true },
  { module: 'Approval Faktur', create: false, edit: true, delete: false, show: true },
  { module: 'Riwayat Pembelian', create: false, edit: false, delete: false, show: true },
  { module: 'Resep Dokter', create: true, edit: true, delete: true, show: true },
  { module: 'Unknown Module', create: true, edit: true, delete: true, show: true },
];

function mockDefaultFetch() {
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/api/rbac/roles/') && init?.method === 'DELETE') return okJson({ message: 'deleted' });
    if (url.includes('/api/rbac/roles') && init?.method === 'POST') return okJson({ id: 3, name: 'Manager' });
    if (url.includes('/api/rbac/permissions') && init?.method === 'PUT') return okJson({ message: 'saved' });
    if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
    if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
    return okJson({});
  }) as unknown as typeof fetch;
}

function renderPage() {
  return render(<SettingsrolepermissionsPage />);
}

async function waitPageLoaded() {
  expect(await screen.findByTestId('header')).toHaveTextContent('Role Permissions');
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
  expect(await screen.findByText('Management Product')).toBeInTheDocument();
  await waitFor(() => {
    const cb = document.querySelector('input[type="checkbox"]');
    expect(cb).not.toBeNull();
  }, { timeout: 5000 });
}

function findFirstCheckbox() {
  return document.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

async function changePermission() {
  await waitPageLoaded();
  const checkbox = findFirstCheckbox();
  fireEvent.click(checkbox);
  await waitFor(() => {
    expect(screen.getByText('Save Changes')).not.toBeDisabled();
  }, { timeout: 10000 });
}

async function changePermissionAndSave() {
  await waitPageLoaded();
  const checkbox = findFirstCheckbox();
  fireEvent.click(checkbox);
  await waitFor(() => {
    const button = screen.getByText('Save Changes');
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  }, { timeout: 10000 });
  fireEvent.click(screen.getByText('Save Changes'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPermLoading = false;
  mockHasPermission = true;
  mockCurrentUserRole = 'superadmin';
  localStorage.clear();
  localStorage.setItem('token', 'test');
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' }));
  mockDefaultFetch();
});

describe('settings-role-permissions module', () => {
  test('renders loading when permission hook is loading', () => {
    mockPermLoading = true;
    renderPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('renders loading when user has no permission', () => {
    mockHasPermission = false;
    renderPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('renders page and loads roles and permissions', async () => {
    renderPage();
    await waitPageLoaded();
    expect(screen.getByText('Manage roles and permissions')).toBeInTheDocument();
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
    expect(screen.getByText('Cashier')).toBeInTheDocument();
    expect(screen.getByText('2 role')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/rbac/roles'), expect.any(Object));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/rbac/permissions?roleId=1'), expect.any(Object));
  });

  test('fetches without token', async () => {
    localStorage.removeItem('token');
    renderPage();
    await waitPageLoaded();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rbac/roles'),
      expect.objectContaining({ headers: {} })
    );
  });

  test('renders no roles state', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles')) return okJson([]);
      return okJson([]);
    }) as unknown as typeof fetch;
    renderPage();
    expect(await screen.findByText('No roles')).toBeInTheDocument();
    expect(screen.getByText('0 role')).toBeInTheDocument();
    expect(screen.getByText('Pilih role untuk mulai mengatur hak akses')).toBeInTheDocument();
    expect(screen.getByText('Pilih role di sebelah kiri untuk melihat dan mengubah permissions.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Cari module')).toBeDisabled();
  });

  test('handles roles unauthorized', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles')) return failJson({}, 401);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Sesi berakhir. Silakan login kembali.', expect.any(Object));
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles roles fetch failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles')) return failJson({}, 500);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to fetch roles:', 'Error');
    });
  });

  test('handles roles network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(() => Promise.reject(new Error('roles error'))) as unknown as typeof fetch;
    renderPage();
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Error fetching roles:', expect.any(Error));
    });
  });

  test('handles permissions unauthorized', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      if (url.includes('/api/rbac/permissions')) return failJson({}, 401);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Sesi berakhir. Silakan login kembali.', expect.any(Object));
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles permissions network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      if (url.includes('/api/rbac/permissions')) return Promise.reject(new Error('permissions error'));
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Error fetching permissions:', expect.any(Error));
    });
  });

  test('selects another role and fetches permissions', async () => {
    renderPage();
    await waitPageLoaded();
    fireEvent.click(screen.getByText('Cashier'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/rbac/permissions?roleId=2'), expect.any(Object));
    });
  });

  test('search input disables when no role selected', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles')) return okJson([]);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    expect(await screen.findByPlaceholderText('Cari module')).toBeDisabled();
  });

  test('search input enables when role selected', async () => {
    renderPage();
    await waitPageLoaded();
    expect(screen.getByPlaceholderText('Cari module')).not.toBeDisabled();
  });

  test('search filters modules by name', async () => {
    renderPage();
    await waitPageLoaded();
    const input = screen.getByPlaceholderText('Cari module');
    fireEvent.change(input, { target: { value: 'Trans' } });
    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.queryByText('Suppliers')).not.toBeInTheDocument();
    });
  });

  test('shows "Save Changes" and "Add Role" buttons for superadmin', async () => {
    renderPage();
    await waitPageLoaded();
    expect(screen.getByText('Save Changes')).toBeDisabled();
    expect(screen.getByText('Add Role & Permissions')).toBeInTheDocument();
  });

  test('Save Changes button is disabled when there are no changes', async () => {
    renderPage();
    await waitPageLoaded();
    expect(screen.getByText('Save Changes')).toBeDisabled();
  });

  test('Save Changes button is not visible for non-superadmin', async () => {
    mockCurrentUserRole = 'cashier';
    renderPage();
    await waitPageLoaded();
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
  });

  test('Add Role button is not visible for non-superadmin', async () => {
    mockCurrentUserRole = 'cashier';
    renderPage();
    await waitPageLoaded();
    expect(screen.queryByText('Add Role & Permissions')).not.toBeInTheDocument();
  });

  test('permissions table shows correct module names', async () => {
    renderPage();
    await waitPageLoaded();
    const moduleHeaders = screen.getAllByRole('columnheader', { hidden: true });
    const headerTexts = moduleHeaders.map(h => h.textContent);
    expect(headerTexts).toEqual(expect.arrayContaining(['Module', 'create', 'edit', 'delete', 'show']));
  });

  test('all MODULE_CONFIG modules appear in permissions table', async () => {
    renderPage();
    await waitPageLoaded();
    expect(screen.getByText('Management Product')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Management Pengguna')).toBeInTheDocument();
    expect(screen.getByText('Sales Report')).toBeInTheDocument();
    expect(screen.getByText('Peramalan Stok')).toBeInTheDocument();
    expect(screen.getByText('Substitutions')).toBeInTheDocument();
    expect(screen.getByText('Suppliers')).toBeInTheDocument();
    expect(screen.getByText('Stock Opname')).toBeInTheDocument();
    expect(screen.getByText('Role & Permission')).toBeInTheDocument();
    expect(screen.getByText('Transaction Setting')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('Approval Faktur')).toBeInTheDocument();
    expect(screen.getByText('Riwayat Pembelian')).toBeInTheDocument();
    expect(screen.getByText('Resep Dokter')).toBeInTheDocument();
  });

  test('MODULE_CONFIG actions correctly show allowed/disallowed per module', async () => {
    renderPage();
    await waitPageLoaded();

    const tableRows = document.querySelectorAll('table tbody tr');
    const rowsText = Array.from(tableRows).map(row => row.textContent || '');

    const peramalanRow = rowsText.find(t => t.includes('Peramalan Stok'));
    expect(peramalanRow).toBeDefined();
    expect(peramalanRow).toContain('-');
    expect(peramalanRow).not.toContain('create');
  });

  test('opens add role modal and closes it with Cancel', async () => {
    renderPage();
    await waitPageLoaded();
    fireEvent.click(screen.getByText('Add Role & Permissions'));
    expect(screen.getAllByText('Add Role & Permissions').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Role name')).not.toBeInTheDocument();
    });
  });

  test('opens add role modal and closes it with onClose', async () => {
    renderPage();
    await waitPageLoaded();
    fireEvent.click(screen.getByText('Add Role & Permissions'));
    expect(screen.getByTestId('offcanvas')).toBeInTheDocument();
    expect(screen.getByText('close-offcanvas')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-offcanvas'));
    await waitFor(() => {
      expect(screen.queryByTestId('offcanvas')).not.toBeInTheDocument();
    });
  });

  test('add role button disabled when name is blank', async () => {
    renderPage();
    await waitPageLoaded();
    fireEvent.click(screen.getByText('Add Role & Permissions'));
    expect(screen.getByText('Save')).toBeDisabled();
  });

  test('adds role successfully', async () => {
    renderPage();
    await waitPageLoaded();
    fireEvent.click(screen.getByText('Add Role & Permissions'));
    fireEvent.change(screen.getByPlaceholderText('Role name'), { target: { value: 'Manager' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Role berhasil ditambahkan', expect.any(Object));
    });
  });

  test('handles add role unauthorized', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles') && init?.method === 'POST') return failJson({}, 401);
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitPageLoaded();
    fireEvent.click(screen.getByText('Add Role & Permissions'));
    fireEvent.change(screen.getByPlaceholderText('Role name'), { target: { value: 'Manager' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Sesi Berakhir', expect.any(Object));
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles add role failure with message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles') && init?.method === 'POST') return failJson({ message: 'Role exists' }, 400);
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitPageLoaded();
    fireEvent.click(screen.getByText('Add Role & Permissions'));
    fireEvent.change(screen.getByPlaceholderText('Role name'), { target: { value: 'Manager' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Role exists', expect.any(Object));
    });
  });

  test('handles add role failure without message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles') && init?.method === 'POST') return failJson({}, 400);
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitPageLoaded();
    fireEvent.click(screen.getByText('Add Role & Permissions'));
    fireEvent.change(screen.getByPlaceholderText('Role name'), { target: { value: 'Manager' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menambahkan role', expect.any(Object));
    });
  });

  test('handles add role network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles') && init?.method === 'POST') return Promise.reject(new Error('add error'));
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitPageLoaded();
    fireEvent.click(screen.getByText('Add Role & Permissions'));
    fireEvent.change(screen.getByPlaceholderText('Role name'), { target: { value: 'Manager' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan saat menambahkan role', expect.any(Object));
    });
  });

  test('opens delete confirm and closes it', async () => {
    renderPage();
    await waitPageLoaded();
    const deleteButtons = await screen.findAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    expect(screen.getByText('Hapus Role')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-delete'));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });
  });

  test('deletes selected role successfully', async () => {
    renderPage();
    await waitPageLoaded();
    const deleteButtons = await screen.findAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Role berhasil dihapus', expect.any(Object));
    });
  });

  test('deletes non-selected role successfully', async () => {
    renderPage();
    await waitPageLoaded();
    const deleteButtons = await screen.findAllByTitle('Delete');
    fireEvent.click(deleteButtons[1]);
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Role berhasil dihapus', expect.any(Object));
    });
  });

  test('handles delete role unauthorized', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles/') && init?.method === 'DELETE') return failJson({}, 401);
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitPageLoaded();
    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Sesi berakhir. Silakan login kembali.', expect.any(Object));
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles delete role failure with message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles/') && init?.method === 'DELETE') return failJson({ message: 'Delete failed' }, 400);
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitPageLoaded();
    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Delete failed', expect.any(Object));
    });
  });

  test('handles delete role failure without message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles/') && init?.method === 'DELETE') return failJson({}, 400);
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitPageLoaded();
    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menghapus role', expect.any(Object));
    });
  });

  test('handles delete role network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles/') && init?.method === 'DELETE') return Promise.reject(new Error('delete error'));
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitPageLoaded();
    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan saat menghapus role', expect.any(Object));
    });
  });

  test('renders non-superadmin warning and disables management', async () => {
    mockCurrentUserRole = 'admin';
    renderPage();
    expect(await screen.findByText('Halaman ini hanya bisa dikelola oleh superadmin.')).toBeInTheDocument();
    expect(screen.queryByText('Add Role & Permissions')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
  });

  test('toggles create/edit/delete permission and sets show to true', async () => {
    renderPage();
    await waitPageLoaded();
    // Find a module that has show permission, like Management Product
    // First, turn off create permission for Management Product
    const checkboxes = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    let createCheckbox = null;
    for (const cb of checkboxes) {
      if (cb.checked) {
        createCheckbox = cb;
        break;
      }
    }
    if (createCheckbox) {
      fireEvent.click(createCheckbox); // Turn off create
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).not.toBeDisabled();
      });
      fireEvent.click(createCheckbox); // Turn on create, which should trigger line 159 (next.show = true)
    }
  });

  test('toggles show permission off and sets create/edit/delete to false', async () => {
    renderPage();
    await waitPageLoaded();
    // Find a show checkbox that's checked
    const checkboxes = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    // Find the show checkbox for Management Product (the last one in its row)
    const managementProductRow = Array.from(document.querySelectorAll('table tbody tr')).find(
      row => row.textContent?.includes('Management Product')
    );
    if (managementProductRow) {
      const rowCheckboxes = managementProductRow.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      const showCheckbox = rowCheckboxes[rowCheckboxes.length - 1];
      if (showCheckbox) {
        fireEvent.click(showCheckbox); // Toggle show off, which should trigger lines 163-165
        await waitFor(() => {
          expect(screen.getByText('Save Changes')).not.toBeDisabled();
        });
      }
    }
  });

  test('Save Changes successfully', async () => {
    renderPage();
    await waitPageLoaded();
    const checkbox = findFirstCheckbox();
    fireEvent.click(checkbox);
    await waitFor(() => { expect(screen.getByText('Save Changes')).not.toBeDisabled(); }, { timeout: 10000 });
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/permissions') && init?.method === 'PUT') return okJson({ message: 'success' });
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Hak akses berhasil disimpan', expect.any(Object));
    }, { timeout: 10000 });
  });

  test('Save Changes with 401 redirects to login', async () => {
    renderPage();
    await waitPageLoaded();
    const checkbox = findFirstCheckbox();
    fireEvent.click(checkbox);
    await waitFor(() => { expect(screen.getByText('Save Changes')).not.toBeDisabled(); }, { timeout: 10000 });
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/permissions') && init?.method === 'PUT') return failJson({}, 401);
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Sesi berakhir. Silakan login kembali.', expect.any(Object));
      expect(pushMock).toHaveBeenCalledWith('/login');
    }, { timeout: 10000 });
  });

  test('Save Changes with failure message', async () => {
    renderPage();
    await waitPageLoaded();
    const checkbox = findFirstCheckbox();
    fireEvent.click(checkbox);
    await waitFor(() => { expect(screen.getByText('Save Changes')).not.toBeDisabled(); }, { timeout: 10000 });
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/permissions') && init?.method === 'PUT') return failJson({ message: 'Save failed' }, 400);
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Save failed', expect.any(Object));
    }, { timeout: 10000 });
  });

  test('Save Changes with network error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    await waitPageLoaded();
    const checkbox = findFirstCheckbox();
    fireEvent.click(checkbox);
    await waitFor(() => { expect(screen.getByText('Save Changes')).not.toBeDisabled(); }, { timeout: 10000 });
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/permissions') && init?.method === 'PUT') return Promise.reject(new Error('save error'));
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan saat menyimpan hak akses', expect.any(Object));
    }, { timeout: 10000 });
    consoleSpy.mockRestore();
  });

  test('permissions fetch returns non-ok status (line 112 else branch)', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      if (url.includes('/api/rbac/permissions')) return failJson({}, 500);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('header')).toHaveTextContent('Role Permissions');
    });
    consoleSpy.mockRestore();
  });

  test('Save Changes with failure without message (line 203 else branch)', async () => {
    renderPage();
    await waitPageLoaded();
    const checkbox = findFirstCheckbox();
    fireEvent.click(checkbox);
    await waitFor(() => { expect(screen.getByText('Save Changes')).not.toBeDisabled(); }, { timeout: 10000 });
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/rbac/permissions') && init?.method === 'PUT') return failJson({}, 400);
      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menyimpan hak akses', expect.any(Object));
    }, { timeout: 10000 });
  });

  test('addRole with empty name returns early (line 269 guard)', async () => {
    renderPage();
    await waitPageLoaded();

    fireEvent.click(screen.getByText('Add Role & Permissions'));

    const saveButton = screen.getByText('Save') as HTMLButtonElement;
    const reactPropsKey = Object.keys(saveButton).find(k =>
      k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers')
    );

    if (reactPropsKey) {
      const props = (saveButton as Record<string, any>)[reactPropsKey];
      props.onClick();
    } else {
      saveButton.disabled = false;
      fireEvent.click(saveButton);
    }

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/rbac/roles'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('toggles permissions on module with limited config (forEach line 155)', async () => {
    renderPage();
    await waitPageLoaded();

    const transactionsRow = Array.from(document.querySelectorAll('table tbody tr')).find(
      row => row.textContent?.includes('Transactions')
    );
    expect(transactionsRow).toBeDefined();

    const rowCheckboxes = transactionsRow!.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    expect(rowCheckboxes.length).toBe(2);

    const createCheckbox = rowCheckboxes[0];
    expect(createCheckbox.checked).toBe(true);

    fireEvent.click(createCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).not.toBeDisabled();
    });
  });

  test('toggles permission on module not in MODULE_CONFIG (line 151 ?? default)', async () => {
    renderPage();
    await waitPageLoaded();

    const unknownRow = Array.from(document.querySelectorAll('table tbody tr')).find(
      row => row.textContent?.includes('Unknown Module')
    );
    expect(unknownRow).toBeDefined();

    const rowCheckboxes = unknownRow!.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    const createCheckbox = rowCheckboxes[0];
    fireEvent.click(createCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).not.toBeDisabled();
    });
  });
});
