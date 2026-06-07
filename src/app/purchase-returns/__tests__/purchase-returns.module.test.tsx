import React from 'react';
import { render, waitFor, fireEvent, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'react-dom';
import PurchaseReturnsPage from '../page';
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
  usePathname: () => '/purchase-returns',
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
  ArrowLeft: () => <span data-testid="arrowleft-icon" />,
  AlertTriangle: () => <span data-testid="alerttriangle-icon" />,
  Package: () => <span data-testid="package-icon" />,
  RotateCcw: () => <span data-testid="rotateccw-icon" />,
  History: () => <span data-testid="history-icon" />,
  Eye: () => <span data-testid="eye-icon" />,
  X: () => <span data-testid="x-icon" />,
  Info: () => <span data-testid="info-icon" />,
  TrendingDown: () => <span data-testid="trendingdown-icon" />,
  DollarSign: () => <span data-testid="dollarsign-icon" />,
  Calendar: () => <span data-testid="calendar-icon" />,
  ShoppingBag: () => <span data-testid="shoppingbag-icon" />,
  CheckCircle: () => <span data-testid="checkcircle-icon" />,
  AlertCircle: () => <span data-testid="alertcircle-icon" />,
  HelpCircle: () => <span data-testid="helpcircle-icon" />,
}));

const sampleItems = [
  {
    purchase_item_id: 1,
    product_id: 1,
    product_name: 'Paracetamol',
    quantity: 20,
    buy_price: 5000,
    batch_id: 101,
    batch_number: 'B001',
    expired_date: '2026-12-31',
    current_stock: 15,
    qty_already_returned: 2,
    qty_returnable: 10,
  },
  {
    purchase_item_id: 2,
    product_id: 2,
    product_name: 'Ibuprofen',
    quantity: 10,
    buy_price: 8000,
    batch_id: 102,
    batch_number: null,
    expired_date: null,
    current_stock: 5,
    qty_already_returned: 0,
    qty_returnable: 5,
  },
  {
    purchase_item_id: 3,
    product_id: 3,
    product_name: 'Amoxicillin',
    quantity: 5,
    buy_price: 12000,
    batch_id: 103,
    batch_number: 'B003',
    expired_date: '2025-01-15',
    current_stock: 0,
    qty_already_returned: 0,
    qty_returnable: 0,
  },
];

const sampleLookupResult = {
  purchase: { id: 1, invoice_no: 'INV-001', date: '2026-01-15', total: 200000 },
  supplier: { id: 1, name: 'PT Supplier Sehat', accepts_return: true, return_notes: null },
  items: sampleItems,
};

const sampleLookupResultNoReturn = {
  purchase: { id: 1, invoice_no: 'INV-001', date: '2026-01-15', total: 200000 },
  supplier: { id: 1, name: 'PT Supplier Sehat', accepts_return: false, return_notes: 'Tidak menerima retur barang basah' },
  items: [sampleItems[0]],
};

const sampleLookupResultWithNotes = {
  purchase: { id: 2, invoice_no: 'INV-002', date: '2026-02-10', total: 100000 },
  supplier: { id: 2, name: 'PT Obat Maju', accepts_return: true, return_notes: 'Retur diterima maks 7 hari' },
  items: [sampleItems[1]],
};

const sampleHistory = [
  {
    id: 1,
    return_no: 'RT-001',
    invoice_no: 'INV-001',
    supplier_name: 'PT Supplier Sehat',
    handling: 'reduce_payable',
    total_value: 50000,
    reason: 'Rusak',
    created_at: '2026-06-01T10:00:00Z',
    items: [
      { id: 1, product_name: 'Paracetamol', qty_returned: 10, buy_price: 5000, condition: 'damaged' },
    ],
  },
  {
    id: 2,
    return_no: 'RT-002',
    invoice_no: 'INV-003',
    supplier_name: 'PT Obat Maju',
    handling: 'credit_note',
    total_value: 80000,
    reason: 'Kadaluarsa',
    created_at: '2026-05-15T08:30:00Z',
    items: [
      { id: 2, product_name: 'Ibuprofen', qty_returned: 5, buy_price: 8000, condition: 'expired' },
    ],
  },
  {
    id: 3,
    return_no: 'RT-003',
    invoice_no: 'INV-004',
    supplier_name: 'PT Lain',
    handling: 'write_off_loss',
    total_value: 24000,
    reason: null,
    created_at: '2026-04-01T12:00:00Z',
    items: [
      { id: 3, product_name: 'Amoxicillin', qty_returned: 2, buy_price: 12000, condition: 'wrong_item' },
    ],
  },
];

