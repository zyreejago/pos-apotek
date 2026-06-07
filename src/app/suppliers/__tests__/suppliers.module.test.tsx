import React from 'react';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import SuppliersPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';
import { OffCanvasProvider } from '@/context/OffCanvasContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { HeaderProvider, useHeader } from '@/context/HeaderContext';

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
          <HeaderDisplay />
          {ui}
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
  usePathname: () => '/suppliers',
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
        <button type="button" onClick={onClose}>
          <span data-testid="x-icon" />
        </button>
        {children}
      </div>
    ) : null,
}));

jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon" />,
  Filter: () => <span data-testid="filter-icon" />,
  Edit: () => <span data-testid="edit-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  X: () => <span data-testid="x-icon" />,
  Eye: () => <span data-testid="eye-icon" />,
  FileText: () => <span data-testid="filetext-icon" />,
  ShoppingBag: () => <span data-testid="shoppingbag-icon" />,
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

const suppliersPayload = {
  data: [
    {
      id: 1,
      name: 'PT Sumber Makmur',
      contact_person: 'John Doe',
      phone: '08123456789',
      address: 'Jl. Sudirman No. 1',
    },
    {
      id: 2,
      name: 'CV Kosong Phone',
      contact_person: '',
      phone: '',
      address: '',
    },
  ],
  pagination: {
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 2,
  },
};

const supplierDetailsPayload = {
  supplier: {
    id: 1,
    name: 'PT Sumber Makmur',
    contact_person: 'John Doe',
    phone: '08123456789',
    address: 'Jl. Sudirman No. 1',
  },
  batches: [
    {
      id: 1,
      product_name: 'Paracetamol 500mg',
      status: 'approved',
      purchase_date: '2024-01-01',
      expired_date: '2025-01-01',
      due_date: '2024-02-01',
      initial_quantity: 100,
      remaining_quantity: 50,
      cost_price: 10000,
      stock_type: 'dp',
      dp_payments: [
        { id: 1, amount: 500000, payment_date: '2024-01-01', payment_method: 'cash' },
        { id: 2, amount: 300000, payment_date: '2024-01-15', payment_method: 'transfer' }
      ],
      notes: 'Order pertama',
      image_url: '/uploads/bukti1.jpg'
    },
    {
      id: 2,
      product_name: 'Amoxicillin 250mg',
      status: 'pending',
      purchase_date: '2024-01-10',
      initial_quantity: 50,
      remaining_quantity: 50,
      cost_price: 15000,
      stock_type: 'lunas',
      dp_amount: 750000,
      notes: ''
    }
  ]
};

function mockDefaultFetch() {
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/suppliers') && init?.method === 'POST') {
      return okJson({ message: 'created' });
    }

    if (url.includes('/api/suppliers/') && init?.method === 'PUT') {
      return okJson({ message: 'updated' });
    }

    if (url.includes('/api/suppliers/') && init?.method === 'DELETE') {
      return okJson({ message: 'deleted' });
    }

    if (url.includes('/api/suppliers/1')) {
      return okJson(supplierDetailsPayload);
    }

    if (url.includes('/api/suppliers')) {
      return okJson(suppliersPayload);
    }

    return okJson({});
  }) as unknown as typeof fetch;
}

function renderPage() {
  return renderWithProviders(<SuppliersPage />);
}

