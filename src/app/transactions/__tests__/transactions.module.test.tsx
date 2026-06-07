import React from 'react';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import TransactionsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';
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
    <HeaderProvider>
      <HeaderDisplay />
      {ui}
    </HeaderProvider>
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
  usePathname: () => '/transactions',
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
  default: () => <div data-testid="header" />,
}));

jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon" />,
  ShoppingCart: () => <span data-testid="cart-icon" />,
  Plus: () => <span data-testid="plus-icon" />,
  Minus: () => <span data-testid="minus-icon" />,
  X: () => <span data-testid="x-icon" />,
  CreditCard: () => <span data-testid="creditcard-icon" />,
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

const testProducts = [
  {
    id: 1,
    name: 'Test Product 1',
    cost_price: 1000,
    selling_price: 2000,
    stock: 10,
    unit: 'PCS',
    category: 'Test',
  },
  {
    id: 2,
    name: 'Test Product 2',
    cost_price: 2000,
    selling_price: 4000,
    stock: 20,
    unit: 'BOX',
    category: 'Test',
  },
];

function mockDefaultFetch() {
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/products')) {
      return okJson({
        data: testProducts,
        pagination: {
          total: 2,
          page: 1,
          limit: 100,
          totalPages: 1,
        },
      });
    }

    if (url.includes('/api/settings')) {
      return okJson({
        ppn_rate: '11',
        discount_rate: '5',
      });
    }

    if (url.includes('/api/transactions') && init?.method === 'POST') {
      return okJson({
        message: 'Success',
      });
    }

    return okJson({});
  }) as unknown as typeof fetch;
}

function renderPage() {
  return renderWithProviders(<TransactionsPage />);
}

async function waitProductsLoaded() {
  expect(await screen.findByText('Test Product 1')).toBeInTheDocument();
  expect(screen.getByText('Test Product 2')).toBeInTheDocument();
}

function addFirstProduct() {
  fireEvent.click(screen.getAllByText('Test Product 1')[0]);
}

function addSecondProduct() {
  fireEvent.click(screen.getAllByText('Test Product 2')[0]);
}

beforeEach(() => {
  jest.clearAllMocks();
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

  Object.defineProperty(window, 'snap', {
    value: {
      pay: jest.fn(),
    },
    writable: true,
  });
});

