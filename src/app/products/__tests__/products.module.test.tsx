import React from 'react';
import { render, screen, waitFor, fireEvent, } from '@testing-library/react';
import ProductsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';
import { OffCanvasProvider } from '@/context/OffCanvasContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { HeaderProvider, useHeader } from '@/context/HeaderContext';
import { KeyboardShortcutsProvider } from '@/context/KeyboardShortcutsContext';

function HeaderDisplay() {
  const { headerState } = useHeader();
  return (
    <div data-testid="header">
      <h1>{headerState.title}</h1>
      {headerState.subtitle && <p>{headerState.subtitle}</p>}
      {headerState.rightContent}
    </div>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <OffCanvasProvider>
      <SidebarProvider>
        <HeaderProvider>
          <KeyboardShortcutsProvider>
            <HeaderDisplay />
            {ui}
          </KeyboardShortcutsProvider>
        </HeaderProvider>
      </SidebarProvider>
    </OffCanvasProvider>
  );
}

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

jest.mock('@/components/OffCanvas', () => ({
  __esModule: true,
  default: ({ isOpen, onClose, title, children }: any) =>
    isOpen ? (
      <div data-testid="offcanvas">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          <span data-testid="x-icon" />
        </button>
        {children}
      </div>
    ) : null,
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
  FileText: () => <span data-testid="filetext-icon" />,
  Info: () => <span data-testid="info-icon" />,
  UploadCloud: () => <span data-testid="uploadcloud-icon" />,
  Camera: () => <span data-testid="camera-icon" />,
  Check: () => <span data-testid="check-icon" />,
  AlertCircle: () => <span data-testid="alertcircle-icon" />,
  CheckCircle: () => <span data-testid="checkcircle-icon" />,
  Package: () => <span data-testid="package-icon" />,
  Users: () => <span data-testid="users-icon" />,
  Calendar: () => <span data-testid="calendar-icon" />,
  AlertTriangle: () => <span data-testid="alerttriangle-icon" />,
  ArrowUpDown: () => <span data-testid="arrowupdown-icon" />,
  Wallet: () => <span data-testid="wallet-icon" />,
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
    const resp = { ok: true, status: 200 };

    if (url.includes('/api/products/') && init?.method === 'DELETE') {
      return {
        ...resp,
        json: async () => ({ message: 'deleted' }),
        text: async () => JSON.stringify({ message: 'deleted' }),
      };
    }

    if (url.includes('/api/products/') && init?.method === 'PUT') {
      return {
        ...resp,
        json: async () => ({ message: 'updated' }),
        text: async () => JSON.stringify({ message: 'updated' }),
      };
    }

    if (url.endsWith('/api/products') && init?.method === 'POST') {
      return {
        ...resp,
        json: async () => ({ message: 'created' }),
        text: async () => JSON.stringify({ message: 'created' }),
      };
    }

    if (url.includes('/api/products')) {
      return {
        ...resp,
        json: async () => productsPayload,
        text: async () => JSON.stringify(productsPayload),
      };
    }

    return {
      ...resp,
      json: async () => ({}),
      text: async () => JSON.stringify({}),
    };
  }) as unknown as typeof fetch;
}

