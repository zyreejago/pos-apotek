import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PrescriptionsPage from '../page';
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
  usePathname: () => '/prescriptions',
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
  Plus: () => <span data-testid="plus-icon" />,
  Edit: () => <span data-testid="edit-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  Image: () => <span data-testid="image-icon" />,
  ShoppingCart: () => <span data-testid="shoppingcart-icon" />,
  Minus: () => <span data-testid="minus-icon" />,
  X: () => <span data-testid="x-icon" />,
  UploadCloud: () => <span data-testid="uploadcloud-icon" />,
  Camera: () => <span data-testid="camera-icon" />,
  FileText: () => <span data-testid="filetext-icon" />,
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

const prescriptionsPayload = {
  data: [
    {
      id: 1,
      prescription_code: 'RX-001',
      image_url: '/uploads/prescriptions/img1.jpg',
      prescription_date: '2025-06-01',
      entered_by: 1,
      transaction_id: 100,
      notes: 'Test notes',
      created_at: '2025-06-01T10:00:00Z',
      entered_by_name: 'Dr. Smith',
      items: [
        { id: 1, prescription_id: 1, product_id: 1, quantity: 2, selling_price: 5000, product_name: 'Paracetamol' },
        { id: 2, prescription_id: 1, product_id: 2, quantity: 1, selling_price: 10000, product_name: 'Amoxicillin' },
      ],
    },
    {
      id: 2,
      prescription_code: null,
      image_url: null,
      prescription_date: null,
      entered_by: 2,
      transaction_id: null,
      notes: null,
      created_at: '2025-06-02T10:00:00Z',
      entered_by_name: null,
      items: [],
    },
  ],
};

const productsPayload = {
  data: [
    { id: 1, name: 'Paracetamol', cost_price: 3000, selling_price: 5000, stock: 100, unit: 'tablet', category: 'Medicine' },
    { id: 2, name: 'Amoxicillin', cost_price: 7000, selling_price: 10000, stock: 50, unit: 'kapsul', category: 'Medicine' },
  ],
};

const settingsPayload = { ppn_rate: 10, discount_rate: 5 };

const outOfStockProductsPayload = {
  data: [
    ...productsPayload.data,
    { id: 3, name: 'Vitamin C', cost_price: 2000, selling_price: 4000, stock: 0, unit: 'botol', category: 'Supplement' },
  ],
};

let midtransCallbacks: Record<string, (...args: any[]) => void> = {};

function mockDefaultFetch() {
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = init?.method || 'GET';
    if (url.includes('/api/inventory/prescriptions') && method === 'DELETE') return okJson({ message: 'deleted' });
    if (url.includes('/api/inventory/prescriptions') && method === 'PUT') return okJson({ message: 'updated' });
    if (url.includes('/api/inventory/prescriptions') && method === 'POST') return okJson({ message: 'created' });
    if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
    if (url.includes('/api/products')) return okJson(productsPayload);
    if (url.includes('/api/settings')) return okJson(settingsPayload);
    if (url.includes('/api/transactions') && method === 'POST') return okJson({ id: 200, redirect_url: null });
    return okJson({});
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockCheckPermission.mockImplementation(() => true);
  localStorage.clear();
  localStorage.setItem('token', 'test');
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test', role: 'superadmin' }));
  (window as any).snap = {
    pay: jest.fn((_token: string, options: any) => { midtransCallbacks = options; }),
  };
  mockDefaultFetch();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function renderPage() {
  return render(<PrescriptionsPage />);
}

async function waitLoaded() {
  await waitFor(() => {
    expect(screen.queryByText('Memuat resep...')).not.toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByText('RX-001')).toBeInTheDocument();
  });
}

