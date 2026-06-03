import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsrolepermissionsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';

const pushMock = jest.fn();

let mockPermLoading = false;
let mockHasPermission = true;
let mockCurrentUserRole = 'superadmin';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
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

jest.mock('@/components/Header', () => ({
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
  {
    module: 'Management Product',
    create: true,
    edit: true,
    delete: true,
    show: true,
  },
  {
    module: 'Transactions',
    create: true,
    edit: false,
    delete: false,
    show: true,
  },
  {
    module: 'Sales Report',
    create: false,
    edit: false,
    delete: false,
    show: true,
  },
  {
    module: 'Unknown Module',
    create: true,
    edit: true,
    delete: true,
    show: true,
  },
];

function mockDefaultFetch() {
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/rbac/roles/') && init?.method === 'DELETE') {
      return okJson({ message: 'deleted' });
    }

    if (url.includes('/api/rbac/roles') && init?.method === 'POST') {
      return okJson({ id: 3, name: 'Manager' });
    }

    if (url.includes('/api/rbac/permissions') && init?.method === 'PUT') {
      return okJson({ message: 'saved' });
    }

    if (url.includes('/api/rbac/permissions')) {
      return okJson(permissionsPayload);
    }

    if (url.includes('/api/rbac/roles')) {
      return okJson(rolesPayload);
    }

    return okJson({});
  }) as unknown as typeof fetch;
}

function renderPage() {
  return render(<SettingsrolepermissionsPage />);
}

async function waitPageLoaded() {
  expect(await screen.findByTestId('header')).toHaveTextContent(
    'Role Permissions'
  );

  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  expect(await screen.findByText('Management Product')).toBeInTheDocument();

  await waitFor(() => {
    expect(
      screen.getAllByRole('checkbox', { hidden: true }).length
    ).toBeGreaterThan(0);
  });
}

async function changePermission() {
  await waitPageLoaded();

  const checkbox = screen.getAllByRole('checkbox', { hidden: true })[0] as HTMLInputElement;

  fireEvent.click(checkbox);

  await waitFor(() => {
    expect(screen.getByText('Save Changes')).not.toBeDisabled();
  });
}

async function changePermissionAndSave() {
  await waitPageLoaded();

  const checkboxes = screen.getAllByRole('checkbox', {
    hidden: true,
  });

  fireEvent.click(checkboxes[0]);

  await waitFor(() => {
    const button = screen.getByText('Save Changes');

    expect(button).toBeInTheDocument();
    expect(button).not.toHaveAttribute('disabled');
  });

  fireEvent.click(screen.getByText('Save Changes'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPermLoading = false;
  mockHasPermission = true;
  mockCurrentUserRole = 'superadmin';

  localStorage.clear();
  localStorage.setItem('token', 'test');
  localStorage.setItem(
    'user',
    JSON.stringify({
      id: 1,
      username: 'test',
      role: 'superadmin',
      email: 'test@test.com',
    })
  );

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

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rbac/roles'),
      expect.any(Object)
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rbac/permissions?roleId=1'),
      expect.any(Object)
    );
  });

  test('fetches without token', async () => {
    localStorage.removeItem('token');

    renderPage();

    await waitPageLoaded();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rbac/roles'),
      expect.objectContaining({
        headers: {},
      })
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
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Sesi berakhir. Silakan login kembali.',
        expect.any(Object)
      );
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
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching roles:',
        expect.any(Error)
      );
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
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Sesi berakhir. Silakan login kembali.',
        expect.any(Object)
      );
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles permissions network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);
      if (url.includes('/api/rbac/permissions')) {
        return Promise.reject(new Error('permissions error'));
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching permissions:',
        expect.any(Error)
      );
    });
  });

  test('selects another role and fetches permissions', async () => {
    renderPage();

    await waitPageLoaded();

    fireEvent.click(screen.getByText('Cashier'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/rbac/permissions?roleId=2'),
        expect.any(Object)
      );
    });
  });

  // test('filters permissions by query', async () => {
  //   renderPage();

  //   await waitPageLoaded();

  //   fireEvent.change(screen.getByPlaceholderText('Cari module'), {
  //     target: { value: 'sales' },
  //   });

  //   expect(screen.getByText('Sales Report')).toBeInTheDocument();
  //   expect(screen.queryByText('Management Product')).not.toBeInTheDocument();
  // });

  // test('toggles permission and enables save button', async () => {
  //   renderPage();

  //   await changePermission();

  //   expect(screen.getByText('Save Changes')).not.toBeDisabled();
  // });

  // test('saves permissions successfully', async () => {
  //   renderPage();

  //   await changePermissionAndSave();

  //   await waitFor(() => {
  //     expect(goeyToast.success).toHaveBeenCalledWith(
  //       'Hak akses berhasil disimpan',
  //       expect.any(Object)
  //     );
  //   });
  // });