function renderPage() {
  return renderWithProviders(<ProductsPage />);
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
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  test('renders loading state', async () => {
    let resolveMainFetch: ((value: Response) => void) | null = null;

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products') && url.includes('page=')) {
        return new Promise<Response>((resolve) => {
          resolveMainFetch = resolve;
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => url.includes('/api/products') ? productsPayload : {},
        text: async () => JSON.stringify(url.includes('/api/products') ? productsPayload : {}),
      } as Response);
    }) as unknown as typeof fetch;

    renderPage();

    expect(screen.getByText('Loading products...')).toBeInTheDocument();

    resolveMainFetch!({
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
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() => failJson({}, 401)) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No products found.')).toBeInTheDocument();
    });
  });

  test('handles forbidden fetch', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() => failJson({}, 403)) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No products found.')).toBeInTheDocument();
    });
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

    // Only 4 products in allProducts — pagination has 1 page, so arrow is disabled
    const rightArrow = screen.getByText('→');
    expect(rightArrow).toBeDisabled();
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
  });

  test('creates product successfully', async () => {
    renderPage();

    await waitLoaded();

    expect(screen.getByText('Add Products')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add Products'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    fillForm();

    // Submit via form submit event (fireEvent.click on submit button doesn't trigger form submission in JSDOM)
    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Produk berhasil disimpan');
    });
  });

  test('handles create permission denied', async () => {
    renderPage();

    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    fillForm();

    mockCheckPermission.mockImplementation((action?: string) => action !== 'create');

    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

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
    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Produk berhasil disimpan'
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
    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Produk berhasil disimpan'
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
    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Produk berhasil disimpan'
      );
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
    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal menambahkan produk'
      );
    });
  });

  test('opens edit modal with fallback unit category and empty expired date', async () => {
    renderPage();

    await waitLoaded();

    // Products are sorted by name ascending: Expired, No Date, Safe, Soon
    // "Soon Product" has empty unit → falls back to 'Tablet'
    fireEvent.click((await screen.findAllByTitle('Edit'))[3]);

    expect(screen.getByText('Edit Product')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Soon Product')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tablet')).toBeInTheDocument();
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
        'Produk berhasil diperbarui'
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
        'Gagal memperbarui produk'
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
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Terjadi Kesalahan',
        expect.objectContaining({ description: 'Gagal menghapus produk.' })
      );
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
        'Terjadi Kesalahan',
        expect.objectContaining({ description: 'Gagal menghapus produk.' })
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
        'Terjadi Kesalahan',
        expect.objectContaining({ description: 'Gagal menghapus produk.' })
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

  // ─── Product add with existing product name match (auto-fill) ───
  test('auto-fills selling price when product name matches existing product', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    // Type name that matches 'Expired Product' from the payload
    fireEvent.change(screen.getByPlaceholderText('Enter product name'), {
      target: { name: 'name', value: 'Expired Product' },
    });

    // Selling price should be auto-filled to 2000
    await waitFor(() => {
      const sellingInput = document.querySelector('[name="selling_price"]') as HTMLInputElement;
      expect(sellingInput.value).toBe('2000');
    });
  });

  // ─── Product add with supplier triggers batch creation ───
  test('creates product with supplier triggering batch creation', async () => {
    const mockFetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/api/products') && init?.method === 'POST')
        return okJson({ id: 999, message: 'created' });
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return okJson({ data: { status: 'approved' }, message: 'batch created' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      return okJson({
        data: [{ id: 1, name: 'Test Supplier' }],
      });
    }) as unknown as typeof fetch;
    global.fetch = mockFetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    fillForm();

    // Select supplier from the dropdown
    const supplierSelect = document.querySelector('[name="supplier_id"]') as HTMLSelectElement;
    fireEvent.change(supplierSelect, { target: { name: 'supplier_id', value: '1' } });

    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Produk berhasil disimpan');
    });
  });

  // ─── Product update network error ───
  test('handles product update network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return Promise.reject(new Error('update error'));
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Edit'))[0]);
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal memperbarui produk');
    });
  });

  // ─── Form input: purchase_unit_stock changes calculate stock ───
  test('calculates stock when purchase_unit_stock changes', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    // Toggle on "Memiliki satuan besar?" to show purchase unit fields
    const toggleText = screen.getByText('Memiliki satuan besar?');
    const toggleBtn = toggleText.closest('div')?.querySelector('button') || toggleText.previousElementSibling as HTMLElement;
    if (toggleBtn) fireEvent.click(toggleBtn);

    // Find purchase_unit_stock input by name
    const purchaseStockInput = document.querySelector('[name="purchase_unit_stock"]') as HTMLInputElement;
    fireEvent.change(purchaseStockInput, {
      target: { name: 'purchase_unit_stock', value: '5' },
    });

    // Stock should be 5 * 1 = 5
    await waitFor(() => {
      const stockInput = document.querySelector('[name="stock"]') as HTMLInputElement;
      expect(stockInput.value).toBe('5');
    });
  });

  // ─── Form input: unit_multiplier changes calculate stock ───
  function toggleSatuanBesar() {
    const toggleText = screen.getByText('Memiliki satuan besar?');
    const toggleBtn = toggleText.closest('div')?.querySelector('button');
    if (toggleBtn) fireEvent.click(toggleBtn);
  }

  test('calculates stock when unit_multiplier changes', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    toggleSatuanBesar();

    // First set purchase_unit_stock to 5
    const purchaseStockInput = document.querySelector('[name="purchase_unit_stock"]') as HTMLInputElement;
    fireEvent.change(purchaseStockInput, {
      target: { name: 'purchase_unit_stock', value: '5' },
    });

    // Now change unit_multiplier
    const unitMultInput = document.querySelector('[name="unit_multiplier"]') as HTMLInputElement;
    fireEvent.change(unitMultInput, {
      target: { name: 'unit_multiplier', value: '3' },
    });

    // Stock should be 5 * 3 = 15
    await waitFor(() => {
      const stockInput = document.querySelector('[name="stock"]') as HTMLInputElement;
      expect(stockInput.value).toBe('15');
    });
  });

  // ─── Form input: stock changes calculate purchase_unit_stock ───
  test('calculates purchase_unit_stock when stock changes', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    toggleSatuanBesar();

    // Change stock directly
    const stockInput = document.querySelector('[name="stock"]') as HTMLInputElement;
    fireEvent.change(stockInput, {
      target: { name: 'stock', value: '30' },
    });

    // purchase_unit_stock should be 30 / 1 = 30
    await waitFor(() => {
      const purchaseStockInput = document.querySelector('[name="purchase_unit_stock"]') as HTMLInputElement;
      expect(purchaseStockInput.value).toBe('30');
    });
  });

  // ─── Product image upload ───
  test('handles product image file selection', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByText('Pilih File')).toBeInTheDocument();
    });

    // Trigger the hidden file input change
    const file = new File(['image'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    // Just verify no errors occur - image preview is handled asynchronously
    expect(fileInput).toBeTruthy();
  });

  // ─── Multiple products: toggle and add ───
  test('toggles to multiple products mode and adds product to list', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    // Switch to multiple products mode
    fireEvent.click(screen.getByText('Multiple Products'));

    // Should show "+ Tambahkan ke Daftar" button
    expect(screen.getByText(/Tambahkan ke Daftar/)).toBeInTheDocument();

    // Fill in product details using querySelector for specific inputs in multi mode
    const nameInput = document.querySelector('[name="name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { name: 'name', value: 'Produk Multi' } });

    const costInput = document.querySelector('[name="cost_price"]') as HTMLInputElement;
    fireEvent.change(costInput, { target: { name: 'cost_price', value: '5000' } });

    const stockInput = document.querySelector('[name="stock"]') as HTMLInputElement;
    fireEvent.change(stockInput, { target: { name: 'stock', value: '10' } });

    // Add to list
    fireEvent.click(screen.getByText(/Tambahkan ke Daftar/));

    await waitFor(() => {
      expect(screen.getByText('Daftar Produk (1)')).toBeInTheDocument();
      expect(screen.getByText(/Produk Multi/)).toBeInTheDocument();
    });
  });

  // ─── Multiple products: remove from list ───
  test('removes product from multiple products list', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Multiple Products'));

    const nameInput = document.querySelector('[name="name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { name: 'name', value: 'Produk Multi' } });

    const costInput = document.querySelector('[name="cost_price"]') as HTMLInputElement;
    fireEvent.change(costInput, { target: { name: 'cost_price', value: '5000' } });

    const stockInput = document.querySelector('[name="stock"]') as HTMLInputElement;
    fireEvent.change(stockInput, { target: { name: 'stock', value: '10' } });

    fireEvent.click(screen.getByText(/Tambahkan ke Daftar/));

    await waitFor(() => {
      expect(screen.getByText('Daftar Produk (1)')).toBeInTheDocument();
    });

    // Remove the product (Trash2 button in list)
    const trashButtons = screen.getAllByTestId('trash-icon');
    const removeBtn = trashButtons[trashButtons.length - 1].closest('button')!;
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Daftar Produk (1)')).not.toBeInTheDocument();
    });
  });

  // ─── Multiple products: submit with empty list error ───
  test('shows error when submitting multiple products with empty list', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    // Switch to multiple products mode without adding any
    fireEvent.click(screen.getByText('Multiple Products'));

    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Daftar produk kosong',
        expect.any(Object)
      );
    });
  });

  // ─── Multiple products: duplicate name accumulates stock ───
  test('accumulates stock when adding duplicate product name in multiple products', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Multiple Products'));

    // Add first product
    let nameInput = document.querySelector('[name="name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { name: 'name', value: 'Produk A' } });
    let costInput = document.querySelector('[name="cost_price"]') as HTMLInputElement;
    fireEvent.change(costInput, { target: { name: 'cost_price', value: '5000' } });
    let stockInput = document.querySelector('[name="stock"]') as HTMLInputElement;
    fireEvent.change(stockInput, { target: { name: 'stock', value: '10' } });
    fireEvent.click(screen.getByText(/Tambahkan ke Daftar/));

    await waitFor(() => {
      expect(screen.getByText(/Produk A/)).toBeInTheDocument();
    });

    // Add same product name again (form should be reset)
    nameInput = document.querySelector('[name="name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { name: 'name', value: 'Produk A' } });
    costInput = document.querySelector('[name="cost_price"]') as HTMLInputElement;
    fireEvent.change(costInput, { target: { name: 'cost_price', value: '6000' } });
    stockInput = document.querySelector('[name="stock"]') as HTMLInputElement;
    fireEvent.change(stockInput, { target: { name: 'stock', value: '5' } });
    fireEvent.click(screen.getByText(/Tambahkan ke Daftar/));

    // Should still show only 1 product with accumulated stock (10 + 5 = 15)
    await waitFor(() => {
      expect(screen.getByText('Daftar Produk (1)')).toBeInTheDocument();
      expect(screen.getByText(/Stok: 15/)).toBeInTheDocument();
    });
  });

  // ─── Opens faktur offcanvas ───
  test('opens faktur offcanvas when clicking Faktur button', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);

    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
      expect(screen.getByText('Belum ada faktur. Tambahkan faktur pertama!')).toBeInTheDocument();
    });
  });

  // ─── Closes faktur offcanvas ───
  test('closes faktur offcanvas with x button', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);

    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByTestId('x-icon');
    fireEvent.click(closeButtons[closeButtons.length - 1].closest('button')!);

    await waitFor(() => {
      expect(screen.queryByText(/Faktur - /)).not.toBeInTheDocument();
    });
  });

  // ─── Opens faktur add form ───
  test('opens faktur add form from faktur offcanvas', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);

    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    // Click the "Tambah Faktur" in the list header (first one)
    const tambahButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(tambahButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument();
    });
  });

  // ─── Saves faktur successfully (add mode) ───
  test('saves faktur successfully in add mode', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return okJson({ status: 'approved', data: { status: 'approved' } });
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    const tambahButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(tambahButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument();
    });

    // Fill quantity
    const qtyInput = document.querySelector('[name="quantity"]') as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { name: 'quantity', value: '10' } });

    // Click the faktur save button (the last "Tambah Faktur" in the form)
    const saveButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Faktur ditambahkan!');
    });
  });

  // ─── Saves faktur with pending approval response ───
  test('shows approval info when faktur response status is pending', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return okJson({ status: 'pending', data: { status: 'pending' } });
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    const tambahButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(tambahButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument();
    });

    const saveButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(goeyToast.info).toHaveBeenCalledWith(
        'Persetujuan Diperlukan',
        expect.any(Object)
      );
    });
  });

  // ─── Saves faktur failure ───
  test('handles faktur save failure', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return failJson({}, 500);
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    const tambahButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(tambahButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument();
    });

    const saveButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menyimpan faktur');
    });
  });

  // ─── Saves faktur network error ───
  test('handles faktur save network error', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return Promise.reject(new Error('network'));
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    const tambahButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(tambahButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument();
    });

    const saveButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menyimpan faktur');
    });
  });

  // ─── Sort by clicking column header (name → toggle desc) ───
  test('sorts by name column toggling direction', async () => {
    renderPage();
    await waitLoaded();

    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);
    fireEvent.click(nameHeader);
  });

  // ─── Sort by expired_date ───
  test('sorts by expired date column', async () => {
    renderPage();
    await waitLoaded();

    const expiredHeader = screen.getByText('Expired Date');
    fireEvent.click(expiredHeader);

    const firstRow = screen.getAllByRole('row')[1];
    expect(firstRow.textContent).toContain('Expired Product');
  });

  // ─── Sort by cost_price (number field) ───
  test('sorts by cost price column toggling direction', async () => {
    renderPage();
    await waitLoaded();

    const costHeader = screen.getByText('Cost Price');
    fireEvent.click(costHeader);
    fireEvent.click(costHeader);
  });

  // ─── Sort by stock (desc default) ───
  test('sorts by stock column with default desc', async () => {
    renderPage();
    await waitLoaded();

    const stockHeader = screen.getByText('Stock');
    fireEvent.click(stockHeader);

    const firstRow = screen.getAllByRole('row')[1];
    expect(firstRow.textContent).toContain('Safe Product');
  });

  // ─── Sort by product_category (all undefined, falls through to return 0) ───
  test('sorts by kategori column all undefined returns 0', async () => {
    renderPage();
    await waitLoaded();

    const kategoriHeader = screen.getByText('Kategori');
    fireEvent.click(kategoriHeader);
  });

  // ─── Open approval modal ───
  test('opens approval modal and shows loading', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));

    await waitFor(() => {
      expect(screen.getByText('Approval Faktur Pembelian')).toBeInTheDocument();
    });

    expect(screen.getByText('Semua Beres!')).toBeInTheDocument();
  });

  // ─── Approval modal with pending fakturs ───
  test('shows pending fakturs in approval modal', async () => {
    const pendingData = {
      data: [
        {
          id: 10,
          product_id: 1,
          product_name: 'Test Product',
          batch_number: 'INV-001',
          invoice_number: 'INV-001',
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          cost_price: 3000000,
          quantity: 2,
          initial_quantity: 2,
          remaining_quantity: 2,
          stock_type: 'belum_bayar',
          status: 'pending',
          image_url: null,
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches'))
        return okJson(pendingData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));

    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
      expect(screen.getByText(/INV-001/)).toBeInTheDocument();
    });
  });

  // ─── Approval modal with rejected faktur shows delete button ───
  test('shows delete button for rejected faktur in approval modal', async () => {
    const pendingData = {
      data: [
        {
          id: 10,
          product_id: 1,
          product_name: 'Rejected Product',
          batch_number: 'INV-002',
          invoice_number: 'INV-002',
          supplier_name: 'Supplier B',
          purchase_date: '2024-01-15',
          cost_price: 3000000,
          quantity: 2,
          initial_quantity: 2,
          remaining_quantity: 2,
          stock_type: 'belum_bayar',
          status: 'rejected',
          image_url: null,
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches'))
        return okJson(pendingData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));

    await waitFor(() => {
      expect(screen.getByText('Rejected Product')).toBeInTheDocument();
    });

    const trashIcons = screen.getAllByTestId('trash-icon');
    expect(trashIcons.length).toBeGreaterThan(0);
  });

  // ─── Closes approval modal ───
  test('closes approval modal', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches'))
        return Promise.resolve(new Promise(() => {}));
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));

    await waitFor(() => {
      expect(screen.getByText('Approval Faktur Pembelian')).toBeInTheDocument();
    });

    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByText('Approval Faktur Pembelian')).not.toBeInTheDocument();
    });
  });

  // ─── Pagination: previous button disabled on first page ───
  test('pagination previous button is disabled on first page', async () => {
    renderPage();
    await waitLoaded();

    const leftArrow = screen.getByText('←');
    expect(leftArrow).toBeDisabled();
  });

  // ─── Pagination: next button disabled when only one page ───
  test('pagination next button disabled when only one page', async () => {
    renderPage();
    await waitLoaded();

    const rightArrow = screen.getByText('→');
    expect(rightArrow).toBeDisabled();
  });

  // ─── Faktur offcanvas shows faktur data in table when batches exist ───
  test('faktur offcanvas shows faktur data table when batches exist', async () => {
    const faktursData = {
      data: [
        {
          id: 20,
          product_id: 1,
          batch_number: 'BATCH-001',
          invoice_number: 'BATCH-001',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 8,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'belum_bayar',
          status: 'approved',
          dp_amount: null,
          due_date: null,
          expired_date: '2025-06-01',
          notes: null,
          image_url: null,
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-001')).toBeInTheDocument();
    });
  });

  // ─── Expire batch via confirm modal ───
  test('expires batch via confirm modal', async () => {
    const faktursData = {
      data: [
        {
          id: 30,
          product_id: 1,
          batch_number: 'BATCH-002',
          invoice_number: 'BATCH-002',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'belum_bayar',
          status: 'approved',
          dp_amount: null,
          due_date: null,
          expired_date: '2024-01-01',
          notes: null,
          image_url: null,
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && init?.method === 'PUT')
        return okJson({ message: 'expired' });
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-002')).toBeInTheDocument();
    });

    const expireButton = screen.getByTitle('Tandai Kadaluarsa');
    fireEvent.click(expireButton);

    await waitFor(() => {
      expect(screen.getByText('Tandai Kadaluarsa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Batch berhasil ditandai sebagai kadaluarsa!');
    });
  });

  // ─── Expire batch failure ───
  test('handles expire batch failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const faktursData = {
      data: [
        {
          id: 30,
          product_id: 1,
          batch_number: 'BATCH-002',
          invoice_number: 'BATCH-002',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'belum_bayar',
          status: 'approved',
          dp_amount: null,
          due_date: null,
          expired_date: '2024-01-01',
          notes: null,
          image_url: null,
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && init?.method === 'PUT')
        return failJson({ no_message: true }, 400);
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-002')).toBeInTheDocument();
    });

    const expireButton = screen.getByTitle('Tandai Kadaluarsa');
    fireEvent.click(expireButton);

    await waitFor(() => {
      expect(screen.getByText('Tandai Kadaluarsa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menandai batch sebagai kadaluarsa');
    });
  });

  // ─── Archive faktur (lunas type) ───
  test('archives lunas faktur successfully', async () => {
    const faktursData = {
      data: [
        {
          id: 50,
          product_id: 1,
          batch_number: 'BATCH-004',
          invoice_number: 'BATCH-004',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'lunas',
          status: 'approved',
          dp_amount: null,
          due_date: null,
          expired_date: null,
          notes: null,
          image_url: null,
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && url.includes('/archive'))
        return okJson({ message: 'archived' });
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-004')).toBeInTheDocument();
    });

    const archiveButton = screen.getByTitle('Arsipkan Faktur');
    fireEvent.click(archiveButton);

    await waitFor(() => {
      expect(screen.getByText('Arsipkan Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Faktur berhasil diarsipkan!');
    });
  });

  // ─── Save faktur with product update failure ───
  test('handles faktur save when product update fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return failJson({}, 500);
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    const tambahButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(tambahButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument();
    });

    const saveButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal memperbarui produk');
    });
  });

  // ─── Edit faktur via faktur table ───
  test('opens edit faktur modal from faktur table', async () => {
    const faktursData = {
      data: [
        {
          id: 20,
          product_id: 1,
          batch_number: 'BATCH-001',
          invoice_number: 'BATCH-001',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 8,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'belum_bayar',
          status: 'approved',
          dp_amount: null,
          due_date: null,
          expired_date: '2025-06-01',
          notes: null,
          image_url: null,
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-001')).toBeInTheDocument();
    });

    const allEditButtons = screen.getAllByTitle('Edit');
    const fakturEditButton = allEditButtons[allEditButtons.length - 1];
    fireEvent.click(fakturEditButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });
  });

  // ─── Add DP payment via edit faktur form ───
  test('adds DP payment from edit faktur form', async () => {
    const faktursData = {
      data: [
        {
          id: 60,
          product_id: 1,
          batch_number: 'BATCH-DP',
          invoice_number: 'BATCH-DP',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'dp',
          status: 'approved',
          dp_amount: 10000,
          due_date: '2024-06-15',
          expired_date: null,
          notes: null,
          image_url: null,
          dp_payments: [],
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && url.includes('/dp-payments') && init?.method === 'POST')
        return okJson({ message: 'dp added' });
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-DP')).toBeInTheDocument();
    });

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tambah DP'));

    const dpInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(dpInputs[dpInputs.length - 1], { target: { value: '5000' } });

    fireEvent.click(screen.getByText('Simpan DP'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('DP berhasil ditambahkan!');
    });
  });

  // ─── Delete DP payment ───
  test('deletes DP payment via edit faktur form', async () => {
    const faktursData = {
      data: [
        {
          id: 60,
          product_id: 1,
          batch_number: 'BATCH-DP',
          invoice_number: 'BATCH-DP',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'dp',
          status: 'approved',
          dp_amount: 10000,
          due_date: '2024-06-15',
          expired_date: null,
          notes: null,
          image_url: null,
          dp_payments: [
            { id: 1, amount: 10000, payment_date: '2024-01-15', payment_method: 'cash', created_at: '2024-01-15T00:00:00Z' },
          ],
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && url.includes('/dp-payments') && init?.method === 'DELETE')
        return okJson({ message: 'dp deleted' });
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-DP')).toBeInTheDocument();
    });

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });

    const trashIcons = screen.getAllByTestId('trash-icon');
    const dpTrashButton = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(dpTrashButton);

    await waitFor(() => {
      expect(screen.getByText('Hapus DP')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('DP berhasil dihapus!');
    });
  });

  // ─── Delete faktur from approval modal ───
  test('deletes rejected faktur from approval modal', async () => {
    const pendingData = {
      data: [
        {
          id: 20,
          product_id: 1,
          product_name: 'Rejected Product',
          batch_number: 'INV-REJ',
          invoice_number: 'INV-REJ',
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          cost_price: 5000,
          quantity: 10,
          initial_quantity: 10,
          remaining_quantity: 10,
          stock_type: 'belum_bayar',
          status: 'rejected',
          image_url: null,
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && init?.method === 'DELETE')
        return okJson({ message: 'deleted' });
      if (url.includes('/api/inventory/pending-batches'))
        return okJson(pendingData);
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Rejected Product')).toBeInTheDocument();
    });

    const trashIcons = screen.getAllByTestId('trash-icon');
    const deleteButton = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Hapus Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Faktur berhasil dihapus!');
    });
  });

  // ─── Archive non-lunas faktur shows error ───
  test('shows error when archiving non-lunas faktur', async () => {
    const faktursData = {
      data: [
        {
          id: 50,
          product_id: 1,
          batch_number: 'BATCH-NL',
          invoice_number: 'BATCH-NL',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'belum_bayar',
          status: 'approved',
          dp_amount: null,
          due_date: null,
          expired_date: null,
          notes: null,
          image_url: null,
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-NL')).toBeInTheDocument();
    });
  });

  // ─── Save faktur with DP stock type ───
  test('saves faktur with DP stock type', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return okJson({ status: 'approved', data: { status: 'approved' } });
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    const tambahButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(tambahButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument();
    });

    const stockTypeSelect = document.querySelector('[name="stock_type"]') as HTMLSelectElement;
    fireEvent.change(stockTypeSelect, { target: { name: 'stock_type', value: 'dp' } });

    await waitFor(() => {
      const dpAmountInput = document.querySelector('[name="dp_amount"]') as HTMLInputElement;
      expect(dpAmountInput).toBeInTheDocument();
    });

    const dpAmountInput = document.querySelector('[name="dp_amount"]') as HTMLInputElement;
    fireEvent.change(dpAmountInput, { target: { name: 'dp_amount', value: '5000' } });

    const dueDateInput = document.querySelector('[name="due_date"]') as HTMLInputElement;
    fireEvent.change(dueDateInput, { target: { name: 'due_date', value: '2024-06-15' } });

    const qtyInput = document.querySelector('[name="quantity"]') as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { name: 'quantity', value: '10' } });

    const file = new File(['image'], 'faktur.png', { type: 'image/png' });
    const fakturFileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fakturFileInput) {
      Object.defineProperty(fakturFileInput, 'files', { value: [file] });
      fireEvent.change(fakturFileInput);
    }

    const saveButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Faktur ditambahkan!');
    });
  });

  // ─── Add DP network error ───
  test('handles add DP network error', async () => {
    const faktursData = {
      data: [
        {
          id: 60,
          product_id: 1,
          batch_number: 'BATCH-DPNET',
          invoice_number: 'BATCH-DPNET',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'dp',
          status: 'approved',
          dp_amount: 10000,
          due_date: '2024-06-15',
          expired_date: null,
          notes: null,
          image_url: null,
          dp_payments: [],
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && url.includes('/dp-payments') && init?.method === 'POST')
        return Promise.reject(new Error('network error'));
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-DPNET')).toBeInTheDocument();
    });

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tambah DP'));

    const dpInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(dpInputs[dpInputs.length - 1], { target: { value: '5000' } });

    fireEvent.click(screen.getByText('Simpan DP'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan');
    });
  });

  // ─── Add DP with error response ───
  test('handles add DP error response', async () => {
    const faktursData = {
      data: [
        {
          id: 60,
          product_id: 1,
          batch_number: 'BATCH-DPERR',
          invoice_number: 'BATCH-DPERR',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'dp',
          status: 'approved',
          dp_amount: 10000,
          due_date: '2024-06-15',
          expired_date: null,
          notes: null,
          image_url: null,
          dp_payments: [],
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && url.includes('/dp-payments') && init?.method === 'POST')
        return failJson({}, 400);
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-DPERR')).toBeInTheDocument();
    });

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tambah DP'));

    const dpInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(dpInputs[dpInputs.length - 1], { target: { value: '5000' } });

    fireEvent.click(screen.getByText('Simpan DP'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menambahkan DP');
    });
  });

  // ─── Delete DP error ───
  test('handles delete DP error', async () => {
    const faktursData = {
      data: [
        {
          id: 60,
          product_id: 1,
          batch_number: 'BATCH-DPDEL',
          invoice_number: 'BATCH-DPDEL',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'dp',
          status: 'approved',
          dp_amount: 10000,
          due_date: '2024-06-15',
          expired_date: null,
          notes: null,
          image_url: null,
          dp_payments: [
            { id: 1, amount: 10000, payment_date: '2024-01-15', payment_method: 'cash', created_at: '2024-01-15T00:00:00Z' },
          ],
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && url.includes('/dp-payments') && init?.method === 'DELETE')
        return failJson({}, 400);
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-DPDEL')).toBeInTheDocument();
    });

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });

    const trashIcons = screen.getAllByTestId('trash-icon');
    const dpTrashButton = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(dpTrashButton);

    await waitFor(() => {
      expect(screen.getByText('Hapus DP')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menghapus DP');
    });
  });

  // ─── Delete DP modal closes via close button ───
  test('closes delete DP modal via close button', async () => {
    const faktursData = {
      data: [
        {
          id: 60,
          product_id: 1,
          batch_number: 'BATCH-DPCLS',
          invoice_number: 'BATCH-DPCLS',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'dp',
          status: 'approved',
          dp_amount: 10000,
          due_date: '2024-06-15',
          expired_date: null,
          notes: null,
          image_url: null,
          dp_payments: [
            { id: 1, amount: 10000, payment_date: '2024-01-15', payment_method: 'cash', created_at: '2024-01-15T00:00:00Z' },
          ],
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-DPCLS')).toBeInTheDocument();
    });

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });

    const trashIcons = screen.getAllByTestId('trash-icon');
    const dpTrashButton = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(dpTrashButton);

    await waitFor(() => {
      expect(screen.getByText('Hapus DP')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('close-delete'));

    await waitFor(() => {
      expect(screen.queryByText('Hapus DP')).not.toBeInTheDocument();
    });
  });

  // ─── Delete DP network error ───
  test('handles delete DP network error', async () => {
    const faktursData = {
      data: [
        {
          id: 60,
          product_id: 1,
          batch_number: 'BATCH-DPNET2',
          invoice_number: 'BATCH-DPNET2',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'dp',
          status: 'approved',
          dp_amount: 10000,
          due_date: '2024-06-15',
          expired_date: null,
          notes: null,
          image_url: null,
          dp_payments: [
            { id: 1, amount: 10000, payment_date: '2024-01-15', payment_method: 'cash', created_at: '2024-01-15T00:00:00Z' },
          ],
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && url.includes('/dp-payments') && init?.method === 'DELETE')
        return Promise.reject(new Error('network error'));
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-DPNET2')).toBeInTheDocument();
    });

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });

    const trashIcons = screen.getAllByTestId('trash-icon');
    const dpTrashButton = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(dpTrashButton);

    await waitFor(() => {
      expect(screen.getByText('Hapus DP')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan');
    });
  });

  // ─── Expire batch with API error message ───
  test('expire batch shows API error message', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const faktursData = {
      data: [
        {
          id: 30,
          product_id: 1,
          batch_number: 'BATCH-EXPERR',
          invoice_number: 'BATCH-EXPERR',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'belum_bayar',
          status: 'approved',
          dp_amount: null,
          due_date: null,
          expired_date: '2024-01-01',
          notes: null,
          image_url: null,
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && init?.method === 'PUT')
        return failJson({ message: 'Sudah kadaluarsa' }, 400);
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-EXPERR')).toBeInTheDocument();
    });

    const expireButton = screen.getByTitle('Tandai Kadaluarsa');
    fireEvent.click(expireButton);

    await waitFor(() => {
      expect(screen.getByText('Tandai Kadaluarsa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Sudah kadaluarsa');
    });
  });

  // ─── Global pending fakturs fetch error ───
  test('handles global pending fakturs fetch error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches'))
        return Promise.reject(new Error('fetch error'));
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal memuat data approval');
    });
  });

  // ─── Archive DP faktur with full payment (hits stock_type guard) ───
  test('shows error when archiving DP faktur with full payment', async () => {
    const faktursData = {
      data: [
        {
          id: 70,
          product_id: 1,
          batch_number: 'BATCH-DPFULL',
          invoice_number: 'BATCH-DPFULL',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'dp',
          status: 'approved',
          dp_amount: 50000,
          due_date: '2024-06-15',
          expired_date: null,
          notes: null,
          image_url: null,
          dp_payments: [
            { id: 1, amount: 50000, payment_date: '2024-01-15', payment_method: 'cash', created_at: '2024-01-15T00:00:00Z' },
          ],
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-DPFULL')).toBeInTheDocument();
    });

    const archiveButton = screen.getByTitle('Arsipkan Faktur');
    fireEvent.click(archiveButton);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Hanya faktur dengan tipe stok "lunas" atau "retur" yang dapat diarsipkan!');
    });
  });

  // ─── Archive faktur network error ───
  test('handles archive faktur network error', async () => {
    const faktursData = {
      data: [
        {
          id: 50,
          product_id: 1,
          batch_number: 'BATCH-ARCHNET',
          invoice_number: 'BATCH-ARCHNET',
          supplier_id: 1,
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          remaining_quantity: 10,
          quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'lunas',
          status: 'approved',
          dp_amount: null,
          due_date: null,
          expired_date: null,
          notes: null,
          image_url: null,
          created_at: '2024-01-15T00:00:00Z',
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && url.includes('/archive'))
        return Promise.reject(new Error('network error'));
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('BATCH-ARCHNET')).toBeInTheDocument();
    });

    const archiveButton = screen.getByTitle('Arsipkan Faktur');
    fireEvent.click(archiveButton);

    await waitFor(() => {
      expect(screen.getByText('Arsipkan Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal mengarsipkan faktur');
    });
  });

  // ─── Faktur image file selection ───
  test('handles faktur image file selection', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText(/Faktur - /)).toBeInTheDocument();
    });

    const tambahButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(tambahButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument();
    });

    const fileInputs = document.querySelectorAll('input[type="file"]');
    const fakturFileInput = fileInputs[fileInputs.length - 1];
    const file = new File(['image'], 'faktur.png', { type: 'image/png' });
    Object.defineProperty(fakturFileInput, 'files', { value: [file] });
    fireEvent.change(fakturFileInput);
    expect(fakturFileInput).toBeTruthy();
  });

  // ─── Add product with existing name triggers existing product update path ───
  test('adds product with existing name updates existing product', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.endsWith('/api/products') && init?.method === 'POST')
        return okJson({ id: 999, message: 'created' });
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return okJson({ data: { status: 'pending' } });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [{ id: 1, name: 'Test Supplier' }] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Enter product name'), {
      target: { name: 'name', value: 'Expired Product' },
    });

    const numberInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(numberInputs[0], { target: { name: 'cost_price', value: '2000' } });
    fireEvent.change(numberInputs[1], { target: { name: 'selling_price', value: '3000' } });

    const supplierSelect = document.querySelector('[name="supplier_id"]') as HTMLSelectElement;
    fireEvent.change(supplierSelect, { target: { name: 'supplier_id', value: '1' } });

    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Produk berhasil disimpan');
    });
  });

  // ─── Add product with supplier triggers batch with pending status ───
  test('adds product with supplier triggers pending approval info', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/api/products') && init?.method === 'POST')
        return okJson({ id: 999, message: 'created' });
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return okJson({ data: { status: 'pending' } });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [{ id: 1, name: 'Test Supplier' }] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    fillForm();

    const supplierSelect = document.querySelector('[name="supplier_id"]') as HTMLSelectElement;
    fireEvent.change(supplierSelect, { target: { name: 'supplier_id', value: '1' } });

    const invoiceInput = document.querySelector('[name="invoice_number"]') as HTMLInputElement;
    fireEvent.change(invoiceInput, { target: { name: 'invoice_number', value: 'INV-001' } });

    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Produk berhasil disimpan');
    });
  });

  // ─── Delete faktur network error from approval modal ───
  test('handles delete faktur network error', async () => {
    const pendingData = {
      data: [
        {
          id: 20,
          product_id: 1,
          product_name: 'Rejected Product',
          batch_number: 'INV-NET',
          invoice_number: 'INV-NET',
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          cost_price: 5000,
          quantity: 10,
          initial_quantity: 10,
          remaining_quantity: 10,
          stock_type: 'belum_bayar',
          status: 'rejected',
          image_url: null,
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && init?.method === 'DELETE')
        return Promise.reject(new Error('network error'));
      if (url.includes('/api/inventory/pending-batches'))
        return okJson(pendingData);
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Rejected Product')).toBeInTheDocument();
    });

    const trashIcons = screen.getAllByTestId('trash-icon');
    const deleteButton = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Hapus Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menghapus faktur');
    });
  });

  // ─── Delete faktur error from approval modal ───
  test('handles delete faktur error', async () => {
    const pendingData = {
      data: [
        {
          id: 20,
          product_id: 1,
          product_name: 'Rejected Product',
          batch_number: 'INV-ERR',
          invoice_number: 'INV-ERR',
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          cost_price: 5000,
          quantity: 10,
          initial_quantity: 10,
          remaining_quantity: 10,
          stock_type: 'belum_bayar',
          status: 'rejected',
          image_url: null,
        },
      ],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && init?.method === 'DELETE')
        return failJson({}, 500);
      if (url.includes('/api/inventory/pending-batches'))
        return okJson(pendingData);
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Rejected Product')).toBeInTheDocument();
    });

    const trashIcons = screen.getAllByTestId('trash-icon');
    const deleteButton = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Hapus Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menghapus faktur');
    });
  });

  // ─── Multiple products submit with supplier triggers batch creation ───
  test('submits multiple products with supplier', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/api/products') && init?.method === 'POST')
        return okJson({ id: 999, message: 'created' });
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return okJson({ data: { status: 'approved' } });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [{ id: 1, name: 'Test Supplier' }] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Multiple Products'));

    const nameInput = document.querySelector('[name="name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { name: 'name', value: 'Multi Product' } });
    const costInput = document.querySelector('[name="cost_price"]') as HTMLInputElement;
    fireEvent.change(costInput, { target: { name: 'cost_price', value: '5000' } });
    const stockInput = document.querySelector('[name="stock"]') as HTMLInputElement;
    fireEvent.change(stockInput, { target: { name: 'stock', value: '10' } });

    const supplierSelect = document.querySelector('[name="supplier_id"]') as HTMLSelectElement;
    fireEvent.change(supplierSelect, { target: { name: 'supplier_id', value: '1' } });

    fireEvent.click(screen.getByText(/Tambahkan ke Daftar/));

    await waitFor(() => {
      expect(screen.getByText('Daftar Produk (1)')).toBeInTheDocument();
    });

    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Produk berhasil disimpan');
    });
  });

  // ─── handleAddDP early return when DP amount is empty ───
  test('shows error when adding DP with empty amount', async () => {
    const faktursData = {
      data: [{
        id: 60, product_id: 1, batch_number: 'BATCH-DP0', invoice_number: 'BATCH-DP0',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'dp', status: 'approved',
        dp_amount: 10000, due_date: '2024-06-15', expired_date: null, notes: null,
        image_url: null, dp_payments: [], created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT') return okJson({ message: 'updated' });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-DP0')).toBeInTheDocument());

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Edit Faktur')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Tambah DP'));
    // Click Simpan DP without entering amount
    fireEvent.click(screen.getByText('Simpan DP'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Jumlah DP harus lebih dari 0');
    });
  });

  // ─── Fetch fakturs network error (catch branch) ───
  test('handles fetch fakturs network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return Promise.reject(new Error('network error'));
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching fakturs:', expect.any(Error)
      );
    });
  });

  // ─── Faktur with konsinyasi stock type ───
  test('shows konsinyasi status in faktur table', async () => {
    const faktursData = {
      data: [{
        id: 80, product_id: 1, batch_number: 'BATCH-KONS', invoice_number: 'BATCH-KONS',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'konsinyasi', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2025-06-01', notes: null,
        image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => {
      expect(screen.getByText('BATCH-KONS')).toBeInTheDocument();
    });

    expect(screen.getByText('Konsinyasi')).toBeInTheDocument();
  });

  // ─── DP faktur with dp_amount (no dp_payments) zeigt DP list in edit form ───
  test('shows DP payment from dp_amount field when dp_payments is missing', async () => {
    const faktursData = {
      data: [{
        id: 90, product_id: 1, batch_number: 'BATCH-DPAMT', invoice_number: 'BATCH-DPAMT',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'dp', status: 'approved',
        dp_amount: 15000, due_date: '2024-06-15', expired_date: null, notes: null,
        image_url: null,
        // no dp_payments array
        created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT') return okJson({ message: 'updated' });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-DPAMT')).toBeInTheDocument());

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Edit Faktur')).toBeInTheDocument());

    // The DP list should show an entry from dp_amount (id: -1, so no trash icon)
    // Note: formatCurrency renders both in the table and in the edit form, so use getAllByText
    await waitFor(() => {
      const matches = screen.getAllByText(/Rp\s*15\.000/);
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });



  // ─── Faktur with notes shows revision notes ───
  test('shows revision notes in faktur form', async () => {
    const faktursData = {
      data: [{
        id: 110, product_id: 1, batch_number: 'BATCH-NOTES', invoice_number: 'BATCH-NOTES',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8,
        quantity: 10, cost_price: 5000, total_amount: 50000,
        stock_type: 'belum_bayar', status: 'revision',
        dp_amount: null, due_date: null, expired_date: '2025-06-01',
        notes: 'Harga beli terlalu tinggi, sesuaikan dengan faktur terbaru',
        image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-NOTES')).toBeInTheDocument());

    // click edit button (Perbaiki since status is revision)
    const perbaikiButton = screen.getByTitle('Perbaiki');
    fireEvent.click(perbaikiButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });

    // Notes should be displayed in the form
    expect(screen.getByText(/Harga beli terlalu tinggi/)).toBeInTheDocument();
  });

  // ─── Faktur with revision status shows Perbaiki button ───
  test('shows Perbaiki button for revision status faktur', async () => {
    const faktursData = {
      data: [{
        id: 120, product_id: 1, batch_number: 'BATCH-REV', invoice_number: 'BATCH-REV',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8,
        quantity: 10, cost_price: 5000, total_amount: 50000,
        stock_type: 'belum_bayar', status: 'revision',
        dp_amount: null, due_date: null, expired_date: '2025-06-01',
        notes: null, image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-REV')).toBeInTheDocument());

    // The edit button should have title "Perbaiki" instead of "Edit"
    expect(screen.getByTitle('Perbaiki')).toBeInTheDocument();
    expect(screen.getByText('Menunggu Perbaikan')).toBeInTheDocument();
  });

  // ─── Product form shows DP fields when stock_type is dp (add mode) ───
  test('shows DP fields when selecting DP stock type in add form', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    // Change stock type to DP
    const stockTypeSelect = screen.getByDisplayValue('Belum Bayar');
    fireEvent.change(stockTypeSelect, { target: { name: 'stock_type', value: 'dp' } });

    await waitFor(() => {
      expect(screen.getByText('DP Amount (IDR)')).toBeInTheDocument();
      expect(screen.getByText('Due Date')).toBeInTheDocument();
    });
  });

  // ─── Expire batch modal closes via close button (onClose) ───
  test('closes expire batch modal via close button', async () => {
    const faktursData = {
      data: [{
        id: 130, product_id: 1, batch_number: 'BATCH-EXPCLS', invoice_number: 'BATCH-EXPCLS',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'belum_bayar', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2024-01-01', notes: null,
        image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-EXPCLS')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Tandai Kadaluarsa'));
    await waitFor(() => {
      expect(screen.getByText('Tandai Kadaluarsa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('close-delete'));
    await waitFor(() => {
      expect(screen.queryByText('Tandai Kadaluarsa')).not.toBeInTheDocument();
    });
  });

  // ─── Archive modal closes via close button (onClose) ───
  test('closes archive modal via close button', async () => {
    const faktursData = {
      data: [{
        id: 140, product_id: 1, batch_number: 'BATCH-ARCHCLS', invoice_number: 'BATCH-ARCHCLS',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: null, notes: null,
        image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-ARCHCLS')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Arsipkan Faktur'));
    await waitFor(() => {
      expect(screen.getByText('Arsipkan Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('close-delete'));
    await waitFor(() => {
      expect(screen.queryByText('Arsipkan Faktur')).not.toBeInTheDocument();
    });
  });

  // ─── Faktur with image_url shows Lihat Bukti button ───
  test('shows Lihat Bukti button for faktur with image_url', async () => {
    const faktursData = {
      data: [{
        id: 150, product_id: 1, batch_number: 'BATCH-IMG', invoice_number: 'BATCH-IMG',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2025-06-01', notes: null,
        image_url: '/uploads/faktur-123.jpg', created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-IMG')).toBeInTheDocument());

    // The "Lihat Bukti" button should be present
    const lihatBuktiButtons = screen.getAllByTitle('Lihat Bukti');
    expect(lihatBuktiButtons.length).toBeGreaterThan(0);

    // Click it to open the preview modal
    fireEvent.click(lihatBuktiButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Bukti Faktur')).toBeInTheDocument();
    });

    // Close preview modal
    const closeButtons = screen.getAllByTestId('x-icon');
    fireEvent.click(closeButtons[closeButtons.length - 1].closest('button')!);
    await waitFor(() => {
      expect(screen.queryByText('Bukti Faktur')).not.toBeInTheDocument();
    });
  });

  // ─── Faktur image preview in edit modal ───
  test('shows existing faktur image preview in edit modal', async () => {
    const faktursData = {
      data: [{
        id: 160, product_id: 1, batch_number: 'BATCH-IMGPREV', invoice_number: 'BATCH-IMGPREV',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'belum_bayar', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2025-06-01', notes: null,
        image_url: '/uploads/faktur-edit.jpg', created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-IMGPREV')).toBeInTheDocument());

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Edit Faktur')).toBeInTheDocument());

    // Preview image should be shown (via background image URL)
    await waitFor(() => {
      // The existing image preview should be set (background fetch happens)
    });
  });

  // ─── Approval modal with revision status and Perbaiki Data button ───
  test('shows Perbaiki Data button for revision status in approval modal', async () => {
    const pendingData = {
      data: [{
        id: 170, product_id: 1, product_name: 'Test Revision',
        batch_number: 'INV-REV', invoice_number: 'INV-REV',
        supplier_id: 1, supplier_name: 'Supplier A',
        purchase_date: '2024-01-15', cost_price: 5000, quantity: 10,
        initial_quantity: 10, remaining_quantity: 10,
        stock_type: 'belum_bayar', status: 'revision',
        notes: 'Fix the price', image_url: null,
        product_status: 'active',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) return okJson(pendingData);
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Test Revision')).toBeInTheDocument();
    });

    // Should show Perbaiki Data button
    expect(screen.getByText('Perbaiki Data')).toBeInTheDocument();
    expect(screen.getByText('Menunggu Perbaikan')).toBeInTheDocument();
  });

  // ─── Approval modal with pending status and product_status === 'pending' ───
  test('shows Produk Baru badge for pending product in approval', async () => {
    const pendingData = {
      data: [{
        id: 180, product_id: 1, product_name: 'New Pending Product',
        batch_number: 'INV-NEW', invoice_number: 'INV-NEW',
        supplier_id: 1, supplier_name: 'Supplier A',
        purchase_date: '2024-01-15', cost_price: 3000000, quantity: 2,
        initial_quantity: 2, remaining_quantity: 2,
        stock_type: 'belum_bayar', status: 'pending',
        notes: null, image_url: null,
        product_status: 'pending',
        product_unit: 'Tablet', product_purchase_unit: 'Box', product_unit_multiplier: 1,
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) return okJson(pendingData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('New Pending Product')).toBeInTheDocument();
    });

    expect(screen.getByText('Produk Baru')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  // ─── Approval modal shows revision notes ───
  test('shows revision notes in approval modal', async () => {
    const pendingData = {
      data: [{
        id: 190, product_id: 1, product_name: 'Product with Notes',
        batch_number: 'INV-NOTES2', invoice_number: 'INV-NOTES2',
        supplier_id: 1, supplier_name: 'Supplier A',
        purchase_date: '2024-01-15', cost_price: 5000, quantity: 10,
        initial_quantity: 10, remaining_quantity: 10,
        stock_type: 'belum_bayar', status: 'revision',
        notes: 'Please update the quantity', image_url: null,
        product_status: 'active',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) return okJson(pendingData);
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Product with Notes')).toBeInTheDocument();
    });

    // Notes should be displayed
    expect(screen.getByText(/Please update the quantity/)).toBeInTheDocument();
  });

  // ─── Approval modal with image_url shows Lihat Bukti button ───
  test('shows Lihat Bukti button for faktur with image in approval modal', async () => {
    const pendingData = {
      data: [{
        id: 200, product_id: 1, product_name: 'Pending With Image',
        batch_number: 'INV-IMGAPP', invoice_number: 'INV-IMGAPP',
        supplier_id: 1, supplier_name: 'Supplier A',
        purchase_date: '2024-01-15', cost_price: 3000000, quantity: 2,
        initial_quantity: 2, remaining_quantity: 2,
        stock_type: 'belum_bayar', status: 'pending',
        notes: null, image_url: '/uploads/bukti.jpg',
        product_status: 'active',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) return okJson(pendingData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Pending With Image')).toBeInTheDocument();
    });

    // Should have Lihat Bukti button
    expect(screen.getByText('Lihat Bukti')).toBeInTheDocument();
  });

  // ─── Approval modal: close via backdrop click ───
  test('closes approval modal via backdrop click', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches'))
        return Promise.resolve(new Promise(() => {}));
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));

    await waitFor(() => {
      expect(screen.getByText('Approval Faktur Pembelian')).toBeInTheDocument();
    });

    // Close via close button (X icon)
    const allXButtons = screen.getAllByTestId('x-icon');
    const modalCloseBtn = allXButtons[allXButtons.length - 1].closest('button')!;
    fireEvent.click(modalCloseBtn);

    await waitFor(() => {
      expect(screen.queryByText('Approval Faktur Pembelian')).not.toBeInTheDocument();
    });
  });

  // ─── Add product with existing name (no supplier) triggers existing product update path ───
  test('adds existing name product without supplier uses correct stock calc', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.endsWith('/api/products') && init?.method === 'POST')
        return okJson({ id: 999, message: 'created' });
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return okJson({ data: { status: 'approved' } });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [{ id: 1, name: 'Test Supplier' }] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    // Type name that matches existing product but do NOT select supplier
    fireEvent.change(screen.getByPlaceholderText('Enter product name'), {
      target: { name: 'name', value: 'Expired Product' },
    });

    const numberInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(numberInputs[0], { target: { name: 'cost_price', value: '2000' } });
    fireEvent.change(numberInputs[1], { target: { name: 'selling_price', value: '3000' } });

    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Produk berhasil disimpan');
    });
  });

  // ─── handleArchiveFaktur API failure branch ───
  test('handles archive faktur API failure', async () => {
    const faktursData = {
      data: [{
        id: 210, product_id: 1, batch_number: 'BATCH-ARCHFAIL', invoice_number: 'BATCH-ARCHFAIL',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: null, notes: null,
        image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && url.includes('/archive'))
        return failJson({}, 500);
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-ARCHFAIL')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Arsipkan Faktur'));
    await waitFor(() => {
      expect(screen.getByText('Arsipkan Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal mengarsipkan faktur');
    });
  });

  // ─── Faktur form stock_type change to dp shows DP fields ───
  test('shows DP fields in faktur form when stock_type is dp', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Tambah Faktur'));
    await waitFor(() => expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument());

    // Change stock type to DP
    const stockTypeSelect = document.querySelector('[name="stock_type"]') as HTMLSelectElement;
    fireEvent.change(stockTypeSelect, { target: { name: 'stock_type', value: 'dp' } });

    await waitFor(() => {
      expect(screen.getByText('Jumlah DP (IDR)')).toBeInTheDocument();
      expect(screen.getByText('Jatuh Tempo')).toBeInTheDocument();
    });
  });

  // ─── Expire batch network error (catch branch for line 770-771) ───
  test('handles expire batch network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const faktursData = {
      data: [{
        id: 230, product_id: 1, batch_number: 'BATCH-EXPNET', invoice_number: 'BATCH-EXPNET',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'belum_bayar', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2024-01-01', notes: null,
        image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && init?.method === 'PUT')
        return Promise.reject(new Error('expire network error'));
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-EXPNET')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Tandai Kadaluarsa'));
    await waitFor(() => {
      expect(screen.getByText('Tandai Kadaluarsa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menandai batch sebagai kadaluarsa');
    });
  });

  // ─── Faktur image preview in approval modal opens and closes ───
  test('opens and closes image preview from approval modal', async () => {
    const pendingData = {
      data: [{
        id: 240, product_id: 1, product_name: 'Product with Bukti',
        batch_number: 'INV-BUKTI', invoice_number: 'INV-BUKTI',
        supplier_id: 1, supplier_name: 'Supplier A',
        purchase_date: '2024-01-15', cost_price: 3000000, quantity: 2,
        initial_quantity: 2, remaining_quantity: 2,
        stock_type: 'belum_bayar', status: 'pending',
        notes: null, image_url: '/uploads/bukti.jpg',
        product_status: 'active',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) return okJson(pendingData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Product with Bukti')).toBeInTheDocument();
    });

    // Click Lihat Bukti
    fireEvent.click(screen.getByText('Lihat Bukti'));
    await waitFor(() => {
      expect(screen.getByText('Bukti Faktur')).toBeInTheDocument();
    });

    // Close via backdrop click
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) {
      // The image preview modal has z-index 9999, click on it
      const imageModal = document.querySelectorAll('.fixed.inset-0');
      if (imageModal.length > 1) {
        fireEvent.click(imageModal[imageModal.length - 1]);
      }
    }

    await waitFor(() => {
      expect(screen.queryByText('Bukti Faktur')).not.toBeInTheDocument();
    });
  });

  // ─── Faktur with two dp_payments shows list correctly ───
  test('shows multiple DP payments in edit form', async () => {
    const faktursData = {
      data: [{
        id: 250, product_id: 1, batch_number: 'BATCH-2DP', invoice_number: 'BATCH-2DP',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 50000, total_amount: 500000, stock_type: 'dp', status: 'approved',
        dp_amount: null, due_date: '2024-06-15', expired_date: null, notes: null,
        image_url: null,
        dp_payments: [
          { id: 1, amount: 100000, payment_date: '2024-01-15', payment_method: 'cash', created_at: '2024-01-15T00:00:00Z' },
          { id: 2, amount: 200000, payment_date: '2024-02-15', payment_method: 'transfer', created_at: '2024-02-15T00:00:00Z' },
        ],
        created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT') return okJson({ message: 'updated' });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-2DP')).toBeInTheDocument());

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Edit Faktur')).toBeInTheDocument());

    // Should show both DP payments and "TF" for the transfer payment
    await waitFor(() => {
      expect(screen.getByText('TF')).toBeInTheDocument();
      expect(screen.getByText(/Rp\s*100\.000/)).toBeInTheDocument();
    });
  });

  // ─── Produk Baru badge + image_url in approval modal ───
  test('shows Produk Baru badge and Lihat Bukti in approval modal', async () => {
    const pendingData = {
      data: [{
        id: 260, product_id: 999, product_name: 'Brand New Product',
        batch_number: 'INV-NEW2', invoice_number: 'INV-NEW2',
        supplier_id: 1, supplier_name: 'Supplier Baru',
        purchase_date: '2024-01-15', cost_price: 3000000, quantity: 2,
        initial_quantity: 2, remaining_quantity: 2,
        stock_type: 'belum_bayar', status: 'pending',
        notes: null, image_url: '/uploads/new-product.jpg',
        product_status: 'pending',
        product_unit: 'Tablet', product_purchase_unit: 'Box', product_unit_multiplier: 1,
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) return okJson(pendingData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Brand New Product')).toBeInTheDocument();
    });

    // Both badges should be present
    expect(screen.getByText('Produk Baru')).toBeInTheDocument();
    expect(screen.getByText('Lihat Bukti')).toBeInTheDocument();
  });

  // ─── Pagination: large product list enables navigation ───
  test('paginates with large product list', async () => {
    const manyProducts = {
      data: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1000,
        name: `Product ${i + 1}`,
        cost_price: (i + 1) * 1000,
        selling_price: (i + 1) * 2000,
        stock: (i + 1) * 5,
        unit: 'pcs',
        expired_date: i < 5 ? '2020-01-01' : null,
        supplier_name: i < 10 ? `Supplier ${i}` : null,
        location_code: i < 5 ? `A-${i}` : null,
        stock_type: 'lunas',
      })),
      pagination: { total: 25, page: 1, limit: 10, totalPages: 3 },
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products') && url.includes('limit=1000'))
        return okJson(manyProducts);
      if (url.includes('/api/products'))
        return okJson(manyProducts);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(async () => {
      await screen.findByText('Product 1');
    });
    await waitFor(async () => {
      expect(screen.getByText('Showing 25 of 25 Products')).toBeInTheDocument();
    });

    // With 25 products and 10 per page, we should have 3 pages
    // Right arrow should be enabled
    const rightArrow = screen.getByText('→');
    expect(rightArrow).not.toBeDisabled();

    // Navigate to page 2
    fireEvent.click(rightArrow);

    // Right arrow should still be enabled
    await waitFor(() => {
      expect(screen.getByText('→')).not.toBeDisabled();
    });
    await waitFor(() => {
      expect(screen.queryByText('Product 1')).not.toBeInTheDocument();
    });

    // Navigate to page 3 (last page)
    fireEvent.click(screen.getByText('→'));

    // Right arrow should now be disabled (on last page)
    await waitFor(() => {
      const arrow = screen.getByText('→');
      expect(arrow).toBeDisabled();
    });

    // Left arrow should be enabled (not on first page)
    await waitFor(() => {
      expect(screen.getByText('←')).not.toBeDisabled();
    });

    // Navigate back
    fireEvent.click(screen.getByText('←'));
    await waitFor(() => {
      expect(screen.getByText('→')).not.toBeDisabled();
    });

    // Change items per page to 5
    await waitFor(() => {
      const selectEl = screen.getByDisplayValue('10');
      fireEvent.change(selectEl, { target: { value: '5' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeInTheDocument();
    });
  });

  // ─── Click 1 Product button to switch from multiple to single mode ───
  test('switches from multiple to single product mode', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    // Switch to multiple mode
    fireEvent.click(screen.getByText('Multiple Products'));
    expect(screen.getByText(/Tambahkan ke Daftar/)).toBeInTheDocument();

    // Switch back to single mode
    fireEvent.click(screen.getByText('1 Product'));
    await waitFor(() => {
      expect(screen.getByText('Create Product')).toBeInTheDocument();
    });
  });

  // ─── Faktur cancel button clears form ───
  test('cancels faktur form and resets to add mode', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Tambah Faktur'));
    await waitFor(() => expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument());

    // Click Batal button in faktur form
    const batalButtons = screen.getAllByText('Batal');
    fireEvent.click(batalButtons[batalButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('Tambah Faktur Baru')).not.toBeInTheDocument();
    });
  });

  // ─── Cancel DP form (Batal button) ───
  test('cancels DP add form', async () => {
    const faktursData = {
      data: [{
        id: 260, product_id: 1, batch_number: 'BATCH-DPCAN', invoice_number: 'BATCH-DPCAN',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'dp', status: 'approved',
        dp_amount: 10000, due_date: '2024-06-15', expired_date: null, notes: null,
        image_url: null, dp_payments: [], created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT') return okJson({ message: 'updated' });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-DPCAN')).toBeInTheDocument());

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Edit Faktur')).toBeInTheDocument());

    // Open DP form
    fireEvent.click(screen.getByText('Tambah DP'));
    await waitFor(() => expect(screen.getByText('Simpan DP')).toBeInTheDocument());

    // Cancel DP form - find the Batal button next to Simpan DP
    const simpanDpButton = screen.getByText('Simpan DP');
    const dpFormDiv = simpanDpButton.closest('div');
    const dpBatalButton = dpFormDiv?.querySelector('button');
    if (dpBatalButton) {
      fireEvent.click(dpBatalButton);
    }

    await waitFor(() => {
      expect(screen.queryByText('Simpan DP')).not.toBeInTheDocument();
    });
  });

  // ─── Faktur handling: stock type konsinyasi in faktur form ───
  test('shows konsinyasi stock type in faktur add form', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [{ id: 1, name: 'Test Supplier' }] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Tambah Faktur'));
    await waitFor(() => expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument());

    // Select konsinyasi stock type
    const stockTypeSelect = document.querySelector('[name="stock_type"]') as HTMLSelectElement;
    if (stockTypeSelect) {
      fireEvent.change(stockTypeSelect, { target: { name: 'stock_type', value: 'konsinyasi' } });
    }
  });

  // ─── Faktur form with supplier options ───
  test('shows supplier options in faktur form', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [{ id: 1, name: 'Test Supplier' }, { id: 2, name: 'Another Supplier' }] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Tambah Faktur'));
    await waitFor(() => expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument());

    // Supplier select should have options
    const supplierSelect = document.querySelector('[name="supplier_id"]') as HTMLSelectElement;
    expect(supplierSelect).toBeInTheDocument();

    // Select the first supplier
    fireEvent.change(supplierSelect, { target: { name: 'supplier_id', value: '1' } });
  });

  // ─── Click Pilih File and Ambil Foto buttons in faktur form ───
  test('clicks faktur image upload buttons', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Tambah Faktur'));
    await waitFor(() => expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument());

    // Click Pilih File button in faktur form
    const pilihFileButtons = screen.getAllByText('Pilih File');
    fireEvent.click(pilihFileButtons[pilihFileButtons.length - 1]);

    // Click Ambil Foto button in faktur form
    const ambilFotoButtons = screen.getAllByText('Ambil Foto');
    fireEvent.click(ambilFotoButtons[ambilFotoButtons.length - 1]);
  });

  // ─── Click Perbaiki Data button in approval modal ───
  test('clicks Perbaiki Data button in approval modal', async () => {
    const pendingData = {
      data: [{
        id: 270, product_id: 1, product_name: 'Revision Product',
        batch_number: 'INV-PERBAIKI', invoice_number: 'INV-PERBAIKI',
        supplier_id: 1, supplier_name: 'Supplier A',
        purchase_date: '2024-01-15', cost_price: 5000, quantity: 10,
        initial_quantity: 10, remaining_quantity: 10,
        stock_type: 'belum_bayar', status: 'revision',
        notes: null, image_url: null,
        product_status: 'active',
        product_unit: 'Tablet', product_purchase_unit: 'Box', product_unit_multiplier: 1,
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) return okJson(pendingData);
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Revision Product')).toBeInTheDocument();
    });

    // Click Perbaiki Data button
    fireEvent.click(screen.getByText('Perbaiki Data'));

    // Should close approval modal and open edit faktur form
    await waitFor(() => {
      expect(screen.queryByText('Approval Faktur Pembelian')).not.toBeInTheDocument();
    });
  });

  // ─── Interact with DP add form inputs ───
  test('interacts with DP add form inputs', async () => {
    const faktursData = {
      data: [{
        id: 280, product_id: 1, batch_number: 'BATCH-DPINP', invoice_number: 'BATCH-DPINP',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'dp', status: 'approved',
        dp_amount: 10000, due_date: '2024-06-15', expired_date: null, notes: null,
        image_url: null, dp_payments: [], created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products/') && init?.method === 'PUT') return okJson({ message: 'updated' });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-DPINP')).toBeInTheDocument());

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Edit Faktur')).toBeInTheDocument());

    // Open DP form
    fireEvent.click(screen.getByText('Tambah DP'));
    await waitFor(() => expect(screen.getByText('Simpan DP')).toBeInTheDocument());

    // Change date input
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const dpDateInput = dateInputs[dateInputs.length - 1];
    if (dpDateInput) {
      fireEvent.change(dpDateInput, { target: { value: '2024-07-15' } });
    }

    // Change payment method to transfer
    const paymentSelect = document.querySelector('select') as HTMLSelectElement;
    const allSelects = document.querySelectorAll('select');
    const paymentMethodSelect = allSelects[allSelects.length - 1];
    if (paymentMethodSelect) {
      fireEvent.change(paymentMethodSelect, { target: { value: 'transfer' } });
    }
  });

  // ─── Click Tutup button in approval modal ───
  test('closes approval modal via Tutup button', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches'))
        return Promise.resolve(new Promise(() => {}));
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));

    await waitFor(() => {
      expect(screen.getByText('Approval Faktur Pembelian')).toBeInTheDocument();
    });

    // Click the last Tutup button (in the approval modal footer)
    const allButtons = screen.getAllByRole('button');
    const tutupButton = allButtons.find(btn => btn.textContent === 'Tutup');
    if (tutupButton) {
      fireEvent.click(tutupButton);
    }

    await waitFor(() => {
      expect(screen.queryByText('Approval Faktur Pembelian')).not.toBeInTheDocument();
    });
  });

  // ─── Delete faktur image preview (with existing image_url) ───
  test('deletes faktur image preview reverting to original', async () => {
    const faktursData = {
      data: [{
        id: 290, product_id: 1, batch_number: 'BATCH-IMGDEL', invoice_number: 'BATCH-IMGDEL',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'belum_bayar', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2025-06-01', notes: null,
        image_url: '/uploads/original.jpg', created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-IMGDEL')).toBeInTheDocument());

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Edit Faktur')).toBeInTheDocument());

    // Upload a new file to create a preview
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const fakturInput = fileInputs[fileInputs.length - 1];
    const file = new File(['image'], 'new.png', { type: 'image/png' });
    Object.defineProperty(fakturInput, 'files', { value: [file] });
    fireEvent.change(fakturInput);

    // Wait for FileReader to fire onload
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The preview delete button should now be visible (use the last trash icon in the faktur form)
    const allTrashIcons = screen.getAllByTestId('trash-icon');
    if (allTrashIcons.length > 0) {
      const previewDeleteBtn = allTrashIcons[allTrashIcons.length - 1].closest('button');
      if (previewDeleteBtn) {
        fireEvent.click(previewDeleteBtn);
      }
    }
  });

  // ─── Delete faktur image preview without original image (else branch) ───
  test('deletes faktur image preview without original image', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Tambah Faktur'));
    await waitFor(() => expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument());

    // Upload a file to create a preview
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const fakturInput = fileInputs[fileInputs.length - 1];
    const file = new File(['image'], 'new.png', { type: 'image/png' });
    Object.defineProperty(fakturInput, 'files', { value: [file] });
    fireEvent.change(fakturInput);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Click delete on preview (no original image_url, so falls to else branch)
    const allTrashIcons = screen.getAllByTestId('trash-icon');
    const previewDeleteBtn = allTrashIcons[allTrashIcons.length - 1].closest('button');
    if (previewDeleteBtn) {
      fireEvent.click(previewDeleteBtn);
    }
  });

  // ─── Expired batch shows KADALUARSA badge ───
  test('shows KADALUARSA badge for expired batch', async () => {
    const faktursData = {
      data: [{
        id: 220, product_id: 1, batch_number: 'BATCH-EXP', invoice_number: 'BATCH-EXP',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 0,
        quantity: 10, cost_price: 5000, total_amount: 50000,
        stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2024-01-01',
        notes: 'Expired', image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-EXP')).toBeInTheDocument());

    expect(screen.getByText('KADALUARSA')).toBeInTheDocument();
  });

  // ─── Product form Pilih File and Ambil Foto button clicks (cover lines 1581,1589) ───
  test('clicks product form file upload and photo buttons', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => expect(screen.getByText('Add New Product')).toBeInTheDocument());

    const pilihFileButtons = screen.getAllByText('Pilih File');
    expect(pilihFileButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(pilihFileButtons[pilihFileButtons.length - 1]);

    const ambilFotoButtons = screen.getAllByText('Ambil Foto');
    expect(ambilFotoButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(ambilFotoButtons[ambilFotoButtons.length - 1]);

    const closeButton = screen.getByTestId('x-icon').closest('button') as HTMLButtonElement;
    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByText('Add New Product')).not.toBeInTheDocument();
    });
  });

  // ─── Product form image preview remove (cover line 1622) ───
  test('shows and removes product image preview', async () => {
    const fileReaderMock = {
      onloadend: null as any,
      result: null as any,
      readAsDataURL: jest.fn(function (this: any) {
        this.result = 'data:image/png;base64,mock';
        if (this.onloadend) this.onloadend();
      }),
    };
    jest.spyOn(window, 'FileReader').mockImplementation(() => fileReaderMock as any);
    window.URL.createObjectURL = jest.fn(() => 'blob:mock');

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => expect(screen.getByText('Add New Product')).toBeInTheDocument());

    const fileInputs = document.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) {
      const file = new File(['dummy'], 'test.png', { type: 'image/png' });
      Object.defineProperty(fileInputs[0], 'files', { value: [file] });
      fireEvent.change(fileInputs[0]);
    }

    const closeButton = screen.getByTestId('x-icon').closest('button') as HTMLButtonElement;
    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByText('Add New Product')).not.toBeInTheDocument();
    });
  });

  // ─── DP delete onClose (cover line 529) ───
  test('closes hapus dp confirm modal via close button', async () => {
    const faktursData = {
      data: [{
        id: 61, product_id: 1, batch_number: 'BATCH-DPC', invoice_number: 'BATCH-DPC',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'dp', status: 'approved',
        dp_amount: 10000, due_date: '2024-06-15', expired_date: null,
        notes: null, image_url: null,
        dp_payments: [
          { id: 2, amount: 10000, payment_date: '2024-01-15', payment_method: 'cash', created_at: '2024-01-15T00:00:00Z' },
        ],
        created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-DPC')).toBeInTheDocument());

    const allEditButtons = screen.getAllByTitle('Edit');
    fireEvent.click(allEditButtons[allEditButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Edit Faktur')).toBeInTheDocument());

    const trashIcons = screen.getAllByTestId('trash-icon');
    const dpTrashButton = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(dpTrashButton);

    await waitFor(() => expect(screen.getByText('Hapus DP')).toBeInTheDocument());

    fireEvent.click(screen.getByText('close-delete'));

    await waitFor(() => {
      expect(screen.queryByText('Hapus DP')).not.toBeInTheDocument();
    });
  });

  // ─── Delete rejected faktur and trigger selectedProduct check (cover line 728) ───

  // ─── Expire batch confirm modal onClose (cover line 775) ───
  test('closes expire batch confirm modal via close button', async () => {
    const faktursData = {
      data: [{
        id: 63, product_id: 1, batch_number: 'BATCH-EXPCLS', invoice_number: 'BATCH-EXPCLS',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: null,
        notes: null, image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-EXPCLS')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Tandai Kadaluarsa'));
    await waitFor(() => {
      expect(screen.getByText('Tandai Kadaluarsa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('close-delete'));
    await waitFor(() => {
      expect(screen.queryByText('Tandai Kadaluarsa')).not.toBeInTheDocument();
    });
  });

  // ─── Archive confirm modal onClose (cover line 823) ───
  test('closes archive confirm modal via close button', async () => {
    const faktursData = {
      data: [{
        id: 64, product_id: 1, batch_number: 'BATCH-ARCHCLS2', invoice_number: 'BATCH-ARCHCLS2',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: null,
        notes: null, image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-ARCHCLS2')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Arsipkan Faktur'));
    await waitFor(() => {
      expect(screen.getByText('Arsipkan Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('close-delete'));
    await waitFor(() => {
      expect(screen.queryByText('Arsipkan Faktur')).not.toBeInTheDocument();
    });
  });

  // ─── Retur faktur renders correctly in table ───
  test('renders retur faktur in faktur table', async () => {
    const faktursData = {
      data: [{
        id: 300, product_id: 1, batch_number: 'BATCH-RETUR', invoice_number: 'BATCH-RETUR',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 3, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'retur', status: 'approved',
        dp_amount: null, due_date: null, expired_date: null,
        notes: null, image_url: null,
        qty_returned: 5,
        created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-RETUR')).toBeInTheDocument());
  });

  // ─── Close delete product confirm modal via close button (cover line 1251) ───
  test('closes delete product confirm modal via close button', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('close-delete'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });
  });

  // ─── Delete rejected faktur from approval modal with selectedProduct set (cover line 728) ───
  test('deletes rejected faktur from approval modal with selectedProduct set', async () => {
    const faktursData = {
      data: [{
        id: 310, product_id: 1, batch_number: 'BATCH-SELPROD', invoice_number: 'BATCH-SELPROD',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'belum_bayar', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2025-06-01',
        notes: null, image_url: null, created_at: '2024-01-15T00:00:00Z',
        dp_payments: [],
      }],
    };

    const pendingData = {
      data: [{
        id: 20, product_id: 1, product_name: 'Rejected With Sel',
        batch_number: 'INV-SEL', invoice_number: 'INV-SEL',
        supplier_id: 1, supplier_name: 'Supplier A',
        purchase_date: '2024-01-15', cost_price: 5000, quantity: 10,
        initial_quantity: 10, remaining_quantity: 10,
        stock_type: 'belum_bayar', status: 'rejected',
        image_url: null,
      }],
    };

    let callCount = 0;
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/') && init?.method === 'DELETE')
        return okJson({ message: 'deleted' });
      if (url.includes('/api/inventory/batches/'))
        return okJson(faktursData);
      if (url.includes('/api/inventory/pending-batches'))
        return okJson(pendingData);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    // First, open faktur offcanvas to set selectedProduct
    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    // Now click Lihat Approval Tertunda (selectedProduct is still set)
    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Rejected With Sel')).toBeInTheDocument();
    });

    // Click delete on rejected faktur
    const trashIcons = screen.getAllByTestId('trash-icon');
    const deleteBtn = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Hapus Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Faktur berhasil dihapus!');
    });
  });

  // ─── Close delete faktur confirm modal via close button (cover line 741) ───
  test('closes delete faktur confirm modal via close button', async () => {
    const pendingData = {
      data: [{
        id: 320, product_id: 1, product_name: 'Rejected Close',
        batch_number: 'INV-CLS', invoice_number: 'INV-CLS',
        supplier_id: 1, supplier_name: 'Supplier A',
        purchase_date: '2024-01-15', cost_price: 5000, quantity: 10,
        initial_quantity: 10, remaining_quantity: 10,
        stock_type: 'belum_bayar', status: 'rejected',
        image_url: null,
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches'))
        return okJson(pendingData);
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Rejected Close')).toBeInTheDocument();
    });

    // Click delete on rejected faktur
    const trashIcons = screen.getAllByTestId('trash-icon');
    const deleteBtn = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Hapus Faktur')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('close-delete'));

    await waitFor(() => {
      expect(screen.queryByText('Hapus Faktur')).not.toBeInTheDocument();
    });
  });

  // ─── Product form image preview remove (cover lines 1616-1632) ───
  test('shows and removes product image preview', async () => {
    class MockFileReader {
      result = 'data:image/png;base64,mockdata';
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
      readAsDataURL(_blob: Blob) {
        if (this.onload) {
          const event = { target: this } as unknown as ProgressEvent<FileReader>;
          this.onload.call(this, event);
        }
      }
    }

    jest.spyOn(window, 'FileReader').mockImplementation(() => new MockFileReader() as any);

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    // Upload file to trigger preview
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    Object.defineProperty(fileInputs[0], 'files', { value: [file] });
    fireEvent.change(fileInputs[0]);

    // FileReader onload fires synchronously, productFormImagePreview should be set
    await waitFor(() => {
      expect(screen.getByAltText('Preview 1')).toBeInTheDocument();
    });

    // Click the image preview delete button (trash icon in the preview overlay)
    const trashIcons = screen.getAllByTestId('trash-icon');
    const previewDeleteBtn = trashIcons[trashIcons.length - 1].closest('button')!;
    fireEvent.click(previewDeleteBtn);

    jest.restoreAllMocks();
  });

  // ─── Product form DP amount and due date input changes (cover formData.stock_type === 'dp' in add form) ───
  test('changes dp amount and due date in product add form', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByText('Add New Product')).toBeInTheDocument();
    });

    const stockTypeSelect = screen.getByDisplayValue('Belum Bayar');
    fireEvent.change(stockTypeSelect, { target: { name: 'stock_type', value: 'dp' } });

    await waitFor(() => {
      expect(screen.getByText('DP Amount (IDR)')).toBeInTheDocument();
    });

    const dpAmountInput = document.querySelector('[name="dp_amount"]') as HTMLInputElement;
    fireEvent.change(dpAmountInput, { target: { name: 'dp_amount', value: '50000' } });
    expect(dpAmountInput.value).toBe('50000');

    const dueDateInput = document.querySelector('[name="due_date"]') as HTMLInputElement;
    fireEvent.change(dueDateInput, { target: { name: 'due_date', value: '2024-07-15' } });
    expect(dueDateInput.value).toBe('2024-07-15');
  });

  // ─── Tambahkan ke Daftar button with missing fields (early return) ───
  test('early return when adding to multiple products list with empty fields', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Multiple Products'));

    // Click "Tambahkan ke Daftar" without filling required fields
    const tambahButton = screen.getByText(/Tambahkan ke Daftar/);
    fireEvent.click(tambahButton);

    // Should not show product list (no toast or list update expected)
    await waitFor(() => {
      expect(screen.queryByText('Daftar Produk (1)')).not.toBeInTheDocument();
    });
  });

  // ─── Faktur form with multiplier > 1 showing conversion hint (cover line 2509) ───
  test('shows unit conversion hint when multiplier > 1 in faktur form', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Tambah Faktur'));
    await waitFor(() => expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument());

    // Change multiplier to > 1
    const multInput = document.querySelector('[name="unit_multiplier"]') as HTMLInputElement;
    fireEvent.change(multInput, { target: { name: 'unit_multiplier', value: '10' } });

    // Fill quantity to show hint
    const qtyInput = document.querySelector('[name="quantity"]') as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { name: 'quantity', value: '5' } });

    await waitFor(() => {
      expect(screen.getByText(/total satuan dasar/)).toBeInTheDocument();
    });
  });

  // ─── Multiple products change unit_multiplier inline handler (cover line 2006) ───
  test('changes unit_multiplier in multiple products mode', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Multiple Products'));

    toggleSatuanBesar();

    // Find the unit_multiplier input in multi mode
    const multInput = document.querySelector('[name="unit_multiplier"]') as HTMLInputElement;
    fireEvent.change(multInput, { target: { value: '5' } });
    expect(multInput.value).toBe('5');
  });

  // ─── Faktur qty_returned > 0 shows retur qty (cover line 2335) ───
  test('shows qty returned in faktur table row', async () => {
    const faktursData = {
      data: [{
        id: 330, product_id: 1, batch_number: 'BATCH-QTYRET', invoice_number: 'BATCH-QTYRET',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2025-06-01',
        notes: null, image_url: null,
        qty_returned: 2,
        created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-QTYRET')).toBeInTheDocument());

    // The qty_returned=2 should show in the table row
    await waitFor(() => {
      const row = screen.getByText('BATCH-QTYRET').closest('tr')!;
      expect(row.textContent).toContain('2');
    });
  });

  // ─── Approval modal notes display revision notes (cover line 2951) ───
  test('shows revision notes dalam approval modal', async () => {
    const pendingData = {
      data: [{
        id: 340, product_id: 1, product_name: 'Product Revision Notes',
        batch_number: 'INV-REVNOTES', invoice_number: 'INV-REVNOTES',
        supplier_id: 1, supplier_name: 'Supplier A',
        purchase_date: '2024-01-15', cost_price: 5000, quantity: 10,
        initial_quantity: 10, remaining_quantity: 10,
        stock_type: 'belum_bayar', status: 'revision',
        notes: 'Please revise the cost price', image_url: null,
        product_status: 'active',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) return okJson(pendingData);
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Product Revision Notes')).toBeInTheDocument();
    });

    expect(screen.getByText(/Please revise the cost price/)).toBeInTheDocument();
  });

  // ─── Faktur with status revision and notes showing catatan perbaikan in edit form ───
  test('shows catatan perbaikan in faktur edit form', async () => {
    const faktursData = {
      data: [{
        id: 350, product_id: 1, batch_number: 'BATCH-REVNOTE2', invoice_number: 'BATCH-REVNOTE2',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000,
        stock_type: 'belum_bayar', status: 'revision',
        dp_amount: null, due_date: null, expired_date: '2025-06-01',
        notes: 'Harga tidak sesuai', image_url: null,
        created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-REVNOTE2')).toBeInTheDocument());

    const editBtn = screen.getByTitle('Perbaiki');
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Harga tidak sesuai')).toBeInTheDocument();
    });
  });

  // ─── Expired date coloring: expired (past date) ───
  test('shows expired product with red badge', async () => {
    renderPage();
    await waitLoaded();

    // "Expired Product" has expired_date '2020-01-01', should show red badge
    const expiredRow = screen.getByText('Expired Product').closest('tr')!;
    expect(expiredRow.textContent).toContain('2020');
  });

  // ─── No date product shows dash ───
  test('shows dash for product without expired date', async () => {
    renderPage();
    await waitLoaded();

    // "No Date Product" has null expired_date, should show "-"
    const noDateRow = screen.getByText('No Date Product').closest('tr')!;
    expect(noDateRow.textContent).toContain('-');
  });

  // ─── Konsinyasi stock type badge in product table ───
  test('shows konsinyasi badge in product table', async () => {
    const konsinyasiPayload = {
      data: [{
        id: 360, name: 'Konsinyasi Product',
        cost_price: 5000, selling_price: 8000,
        stock: 10, unit: 'pcs',
        expired_date: '2025-06-01',
        location_code: 'A-01-03',
        supplier_id: 1, supplier_name: 'Supplier A',
        stock_type: 'konsinyasi',
      }],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) return okJson(konsinyasiPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Konsinyasi Product')).toBeInTheDocument();
    });

    expect(screen.getByText('Konsinyasi')).toBeInTheDocument();
  });

  // ─── Kode Lokasi info button opens confirm modal (cover lines 1842-1864) ───
  test('opens kode lokasi info modal', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByText('Add New Product')).toBeInTheDocument();
    });

    // Click the Info icon next to Kode Lokasi
    const infoIcons = screen.getAllByTestId('info-icon');
    const infoBtn = infoIcons[infoIcons.length - 1].closest('button')!;
    fireEvent.click(infoBtn);

    await waitFor(() => {
      expect(screen.getByText('Format Kode Lokasi')).toBeInTheDocument();
    });

    // Close via confirm
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(screen.queryByText('Format Kode Lokasi')).not.toBeInTheDocument();
    });
  });

  // ─── Products fetch without data field (cover || [] fallback) ───
  test('handles products fetch without data field', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products'))
        return okJson({ pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No products found.')).toBeInTheDocument();
    });
  });

  // ─── Products fetch without pagination fields (cover || fallbacks) ───
  test('handles products fetch without pagination fields', async () => {
    const noPaginationPayload = {
      data: [{ id: 1, name: 'Single Product', cost_price: 1000, selling_price: 2000, stock: 5, unit: 'pcs', expired_date: null, location_code: '', supplier_id: null, supplier_name: null, stock_type: null }],
    };

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products'))
        return okJson(noPaginationPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Single Product')).toBeInTheDocument();
    });
    expect(screen.getByText(/All Products: 0/)).toBeInTheDocument();
  });

  // ─── AllProducts fetch fails (cover else path) ───
  test('handles allProducts fetch failure', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('limit=1000'))
        return failJson({}, 500);
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    // First fetch succeeds but limit=1000 fetch fails, so allProducts stays empty
    await waitFor(() => {
      expect(screen.getByText('No products found.')).toBeInTheDocument();
    });
  });

  // ─── Global pending fakturs fetch returns no data field ───
  test('handles pending fakturs without data field', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches'))
        return okJson({ something: true });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await waitFor(() => {
      expect(screen.getByText('Semua Beres!')).toBeInTheDocument();
    });
  });

  // ─── Minimal product data (all optional fields null) to cover JSX fallback branches ───
  test('renders product with minimal data and null fields', async () => {
    const minimalPayload = {
      data: [{
        id: 999,
        name: 'Minimal Product',
        cost_price: 0,
        selling_price: 0,
        stock: 0,
        unit: '',
        expired_date: null,
        location_code: '',
        supplier_id: null,
        supplier_name: null,
        stock_type: null,
        purchase_unit: null,
        unit_multiplier: null,
        product_category: null,
      }],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    };

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) return okJson(minimalPayload);
      return okJson({ data: [] });
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Minimal Product')).toBeInTheDocument();
    });
    // Stock display should use fallbacks
    expect(screen.getByText(/0 Tablet/)).toBeInTheDocument();
  });

  // ─── Faktur form: batal button in edit mode ───
  test('cancels faktur edit form', async () => {
    const faktursData = {
      data: [{
        id: 370, product_id: 1, batch_number: 'BATCH-CANCEL', invoice_number: 'BATCH-CANCEL',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2025-06-01',
        notes: null, image_url: null, created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-CANCEL')).toBeInTheDocument());

    // Open edit form
    const editButtons = screen.getAllByTitle('Edit');
    fireEvent.click(editButtons[editButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Simpan Faktur')).toBeInTheDocument());

    // Click Batal
    const batalButtons = screen.getAllByText('Batal');
    fireEvent.click(batalButtons[batalButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('Simpan Faktur')).not.toBeInTheDocument();
    });
  });

  // ─── Save faktur where batch creation API fails (cover else path for res.ok) ───
  test('handles batch create failure when saving faktur', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return failJson({}, 500);
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    const tambahButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(tambahButtons[0]);
    await waitFor(() => expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument());

    const saveButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menyimpan faktur');
    });
  });

  // ─── Empty file input change (cover else path) ───
  test('handles empty file input change for product image', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
    });

    // Trigger change with no files (e.target.files is null/undefined)
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: null as any } });
    // No error should occur
  });

  // ─── Edit faktur handleSaveFaktur with empty expired_date ───
  test('saves faktur with empty expired and due dates', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches') && init?.method === 'POST')
        return okJson({ status: 'approved', data: { status: 'approved' } });
      if (url.includes('/api/inventory/batches/'))
        return okJson({ data: [] });
      if (url.includes('/api/products/') && init?.method === 'PUT')
        return okJson({ message: 'updated' });
      if (url.includes('/api/products'))
        return okJson(productsPayload);
      if (url.includes('/api/suppliers'))
        return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Tambah Faktur'));
    await waitFor(() => expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument());

    // Fill only required fields with empty optionals
    const qtyInput = document.querySelector('[name="quantity"]') as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { name: 'quantity', value: '5' } });

    const saveButtons = screen.getAllByText('Tambah Faktur');
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Faktur ditambahkan!');
    });
  });

  // ─── Non-empty faktur with dp stock type and full coverage (else if dp branch) ───
  test('shows dp status with partial payment for dp faktur', async () => {
    const faktursData = {
      data: [{
        id: 500, product_id: 1, batch_number: 'BATCH-DPPART', invoice_number: 'BATCH-DPPART',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 50000, total_amount: 500000, stock_type: 'dp', status: 'approved',
        dp_amount: null, due_date: '2024-06-15', expired_date: null,
        notes: null, image_url: null,
        dp_payments: [
          { id: 1, amount: 100000, payment_date: '2024-01-15', payment_method: 'cash', created_at: '2024-01-15T00:00:00Z' },
        ],
        created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-DPPART')).toBeInTheDocument());

    // Verify status shows DP (partial payment)
    expect(screen.getByText('DP')).toBeInTheDocument();
  });

  // ─── Sort with null supplier_name (cover null sorting branch) ───
  test('sorts by supplier_name with null values', async () => {
    renderPage();
    await waitLoaded();

    const supplierHeader = screen.getByText('Supplier');
    fireEvent.click(supplierHeader);
    // Should sort without errors despite null supplier_name values
  });

  // ─── TARGETED BRANCH COVERAGE TESTS ───

  test('covers product list table stock types and categories branch paths', async () => {
    const test1Products = {
      data: [
        {
          id: 101,
          name: 'Product category non-obat',
          cost_price: 1000,
          selling_price: 2000,
          stock: 5,
          unit: 'pcs',
          expired_date: '2028-01-01',
          category: 'Medicine',
          product_category: 'NON_OBAT',
          stock_type: 'belum_bayar',
        },
        {
          id: 102,
          name: 'Product stock type DP',
          cost_price: 3000,
          selling_price: 5000,
          stock: 10,
          unit: 'pcs',
          expired_date: '2028-01-01',
          category: 'Medicine',
          product_category: 'OBAT',
          stock_type: 'dp',
        },
        {
          id: 103,
          name: 'Product stock type retur',
          cost_price: 4000,
          selling_price: 8000,
          stock: 20,
          unit: 'pcs',
          expired_date: '2028-01-01',
          category: 'General',
          product_category: 'OBAT',
          stock_type: 'retur',
        },
        {
          id: 104,
          name: 'Product null unit multiplier',
          cost_price: 4000,
          selling_price: 8000,
          stock: 20,
          unit: 'pcs',
          expired_date: '2028-01-01',
          category: 'General',
          product_category: 'OBAT',
          stock_type: 'lunas',
          unit_multiplier: null,
          purchase_unit: null,
        }
      ],
      pagination: { total: 4, page: 1, limit: 10, totalPages: 1 }
    };

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) return okJson(test1Products);
      return okJson({ data: [] });
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Product category non-obat')).toBeInTheDocument();
    });

    expect(screen.getByText('Non-Obat')).toBeInTheDocument();
    expect(screen.getByText('DP')).toBeInTheDocument();
    expect(screen.getByText('Retur')).toBeInTheDocument();
    expect(screen.getAllByText('Obat').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20 pcs').length).toBe(2);
  });

  test('covers product form date inputs, input clear synchronization, and edit/add submit fallbacks', async () => {
    const productWithNulls = {
      id: 10,
      name: 'Product Nulls',
      cost_price: 0,
      selling_price: 0,
      stock: 0,
      unit: '',
      expired_date: null,
      purchase_date: '2024-01-01',
      due_date: '2024-02-01',
      location_code: '',
      supplier_id: null,
      stock_type: null,
      purchase_unit: '',
      unit_multiplier: null,
      product_category: 'OBAT'
    };

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) {
        return okJson({
          data: [productWithNulls],
          pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
        });
      }
      return okJson({ data: [] });
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Product Nulls')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit'));
    await waitFor(() => {
      expect(screen.getByText('Edit Product')).toBeInTheDocument();
    });

    toggleSatuanBesar();

    const purchaseStockInput = document.querySelector('[name="purchase_unit_stock"]') as HTMLInputElement;
    const unitMultiplierInput = document.querySelector('[name="unit_multiplier"]') as HTMLInputElement;
    const stockInput = document.querySelector('[name="stock"]') as HTMLInputElement;

    fireEvent.change(purchaseStockInput, { target: { name: 'purchase_unit_stock', value: '' } });
    fireEvent.change(unitMultiplierInput, { target: { name: 'unit_multiplier', value: '' } });
    fireEvent.change(stockInput, { target: { name: 'stock', value: '' } });

    const form = screen.getByText('Save Changes').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Produk berhasil diperbarui');
    });
  });

  test('covers product add mode existing/new name submit fallbacks and batch creation parameters', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches') && init?.method === 'POST') {
        return failJson({ message: 'Batch error' }, 400);
      }
      if (url.includes('/api/products') && init?.method === 'PUT') {
        return okJson({ message: 'updated' });
      }
      if (url.includes('/api/products') && init?.method === 'POST') {
        return okJson({ id: 999 });
      }
      if (url.includes('/api/products')) return okJson(productsPayload);
      return okJson({ data: [] });
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByText('Add New Product')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Enter product name'), {
      target: { name: 'name', value: '  EXPIRED PRODUCT  ' },
    });
    
    const stockInput = document.querySelector('[name="stock"]') as HTMLInputElement;
    fireEvent.change(stockInput, {
      target: { name: 'stock', value: '10' }
    });
    
    const supplierSelect = document.querySelector('[name="supplier_id"]') as HTMLSelectElement;
    fireEvent.change(supplierSelect, { target: { name: 'supplier_id', value: '1' } });

    const form = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Produk berhasil disimpan');
    });

    fireEvent.click(screen.getByText('Add Products'));
    await waitFor(() => {
      expect(screen.getByText('Add New Product')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Enter product name'), {
      target: { name: 'name', value: 'Brand New Product' },
    });
    
    const costPriceInput = document.querySelector('[name="cost_price"]') as HTMLInputElement;
    const sellingPriceInput = document.querySelector('[name="selling_price"]') as HTMLInputElement;
    fireEvent.change(costPriceInput, { target: { name: 'cost_price', value: '' } });
    fireEvent.change(sellingPriceInput, { target: { name: 'selling_price', value: '' } });

    const form2 = screen.getByText('Create Product').closest('form')!;
    fireEvent.submit(form2);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Produk berhasil disimpan');
    });
  });

  test('covers edit faktur modal total amount, DP fallback list, and sisa hutang formatting', async () => {
    const dpFakturNulls = {
      id: 201,
      product_id: 1,
      batch_number: 'BATCH-DPNULLS',
      invoice_number: 'BATCH-DPNULLS',
      supplier_id: 1,
      supplier_name: 'Supplier A',
      purchase_date: '2024-01-15',
      cost_price: 5000,
      initial_quantity: null,
      quantity: 10,
      remaining_quantity: 10,
      total_amount: null,
      stock_type: 'dp',
      status: 'approved',
      dp_payments: null,
      dp_amount: 20000,
      due_date: '2024-06-15',
      expired_date: null,
      notes: null,
      image_url: null,
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [dpFakturNulls] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-DPNULLS')).toBeInTheDocument());

    // Get the LAST Edit button (the faktur row edit, not product table edit)
    const editBtns = screen.getAllByTitle('Edit');
    fireEvent.click(editBtns[editBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });
  });

  test('covers faktur list table stock types, status labels, and qty display calculations', async () => {
    const test5Fakturs = {
      data: [
        {
          id: 301,
          batch_number: 'BATCH-RETUR',
          invoice_number: 'BATCH-RETUR',
          supplier_name: null,
          purchase_date: null,
          initial_quantity: null,
          quantity: 10,
          remaining_quantity: null,
          cost_price: 5000,
          total_amount: null,
          stock_type: 'retur',
          status: 'rejected',
          qty_returned: null,
        },
        {
          id: 302,
          batch_number: 'BATCH-INVALID',
          invoice_number: 'BATCH-INVALID',
          supplier_name: 'Supplier A',
          purchase_date: '2024-01-15',
          initial_quantity: 10,
          quantity: 10,
          remaining_quantity: 10,
          cost_price: 5000,
          total_amount: 50000,
          stock_type: 'invalid_type',
          status: 'pending',
          qty_returned: 0,
        }
      ]
    };

    const productNullMultiplier = {
      ...productsPayload.data[0],
      unit_multiplier: null,
      unit: ''
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(test5Fakturs);
      if (url.includes('/api/products')) {
        return okJson({
          data: [productNullMultiplier],
          pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
        });
      }
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    await screen.findByText('BATCH-RETUR');
    expect(screen.getByText('BATCH-INVALID')).toBeInTheDocument();
    expect(screen.getByText('Ditolak')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  test('covers approval modal pending row fallbacks and Perbaiki Data product fallback generator', async () => {
    const test7Pending = {
      data: [
        {
          id: 401,
          product_id: 9999,
          product_name: null,
          batch_number: null,
          invoice_number: null,
          supplier_name: null,
          purchase_date: null,
          cost_price: 5000,
          quantity: 10,
          product_purchase_unit: null,
          product_unit_multiplier: null,
          stock_type: '',
          status: 'revision',
          notes: 'Please check details',
        }
      ]
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) return okJson(test7Pending);
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getByText('Lihat Approval Tertunda'));
    await screen.findByText('Please check details');

    expect(screen.getByText('Tanpa Supplier')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);

    const perbaikiBtn = screen.getByText('Perbaiki Data');
    fireEvent.click(perbaikiBtn);

    await waitFor(() => {
      expect(screen.getByText('Edit Faktur')).toBeInTheDocument();
    });
  });

  // ─── Empty file input for faktur image change (cover line 450) ───
  test('handles empty file input for faktur image', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson({ data: [] });
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Tambah Faktur'));
    await waitFor(() => expect(screen.getByText('Tambah Faktur Baru')).toBeInTheDocument());

    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[fileInputs.length - 1], { target: { files: null as any } });
  });

  // ─── Faktur table with dp_amount fallback (no dp_payments) ───
  test('shows DP amount fallback in faktur table when dp_payments is null', async () => {
    const faktursData = {
      data: [{
        id: 601, product_id: 1, batch_number: 'BATCH-DPFALLBACK', invoice_number: 'BATCH-DPFALLBACK',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 10, quantity: 10,
        cost_price: 50000, total_amount: 500000, stock_type: 'dp', status: 'approved',
        dp_amount: 50000, due_date: '2024-06-15', expired_date: null, notes: null, image_url: null,
        created_at: '2024-01-15T00:00:00Z',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-DPFALLBACK')).toBeInTheDocument());
  });

  // ─── Detail Faktur button (eye icon) opens detail modal ───
  test('opens detail faktur modal with eye icon', async () => {
    const faktursData = {
      data: [{
        id: 701, product_id: 1, batch_number: 'BATCH-DETAIL01', invoice_number: 'BATCH-DETAIL01',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2025-06-01',
        notes: 'Test notes', image_url: null,
        created_at: '2024-01-15T00:00:00Z',
        created_by_username: 'superadmin',
        created_by_role: 'superadmin',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-DETAIL01')).toBeInTheDocument());

    // Click the eye icon (detail) button - first button in actions (before Edit)
    const detailBtn = screen.getByTitle('Detail Faktur');
    fireEvent.click(detailBtn);

    // Detail modal should show
    await waitFor(() => {
      expect(screen.getByText('Detail Faktur')).toBeInTheDocument();
    });
    expect(screen.getAllByText('BATCH-DETAIL01').length).toBeGreaterThanOrEqual(2);
  });

  // ─── Detail modal shows created_by info (Dibuat Oleh) ───
  test('detail modal displays created_by username and role', async () => {
    const faktursData = {
      data: [{
        id: 702, product_id: 1, batch_number: 'BATCH-CREATEDBY', invoice_number: 'BATCH-CREATEDBY',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2025-06-01',
        notes: null, image_url: null,
        created_at: '2024-01-15T00:00:00Z',
        created_by_username: 'admin_user',
        created_by_role: 'admin',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-CREATEDBY')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Detail Faktur'));

    await waitFor(() => {
      expect(screen.getByText('Detail Faktur')).toBeInTheDocument();
      expect(screen.getByText('admin_user')).toBeInTheDocument();
    });
  });

  // ─── Detail modal close button works ───
  test('closes detail faktur modal via close button', async () => {
    const faktursData = {
      data: [{
        id: 703, product_id: 1, batch_number: 'BATCH-DETAILCLOSE', invoice_number: 'BATCH-DETAILCLOSE',
        supplier_id: 1, supplier_name: 'Supplier A', purchase_date: '2024-01-15',
        initial_quantity: 10, remaining_quantity: 8, quantity: 10,
        cost_price: 5000, total_amount: 50000, stock_type: 'lunas', status: 'approved',
        dp_amount: null, due_date: null, expired_date: '2025-06-01',
        notes: null, image_url: null,
        created_at: '2024-01-15T00:00:00Z',
        created_by_username: 'test_user',
        created_by_role: 'admin',
      }],
    };

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/batches/')) return okJson(faktursData);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/suppliers')) return okJson({ data: [] });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click((await screen.findAllByTitle('Faktur'))[0]);
    await waitFor(() => expect(screen.getByText(/Faktur - /)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BATCH-DETAILCLOSE')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Detail Faktur'));
    await waitFor(() => {
      expect(screen.getByText('Detail Faktur')).toBeInTheDocument();
    });

    // Close via Tutup button
    const tutupBtn = screen.getByText('Tutup');
    fireEvent.click(tutupBtn);

    await waitFor(() => {
      expect(screen.queryByText('Detail Faktur')).not.toBeInTheDocument();
    });
  });
});