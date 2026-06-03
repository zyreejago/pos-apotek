import React from 'react';
import { render, screen, waitFor, fireEvent, } from '@testing-library/react';
import ProductsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';

const pushMock = jest.fn();
const mockCheckPermission = jest.fn((action?: string) => true);

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/products',
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
  default: ({ isOpen, onClose, onConfirm, title, message }: any) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <div>{title}</div>
        <div>{message}</div>
        <button onClick={onConfirm}>confirm-delete</button>
        <button onClick={onClose}>close-delete</button>
      </div>
    ) : null,
}));

jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon" />,
  Filter: () => <span data-testid="filter-icon" />,
  Plus: () => <span data-testid="plus-icon" />,
  Edit: () => <span data-testid="edit-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  X: () => <span data-testid="x-icon" />,
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

const productsPayload = {
  data: [
    {
      id: 1,
      name: 'Expired Product',
      cost_price: 1000,
      selling_price: 2000,
      stock: 5,
      unit: 'pcs',
      expired_date: '2020-01-01',
      category: 'Medicine',
    },
    {
      id: 2,
      name: 'Soon Product',
      cost_price: 3000,
      selling_price: 5000,
      stock: 10,
      unit: '',
      expired_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      category: '',
    },
    {
      id: 3,
      name: 'Safe Product',
      cost_price: 4000,
      selling_price: 8000,
      stock: 20,
      unit: 'box',
      expired_date: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'General',
    },
    {
      id: 4,
      name: 'No Date Product',
      cost_price: 0,
      selling_price: 0,
      stock: 0,
      unit: 'strip',
      expired_date: null,
      category: 'General',
    },
  ],
  pagination: {
    total: 40,
    page: 1,
    limit: 10,
    totalPages: 4,
  },
};

function mockDefaultFetch() {
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/products/') && init?.method === 'DELETE') {
      return okJson({ message: 'deleted' });
    }

    if (url.includes('/api/products/') && init?.method === 'PUT') {
      return okJson({ message: 'updated' });
    }

    if (url.endsWith('/api/products') && init?.method === 'POST') {
      return okJson({ message: 'created' });
    }

    if (url.includes('/api/products')) {
      return okJson(productsPayload);
    }

    return okJson({});
  }) as unknown as typeof fetch;
}

function renderPage() {
  return render(<ProductsPage />);
}