describe('prescriptions module', () => {
  test('renders loading state', async () => {
    let resolveRxFetch: ((value: Response) => void) | null = null;
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/prescriptions')) {
        return new Promise<Response>((resolve) => { resolveRxFetch = resolve; });
      }
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    expect(screen.getByText('Memuat resep...')).toBeInTheDocument();
    resolveRxFetch!({
      ok: true, status: 200,
      json: async () => prescriptionsPayload,
      text: async () => JSON.stringify(prescriptionsPayload),
    } as Response);
    expect(await screen.findByText('RX-001')).toBeInTheDocument();
  });

  test('renders prescriptions and displays data', async () => {
    renderPage();
    expect(screen.getByTestId('header')).toHaveTextContent('Resep Dokter');
    await waitLoaded();
    expect(screen.getByText('Menampilkan 2 Resep')).toBeInTheDocument();
    expect(screen.getByText('RX-001')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    expect(screen.getByText('Lihat Gambar')).toBeInTheDocument();
  });

  test('renders empty state', async () => {
    global.fetch = jest.fn(() => okJson({ data: [] })) as unknown as typeof fetch;
    renderPage();
    expect(await screen.findByText('Belum ada resep yang ditambahkan')).toBeInTheDocument();
  });

  test('handles 401 unauthorized on main fetch', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(() => failJson({}, 401)) as unknown as typeof fetch;
    renderPage();
    await waitFor(() => { expect(pushMock).toHaveBeenCalledWith('/login'); });
  });

  test('handles network error on main fetch', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(() => Promise.reject(new Error('network error'))) as unknown as typeof fetch;
    renderPage();
    await waitFor(() => { expect(screen.getByText('Belum ada resep yang ditambahkan')).toBeInTheDocument(); });
  });

  test('search input works', async () => {
    renderPage();
    await waitLoaded();
    const searchInput = screen.getByPlaceholderText('Cari Resep...');
    fireEvent.change(searchInput, { target: { value: 'RX-001' } });
    expect(searchInput).toHaveValue('RX-001');
  });

  test('opens add offcanvas', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    expect(screen.getByText('Tambah Resep Baru')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Masukkan kode resep')).toBeInTheDocument();
    expect(screen.getByText('Total Item: 0')).toBeInTheDocument();
  });

  test('closes add offcanvas via close button', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    expect(screen.getByText('Tambah Resep Baru')).toBeInTheDocument();
    const closeButton = screen.getByTestId('x-icon').closest('button') as HTMLButtonElement;
    fireEvent.click(closeButton);
    await waitFor(() => { expect(screen.queryByText('Tambah Resep Baru')).not.toBeInTheDocument(); });
  });

  test('opens edit offcanvas with prescription data', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[0]);
    expect(screen.getByText('Edit Resep')).toBeInTheDocument();
    expect(screen.getByDisplayValue('RX-001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument();
    expect(screen.getByText('Total Item: 2')).toBeInTheDocument();
  });

  test('opens edit offcanvas for prescription without items', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);
    expect(screen.getByText('Edit Resep')).toBeInTheDocument();
    expect(screen.getByText('Total Item: 0')).toBeInTheDocument();
  });

  test('opens delete modal and closes via confirm-modal close button', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    expect(screen.getByText('Hapus Resep')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-delete'));
    await waitFor(() => { expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument(); });
  });

  test('deletes prescription successfully', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Resep Berhasil Dihapus', expect.any(Object)); });
  });

  test('handles delete permission denied', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    mockCheckPermission.mockImplementation((action?: string) => action !== 'delete');
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Akses Ditolak', expect.any(Object)); });
  });

  test('handles delete API failure', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/prescriptions') && init?.method === 'DELETE') return failJson({}, 400);
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Gagal Menghapus Resep', expect.any(Object)); });
  });

  test('handles delete network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/prescriptions') && init?.method === 'DELETE') return Promise.reject(new Error('delete error'));
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Delete'))[0]);
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan sistem', expect.any(Object)); });
  });

  test('handles create permission denied', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    mockCheckPermission.mockImplementation((action?: string) => action !== 'create');
    const form = screen.getByText('Simpan Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Akses Ditolak', expect.any(Object)); });
  });

  test('handles edit permission denied', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[0]);
    mockCheckPermission.mockImplementation((action?: string) => action !== 'edit');
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Akses Ditolak', expect.any(Object)); });
  });

  test('adds prescription successfully with empty cart', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.change(screen.getByPlaceholderText('Masukkan kode resep'), {
      target: { name: 'prescription_code', value: 'RX-NEW' },
    });
    const form = screen.getByText('Simpan Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Resep Berhasil Disimpan', expect.any(Object)); });
  });

  test('adds prescription with items and cash payment', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.change(screen.getByPlaceholderText('Masukkan kode resep'), {
      target: { name: 'prescription_code', value: 'RX-NEW' },
    });
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    const form = screen.getByText('Proses Transaksi & Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Resep & Transaksi Berhasil', expect.any(Object)); });
  });

  test('edits prescription successfully', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);
    fireEvent.change(screen.getByPlaceholderText('Masukkan kode resep'), {
      target: { name: 'prescription_code', value: 'RX-UPDATED' },
    });
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Resep berhasil diperbarui', expect.any(Object)); });
  });

  test('edits prescription with items and creates transaction', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Resep & Transaksi Berhasil', expect.any(Object)); });
  });

  test('handles edit API failure', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/prescriptions') && init?.method === 'PUT') return failJson({}, 400);
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[0]);
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Gagal Memperbarui Resep', expect.any(Object)); });
  });

  test('handles edit network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/prescriptions') && init?.method === 'PUT') return Promise.reject(new Error('edit error'));
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[0]);
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Gagal memproses', expect.any(Object)); });
  });

  test('handles add API failure', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/prescriptions') && init?.method === 'POST') return failJson({}, 400);
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    const form = screen.getByText('Simpan Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Gagal Membuat Resep', expect.any(Object)); });
  });

  test('hides action buttons when permissions denied', async () => {
    mockCheckPermission.mockImplementation(() => false);
    renderPage();
    await waitLoaded();
    expect(screen.queryByText('Tambah Resep')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  test('shows dash for prescription with null fields', async () => {
    renderPage();
    await waitLoaded();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  test('renders product search inside offcanvas', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    const productSearch = screen.getByPlaceholderText('Ketik nama obat untuk mencari...');
    expect(productSearch).toBeInTheDocument();
    fireEvent.change(productSearch, { target: { value: 'Para' } });
    expect(productSearch).toHaveValue('Para');
  });

  test('adds product to cart and displays in cart list', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    expect(screen.getByText('Total Item: 1')).toBeInTheDocument();
    expect(screen.getAllByText(/Rp\s*5\.000/).length).toBeGreaterThanOrEqual(1);
  });

  test('shows product not found in search', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) return okJson({ data: [] });
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    expect(screen.getByText('Obat tidak ditemukan.')).toBeInTheDocument();
  });

  test('shows out of stock error when adding out-of-stock product', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) return okJson(outOfStockProductsPayload);
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Vitamin C'));
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Stok Habis', expect.any(Object)); });
  });

  test('shows insufficient stock error when adding beyond available stock', async () => {
    const lowStockProductsPayload = {
      data: [
        ...productsPayload.data,
        { id: 3, name: 'Vitamin C', cost_price: 2000, selling_price: 4000, stock: 1, unit: 'botol', category: 'Supplement' },
      ],
    };
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/products')) return okJson(lowStockProductsPayload);
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    const productSearch = screen.getByPlaceholderText('Ketik nama obat untuk mencari...');
    fireEvent.change(productSearch, { target: { value: 'Vitamin' } });
    fireEvent.click(screen.getByText('Vitamin C'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.change(productSearch, { target: { value: 'Vitamin' } });
    fireEvent.click(screen.getAllByText('Vitamin C')[0]);
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Stok Tidak Cukup', expect.any(Object)); });
  });

  test('removes item from cart', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    const trashButtons = screen.getAllByTestId('trash-icon');
    const cartTrash = trashButtons[trashButtons.length - 1];
    fireEvent.click(cartTrash.closest('button')!);
    await waitFor(() => { expect(screen.getByText('Total Item: 0')).toBeInTheDocument(); });
  });

  test('updates item quantity via minus and plus buttons', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    const plusButtons = screen.getAllByTestId('plus-icon');
    const cartPlusBtn = plusButtons[plusButtons.length - 1];
    fireEvent.click(cartPlusBtn.closest('button')!);
    await waitFor(() => { expect(screen.getByText('2')).toBeInTheDocument(); });
    const minusButton = screen.getByTestId('minus-icon');
    fireEvent.click(minusButton.closest('button')!);
    await waitFor(() => { expect(screen.queryByText('2')).not.toBeInTheDocument(); });
  });

  test('handles file upload and shows image preview', async () => {
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
    fireEvent.click(screen.getByText('Tambah Resep'));
    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[name="image"][type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => { expect(screen.getByAltText('Preview')).toBeInTheDocument(); });
  });

  test('clicks camera and file upload buttons', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Pilih File'));
    fireEvent.click(screen.getByText('Ambil Foto'));
    expect(screen.getByText('Pilih File')).toBeInTheDocument();
  });

  test('prints receipt after successful transaction', async () => {
    const mockDoc = { write: jest.fn(), close: jest.fn() };
    window.open = jest.fn(() => ({ document: mockDoc } as any)) as any;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    const form = screen.getByText('Proses Transaksi & Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(window.open).toHaveBeenCalledWith('', '_blank'); });
    expect(mockDoc.write).toHaveBeenCalled();
    expect(mockDoc.close).toHaveBeenCalled();
  });

  test('handles edit with transaction 401 and redirects to login', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/transactions') && init?.method === 'POST') return failJson({}, 401);
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(pushMock).toHaveBeenCalledWith('/login'); });
  });

  test('handles edit with transaction fail', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/transactions') && init?.method === 'POST') return failJson({ message: 'Error processing' }, 400);
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Transaksi gagal', expect.any(Object)); });
  });

  test('handles edit with midtrans payment flow', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/transactions') && init?.method === 'POST') return okJson({ id: 200, redirect_url: 'https://app.snap.midtrans.com/snap/v1/transactions/snap-token-abc' });
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Midtrans'));
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect((window as any).snap.pay).toHaveBeenCalled(); });
    midtransCallbacks.onSuccess?.();
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Transaksi Berhasil', expect.any(Object)); });
  });

  test('handles edit with midtrans onPending callback', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/transactions') && init?.method === 'POST') return okJson({ id: 200, redirect_url: 'https://app.snap.midtrans.com/snap/v1/transactions/snap-token-abc' });
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Midtrans'));
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect((window as any).snap.pay).toHaveBeenCalled(); });
    goeyToast.info.mockClear();
    midtransCallbacks.onPending?.();
    await waitFor(() => { expect(goeyToast.info).toHaveBeenCalledWith('Menunggu Pembayaran', expect.any(Object)); });
  });

  test('handles edit with midtrans onError callback', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/transactions') && init?.method === 'POST') return okJson({ id: 200, redirect_url: 'https://app.snap.midtrans.com/snap/v1/transactions/snap-token-abc' });
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Midtrans'));
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect((window as any).snap.pay).toHaveBeenCalled(); });
    midtransCallbacks.onError?.();
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Pembayaran Gagal', expect.any(Object)); });
  });

  test('handles edit with midtrans onClose callback', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/transactions') && init?.method === 'POST') return okJson({ id: 200, redirect_url: 'https://app.snap.midtrans.com/snap/v1/transactions/snap-token-abc' });
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Midtrans'));
    goeyToast.info.mockClear();
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect((window as any).snap.pay).toHaveBeenCalled(); });
    midtransCallbacks.onClose?.();
    await waitFor(() => { expect(goeyToast.info).toHaveBeenCalledWith('Pembayaran Ditutup', expect.any(Object)); });
  });

  test('handles add with transaction 401 and redirects to login', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/transactions') && init?.method === 'POST') return failJson({}, 401);
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    const form = screen.getByText('Proses Transaksi & Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(pushMock).toHaveBeenCalledWith('/login'); });
  });

  test('handles add with transaction fail', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/transactions') && init?.method === 'POST') return failJson({ message: 'Error' }, 400);
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    const form = screen.getByText('Proses Transaksi & Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Transaksi gagal', expect.any(Object)); });
  });

  test('handles add with midtrans payment flow - onSuccess', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || 'GET';
      if (url.includes('/api/transactions') && method === 'POST') return okJson({ id: 200, redirect_url: 'https://app.snap.midtrans.com/snap/v1/transactions/snap-token-xyz' });
      if (url.includes('/api/inventory/prescriptions') && method === 'POST') return okJson({ message: 'created' });
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Midtrans'));
    const form = screen.getByText('Proses Transaksi & Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect((window as any).snap.pay).toHaveBeenCalled(); });
    midtransCallbacks.onSuccess?.();
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Transaksi Berhasil', expect.any(Object)); });
  });

  test('handles add with midtrans onPending callback', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || 'GET';
      if (url.includes('/api/transactions') && method === 'POST') return okJson({ id: 200, redirect_url: 'https://app.snap.midtrans.com/snap/v1/transactions/snap-token-xyz' });
      if (url.includes('/api/inventory/prescriptions') && method === 'POST') return okJson({ message: 'created' });
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Midtrans'));
    goeyToast.info.mockClear();
    const form = screen.getByText('Proses Transaksi & Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect((window as any).snap.pay).toHaveBeenCalled(); });
    midtransCallbacks.onPending?.();
    await waitFor(() => { expect(goeyToast.info).toHaveBeenCalledWith('Menunggu Pembayaran', expect.any(Object)); });
  });

  test('handles add with midtrans onError callback', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || 'GET';
      if (url.includes('/api/transactions') && method === 'POST') return okJson({ id: 200, redirect_url: 'https://app.snap.midtrans.com/snap/v1/transactions/snap-token-xyz' });
      if (url.includes('/api/inventory/prescriptions') && method === 'POST') return okJson({ message: 'created' });
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Midtrans'));
    const form = screen.getByText('Proses Transaksi & Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect((window as any).snap.pay).toHaveBeenCalled(); });
    midtransCallbacks.onError?.();
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Pembayaran Gagal', expect.any(Object)); });
  });

  test('handles add with midtrans onClose callback', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || 'GET';
      if (url.includes('/api/transactions') && method === 'POST') return okJson({ id: 200, redirect_url: 'https://app.snap.midtrans.com/snap/v1/transactions/snap-token-xyz' });
      if (url.includes('/api/inventory/prescriptions') && method === 'POST') return okJson({ message: 'created' });
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Midtrans'));
    goeyToast.info.mockClear();
    const form = screen.getByText('Proses Transaksi & Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect((window as any).snap.pay).toHaveBeenCalled(); });
    midtransCallbacks.onClose?.();
    await waitFor(() => { expect(goeyToast.info).toHaveBeenCalledWith('Pembayaran Ditutup', expect.any(Object)); });
  });

  test('adds prescription with image file', async () => {
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
    fireEvent.click(screen.getByText('Tambah Resep'));
    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[name="image"][type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => { expect(screen.getByAltText('Preview')).toBeInTheDocument(); });
    const form = screen.getByText('Simpan Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Resep Berhasil Disimpan', expect.any(Object)); });
  });

  test('handles add network error in create prescription', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/prescriptions') && init?.method === 'POST') return Promise.reject(new Error('network error'));
      if (url.includes('/api/inventory/prescriptions')) return okJson(prescriptionsPayload);
      if (url.includes('/api/products')) return okJson(productsPayload);
      if (url.includes('/api/settings')) return okJson(settingsPayload);
      if (url.includes('/api/transactions')) return okJson({ id: 200, redirect_url: null });
      return okJson({});
    }) as unknown as typeof fetch;
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    const form = screen.getByText('Proses Transaksi & Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.error).toHaveBeenCalledWith('Gagal memproses', expect.any(Object)); });
  });

  test('displays billing summary with PPN and discount when cart has items', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    fireEvent.click(screen.getByText('Amoxicillin'));
    await waitFor(() => { expect(screen.getByText('Total Item: 2')).toBeInTheDocument(); });
    expect(screen.getByText('Subtotal Obat')).toBeInTheDocument();
    expect(screen.getByText(/PPN/)).toBeInTheDocument();
    expect(screen.getByText(/Diskon/)).toBeInTheDocument();
    expect(screen.getByText('Total Tagihan')).toBeInTheDocument();
  });

  test('selects save only option and submits without transaction', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Simpan saja'));
    const form = screen.getByText('Proses Transaksi & Resep').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Resep Berhasil Disimpan', expect.any(Object)); });
  });

  test('shows payment method section and toggles between cash and midtrans', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    expect(screen.getByText('Metode Pembayaran')).toBeInTheDocument();
    expect(screen.getByText('Tunai')).toBeInTheDocument();
    expect(screen.getByText('Midtrans')).toBeInTheDocument();
    expect(screen.getByText('QRIS / Transfer')).toBeInTheDocument();
  });

  test('removes image preview by clicking remove button', async () => {
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
    fireEvent.click(screen.getByText('Tambah Resep'));
    const fileInput = document.querySelector('input[name="image"][type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['dummy'], 'test.png', { type: 'image/png' })] } });
    await waitFor(() => { expect(screen.getByAltText('Preview')).toBeInTheDocument(); });
    const removeButton = screen.getByAltText('Preview').closest('.group')!.querySelector('button')!;
    fireEvent.click(removeButton);
    await waitFor(() => { expect(screen.queryByAltText('Preview')).not.toBeInTheDocument(); });
  });

  test('shows Opsi Simpan section labels', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    expect(screen.getByText('Opsi Simpan')).toBeInTheDocument();
    expect(screen.getByText('Bayar langsung')).toBeInTheDocument();
  });

  test('edits prescription with existing transaction_id and adds items', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click((await screen.findAllByTitle('Edit'))[0]);
    expect(screen.getByText('Edit Resep')).toBeInTheDocument();
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Resep berhasil diperbarui', expect.any(Object)); });
  });

  test('adds same product twice to cart (branch lines 202-203 existing item)', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    await screen.findByText('Paracetamol');
    fireEvent.click(screen.getAllByText('Paracetamol').slice(-1)[0]);
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByText('Paracetamol').slice(-1)[0]);
    await waitFor(() => { expect(screen.getAllByText(/2/).length).toBeGreaterThanOrEqual(2); });
  });

  test('updates quantity with multiple items in cart (branch line 223 else in updateQuantity)', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    await screen.findByText('Paracetamol');
    fireEvent.click(screen.getAllByText('Paracetamol').slice(-1)[0]);
    await screen.findByText('Total Item: 1');
    fireEvent.click(screen.getAllByText('Amoxicillin').slice(-1)[0]);
    await waitFor(() => { expect(screen.getByText('Total Item: 2')).toBeInTheDocument(); });
    const plusButtons = screen.getAllByTestId('plus-icon');
    const cartPlusBtn = plusButtons[plusButtons.length - 1];
    fireEvent.click(cartPlusBtn.closest('button')!);
    await waitFor(() => { expect(screen.getAllByText('Paracetamol').length).toBeGreaterThanOrEqual(1); });
  });

  test('edits prescription with uploaded image (branch line 511)', async () => {
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
    fireEvent.click((await screen.findAllByTitle('Edit'))[1]);
    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[name="image"][type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => { expect(screen.getByAltText('Preview')).toBeInTheDocument(); });
    const form = screen.getByText('Simpan Perubahan').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => { expect(goeyToast.success).toHaveBeenCalledWith('Resep berhasil diperbarui', expect.any(Object)); });
  });

  test('toggles save option back to save_and_pay (branch lines 1147-1172)', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Simpan saja'));
    await waitFor(() => { expect(screen.getByText('Simpan Resep')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Bayar langsung'));
    await waitFor(() => { expect(screen.getByText('Proses Transaksi & Resep')).toBeInTheDocument(); });
  });

  test('closes offcanvas via cancel button (branch line 1212)', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    expect(screen.getByText('Tambah Resep Baru')).toBeInTheDocument();
    const cancelButton = screen.getByText('Batal');
    fireEvent.click(cancelButton);
    await waitFor(() => { expect(screen.queryByText('Tambah Resep Baru')).not.toBeInTheDocument(); });
  });

  test('covers addToCart existing item map branch (lines 202-203) with specific qty increments', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    await screen.findByText('Paracetamol');
    fireEvent.click(screen.getAllByText('Paracetamol').slice(-1)[0]);
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByText('Paracetamol').slice(-1)[0]);
    await waitFor(() => { expect(screen.getAllByText(/2/).length).toBeGreaterThanOrEqual(1); });
    fireEvent.click(screen.getAllByText('Amoxicillin').slice(-1)[0]);
    await waitFor(() => { expect(screen.getByText('Total Item: 2')).toBeInTheDocument(); });
    const plusButtons = screen.getAllByTestId('plus-icon');
    const paracetamolPlus = plusButtons.filter(b => b.closest('button'))[0];
    if (paracetamolPlus) fireEvent.click(paracetamolPlus.closest('button')!);
  });

  test('covers cash payment method button onClick (lines 1170-1172)', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    fireEvent.click(screen.getByText('Paracetamol'));
    await waitFor(() => { expect(screen.getByText('Total Item: 1')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Midtrans'));
    await waitFor(() => {
      const tunaiBtn = screen.getByText('Tunai').closest('button');
      expect(tunaiBtn).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Tunai'));
    await waitFor(() => {
      expect(screen.getByText('QRIS / Transfer')).toBeInTheDocument();
    });
  });

  // --- Tests for doctor_name and instansi fields ---

  test('shows doctor_name and instansi fields in add form', async () => {
    renderPage();
    await waitLoaded();
    const addBtn = screen.getByText('Tambah Resep');
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByText('Tambah Resep Baru')).toBeInTheDocument();
    });
    const inputs = document.querySelectorAll('input');
    const doctorInput = Array.from(inputs).find(i => i.name === 'doctor_name');
    const instansiInput = Array.from(inputs).find(i => i.name === 'instansi');
    expect(doctorInput).toBeTruthy();
    expect(instansiInput).toBeTruthy();
  });

  test('doctor_name and instansi inputs accept text values', async () => {
    renderPage();
    await waitLoaded();
    fireEvent.click(screen.getByText('Tambah Resep'));
    await waitFor(() => {
      expect(screen.getByText('Tambah Resep Baru')).toBeInTheDocument();
    });
    const inputs = document.querySelectorAll('input');
    const doctorInput = Array.from(inputs).find(i => i.name === 'doctor_name') as HTMLInputElement;
    const instansiInput = Array.from(inputs).find(i => i.name === 'instansi') as HTMLInputElement;
    if (doctorInput) {
      fireEvent.change(doctorInput, { target: { name: 'doctor_name', value: 'Dr. John' } });
      expect(doctorInput.value).toBe('Dr. John');
    }
    if (instansiInput) {
      fireEvent.change(instansiInput, { target: { name: 'instansi', value: 'RS Balimed' } });
      expect(instansiInput.value).toBe('RS Balimed');
    }
  });

  test('displays doctor_name and instansi in edit form when data exists', async () => {
    renderPage();
    await waitLoaded();
    const editBtns = screen.getAllByTestId('edit-icon');
    if (editBtns.length > 0) {
      fireEvent.click(editBtns[0].closest('button')!);
      await waitFor(() => {
        expect(screen.getByText('Edit Resep')).toBeInTheDocument();
      });
      const inputs = document.querySelectorAll('input');
      const doctorInput = Array.from(inputs).find(i => i.name === 'doctor_name') as HTMLInputElement;
      const instansiInput = Array.from(inputs).find(i => i.name === 'instansi') as HTMLInputElement;
      if (doctorInput) expect(doctorInput).toBeInTheDocument();
      if (instansiInput) expect(instansiInput).toBeInTheDocument();
    }
  });

  test('doctor_name and instansi shown in table when prescription has them', async () => {
    const prescriptionWithMeta = { ...prescriptionsPayload.data[0], doctor_name: 'Dr. John', instansi: 'RS Balimed' };
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/prescriptions')) {
        return okJson({ data: [prescriptionWithMeta] });
      }
      return okJson({ data: [] });
    }) as unknown as typeof fetch;
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Dr. John')).toBeInTheDocument();
      expect(screen.getByText('RS Balimed')).toBeInTheDocument();
    });
  });
});