async function waitSuppliersLoaded() {
  expect(await screen.findByText('PT Sumber Makmur')).toBeInTheDocument();
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
      username: 'test',
      role: 'superadmin',
      email: 'test@test.com',
    })
  );

  mockDefaultFetch();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('suppliers module', () => {
  test('renders suppliers page and header', async () => {
    renderPage();

    expect(await screen.findByTestId('header')).toHaveTextContent('Supplier');
    expect(screen.getByText('Management Supplier')).toBeInTheDocument();
    
  });

  test('fetches suppliers on load with token', async () => {
    renderPage();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/suppliers?page=1&limit=10&search='),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test',
          }),
        })
      );
    });
  });

  test('fetches suppliers without token', async () => {
    localStorage.removeItem('token');

    renderPage();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/suppliers'),
        expect.objectContaining({
          headers: {},
        })
      );
    });
  });

  test('renders suppliers data and phone fallback', async () => {
    renderPage();

    await waitSuppliersLoaded();

    expect(screen.getByText('08123456789')).toBeInTheDocument();
    expect(screen.getByText('CV Kosong Phone')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  test('renders loading state before suppliers loaded', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn(() => {
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    }) as unknown as typeof fetch;

    renderPage();

    expect(screen.getByText('Loading suppliers...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => suppliersPayload,
      text: async () => JSON.stringify(suppliersPayload),
    } as Response);

    expect(await screen.findByText('PT Sumber Makmur')).toBeInTheDocument();
  });

  test('renders no suppliers found state', async () => {
    global.fetch = jest.fn(() =>
      okJson({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      })
    ) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText('No suppliers found')).toBeInTheDocument();
  });

  test('handles search query', async () => {
    renderPage();

    const searchInput = await screen.findByPlaceholderText('Search Supplier');

    fireEvent.change(searchInput, {
      target: { value: 'makmur' },
    });

    expect(searchInput).toHaveValue('makmur');

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=makmur'),
          expect.any(Object)
        );
      },
      { timeout: 1500 }
    );
  });

  test('changes items per page', async () => {
    renderPage();

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

  test('goes to next previous and selected page', async () => {
    renderPage();

    await waitSuppliersLoaded();

    fireEvent.click(screen.getByText('2'));

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

    fireEvent.click(screen.getByText('→'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
    });
  });

  test('opens add modal and changes fields', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Add Supplier'));

    expect(screen.getAllByText('Add Supplier').length).toBeGreaterThan(1);

    fireEvent.change(screen.getByPlaceholderText('e.g. PT. Sumber Makmur'), {
      target: {
        name: 'name',
        value: 'PT Baru',
      },
    });

    fireEvent.change(screen.getByPlaceholderText('e.g. John Doe'), {
      target: {
        name: 'contact_person',
        value: 'Budi',
      },
    });

    fireEvent.change(screen.getByPlaceholderText('e.g. 08123456789'), {
      target: {
        name: 'phone',
        value: '081111111',
      },
    });

    fireEvent.change(screen.getByPlaceholderText('e.g. Jl. Sudirman No. 1'), {
      target: {
        name: 'address',
        value: 'Alamat Baru',
      },
    });

    expect(screen.getByDisplayValue('PT Baru')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Budi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('081111111')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alamat Baru')).toBeInTheDocument();
  });

  test('closes add modal with cancel', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Add Supplier'));

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('e.g. PT. Sumber Makmur')).not.toBeInTheDocument();
    });
  });

  test('closes add modal with x button', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Add Supplier'));

    const closeButton = screen.getByTestId('x-icon').closest('button') as HTMLButtonElement;

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('e.g. PT. Sumber Makmur')).not.toBeInTheDocument();
    });
  });

  test('submits add supplier successfully with contact person', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Add Supplier'));

    fireEvent.change(screen.getByPlaceholderText('e.g. PT. Sumber Makmur'), {
      target: {
        name: 'name',
        value: 'PT Baru',
      },
    });

    fireEvent.change(screen.getByPlaceholderText('e.g. John Doe'), {
      target: {
        name: 'contact_person',
        value: 'Budi',
      },
    });

    fireEvent.change(screen.getByPlaceholderText('e.g. 08123456789'), {
      target: {
        name: 'phone',
        value: '081111111',
      },
    });

    fireEvent.change(screen.getByPlaceholderText('e.g. Jl. Sudirman No. 1'), {
      target: {
        name: 'address',
        value: 'Alamat Baru',
      },
    });

    fireEvent.click(screen.getAllByText('Add Supplier').at(-1) as HTMLElement);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Supplier berhasil ditambahkan',
        expect.objectContaining({
          description: expect.stringContaining('(CP: Budi)'),
        })
      );
    });
  });

  test('submits add supplier successfully without contact person', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Add Supplier'));

    fireEvent.change(screen.getByPlaceholderText('e.g. PT. Sumber Makmur'), {
      target: {
        name: 'name',
        value: 'PT Tanpa CP',
      },
    });

    fireEvent.click(screen.getAllByText('Add Supplier').at(-1) as HTMLElement);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Supplier berhasil ditambahkan',
        expect.objectContaining({
          description: expect.not.stringContaining('(CP:'),
        })
      );
    });
  });

  test('handles add supplier permission denied', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Add Supplier'));

    fireEvent.change(screen.getByPlaceholderText('e.g. PT. Sumber Makmur'), {
      target: {
        name: 'name',
        value: 'PT Baru',
      },
    });

    mockCheckPermission.mockImplementation((action?: string) => {
      if (action === 'create') return false;
      return true;
    });

    fireEvent.click(screen.getAllByText('Add Supplier').at(-1) as HTMLElement);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });
  });

  test('handles add supplier failure', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/suppliers') && init?.method === 'POST') {
        return failJson({}, 400);
      }

      if (url.includes('/api/suppliers')) return okJson(suppliersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    fireEvent.click(await screen.findByText('Add Supplier'));

    fireEvent.change(screen.getByPlaceholderText('e.g. PT. Sumber Makmur'), {
      target: {
        name: 'name',
        value: 'PT Baru',
      },
    });

    fireEvent.click(screen.getAllByText('Add Supplier').at(-1) as HTMLElement);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Menambah Supplier',
        expect.any(Object)
      );
    });
  });

  test('handles add supplier network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/suppliers') && init?.method === 'POST') {
        return Promise.reject(new Error('save error'));
      }

      if (url.includes('/api/suppliers')) return okJson(suppliersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    fireEvent.click(await screen.findByText('Add Supplier'));

    fireEvent.change(screen.getByPlaceholderText('e.g. PT. Sumber Makmur'), {
      target: {
        name: 'name',
        value: 'PT Baru',
      },
    });

    fireEvent.click(screen.getAllByText('Add Supplier').at(-1) as HTMLElement);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Terjadi kesalahan sistem',
        expect.any(Object)
      );
    });
  });

  test('opens edit modal with supplier values', async () => {
    renderPage();

    await waitSuppliersLoaded();

    const editButtons = await screen.findAllByTitle('Edit');

    fireEvent.click(editButtons[0]);

    expect(screen.getByText('Edit Supplier')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PT Sumber Makmur')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('08123456789')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jl. Sudirman No. 1')).toBeInTheDocument();
  });

  test('opens edit modal with fallback empty values', async () => {
    renderPage();

    await waitSuppliersLoaded();

    const editButtons = await screen.findAllByTitle('Edit');

    fireEvent.click(editButtons[1]);

    expect(screen.getByText('Edit Supplier')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CV Kosong Phone')).toBeInTheDocument();
  });

  test('submits edit supplier successfully', async () => {
    renderPage();

    await waitSuppliersLoaded();

    const editButtons = await screen.findAllByTitle('Edit');

    fireEvent.click(editButtons[0]);

    fireEvent.change(screen.getByPlaceholderText('e.g. PT. Sumber Makmur'), {
      target: {
        name: 'name',
        value: 'PT Edit',
      },
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Supplier berhasil diperbarui',
        expect.any(Object)
      );
    });
  });

  test('handles edit supplier permission denied', async () => {
    renderPage();

    await waitSuppliersLoaded();

    const editButtons = await screen.findAllByTitle('Edit');

    fireEvent.click(editButtons[0]);

    mockCheckPermission.mockImplementation((action?: string) => {
      if (action === 'edit') return false;
      return true;
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });
  });

  test('handles edit supplier failure', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/suppliers/') && init?.method === 'PUT') {
        return failJson({}, 400);
      }

      if (url.includes('/api/suppliers')) return okJson(suppliersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitSuppliersLoaded();

    const editButtons = await screen.findAllByTitle('Edit');

    fireEvent.click(editButtons[0]);

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Memperbarui Supplier',
        expect.any(Object)
      );
    });
  });

  test('opens delete confirmation modal and closes it', async () => {
    renderPage();

    await waitSuppliersLoaded();

    const deleteButtons = await screen.findAllByTitle('Delete');

    fireEvent.click(deleteButtons[0]);

    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    expect(screen.getByText('Delete Supplier')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close-delete'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });
  });

  test('deletes supplier successfully', async () => {
    renderPage();

    await waitSuppliersLoaded();

    const deleteButtons = await screen.findAllByTitle('Delete');

    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Supplier Berhasil Dihapus',
        expect.any(Object)
      );
    });
  });

  test('handles delete supplier permission denied', async () => {
    renderPage();

    await waitSuppliersLoaded();

    const deleteButtons = await screen.findAllByTitle('Delete');

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

  test('handles delete supplier failure', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/suppliers/') && init?.method === 'DELETE') {
        return failJson({}, 400);
      }

      if (url.includes('/api/suppliers')) return okJson(suppliersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitSuppliersLoaded();

    const deleteButtons = await screen.findAllByTitle('Delete');

    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Menghapus Supplier',
        expect.any(Object)
      );
    });
  });

  test('handles delete supplier network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/suppliers/') && init?.method === 'DELETE') {
        return Promise.reject(new Error('delete error'));
      }

      if (url.includes('/api/suppliers')) return okJson(suppliersPayload);

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitSuppliersLoaded();

    const deleteButtons = await screen.findAllByTitle('Delete');

    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Terjadi kesalahan sistem',
        expect.any(Object)
      );
    });
  });

  test('handles unauthorized fetch suppliers', async () => {
    global.fetch = jest.fn(() => failJson({}, 401)) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles fetch suppliers network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() => Promise.reject(new Error('fetch error'))) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching suppliers:',
        expect.any(Error)
      );
    });
  });

  test('uses fallback pagination when response pagination missing', async () => {
    global.fetch = jest.fn(() =>
      okJson({
        data: [],
      })
    ) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText('No suppliers found')).toBeInTheDocument();
    expect(screen.getByText('1-0 of 0')).toBeInTheDocument();
  });

  test('hides add button when create permission denied', async () => {
    mockCheckPermission.mockImplementation((action?: string) => {
      if (action === 'create') return false;
      return true;
    });

    renderPage();

    expect(await screen.findByTestId('header')).toBeInTheDocument();
    expect(screen.queryByText('Add Supplier')).not.toBeInTheDocument();
  });

  test('hides edit button when edit permission denied', async () => {
    mockCheckPermission.mockImplementation((action?: string) => {
      if (action === 'edit') return false;
      return true;
    });

    renderPage();

    await waitSuppliersLoaded();

    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
  });

  test('hides delete button when delete permission denied', async () => {
    mockCheckPermission.mockImplementation((action?: string) => {
      if (action === 'delete') return false;
      return true;
    });

    renderPage();

    await waitSuppliersLoaded();

    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  test('opens view supplier offcanvas and displays supplier details', async () => {
    renderPage();

    await waitSuppliersLoaded();

    const viewButtons = await screen.findAllByTitle('View Details');
    fireEvent.click(viewButtons[0]);

    expect(await screen.findByText('Supplier Details')).toBeInTheDocument();
    // PT Sumber Makmur appears in both table and offcanvas
    const supplierNameElements = screen.getAllByText('PT Sumber Makmur');
    expect(supplierNameElements.length).toBeGreaterThanOrEqual(2);
    // Verify offcanvas rendered with children
    expect(await screen.findByTestId('offcanvas')).toBeInTheDocument();
    expect(screen.getByText('Supplier Details')).toBeInTheDocument();
    // Check that supplier details loaded inside offcanvas
    expect(await screen.findByText(/John Doe/)).toBeInTheDocument();
    expect(await screen.findByText(/Jl. Sudirman/)).toBeInTheDocument();
  });

  test('displays batches (Bukti Faktur Pembelian) with DP, quantities, status, etc.', async () => {
    renderPage();

    await waitSuppliersLoaded();

    const viewButtons = await screen.findAllByTitle('View Details');
    fireEvent.click(viewButtons[0]);

    // Check first batch
    expect(await screen.findByText('Paracetamol 500mg')).toBeInTheDocument();
    expect(screen.getByText('Disetujui')).toBeInTheDocument();
    const stokMasukLabels = screen.getAllByText('Jumlah Stok Masuk:');
    expect(stokMasukLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('100')).toBeInTheDocument();
    const sisaStokLabels = screen.getAllByText('Sisa Stok:');
    expect(sisaStokLabels.length).toBeGreaterThanOrEqual(1);
    const sisaStokValues = screen.getAllByText('50');
    expect(sisaStokValues.length).toBeGreaterThanOrEqual(1);
    const dp1Elements = screen.getAllByText('DP 1:');
    expect(dp1Elements.length).toBeGreaterThanOrEqual(1);
    const cashElements = screen.getAllByText('Cash');
    expect(cashElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Rp\s*500\.000/)).toBeInTheDocument();
    expect(screen.getByText('DP 2:')).toBeInTheDocument();
    expect(screen.getByText('TF')).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*300\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Sisa hutang/)).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*200\.000/)).toBeInTheDocument();
    expect(screen.getByText('Catatan: Order pertama')).toBeInTheDocument();

    // Check second batch
    expect(screen.getByText('Amoxicillin 250mg')).toBeInTheDocument();
    expect(screen.getByText('Menunggu')).toBeInTheDocument();
    const lunasElements = screen.getAllByText('Lunas');
    expect(lunasElements.length).toBeGreaterThanOrEqual(1);
  });

  test('displays no batches message when no batches exist', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/suppliers/1')) {
        return okJson({ ...supplierDetailsPayload, batches: [] });
      }
      if (url.includes('/api/suppliers')) return okJson(suppliersPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitSuppliersLoaded();

    const viewButtons = await screen.findAllByTitle('View Details');
    fireEvent.click(viewButtons[0]);

    expect(await screen.findByText('Belum ada bukti faktur pembelian dari supplier ini.')).toBeInTheDocument();
  });

  test('handles error fetching supplier details', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/suppliers/1')) {
        return Promise.reject(new Error('detail error'));
      }
      if (url.includes('/api/suppliers')) return okJson(suppliersPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitSuppliersLoaded();

    const viewButtons = await screen.findAllByTitle('View Details');
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Error fetching supplier details:', expect.any(Error));
    });
  });

  test('search resets to page 1 when not on first page', async () => {
    renderPage();

    await waitSuppliersLoaded();

    fireEvent.click(screen.getByText('2'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
    });

    const searchInput = screen.getByPlaceholderText('Search Supplier');
    fireEvent.change(searchInput, {
      target: { value: 'test' },
    });

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenLastCalledWith(
          expect.stringContaining('page=1'),
          expect.any(Object)
        );
      },
      { timeout: 1500 }
    );
  });

  test('displays batch without dp_payments or dp_amount', async () => {
    const batchNoDp = {
      id: 3,
      product_name: 'Vitamin C',
      status: 'rejected',
      purchase_date: '2024-03-01',
      initial_quantity: 30,
      remaining_quantity: 30,
      cost_price: 5000,
      stock_type: 'retur',
      notes: '',
    };

    const payload = {
      supplier: {
        id: 1,
        name: 'PT Sumber Makmur',
        contact_person: 'John Doe',
        phone: '08123456789',
        address: 'Jl. Sudirman No. 1',
      },
      batches: [batchNoDp],
    };

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/suppliers/1')) return okJson(payload);
      if (url.includes('/api/suppliers')) return okJson(suppliersPayload);
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitSuppliersLoaded();

    const viewButtons = await screen.findAllByTitle('View Details');
    fireEvent.click(viewButtons[0]);

    expect(await screen.findByText('Vitamin C')).toBeInTheDocument();
    expect(screen.getByText('Ditolak')).toBeInTheDocument();
  });

  test('covers search debounce fetchSuppliers else branch (line 115)', async () => {
    renderPage();

    await waitSuppliersLoaded();

    const initialSupplierCalls = (global.fetch as jest.Mock).mock.calls.filter(
      c => typeof c[0] === 'string' && (c[0] as string).includes('/api/suppliers?')
    ).length;

    const searchInput = screen.getByPlaceholderText('Search Supplier');
    fireEvent.change(searchInput, { target: { value: 'testquery' } });

    await waitFor(() => {
      const currentCalls = (global.fetch as jest.Mock).mock.calls.filter(
        c => typeof c[0] === 'string' && (c[0] as string).includes('/api/suppliers?')
      ).length;
      expect(currentCalls).toBe(initialSupplierCalls + 2);
    }, { timeout: 2000 });
  });

  test('covers search debounce currentPage !== 1 branch (line 113)', async () => {
    renderPage();

    await waitSuppliersLoaded();

    fireEvent.click(screen.getByText('2'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
    });

    const searchInput = screen.getByPlaceholderText('Search Supplier');
    fireEvent.change(searchInput, { target: { value: 'pagetest' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('page=1'),
        expect.any(Object)
      );
    }, { timeout: 2000 });
  });
});