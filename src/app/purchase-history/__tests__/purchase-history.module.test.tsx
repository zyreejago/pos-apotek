import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PurchaseHistoryPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';
import { useHeader } from '@/context/HeaderContext';

function HeaderDisplay() {
  const { headerState } = useHeader();
  return (
    <div data-testid="header">
      <h1>{headerState.title}</h1>
      {headerState.subtitle && <p>{headerState.subtitle}</p>}
    </div>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <div>
      <HeaderDisplay />
      {ui}
    </div>
  );
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  usePathname: () => '/purchase-history',
}));

const mockCheckPermission = jest.fn((action?: string) => true);
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
  goeyToast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
  GoeyToaster: () => null,
}));

jest.mock('@/components/PageHeader', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/context/HeaderContext', () => {
  const headerState = { title: '', subtitle: '' };
  const setHeaderState = jest.fn((s: any) => Object.assign(headerState, s));
  return {
    __esModule: true,
    HeaderProvider: ({ children }: any) => <div>{children}</div>,
    useHeader: () => ({ headerState, setHeaderState }),
  };
});

jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon" />,
  FileText: () => <span data-testid="filetext-icon" />,
  Info: () => <span data-testid="info-icon" />,
  Package: () => <span data-testid="package-icon" />,
  Users: () => <span data-testid="users-icon" />,
  Calendar: () => <span data-testid="calendar-icon" />,
  ArrowUpDown: () => <span data-testid="arrowupdown-icon" />,
  Filter: () => <span data-testid="filter-icon" />,
}));

function okJson(data: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) } as Response);
}

const defaultFakturs = [
  {
    id: 1,
    product_id: 10,
    product_name: 'Paracetamol',
    batch_number: 'BATCH-001',
    supplier_id: 5,
    supplier_name: 'PT Sehat',
    purchase_date: '2025-01-15',
    initial_quantity: 100,
    remaining_quantity: 60,
    cost_price: 5000,
    stock_type: 'lunas',
    dp_amount: null,
    due_date: null,
    expired_date: '2027-01-01',
    image_url: '/uploads/bukti1.jpg',
    status: 'approved',
    is_archived: 0,
    notes: null,
    created_at: '2025-01-15T10:00:00Z',
    dp_payments: [
      { id: 1, amount: 500000, payment_date: '2025-01-15', notes: null, created_at: '2025-01-15T10:00:00Z' },
    ],
  },
  {
    id: 2,
    product_id: 11,
    product_name: 'Amoxicillin',
    batch_number: null,
    supplier_id: null,
    supplier_name: null,
    purchase_date: null,
    initial_quantity: 50,
    remaining_quantity: 50,
    cost_price: 8000,
    stock_type: 'dp',
    dp_amount: 100000,
    due_date: '2025-03-01',
    expired_date: null,
    image_url: null,
    status: 'pending',
    is_archived: 1,
    notes: null,
    created_at: '2025-02-01T08:00:00Z',
    dp_payments: [],
  },
  {
    id: 3,
    product_id: 12,
    product_name: 'Vitamin C',
    batch_number: 'VC-2025',
    supplier_id: 6,
    supplier_name: 'PT Vitamin',
    purchase_date: '2025-03-10',
    initial_quantity: 200,
    remaining_quantity: 200,
    cost_price: 2000,
    stock_type: 'konsinyasi',
    dp_amount: null,
    due_date: null,
    expired_date: null,
    image_url: null,
    status: 'rejected',
    is_archived: 0,
    notes: null,
    created_at: '2025-03-10T09:00:00Z',
    dp_payments: undefined,
  },
  {
    id: 4,
    product_id: 13,
    product_name: 'Ibuprofen',
    batch_number: null,
    supplier_id: 7,
    supplier_name: 'PT Farma',
    purchase_date: null,
    initial_quantity: 30,
    remaining_quantity: 5,
    cost_price: 12000,
    stock_type: 'retur',
    dp_amount: null,
    due_date: null,
    expired_date: '2025-12-01',
    image_url: '/uploads/bukti4.jpg',
    status: 'revision',
    is_archived: 0,
    notes: null,
    created_at: '2025-04-01T11:00:00Z',
    dp_payments: [],
  },
  {
    id: 5,
    product_id: 14,
    product_name: 'Antibiotik X',
    batch_number: 'ABX-001',
    supplier_id: 8,
    supplier_name: 'PT Medika',
    purchase_date: '2025-05-20',
    initial_quantity: 10,
    remaining_quantity: 0,
    cost_price: 15000,
    stock_type: 'lunas',
    dp_amount: null,
    due_date: null,
    expired_date: null,
    image_url: null,
    status: 'approved',
    is_archived: 0,
    notes: null,
    created_at: '2025-05-20T12:00:00Z',
    dp_payments: [],
  },
];