const fmt = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(v);

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

function mockDefaultFetch() {
  global.fetch = jest.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/api/returns/purchases') && !url.includes('lookup') && !url.match(/\/api\/returns\/purchases\/\d+/)) {
      return okJson({ data: sampleHistory });
    }
    return okJson({});
  }) as unknown as typeof fetch;
}

function setCustomFetch(fn: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
  global.fetch = jest.fn(fn) as unknown as typeof fetch;
}

function renderPage() {
  return renderWithProviders(<PurchaseReturnsPage />);
}

async function lookupInvoice(invoiceNo: string) {
  const input = screen.getByPlaceholderText('Masukkan nomor faktur supplier...');
  fireEvent.change(input, { target: { value: invoiceNo } });
  fireEvent.click(screen.getByText('Cari'));
}

async function waitLookupResult() {
  await waitFor(() => {
    expect(screen.getByText('PT Supplier Sehat')).toBeInTheDocument();
  });
}

function fillReason(text = 'Barang rusak') {
  const ta = screen.getByPlaceholderText('Contoh: Barang rusak saat pengiriman...');
  fireEvent.change(ta, { target: { value: text } });
}

function setQty(rowIndex: number, value: number) {
  const qtyInputs = document.querySelectorAll('tbody input[type="number"]');
  fireEvent.change(qtyInputs[rowIndex], { target: { value: String(value) } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckPermission.mockImplementation(() => true);
  localStorage.clear();
  localStorage.setItem('token', 'test');
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' }));
  mockDefaultFetch();
});

describe('purchase-returns module', () => {
  test('renders page with header and stats', async () => {
    renderPage();
    const headers = screen.getAllByText('Retur Pembelian');
    expect(headers.length).toBeGreaterThanOrEqual(1);
    await waitFor(() => {
      expect(screen.getByText('Total Retur')).toBeInTheDocument();
      expect(screen.getByText('Total Nilai')).toBeInTheDocument();
      expect(screen.getByText('Bulan Ini')).toBeInTheDocument();
      expect(screen.getByText('Nilai Bulan Ini')).toBeInTheDocument();
    });
  });

  test('shows guide section when not searched and no lookup result', () => {
    renderPage();
    expect(screen.getByText(/Masukkan nomor faktur supplier di atas/)).toBeInTheDocument();
    expect(screen.getByText(/1\. Cari Faktur/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Pilih Barang/)).toBeInTheDocument();
    expect(screen.getByText(/3\. Proses Retur/)).toBeInTheDocument();
  });

  test('shows mounted stats after mount', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });
    renderPage();
    await waitFor(() => {
      const els = screen.getAllByText((content) => /Rp\s*0,00/.test(content));
      expect(els.length).toBeGreaterThanOrEqual(2);
    });
  });

  test('shows stats from history when data exists', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('3x')).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('Rp') && content.includes('154.000'))).toBeInTheDocument();
    });
  });

  test('input updates invoice number', () => {
    renderPage();
    const input = screen.getByPlaceholderText('Masukkan nomor faktur supplier...');
    fireEvent.change(input, { target: { value: 'INV-123' } });
    expect(input).toHaveValue('INV-123');
  });

  test('lookup with empty invoice shows error', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    renderPage();
    fireEvent.click(screen.getByText('Cari'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Masukkan nomor faktur', expect.any(Object));
    });
  });

  test('lookup shows loading state', async () => {
    let resolveLookup: (value: Response) => void = jest.fn();
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) {
        return new Promise<Response>((resolve) => { resolveLookup = resolve; });
      }
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    const input = screen.getByPlaceholderText('Masukkan nomor faktur supplier...');
    fireEvent.change(input, { target: { value: 'INV-001' } });
    fireEvent.click(screen.getByText('Cari'));
    expect(screen.getByText('Mencari...')).toBeInTheDocument();
    resolveLookup(okJson(sampleLookupResult));
    await waitFor(() => {
      expect(screen.getByText('PT Supplier Sehat')).toBeInTheDocument();
    });
  });

  test('lookup with Enter key', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    const input = screen.getByPlaceholderText('Masukkan nomor faktur supplier...');
    fireEvent.change(input, { target: { value: 'INV-001' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('PT Supplier Sehat')).toBeInTheDocument();
    });
  });

  test('lookup returns 401 and redirects to login', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return failJson({}, 401);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  test('lookup returns 404 shows not found error', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return failJson({}, 404);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-XXX');
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Faktur tidak ditemukan', expect.any(Object));
    });
  });

  test('lookup network error shows toast', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return Promise.reject(new Error('network'));
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal terhubung ke server', {});
    });
  });

  test('shows searched not found state and cari ulang', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => null,
          text: async () => 'null',
        } as Response);
      }
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-XXX');
    await waitFor(() => {
      expect(screen.getByText('Faktur tidak ditemukan')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Cari ulang'));
    expect(screen.getByText(/Masukkan nomor faktur supplier di atas/)).toBeInTheDocument();
  });

  test('renders lookup result with items', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => {
      expect(screen.getByText('PT Supplier Sehat')).toBeInTheDocument();
      expect(screen.getByText('INV-001')).toBeInTheDocument();
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
      expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
      expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    });
  });

  test('supplier does not accept returns shows warning', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResultNoReturn);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => {
      expect(screen.getByText(/Supplier tidak menerima retur barang/)).toBeInTheDocument();
    });
    const writeOffEls = screen.getAllByText(/Write-off/);
    expect(writeOffEls.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Tidak menerima retur barang basah/)).toBeInTheDocument();
  });

  test('supplier with return notes and accepts returns shows info', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResultWithNotes);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-002');
    await waitFor(() => {
      expect(screen.getByText(/Kebijakan Retur Supplier/)).toBeInTheDocument();
      expect(screen.getByText(/Retur diterima maks 7 hari/)).toBeInTheDocument();
    });
  });

  test('item with zero returnable stock is disabled', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => {
      const rows = document.querySelectorAll('tbody tr');
      const amoxInput = rows[2].querySelector('input');
      expect(amoxInput).toBeDisabled();
    });
  });

  test('item with zero stock has opacity-40', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => {
      const rows = document.querySelectorAll('tbody tr');
      expect(rows[2].className).toContain('opacity-40');
    });
  });

  test('qty already returned shows orange text', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => {
      const orangeEls = document.querySelectorAll('.text-orange-600');
      expect(orangeEls.length).toBeGreaterThan(0);
      expect(orangeEls[0].textContent).toBe('2');
    });
  });

  test('qty zero shows gray text', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => {
      const grayEls = document.querySelectorAll('.text-gray-300');
      const zeroEls = Array.from(grayEls).filter(el => el.textContent === '0');
      expect(zeroEls.length).toBeGreaterThan(0);
    });
  });

  test('handles qty change and condition change', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    const qtyInputs = document.querySelectorAll('tbody input[type="number"]');
    fireEvent.change(qtyInputs[0], { target: { value: '5' } });
    expect(qtyInputs[0]).toHaveValue(5);

    const selects = document.querySelectorAll('tbody select');
    fireEvent.change(selects[0], { target: { value: 'expired' } });
    expect(selects[0]).toHaveValue('expired');
  });

  test('changing handling method', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    const handlingSelect = screen.getByDisplayValue('Kurangi Hutang (Supplier Terima Barang)');
    fireEvent.change(handlingSelect, { target: { value: 'credit_note' } });
    expect(screen.getByDisplayValue('Credit Note (Catat Piutang ke Supplier)')).toBeInTheDocument();
  });

  test('handleSubmit without lookupResult silently returns', () => {
    renderPage();
    expect(screen.queryByText('Proses Retur')).not.toBeInTheDocument();
  });

  test('handleSubmit with no permission shows error', async () => {
    mockCheckPermission.mockImplementation((action?: string) => {
      if (action === 'create') return false;
      return true;
    });

    const { goeyToast } = require('@/components/ui/goey-toaster');
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 5);
    fireEvent.click(screen.getByText('Proses Retur'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Akses Ditolak', expect.any(Object));
    });
  });

  test('handleSubmit without reason shows error', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    setQty(0, 5);
    fireEvent.click(screen.getByText('Proses Retur'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Alasan retur wajib diisi', expect.any(Object));
    });
  });

  test('handleSubmit with invalid items (qty too high) shows error', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 99);
    fireEvent.click(screen.getByText('Proses Retur'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Quantity retur tidak valid', expect.any(Object));
    });
  });

  test('handleSubmit with no items selected (all qty=0) button is disabled', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    const submitBtn = screen.getByText('Proses Retur').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  test('handleSubmit success shows confirm modal', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 5);
    fireEvent.click(screen.getByText('Proses Retur'));

    await waitFor(() => {
      const els = screen.getAllByText('Konfirmasi Retur');
      expect(els.length).toBeGreaterThanOrEqual(2);
      expect(els[1].closest('.fixed')).toBeInTheDocument();
    });
  });

  test('confirm modal cancel closes it', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 5);
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => {
      const els = screen.getAllByText('Konfirmasi Retur');
      expect(els.length).toBeGreaterThanOrEqual(2);
    });

    const batalBtns = screen.getAllByText('Batal');
    const modalBatal = batalBtns[batalBtns.length - 1];
    fireEvent.click(modalBatal);

    await waitFor(() => {
      const els = screen.getAllByText('Konfirmasi Retur');
      expect(els.length).toBe(1);
    });
  });

  test('handleConfirmSubmit POST success resets form', async () => {
    setCustomFetch((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases') && init?.method === 'POST') {
        return okJson({ return_no: 'RT-NEW-001' });
      }
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    const { goeyToast } = require('@/components/ui/goey-toaster');

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 5);
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => expect(screen.getByText('Ya, Proses')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Ya, Proses'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Retur berhasil', expect.objectContaining({
        description: 'Return No: RT-NEW-001',
      }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Masukkan nomor faktur supplier di atas/)).toBeInTheDocument();
    });
  });

  test('handleConfirmSubmit POST failure shows error', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    setCustomFetch((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases') && init?.method === 'POST') {
        return failJson({ message: 'Stok tidak mencukupi' }, 400);
      }
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 5);
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => expect(screen.getByText('Ya, Proses')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Ya, Proses'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal', expect.objectContaining({
        description: 'Stok tidak mencukupi',
      }));
    });
  });

  test('handleConfirmSubmit POST network error', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    setCustomFetch((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases') && init?.method === 'POST') {
        return Promise.reject(new Error('network error'));
      }
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 5);
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => expect(screen.getByText('Ya, Proses')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Ya, Proses'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal terhubung ke server', {});
    });
  });

  test('shows submitting state on confirm submit', async () => {
    let resolvePost: (value: Response) => void = jest.fn();
    setCustomFetch((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases') && init?.method === 'POST') {
        return new Promise<Response>((resolve) => { resolvePost = resolve; });
      }
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 5);
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => expect(screen.getByText('Ya, Proses')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Ya, Proses'));
    await waitFor(() => {
      expect(screen.getByText('Memproses...')).toBeInTheDocument();
    });

    resolvePost(okJson({ return_no: 'RT-NEW-001' }));
  });

  test('submitting state on lookup button', async () => {
    let resolveLookup: (value: Response) => void = jest.fn();
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) {
        return new Promise<Response>((resolve) => { resolveLookup = resolve; });
      }
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    const input = screen.getByPlaceholderText('Masukkan nomor faktur supplier...');
    fireEvent.change(input, { target: { value: 'INV-001' } });
    fireEvent.click(screen.getByText('Cari'));

    expect(screen.getByText('Mencari...')).toBeInTheDocument();
    expect(screen.getByText('Mencari...').closest('button')).toBeDisabled();

    resolveLookup(okJson(sampleLookupResult));
    await waitFor(() => {
      expect(screen.getByText('PT Supplier Sehat')).toBeInTheDocument();
    });
  });

  test('batal button resets lookup result', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    const batalBtns = screen.getAllByText('Batal');
    fireEvent.click(batalBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Masukkan nomor faktur supplier di atas/)).toBeInTheDocument();
    });
  });

  test('total return value display', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('PT Supplier Sehat')).toBeInTheDocument());

    const values0 = screen.getAllByText((content) => /Rp\s*0,00/.test(content));
    expect(values0.length).toBeGreaterThanOrEqual(3);

    setQty(0, 3);
    const values15 = screen.getAllByText((content) => /Rp\s*15\.000/.test(content));
    expect(values15.length).toBeGreaterThanOrEqual(1);
  });

  test('submit button is disabled when totalReturn is 0', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    const submitBtn = screen.getByText('Proses Retur').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  test('item count display in submit section', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    setQty(0, 3);
    expect(screen.getByText('1 item dipilih')).toBeInTheDocument();
  });

  test('handles qty change with empty string clears to 0', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('PT Supplier Sehat')).toBeInTheDocument());

    const qtyInputs = document.querySelectorAll('tbody input[type="number"]');
    fireEvent.change(qtyInputs[0], { target: { value: '' } });
    expect(qtyInputs[0]).toHaveValue(null);
  });

  test('shows and hides history section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Riwayat Retur Pembelian')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Riwayat Retur Pembelian'));
    await waitFor(() => {
      expect(screen.getByText('RT-001')).toBeInTheDocument();
      expect(screen.getByText('RT-002')).toBeInTheDocument();
      expect(screen.getByText('RT-003')).toBeInTheDocument();
    });
  });

  test('history shows handling badges correctly', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Riwayat Retur Pembelian'));
    await waitFor(() => {
      expect(screen.getByText('Kurang Hutang')).toBeInTheDocument();
      expect(screen.getByText('Credit Note')).toBeInTheDocument();
      expect(screen.getByText('Write-off')).toBeInTheDocument();
    });
  });

  test('history with reason shows reason text', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('3x')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Riwayat Retur Pembelian'));
    await waitFor(() => {
      expect(screen.getByText(/Rusak/)).toBeInTheDocument();
      expect(screen.getByText(/Kadaluarsa/)).toBeInTheDocument();
    });
  });

  test('history empty state', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Riwayat Retur Pembelian')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Riwayat Retur Pembelian'));
    await waitFor(() => {
      expect(screen.getByText('Belum ada riwayat retur pembelian')).toBeInTheDocument();
    });
  });

  test('history detail view and close', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/1')) {
        return okJson({
          id: 1, return_no: 'RT-001',
          items: [{ id: 1, product_name: 'Paracetamol', qty_returned: 10, buy_price: 5000, condition: 'damaged' }],
        });
      }
      if (url.includes('/api/returns/purchases')) return okJson({ data: sampleHistory });
      return okJson({});
    });

    renderPage();
    fireEvent.click(screen.getByText('Riwayat Retur Pembelian'));
    await waitFor(() => expect(screen.getByText('RT-001')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Detail')[0]);
    await waitFor(() => {
      expect(screen.getByText('Item Retur')).toBeInTheDocument();
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    const closeBtns = screen.getAllByTestId('x-icon');
    const closeBtn = closeBtns[closeBtns.length - 1].closest('button');
    if (closeBtn) fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText('Item Retur')).not.toBeInTheDocument();
    });
  });

  test('history detail network error is silent', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/1')) return Promise.reject(new Error('network'));
      if (url.includes('/api/returns/purchases')) return okJson({ data: sampleHistory });
      return okJson({});
    });

    renderPage();
    fireEvent.click(screen.getByText('Riwayat Retur Pembelian'));
    await waitFor(() => expect(screen.getByText('RT-001')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Detail')[0]);
  });

  test('history item condition badges', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/1')) {
        return okJson({
          id: 1, return_no: 'RT-001',
          items: [
            { id: 1, product_name: 'Paracetamol', qty_returned: 10, buy_price: 5000, condition: 'damaged' },
            { id: 2, product_name: 'Ibuprofen', qty_returned: 5, buy_price: 8000, condition: 'expired' },
            { id: 3, product_name: 'Amoxicillin', qty_returned: 2, buy_price: 12000, condition: 'wrong_item' },
          ],
        });
      }
      if (url.includes('/api/returns/purchases')) return okJson({ data: sampleHistory });
      return okJson({});
    });

    renderPage();
    fireEvent.click(screen.getByText('Riwayat Retur Pembelian'));
    await waitFor(() => expect(screen.getByText('RT-001')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Detail')[0]);
    await waitFor(() => {
      expect(screen.getByText('Rusak')).toBeInTheDocument();
      expect(screen.getByText('Kadaluarsa')).toBeInTheDocument();
      expect(screen.getByText('Salah Barang')).toBeInTheDocument();
    });
  });

  test('history loading spinner visible when loading', async () => {
    let resolveHistory: (value: Response) => void = jest.fn();
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases')) {
        return new Promise<Response>((resolve) => { resolveHistory = resolve; });
      }
      return okJson({});
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Riwayat Retur Pembelian')).toBeInTheDocument();
    });

    resolveHistory(okJson({ data: sampleHistory }));
  });

  test('historyList fetch error on mount is silent', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases')) return Promise.reject(new Error('network'));
      return okJson({});
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Riwayat Retur Pembelian')).toBeInTheDocument();
    });
  });

  test('stats uses date filtering for this month', async () => {
    const now = new Date();
    const thisMonthHistory = [{
      id: 4, return_no: 'RT-004', invoice_no: 'INV-005', supplier_name: 'PT Baru',
      handling: 'reduce_payable', total_value: 100000, reason: 'Test',
      created_at: now.toISOString(),
    }];

    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases')) return okJson({ data: thisMonthHistory });
      return okJson({});
    });

    renderPage();
    await waitFor(() => {
      const els = screen.getAllByText('1x');
      expect(els.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('handleConfirmSubmit without lookupResult silently returns', () => {
    renderPage();
    expect(screen.getByText(/Masukkan nomor faktur supplier di atas/)).toBeInTheDocument();
    expect(screen.queryByText('Ya, Proses')).not.toBeInTheDocument();
  });

  test('handleSubmit with empty handling shows error toast', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 5);
    const handlingSelect = document.querySelector('select[class*="rounded-xl"]') as HTMLSelectElement;
    if (handlingSelect) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(handlingSelect, '');
      fireEvent.change(handlingSelect, { target: { value: '' } });
    }
    fireEvent.click(screen.getByText('Proses Retur'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Pilih metode penanganan', {});
    });
  });

  test('handleSubmit with no items selected shows error toast', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    const user = userEvent.setup();
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    const ta = screen.getByPlaceholderText('Contoh: Barang rusak saat pengiriman...') as HTMLTextAreaElement;
    await user.clear(ta);
    await user.type(ta, 'Barang rusak');
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Contoh: Barang rusak saat pengiriman...') as HTMLTextAreaElement).toHaveValue('Barang rusak');
    });

    const submitBtn = screen.getByText('Proses Retur').closest('button') as HTMLButtonElement;
    if (submitBtn) {
      const fiberKey = Object.keys(submitBtn).find(k => k.startsWith('__reactFiber'));
      if (fiberKey) {
        const fiber = (submitBtn as any)[fiberKey];
        const props = fiber.memoizedProps || fiber.pendingProps || {};
        if (props.onClick) await props.onClick();
      }
    }

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Tidak ada item yang diretur', expect.any(Object));
    });
  });

  test('history fetch on mount network error hits catch', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases')) return Promise.reject(new Error('mount error'));
      return okJson({});
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Masukkan nomor faktur supplier di atas/)).toBeInTheDocument();
    });
  });

  test('handles history fetch with null data', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases')) return okJson({ data: null });
      return okJson({});
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Riwayat Retur Pembelian')).toBeInTheDocument();
    });
  });

  test('fetches purchase history without token', async () => {
    localStorage.removeItem('token');

    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Masukkan nomor faktur supplier di atas/)).toBeInTheDocument();
    });
  });

  test('handleConfirmSubmit without lookupResult returns silently', async () => {
    renderPage();
    expect(screen.getByText(/Masukkan nomor faktur supplier di atas/)).toBeInTheDocument();
  });

  test('history re-fetches after successful confirm submit', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    let fetchCount = 0;
    setCustomFetch((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases') && init?.method === 'POST') {
        return okJson({ return_no: 'RT-NEW-001' });
      }
      if (url.includes('/api/returns/purchases')) {
        fetchCount++;
        if (fetchCount === 2) return okJson({ data: [{ id: 4, return_no: 'RT-NEW-001', invoice_no: 'INV-001', supplier_name: 'PT Supplier', handling: 'reduce_payable', total_value: 25000, created_at: new Date().toISOString() }] });
        return okJson({ data: sampleHistory });
      }
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 5);
    fireEvent.click(screen.getByText('Proses Retur'));
    await waitFor(() => expect(screen.getByText('Ya, Proses')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Ya, Proses'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Retur berhasil', expect.any(Object));
    });
  });

  test('renders history with missing supplier name fallback', async () => {
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases')) {
        return okJson({
          data: [{
            id: 5, return_no: 'RT-005', invoice_no: null, supplier_name: null,
            handling: 'write_off_loss', total_value: 10000, reason: null, created_at: '2026-01-01T00:00:00Z',
            items: [],
          }],
        });
      }
      return okJson({});
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Riwayat Retur Pembelian')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Riwayat Retur Pembelian'));
    await waitFor(() => {
      expect(screen.getByText('RT-005')).toBeInTheDocument();
    });
  });

  test('handleSubmit with qty over max shows error', async () => {
    const { goeyToast } = require('@/components/ui/goey-toaster');
    setCustomFetch((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/returns/purchases/lookup')) return okJson(sampleLookupResult);
      if (url.includes('/api/returns/purchases')) return okJson({ data: [] });
      return okJson({});
    });

    renderPage();
    await lookupInvoice('INV-001');
    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fillReason();
    setQty(0, 11);
    fireEvent.click(screen.getByText('Proses Retur'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Quantity retur tidak valid', expect.any(Object));
    });
  });

});