function mockSavePermissionFetch(putResponse: Promise<Response>) {
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/rbac/permissions') && init?.method === 'PUT') {
      return putResponse;
    }

    if (url.includes('/api/rbac/permissions')) {
      return okJson(permissionsPayload);
    }

    if (url.includes('/api/rbac/roles')) {
      return okJson(rolesPayload);
    }

    return okJson({});
  }) as unknown as typeof fetch;
}
//  test('handles save permissions unauthorized', async () => {
//   mockSavePermissionFetch(failJson({}, 401));

//   renderPage();

//   await changePermissionAndSave();

//   await waitFor(() => {
//     expect(goeyToast.error).toHaveBeenCalledWith(
//       'Sesi berakhir. Silakan login kembali.',
//       expect.any(Object)
//     );
//     expect(pushMock).toHaveBeenCalledWith('/login');
//   });
// });

// test('handles save permissions failure with message', async () => {
//   mockSavePermissionFetch(failJson({ message: 'Save failed' }, 400));

//   renderPage();

//   await changePermissionAndSave();

//   await waitFor(() => {
//     expect(goeyToast.error).toHaveBeenCalledWith(
//       'Save failed',
//       expect.any(Object)
//     );
//   });
// });

// test('handles save permissions failure without message', async () => {
//   mockSavePermissionFetch(failJson({}, 400));

//   renderPage();

//   await changePermissionAndSave();

//   await waitFor(() => {
//     expect(goeyToast.error).toHaveBeenCalledWith(
//       'Gagal menyimpan hak akses',
//       expect.any(Object)
//     );
//   });
// });

// test('handles save permissions network error', async () => {
//   jest.spyOn(console, 'error').mockImplementation(() => {});

//   mockSavePermissionFetch(Promise.reject(new Error('save error')));

//   renderPage();

//   await changePermissionAndSave();

//   await waitFor(() => {
//     expect(goeyToast.error).toHaveBeenCalledWith(
//       'Terjadi kesalahan saat menyimpan hak akses',
//       expect.any(Object)
//     );
//   });
// });

  test('opens add role modal and closes it', async () => {
    renderPage();

    await waitPageLoaded();

    fireEvent.click(screen.getByText('Add Role & Permissions'));

    expect(screen.getAllByText('Add Role & Permissions').length).toBeGreaterThan(1);

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Role name')).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByPlaceholderText('Role name'), {
      target: { value: 'Manager' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Role berhasil ditambahkan',
        expect.any(Object)
      );
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

    fireEvent.change(screen.getByPlaceholderText('Role name'), {
      target: { value: 'Manager' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Sesi Berakhir',
        expect.any(Object)
      );
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles add role failure with message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles') && init?.method === 'POST') {
        return failJson({ message: 'Role exists' }, 400);
      }

      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitPageLoaded();

    fireEvent.click(screen.getByText('Add Role & Permissions'));

    fireEvent.change(screen.getByPlaceholderText('Role name'), {
      target: { value: 'Manager' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Role exists',
        expect.any(Object)
      );
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

    fireEvent.change(screen.getByPlaceholderText('Role name'), {
      target: { value: 'Manager' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal menambahkan role',
        expect.any(Object)
      );
    });
  });

  test('handles add role network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles') && init?.method === 'POST') {
        return Promise.reject(new Error('add error'));
      }

      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitPageLoaded();

    fireEvent.click(screen.getByText('Add Role & Permissions'));

    fireEvent.change(screen.getByPlaceholderText('Role name'), {
      target: { value: 'Manager' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Terjadi kesalahan saat menambahkan role',
        expect.any(Object)
      );
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
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Role berhasil dihapus',
        expect.any(Object)
      );
    });
  });

  test('deletes non-selected role successfully', async () => {
    renderPage();

    await waitPageLoaded();

    const deleteButtons = await screen.findAllByTitle('Delete');

    fireEvent.click(deleteButtons[1]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Role berhasil dihapus',
        expect.any(Object)
      );
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
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Sesi berakhir. Silakan login kembali.',
        expect.any(Object)
      );
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles delete role failure with message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles/') && init?.method === 'DELETE') {
        return failJson({ message: 'Delete failed' }, 400);
      }

      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitPageLoaded();

    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Delete failed',
        expect.any(Object)
      );
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
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal menghapus role',
        expect.any(Object)
      );
    });
  });

  test('handles delete role network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/rbac/roles/') && init?.method === 'DELETE') {
        return Promise.reject(new Error('delete error'));
      }

      if (url.includes('/api/rbac/permissions')) return okJson(permissionsPayload);
      if (url.includes('/api/rbac/roles')) return okJson(rolesPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitPageLoaded();

    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Terjadi kesalahan saat menghapus role',
        expect.any(Object)
      );
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
});