async function waitLoaded() {
  await waitFor(() => {
    expect(screen.queryByText('Loading products...')).not.toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText('Expired Product')).toBeInTheDocument();
  });
}
function fillForm() {
  fireEvent.change(screen.getByPlaceholderText('Enter product name'), {
    target: { name: 'name', value: 'Produk Baru' },
  });

  const numberInputs = screen.getAllByPlaceholderText('0');

  fireEvent.change(numberInputs[0], {
    target: { name: 'cost_price', value: '1000' },
  });

  fireEvent.change(numberInputs[1], {
    target: { name: 'selling_price', value: '2000' },
  });

  fireEvent.change(numberInputs[2], {
    target: { name: 'stock', value: '7' },
  });

  fireEvent.change(screen.getByDisplayValue('Pcs'), {
    target: { name: 'unit', value: 'box' },
  });

  fireEvent.change(screen.getByPlaceholderText('General'), {
    target: { name: 'category', value: 'NewCat' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockCheckPermission.mockImplementation(() => true);

  localStorage.clear();
  localStorage.setItem('token', 'test');
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test', role: 'superadmin' }));

  mockDefaultFetch();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('products module', () => {
  test('renders products page and loads data', async () => {
    renderPage();

    expect(screen.getByTestId('header')).toHaveTextContent('Products');
    await waitLoaded();

    expect(screen.getByText('All Products: 40')).toBeInTheDocument();
    expect(screen.getByText('Showing 4 of 40 Products')).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*1\.000/)).toBeInTheDocument();
expect(screen.getByText(/Rp\s*2\.000/)).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  test('renders loading state', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    })) as unknown as typeof fetch;

    renderPage();

    expect(screen.getByText('Loading products...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => productsPayload,
      text: async () => JSON.stringify(productsPayload),
    } as Response);

    expect(await screen.findByText('Expired Product')).toBeInTheDocument();
  });

  test('renders empty state', async () => {
    global.fetch = jest.fn(() =>
      okJson({
        data: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
      })
    ) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText('No products found.')).toBeInTheDocument();
  });

  test('fetches without token', async () => {
    localStorage.removeItem('token');

    renderPage();

    await waitLoaded();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/products'),
      expect.objectContaining({ headers: {} })
    );
  });

  test('handles unauthorized fetch', async () => {
    global.fetch = jest.fn(() => failJson({}, 401)) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  test('handles forbidden fetch', async () => {
    global.fetch = jest.fn(() => failJson({}, 403)) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });

    expect(await screen.findByText('No products found.')).toBeInTheDocument();
  });

  test('handles fetch network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() => Promise.reject(new Error('network'))) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching products:',
        expect.any(Error)
      );
    });
  });

  test('handles search debounce', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.change(screen.getByPlaceholderText('Search Products'), {
      target: { value: 'safe' },
    });

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=safe'),
          expect.any(Object)
        );
      },
      { timeout: 1200 }
    );
  });

  test('changes items per page', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.change(screen.getByDisplayValue('10'), {
      target: { value: '20' },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
    });
  });

  test('goes next and previous page', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('→'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
    });

    fireEvent.click(screen.getByText('←'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.any(Object)
      );
    });
  });

  test('opens and closes add modal', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));

    expect(screen.getByText('Add New Product')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Add New Product')).not.toBeInTheDocument();
    });
  });

  test('opens and closes modal with x button', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));

    const closeButton = screen.getByTestId('x-icon').closest('button') as HTMLButtonElement;
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Add New Product')).not.toBeInTheDocument();
    });
  });

  test('changes form inputs', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    fillForm();

    expect(screen.getByDisplayValue('Produk Baru')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('7')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Box')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NewCat')).toBeInTheDocument();
  });

  test('creates product successfully', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    fillForm();
    fireEvent.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Produk berhasil ditambahkan',
        expect.any(Object)
      );
    });
  });

  test('handles create permission denied', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    fillForm();

    mockCheckPermission.mockImplementation((action?: string) => action !== 'create');

    fireEvent.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });
  });

  test('handles create failure with backend message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/api/products') && init?.method === 'POST') {
        return failJson({ message: 'Create failed' }, 400);
      }
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    fillForm();
    fireEvent.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal menyimpan produk',
        expect.objectContaining({ description: 'Create failed' })
      );
    });
  });

  test('handles create failure without backend message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/api/products') && init?.method === 'POST') return failJson({}, 400);
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    fillForm();
    fireEvent.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal menyimpan produk',
        expect.objectContaining({
          description: 'Terjadi kesalahan saat menyimpan data produk.',
        })
      );
    });
  });

  test('handles create unauthorized', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/api/products') && init?.method === 'POST') return failJson({}, 401);
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    fillForm();
    fireEvent.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles create network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/api/products') && init?.method === 'POST') {
        return Promise.reject(new Error('save error'));
      }
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    fillForm();
    fireEvent.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Terjadi kesalahan sistem',
        expect.any(Object)
      );
    });
  });

  test('opens edit modal with fallback unit category and empty expired date', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);

    expect(screen.getByText('Edit Product')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Soon Product')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pcs')).toBeInTheDocument();
    expect(screen.getByDisplayValue('General')).toBeInTheDocument();
  });

  test('updates product successfully', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Edit'))[0]);

    fireEvent.change(screen.getByPlaceholderText('Enter product name'), {
      target: { name: 'name', value: 'Produk Edit' },
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Produk berhasil diperbarui',
        expect.any(Object)
      );
    });
  });

  test('handles edit permission denied', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Edit'))[0]);

    mockCheckPermission.mockImplementation((action?: string) => action !== 'edit');

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });
  });

  test('handles update failure', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products/') && init?.method === 'PUT') return failJson({}, 400);
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Edit'))[0]);
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal menyimpan produk',
        expect.any(Object)
      );
    });
  });

  test('opens delete modal and closes it', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);

    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    expect(screen.getByText('Delete Product')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close-delete'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });
  });

  test('deletes product successfully', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Produk Berhasil Dihapus',
        expect.any(Object)
      );
    });
  });

  test('handles delete permission denied', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);

    mockCheckPermission.mockImplementation((action?: string) => action !== 'delete');

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });
  });

  test('handles delete unauthorized', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products/') && init?.method === 'DELETE') return failJson({}, 401);
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles delete failure with message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products/') && init?.method === 'DELETE') {
        return failJson({ message: 'Delete failed' }, 400);
      }
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Menghapus Produk',
        expect.objectContaining({ description: 'Delete failed' })
      );
    });
  });

  test('handles delete failure without message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products/') && init?.method === 'DELETE') return failJson({}, 400);
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Menghapus Produk',
        expect.objectContaining({
          description: 'Terjadi kesalahan saat menghapus produk.',
        })
      );
    });
  });

  test('handles delete network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products/') && init?.method === 'DELETE') {
        return Promise.reject(new Error('delete error'));
      }
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Terjadi Kesalahan',
        expect.any(Object)
      );
    });
  });

  test('hides create edit delete buttons by permission', async () => {
    mockCheckPermission.mockImplementation(() => false);

    renderPage();

    await waitLoaded();

    expect(screen.queryByText('Add Products')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });
});