describe('transactions module', () => {
  test('renders transactions page', async () => {
    renderPage();

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(await screen.findByText('Test Product 1')).toBeInTheDocument();
  });

  test('fetches products and settings on load', async () => {
    renderPage();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products?limit=100'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/settings'),
        expect.any(Object)
      );
    });
  });

  test('shows loading products before data loaded', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    expect(screen.getByText('Loading products...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        data: testProducts,
      }),
      text: async () => JSON.stringify({ data: testProducts }),
    } as Response);

    expect(await screen.findByText('Test Product 1')).toBeInTheDocument();
  });

  test('renders no items in cart initially and payment button disabled', async () => {
    renderPage();

    expect(await screen.findByText('No items in cart')).toBeInTheDocument();

    const button = screen.getByRole('button', {
      name: /pembayaran/i,
    });

    expect(button).toBeDisabled();
  });

  test('handles search query and filters products', async () => {
    renderPage();

    await waitProductsLoaded();

    const searchInput = screen.getByPlaceholderText('Type name, team name...');

    fireEvent.change(searchInput, {
      target: { value: 'Product 2' },
    });

    expect(searchInput).toHaveValue('Product 2');
    expect(screen.queryByText('Test Product 1')).not.toBeInTheDocument();
    expect(screen.getByText('Test Product 2')).toBeInTheDocument();
  });

  test('adds product to cart and calculates subtotal tax discount total', async () => {
    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    expect(screen.getByText('Sub total')).toBeInTheDocument();
    expect(screen.getAllByText('Rp 2.000').length).toBeGreaterThan(0);
    expect(screen.getByText('PPN (11%)')).toBeInTheDocument();
    expect(screen.getByText('+Rp 220')).toBeInTheDocument();
    expect(screen.getByText('Diskon (5%)')).toBeInTheDocument();
    expect(screen.getByText('-Rp 100')).toBeInTheDocument();
    expect(screen.getByText('Rp 2.120')).toBeInTheDocument();
  });

  test('adds same product twice and increments quantity', async () => {
    renderPage();

    await waitProductsLoaded();

    addFirstProduct();
    addFirstProduct();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Rp 4.240')).toBeInTheDocument();
  });

  test('increments and decrements quantity but not below one', async () => {
    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    const plusButtons = screen.getAllByTestId('plus-icon');
    fireEvent.click(plusButtons[plusButtons.length - 1]);

    expect(screen.getByText('2')).toBeInTheDocument();

    const minusButton = screen.getByTestId('minus-icon');
    fireEvent.click(minusButton);

    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(minusButton);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  test('removes item from cart', async () => {
    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    expect(screen.getAllByText('Test Product 1').length).toBeGreaterThan(0);

    const removeButton = screen.getByTestId('x-icon').closest('button') as HTMLButtonElement;
    fireEvent.click(removeButton);

    expect(screen.getByText('No items in cart')).toBeInTheDocument();
  });

  test('adds multiple products to cart', async () => {
    renderPage();

    await waitProductsLoaded();

    addFirstProduct();
    addSecondProduct();

    expect(screen.getAllByText('Test Product 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Test Product 2').length).toBeGreaterThan(0);
    expect(screen.getByText('Rp 6.360')).toBeInTheDocument();
  });

  test('changes payment method to midtrans and back to cash', async () => {
    renderPage();

    await waitProductsLoaded();

    fireEvent.click(screen.getByText('Midtrans'));
    expect(screen.getByText('Transfer/QRIS')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cash'));
    expect(screen.getByText('Tunai')).toBeInTheDocument();
  });

  test('handles cash payment success and refreshes products', async () => {
    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Transaksi Berhasil',
        expect.any(Object)
      );
    });

    expect(screen.getByText('No items in cart')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/transactions'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  test('shows processing state during payment', async () => {
    let resolveTransaction: (value: Response) => void = jest.fn();

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolveTransaction = resolve;
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    expect(await screen.findByText('Processing...')).toBeInTheDocument();

    resolveTransaction({
      ok: true,
      status: 200,
      json: async () => ({
        message: 'Success',
      }),
      text: async () => JSON.stringify({ message: 'Success' }),
    } as Response);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalled();
    });
  });

  test('handles transaction failure with backend message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return failJson({ message: 'Stock not enough' }, 400);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Transaksi gagal',
        expect.objectContaining({
          description: 'Stock not enough',
        })
      );
    });
  });

  test('handles transaction failure without backend message', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return failJson({}, 400);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Transaksi gagal',
        expect.objectContaining({
          description: 'Terjadi kesalahan saat memproses transaksi.',
        })
      );
    });
  });

  test('handles payment network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return Promise.reject(new Error('network'));
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal memproses pembayaran',
        expect.any(Object)
      );
    });
  });

  test('handles payment unauthorized', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return failJson({}, 401);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles create permission denied', async () => {
    mockCheckPermission.mockImplementation((action?: string) => {
      if (action === 'create') return false;
      return true;
    });

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });
  });

  test('handles products fetch forbidden', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return failJson({}, 403);
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Akses Ditolak',
        expect.any(Object)
      );
    });
  });

  test('handles fetch data unauthorized from products', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return failJson({}, 401);
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles fetch data unauthorized from settings', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return failJson({}, 401);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('handles fetch data network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() => Promise.reject(new Error('fetch error'))) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching data:',
        expect.any(Error)
      );
    });
  });

  test('handles products response with null data fallback', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({
          data: null,
        });
      }

      if (url.includes('/api/settings')) {
        return okJson({ ppn_rate: '11', discount_rate: '5' });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Loading products...')).toBeInTheDocument();
    });
  });

  test('handles settings fetch failure with non-401 status', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return failJson({}, 500);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitProductsLoaded();

    addFirstProduct();
    expect(screen.getByText('Sub total')).toBeInTheDocument();
  });

  test('renders product with empty unit fallback', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({
          data: [{ id: 99, name: 'No Unit Product', cost_price: 5000, selling_price: 10000, stock: 5, unit: '', category: 'Test' }],
          pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
        });
      }

      if (url.includes('/api/settings')) {
        return okJson({ ppn_rate: '0', discount_rate: '0' });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => expect(screen.getByText('No Unit Product')).toBeInTheDocument());
    expect(screen.getByText(/tablet/i)).toBeInTheDocument();
  });

  test('uses zero settings fallback when settings values are invalid', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: 'bad',
          discount_rate: 'bad',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    expect(screen.queryByText(/PPN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Diskon/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Rp 2.000').length).toBeGreaterThan(0);
  });

  test('fetches without token', async () => {
    localStorage.removeItem('token');

    renderPage();

    await waitProductsLoaded();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/products'),
      expect.objectContaining({
        headers: {},
      })
    );
  });

  test('handles midtrans payment pending callback', async () => {
    const payMock = jest.fn((_token, callbacks) => {
      callbacks.onPending({});
    });

    Object.defineProperty(window, 'snap', {
      value: {
        pay: payMock,
      },
      writable: true,
    });

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return okJson({
          redirect_url: 'https://snap.midtrans.com/token/snap-token',
          order_id: 'ORDER-1',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByText('Midtrans'));
    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(payMock).toHaveBeenCalledWith(
        'snap-token',
        expect.any(Object)
      );
      expect(goeyToast.info).toHaveBeenCalledWith(
        'Menunggu Pembayaran',
        expect.any(Object)
      );
    });
  });

  test('handles midtrans payment error and close callbacks', async () => {
    const payMock = jest.fn((_token, callbacks) => {
      callbacks.onError({});
      callbacks.onClose();
    });

    Object.defineProperty(window, 'snap', {
      value: {
        pay: payMock,
      },
      writable: true,
    });

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return okJson({
          redirect_url: 'https://snap.midtrans.com/token/snap-token',
          order_id: 'ORDER-1',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByText('Midtrans'));
    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Pembayaran Gagal',
        expect.any(Object)
      );
      expect(goeyToast.info).toHaveBeenCalledWith(
        'Pembayaran Ditutup',
        expect.any(Object)
      );
    });
  });

  test('handles midtrans success with completed status', async () => {
    const payMock = jest.fn((_token, callbacks) => {
      callbacks.onSuccess({});
    });

    Object.defineProperty(window, 'snap', {
      value: {
        pay: payMock,
      },
      writable: true,
    });

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/midtrans/status/ORDER-1')) {
        return okJson({
          payment_status: 'completed',
        });
      }

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return okJson({
          redirect_url: 'https://snap.midtrans.com/token/snap-token',
          order_id: 'ORDER-1',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByText('Midtrans'));
    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith(
        'Transaksi Berhasil',
        expect.any(Object)
      );
    });
  });

  test('handles midtrans success with pending status', async () => {
    const payMock = jest.fn((_token, callbacks) => {
      callbacks.onSuccess({});
    });

    Object.defineProperty(window, 'snap', {
      value: {
        pay: payMock,
      },
      writable: true,
    });

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/midtrans/status/ORDER-1')) {
        return okJson({
          payment_status: 'pending',
        });
      }

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return okJson({
          redirect_url: 'https://snap.midtrans.com/token/snap-token',
          order_id: 'ORDER-1',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByText('Midtrans'));
    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(goeyToast.warning).toHaveBeenCalledWith(
        'Pembayaran Belum Selesai',
        expect.objectContaining({
          description: 'Status pembayaran: pending',
        })
      );
    });
  });

  test('handles midtrans status response error', async () => {
    const payMock = jest.fn((_token, callbacks) => {
      callbacks.onSuccess({});
    });

    Object.defineProperty(window, 'snap', {
      value: {
        pay: payMock,
      },
      writable: true,
    });

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/midtrans/status/ORDER-1')) {
        return failJson({}, 500);
      }

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return okJson({
          redirect_url: 'https://snap.midtrans.com/token/snap-token',
          order_id: 'ORDER-1',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByText('Midtrans'));
    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Memeriksa Status',
        expect.objectContaining({
          description: 'Terjadi kesalahan saat memeriksa status pembayaran.',
        })
      );
    });
  });

  test('handles midtrans status network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const payMock = jest.fn((_token, callbacks) => {
      callbacks.onSuccess({});
    });

    Object.defineProperty(window, 'snap', {
      value: {
        pay: payMock,
      },
      writable: true,
    });

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/midtrans/status/ORDER-1')) {
        return Promise.reject(new Error('status error'));
      }

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return okJson({
          redirect_url: 'https://snap.midtrans.com/token/snap-token',
          order_id: 'ORDER-1',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByText('Midtrans'));
    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal Memeriksa Status',
        expect.objectContaining({
          description: 'Periksa koneksi internet Anda dan coba lagi.',
        })
      );
    });
  });

  test('uses fallback order id when midtrans response has no order id', async () => {
    const payMock = jest.fn((_token, callbacks) => {
      callbacks.onPending({});
    });

    Object.defineProperty(window, 'snap', {
      value: {
        pay: payMock,
      },
      writable: true,
    });

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({
          ppn_rate: '11',
          discount_rate: '5',
        });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return okJson({
          redirect_url: 'https://snap.midtrans.com/token/fallback-token',
        });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitProductsLoaded();

    addFirstProduct();

    fireEvent.click(screen.getByText('Midtrans'));
    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(payMock).toHaveBeenCalledWith(
        'fallback-token',
        expect.any(Object)
      );
    });
  });

  test('shows stock habis when product stock is zero', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({
          data: [{ ...testProducts[0], stock: 0 }],
          pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
        });
      }

      if (url.includes('/api/settings')) {
        return okJson({ ppn_rate: '11', discount_rate: '5' });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => expect(screen.getByText('Test Product 1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Test Product 1'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Stok Habis', expect.any(Object));
    });
  });

  test('shows stok tidak cukup when quantity exceeds stock', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({
          data: [{ ...testProducts[0], stock: 1 }],
          pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
        });
      }

      if (url.includes('/api/settings')) {
        return okJson({ ppn_rate: '11', discount_rate: '5' });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => expect(screen.getByText('Test Product 1')).toBeInTheDocument());

    const productCard = screen.getAllByText('Test Product 1')[0];
    fireEvent.click(productCard);
    fireEvent.click(productCard);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Stok Tidak Cukup', expect.any(Object));
    });
  });

  test('updateQuantity on one item preserves the other items quantity', async () => {
    renderPage();
    await waitProductsLoaded();

    addFirstProduct();
    addSecondProduct();

    const qty1 = screen.getAllByText('1');
    expect(qty1.length).toBeGreaterThanOrEqual(2);

    const plusButtons = screen.getAllByTestId('plus-icon');
    fireEvent.click(plusButtons[plusButtons.length - 1]);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });

  test('print receipt opens print window on cash payment', async () => {
    const mockDoc = { write: jest.fn(), close: jest.fn() };
    const mockWin = { document: mockDoc };
    const openMock = jest.fn().mockReturnValue(mockWin as any);
    Object.defineProperty(window, 'open', { value: openMock, writable: true });

    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/products')) {
        return okJson({ data: testProducts });
      }

      if (url.includes('/api/settings')) {
        return okJson({ ppn_rate: '11', discount_rate: '5' });
      }

      if (url.includes('/api/transactions') && init?.method === 'POST') {
        return okJson({ message: 'Success', id: 123 });
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitProductsLoaded();
    addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: /pembayaran/i }));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith('', '_blank');
    });
    expect(mockDoc.write).toHaveBeenCalledWith(expect.stringContaining('APOTEK SUMBER WARAS'));
    expect(mockDoc.close).toHaveBeenCalled();
  });
});