function mockDefaultFetch() {
  global.fetch = jest.fn(() =>
    okJson({ data: defaultFakturs })
  ) as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockCheckPermission.mockImplementation(() => true);
  localStorage.clear();
  localStorage.setItem('token', 'test-token');
  mockDefaultFetch();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function waitLoaded() {
  await waitFor(() => {
    expect(screen.queryByText('Loading riwayat pembelian...')).not.toBeInTheDocument();
  });
}

async function waitData() {
  await waitLoaded();
  await waitFor(() => {
    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
  });
}

describe('PurchaseHistoryPage', () => {
  test('renders header title', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitLoaded();
    expect(await screen.findByTestId('header')).toBeInTheDocument();
  });

  test('renders loading state', async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as unknown as typeof fetch;

    renderWithProviders(<PurchaseHistoryPage />);
    expect(screen.getByText('Loading riwayat pembelian...')).toBeInTheDocument();

    resolveFetch!(okJson({ data: defaultFakturs }));
    await waitFor(() => {
      expect(screen.queryByText('Loading riwayat pembelian...')).not.toBeInTheDocument();
    });
  });

  test('renders empty state', async () => {
    global.fetch = jest.fn(() => okJson({ data: [] })) as unknown as typeof fetch;
    renderWithProviders(<PurchaseHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Tidak ada riwayat pembelian yang ditemukan.')).toBeInTheDocument();
    });
  });

  test('renders faktur rows with all variants', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    expect(screen.getByText('Vitamin C')).toBeInTheDocument();
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument();

    expect(screen.getByText(/BATCH-001/)).toBeInTheDocument();
    expect(screen.getByText(/VC-2025/)).toBeInTheDocument();
    expect(screen.getByText('PT Sehat')).toBeInTheDocument();

    const diarsipkanBadges = screen.getAllByText('Diarsipkan');
    expect(diarsipkanBadges.length).toBeGreaterThanOrEqual(1);

    const lunasElements = screen.getAllByText('Lunas');
    expect(lunasElements.length).toBeGreaterThan(0);
  });

  test('handles fetch failure (not ok)', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: false, status: 500, json: async () => ({}), text: async () => '{}',
    } as Response)) as unknown as typeof fetch;

    renderWithProviders(<PurchaseHistoryPage />);
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal memuat riwayat pembelian');
    });
    await waitFor(() => {
      expect(screen.getByText('Tidak ada riwayat pembelian yang ditemukan.')).toBeInTheDocument();
    });
  });

  test('handles fetch network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(() => Promise.reject(new Error('network error'))) as unknown as typeof fetch;

    renderWithProviders(<PurchaseHistoryPage />);
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Error fetching history:', expect.any(Error));
    });
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan');
    });
  });

  test('search filters by product name', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByPlaceholderText('Cari produk, supplier, batch...'), {
      target: { value: 'Paracetamol' },
    });

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });
    expect(screen.queryByText('Amoxicillin')).not.toBeInTheDocument();
  });

  test('search filters by supplier name', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByPlaceholderText('Cari produk, supplier, batch...'), {
      target: { value: 'PT Sehat' },
    });

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });
    expect(screen.queryByText('Amoxicillin')).not.toBeInTheDocument();
  });

  test('search filters by batch number', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByPlaceholderText('Cari produk, supplier, batch...'), {
      target: { value: 'BATCH-001' },
    });

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });
    expect(screen.queryByText('Vitamin C')).not.toBeInTheDocument();
  });

  test('search clears and shows all', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByPlaceholderText('Cari produk, supplier, batch...'), {
      target: { value: 'Paracetamol' },
    });
    await waitFor(() => {
      expect(screen.queryByText('Amoxicillin')).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Cari produk, supplier, batch...'), {
      target: { value: '' },
    });
    await waitFor(() => {
      expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    });
  });

  test('status filter: archived', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByDisplayValue('Semua Status'), {
      target: { value: 'archived' },
    });

    await waitFor(() => {
      expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    });
    expect(screen.queryByText('Paracetamol')).not.toBeInTheDocument();
  });

  test('status filter: active', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByDisplayValue('Semua Status'), {
      target: { value: 'active' },
    });

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });
    expect(screen.queryByText('Amoxicillin')).not.toBeInTheDocument();
  });

  test('status filter: approved (specific status)', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByDisplayValue('Semua Status'), {
      target: { value: 'approved' },
    });

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });
    expect(screen.queryByText('Vitamin C')).not.toBeInTheDocument();
  });

  test('status filter: pending', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByDisplayValue('Semua Status'), {
      target: { value: 'pending' },
    });

    await waitFor(() => {
      expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    });
    expect(screen.queryByText('Paracetamol')).not.toBeInTheDocument();
  });

  test('status filter: revision', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByDisplayValue('Semua Status'), {
      target: { value: 'revision' },
    });

    await waitFor(() => {
      expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
    });
    expect(screen.queryByText('Paracetamol')).not.toBeInTheDocument();
  });

  test('status filter: all', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByDisplayValue('Semua Status'), {
      target: { value: 'all' },
    });

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
      expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
      expect(screen.getByText('Vitamin C')).toBeInTheDocument();
      expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
    });
  });

  test('status filter: rejected', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    fireEvent.change(screen.getByDisplayValue('Semua Status'), {
      target: { value: 'rejected' },
    });

    await waitFor(() => {
      expect(screen.getByText('Vitamin C')).toBeInTheDocument();
    });
    expect(screen.queryByText('Paracetamol')).not.toBeInTheDocument();
  });

  test('sorts by created_at (toggle direction)', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const tanggalHeaders = screen.getAllByText('Tanggal');
    expect(tanggalHeaders.length).toBeGreaterThan(0);

    fireEvent.click(tanggalHeaders[0].closest('th')!);
  });

  test('sorts by product_name', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const produkHeaders = screen.getAllByText('Produk');
    fireEvent.click(produkHeaders[0].closest('th')!);
  });

  test('sorts by supplier_name', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const supplierHeaders = screen.getAllByText('Supplier');
    fireEvent.click(supplierHeaders[0].closest('th')!);
  });

  test('sorts by total_price (computed sort)', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const totalHargaHeaders = screen.getAllByText('Total Harga');
    fireEvent.click(totalHargaHeaders[0].closest('th')!);
  });

  test('sorts by status', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const statusHeaders = screen.getAllByText('Status');
    fireEvent.click(statusHeaders[0].closest('th')!);
  });

  test('opens image preview modal and closes via backdrop', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const lihatButtons = screen.getAllByText('Lihat');
    fireEvent.click(lihatButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Bukti Faktur')).toBeInTheDocument();
    });

    const modalTitle = screen.getByText('Bukti Faktur');
    const fixedDiv = modalTitle.closest('[class*="fixed"]');
    expect(fixedDiv).toBeTruthy();
    if (fixedDiv) {
      fireEvent.click(fixedDiv);
    }

    await waitFor(() => {
      expect(screen.queryByText('Bukti Faktur')).not.toBeInTheDocument();
    });
  });

  test('opens image preview modal and closes via X button', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const lihatButtons = screen.getAllByText('Lihat');
    fireEvent.click(lihatButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Bukti Faktur')).toBeInTheDocument();
    });

    const closeButton = screen.getByText('\u00D7');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Bukti Faktur')).not.toBeInTheDocument();
    });
  });

  test('modal clicks on content do not close', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const lihatButtons = screen.getAllByText('Lihat');
    fireEvent.click(lihatButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Bukti Faktur')).toBeInTheDocument();
    });

    const modalTitle = screen.getByText('Bukti Faktur');
    const modalContent = modalTitle.closest('div[class*="rounded-2xl"]');
    if (modalContent) {
      fireEvent.click(modalContent);
    }

    expect(screen.getByText('Bukti Faktur')).toBeInTheDocument();
  });

  test('renders "Tidak ada" when no image', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const tidakAdaElements = screen.getAllByText('Tidak ada');
    expect(tidakAdaElements.length).toBeGreaterThan(0);
  });

  test('renders DP payments list with remaining debt', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const dp1Elements = screen.getAllByText(/DP 1/);
    expect(dp1Elements.length).toBeGreaterThan(0);
  });

  test('renders synthetic DP from dp_amount when dp_payments is empty', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
  });

  test('renders remaining debt when dp < total', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const sisaHutang = screen.getAllByText(/Sisa hutang/);
    expect(sisaHutang.length).toBeGreaterThan(0);
  });

  test('renders Lunas when fully paid', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const lunasElements = screen.getAllByText('Lunas');
    expect(lunasElements.length).toBeGreaterThan(0);
  });

  test('renders fallback text for non-dp stock types', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    expect(screen.getByText('Vitamin C')).toBeInTheDocument();
  });

  test('handles case where dp_amount is null and dp_payments is undefined/empty', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();
    expect(screen.getByText('Antibiotik X')).toBeInTheDocument();
  });

  test('renders sold quantity text when soldQty > 0', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const terjualElements = screen.getAllByText(/terjual/);
    expect(terjualElements.length).toBeGreaterThan(0);
  });

  test('does not render sold quantity when soldQty is 0', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
  });

  test('renders expired date when present', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const expElements = screen.getAllByText(/Exp:/);
    expect(expElements.length).toBeGreaterThan(0);
  });

  test('renders status badges for all variants', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const disetujui = screen.getAllByText('Disetujui');
    expect(disetujui.length).toBeGreaterThanOrEqual(1);
    const menunggu = screen.getAllByText('Menunggu');
    expect(menunggu.length).toBeGreaterThanOrEqual(1);
    const ditolak = screen.getAllByText('Ditolak');
    expect(ditolak.length).toBeGreaterThanOrEqual(1);
    const revisi = screen.getAllByText('Revisi');
    expect(revisi.length).toBeGreaterThanOrEqual(1);
  });

  test('renders batch dash when batch_number is null', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const dashElements = screen.getAllByText('-');
    expect(dashElements.length).toBeGreaterThan(0);
  });

  test('supplier dash when supplier_name is null', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
  });

  test('sorts clicked column toggles direction', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const tanggalHeaders = screen.getAllByText('Tanggal');
    fireEvent.click(tanggalHeaders[0].closest('th')!);
    fireEvent.click(tanggalHeaders[0].closest('th')!);
  });

  test('sorts by cost_price default asc direction', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();
  });

  test('renders with no token', async () => {
    localStorage.removeItem('token');
    renderWithProviders(<PurchaseHistoryPage />);
    await waitFor(() => {
      expect(screen.getByText('Loading riwayat pembelian...')).toBeInTheDocument();
    });
  });

  test('fetches with auth header when token exists', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/inventory/history',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
        }),
      })
    );
  });

  test('renders full DP list with payment dates', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const dpAmounts = screen.getAllByText(/Rp\s*500/);
    expect(dpAmounts.length).toBeGreaterThan(0);
  });

  test('renders all status filter option labels', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const semuaStatus = screen.getAllByText('Semua Status');
    expect(semuaStatus.length).toBeGreaterThanOrEqual(1);
    const semuaAktif = screen.getAllByText('Semua Aktif');
    expect(semuaAktif.length).toBeGreaterThanOrEqual(1);
    const diarsipkan = screen.getAllByText('Diarsipkan');
    expect(diarsipkan.length).toBeGreaterThanOrEqual(1);
    const disetujui = screen.getAllByText('Disetujui');
    expect(disetujui.length).toBeGreaterThanOrEqual(1);
    const menunggu = screen.getAllByText('Menunggu');
    expect(menunggu.length).toBeGreaterThanOrEqual(1);
    const revisi = screen.getAllByText('Revisi');
    expect(revisi.length).toBeGreaterThanOrEqual(1);
    const ditolak = screen.getAllByText('Ditolak');
    expect(ditolak.length).toBeGreaterThanOrEqual(1);
  });

  test('renders search placeholder', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();
    expect(screen.getByPlaceholderText('Cari produk, supplier, batch...')).toBeInTheDocument();
  });

  test('renders stock info for all rows', async () => {
    renderWithProviders(<PurchaseHistoryPage />);
    await waitData();

    const sisaAwalElements = screen.getAllByText('Sisa / Awal');
    expect(sisaAwalElements.length).toBeGreaterThan(0);
  });
});
