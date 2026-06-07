import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GeneralLedgerPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';
import { HeaderProvider, useHeader } from '@/context/HeaderContext';

jest.mock('lucide-react', () => ({
  Download: () => <span data-testid="download-icon" />,
  Calendar: () => <span data-testid="calendar-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
}));

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

const saveMock = jest.fn();

jest.mock('@/components/ui/goey-toaster', () => ({
  goeyToast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
  GoeyToaster: () => null,
}));

jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    setFont: jest.fn(),
    text: jest.fn(),
    setLineWidth: jest.fn(),
    line: jest.fn(),
    addPage: jest.fn(),
    save: saveMock,
  }));
});

jest.mock('jspdf-autotable', () => jest.fn((doc) => {
  doc.lastAutoTable = { finalY: 200 };
}));

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

function failJson(data: unknown) {
  return Promise.resolve({
    ok: false,
    status: 500,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

const mockLedgerData = [
  {
    id: 1,
    date: '2026-05-01T00:00:00.000Z',
    description: 'Pembelian barang',
    code: '111',
    name: 'Kas',
    type: 'aktiva',
    normal_balance: 'debit',
    debit: 100000,
    credit: 0,
  },
  {
    id: 2,
    date: '2026-05-02T00:00:00.000Z',
    description: 'Penjualan tunai',
    code: '411',
    name: 'Pendapatan',
    type: 'pasiva',
    normal_balance: 'credit',
    debit: 0,
    credit: 50000,
  },
];

const mockAccounts = [
  { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit' },
  { id: 2, code: '411', name: 'Pendapatan', type: 'pasiva', normal_balance: 'credit' },
];

beforeEach(() => {
  jest.clearAllMocks();
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

  global.fetch = jest.fn(() =>
    okJson({ ledger: mockLedgerData, accounts: mockAccounts })
  ) as unknown as typeof fetch;
});

describe('general-ledger module', () => {
  test('renders page and shows loading then loads data', async () => {
    renderWithProviders(<GeneralLedgerPage />);

    expect(screen.getByText('Buku Besar')).toBeInTheDocument();
    expect(screen.getByText('Laporan Keuangan')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    expect(screen.getByText('Penjualan tunai')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/accounting/general-ledger'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test',
        }),
      })
    );
  });

  test('shows loading state before data is loaded', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    expect(screen.getByText('Memuat buku besar...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ ledger: mockLedgerData, accounts: mockAccounts }),
      text: async () => JSON.stringify({ ledger: mockLedgerData, accounts: mockAccounts }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });
  });

  test('renders empty state when no ledger data', async () => {
    global.fetch = jest.fn(() =>
      okJson({ ledger: [], accounts: [] })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Tidak ada transaksi pada periode ini')).toBeInTheDocument();
    });
  });

  test('changes month and refetches data', async () => {
    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');

    fireEvent.change(selects[1], {
      target: { value: '3' },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('month=3'),
        expect.any(Object)
      );
    });
  });

  test('changes year and refetches data', async () => {
    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');

    fireEvent.change(selects[2], {
      target: { value: '2025' },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('year=2025'),
        expect.any(Object)
      );
    });
  });

  test('selects an account and refetches with accountId', async () => {
    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    const acctSelect = screen.getByDisplayValue('Semua Akun') as HTMLSelectElement;
    // Wait for header context to propagate account options
    await waitFor(() => {
      expect(acctSelect.options.length).toBe(3);
    });

    acctSelect.value = '1';
    fireEvent.change(acctSelect);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('accountId=1'),
        expect.any(Object)
      );
    });
  });

  test('fetches without authorization header when token is missing', async () => {
    localStorage.removeItem('token');

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/general-ledger'),
        expect.objectContaining({
          headers: {},
        })
      );
    });
  });

  test('shows toast error when fetch response is not ok with message', async () => {
    global.fetch = jest.fn(() =>
      failJson({ message: 'Server error' })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Server error',
        expect.any(Object)
      );
    });
  });

  test('shows fallback toast error when fetch response is not ok without message', async () => {
    global.fetch = jest.fn(() => failJson({})) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal mengambil buku besar',
        expect.any(Object)
      );
    });
  });

  test('shows toast error when fetch throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal terhubung ke server',
        expect.any(Object)
      );
    });
  });

  test('displays correct running balance with debit normal_balance', async () => {
    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Rp 100.000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Dr/)).toBeInTheDocument();
  });

  test('displays correct balance label for credit normal_balance with positive balance', async () => {
    const items = [
      {
        id: 2,
        date: '2026-05-02T00:00:00.000Z',
        description: 'Penjualan tunai',
        code: '411',
        name: 'Pendapatan',
        type: 'pasiva',
        normal_balance: 'credit',
        debit: 0,
        credit: 50000,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: mockAccounts })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Penjualan tunai')).toBeInTheDocument();
    });

    const crElements = screen.getAllByText(/Cr/);
    const drElements = screen.queryAllByText(/Dr/);
    expect(crElements.length).toBeGreaterThan(0);
    expect(drElements.length).toBe(0);
  });

  test('displays Cr when negative balance for debit normal_balance', async () => {
    const items = [
      {
        id: 1,
        date: '2026-05-01T00:00:00.000Z',
        description: 'Retur pembelian',
        code: '111',
        name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',
        debit: 0,
        credit: 25000,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: mockAccounts })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Retur pembelian')).toBeInTheDocument();
    });

    const crElements = screen.getAllByText(/Cr/);
    expect(crElements.length).toBeGreaterThan(0);
    const rpElements = screen.getAllByText(/Rp 25.000/);
    expect(rpElements.length).toBeGreaterThan(0);
  });

  test('displays Dr when negative balance for credit normal_balance', async () => {
    const items = [
      {
        id: 2,
        date: '2026-05-02T00:00:00.000Z',
        description: 'Retur penjualan',
        code: '411',
        name: 'Pendapatan',
        type: 'pasiva',
        normal_balance: 'credit',
        debit: 10000,
        credit: 0,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: mockAccounts })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Retur penjualan')).toBeInTheDocument();
    });

    const drElements = screen.getAllByText(/Dr/);
    expect(drElements.length).toBeGreaterThan(0);
  });

  test('shows dash when debit and credit are zero', async () => {
    const items = [
      {
        id: 1,
        date: '2026-05-01T00:00:00.000Z',
        description: 'Transaksi nol',
        code: '111',
        name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',
        debit: 0,
        credit: 0,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: mockAccounts })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Transaksi nol')).toBeInTheDocument();
    });

    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  test('downloads PDF covering forEach body line 156', async () => {
    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Buku_Besar_')
      );
    });
  });

  test('downloads PDF successfully with data', async () => {
    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(goeyToast.info).toHaveBeenCalledWith(
        'Sedang membuat PDF...',
        expect.any(Object)
      );
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Buku_Besar_')
      );
      expect(goeyToast.success).toHaveBeenCalledWith(
        'PDF berhasil diunduh',
        expect.any(Object)
      );
    });
  });

  test('downloads PDF even when loading (data still resolving)', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(goeyToast.info).toHaveBeenCalledWith(
        'Sedang membuat PDF...',
        expect.any(Object)
      );
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Buku_Besar_')
      );
      expect(goeyToast.success).toHaveBeenCalledWith(
        'PDF berhasil diunduh',
        expect.any(Object)
      );
    });

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ ledger: mockLedgerData, accounts: mockAccounts }),
      text: async () => JSON.stringify({ ledger: mockLedgerData, accounts: mockAccounts }),
    } as Response);
  });

  test('shows toast error when PDF generation fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    saveMock.mockImplementationOnce(() => {
      throw new Error('PDF error');
    });

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal membuat PDF',
        expect.any(Object)
      );
    });
  });

  test('uses fallback name when username is missing', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 1,
        name: 'Admin Name',
        role: 'superadmin',
      })
    );

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });
  });

  test('uses Admin fallback when username and name are missing', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 1,
        role: 'superadmin',
      })
    );

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });
  });

  test('uses Admin fallback when user localStorage is missing', async () => {
    localStorage.removeItem('user');

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });
  });

  test('displays month names and year options in selects', async () => {
    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    expect(screen.getByText('Januari')).toBeInTheDocument();
    expect(screen.getByText('Desember')).toBeInTheDocument();
    expect(screen.getByText('Semua Akun')).toBeInTheDocument();
  });

  test('renders account options in select dropdown', async () => {
    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('111 - Kas')).toBeInTheDocument();
    });
    expect(screen.getByText('411 - Pendapatan')).toBeInTheDocument();
  });

  test('reset select to empty accountId refetches without accountId param', async () => {
    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    const acctSelect = screen.getByDisplayValue('Semua Akun') as HTMLSelectElement;
    // Wait for header context to propagate account options
    await waitFor(() => {
      expect(acctSelect.options.length).toBe(3);
    });

    acctSelect.value = '1';
    fireEvent.change(acctSelect);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('accountId=1'),
        expect.any(Object)
      );
    });

    acctSelect.value = '';
    fireEvent.change(acctSelect);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.not.stringContaining('accountId'),
        expect.any(Object)
      );
    });

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.not.stringContaining('accountId'),
      expect.any(Object)
    );
  });

  test('downloads PDF with empty ledger data', async () => {
    global.fetch = jest.fn(() =>
      okJson({ ledger: [], accounts: [] })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Buku Besar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(goeyToast.info).toHaveBeenCalledWith(
        'Sedang membuat PDF...',
        expect.any(Object)
      );
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Buku_Besar_')
      );
      expect(goeyToast.success).toHaveBeenCalledWith(
        'PDF berhasil diunduh',
        expect.any(Object)
      );
    });
  });

  test('downloads PDF with negative balance items (balance < 0 branch)', async () => {
    const items = [
      {
        id: 1,
        date: '2026-05-01T00:00:00.000Z',
        description: 'Retur pembelian',
        code: '111',
        name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',
        debit: 0,
        credit: 25000,
      },
      {
        id: 2,
        date: '2026-05-02T00:00:00.000Z',
        description: 'Retur penjualan',
        code: '411',
        name: 'Pendapatan',
        type: 'pasiva',
        normal_balance: 'credit',
        debit: 10000,
        credit: 0,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: [] })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Retur pembelian')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Buku_Besar_')
      );
    });
  });

  test('downloads PDF with items having debit=0 and credit=0', async () => {
    const items = [
      {
        id: 1,
        date: '2026-05-01T00:00:00.000Z',
        description: 'Transaksi nol',
        code: '111',
        name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',
        debit: 0,
        credit: 0,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: [] })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Transaksi nol')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Buku_Besar_')
      );
    });
  });

  test('downloads PDF with positive balance credit normal_balance', async () => {
    const items = [
      {
        id: 1,
        date: '2026-05-01T00:00:00.000Z',
        description: 'Penjualan',
        code: '411',
        name: 'Pendapatan',
        type: 'pasiva',
        normal_balance: 'credit',
        debit: 0,
        credit: 100000,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: [] })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Penjualan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Buku_Besar_')
      );
    });
  });

  test('covers all PDF forEach branches: debit>0, credit>0, balance>=0, normal_balance', async () => {
    const items = [
      {
        id: 1,
        date: '2026-05-01T00:00:00.000Z',
        description: 'Kas masuk',
        code: '111',
        name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',
        debit: 100000,
        credit: 0,
      },
      {
        id: 2,
        date: '2026-05-02T00:00:00.000Z',
        description: 'Transaksi nol',
        code: '111',
        name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',
        debit: 0,
        credit: 0,
      },
      {
        id: 3,
        date: '2026-05-03T00:00:00.000Z',
        description: 'Penjualan kredit',
        code: '411',
        name: 'Pendapatan',
        type: 'pasiva',
        normal_balance: 'credit',
        debit: 0,
        credit: 50000,
      },
      {
        id: 4,
        date: '2026-05-04T00:00:00.000Z',
        description: 'Retur pembelian (negatif balance debit)',
        code: '111',
        name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',
        debit: 0,
        credit: 25000,
      },
      {
        id: 5,
        date: '2026-05-05T00:00:00.000Z',
        description: 'Retur penjualan (negatif balance credit)',
        code: '411',
        name: 'Pendapatan',
        type: 'pasiva',
        normal_balance: 'credit',
        debit: 10000,
        credit: 0,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: [] })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Kas masuk')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Buku_Besar_')
      );
    });
  });

  test('downloads PDF with multiple items covering all ternary combinations', async () => {
    const items = [
      {
        id: 1,
        date: '2026-05-01T00:00:00.000Z',
        description: 'Setoran awal',
        code: '111',
        name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',
        debit: 200000,
        credit: 0,
      },
      {
        id: 2,
        date: '2026-05-02T00:00:00.000Z',
        description: 'Pembayaran hutang',
        code: '211',
        name: 'Hutang Usaha',
        type: 'pasiva',
        normal_balance: 'credit',
        debit: 0,
        credit: 75000,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: [] })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Setoran awal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Buku_Besar_')
      );
    });
  });

  // GL-3: Covers Branch ID 7 (result.ledger || []) and Branch ID 8 (result.accounts || [])
  test('handles fetch response without ledger and accounts keys (covers result.ledger || [] and result.accounts || [])', async () => {
    global.fetch = jest.fn(() =>
      okJson({}) // no 'ledger', no 'accounts' keys
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Tidak ada transaksi pada periode ini')).toBeInTheDocument();
    });

    const acctSelect = screen.getByDisplayValue('Semua Akun') as HTMLSelectElement;
    expect(acctSelect.options.length).toBe(1);
  });

  // GL-3b: Covers Branch ID 7 only — response with accounts but no ledger
  test('handles fetch response with accounts but without ledger key (covers result.ledger || [])', async () => {
    global.fetch = jest.fn(() =>
      okJson({ accounts: mockAccounts }) // no 'ledger' key
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Tidak ada transaksi pada periode ini')).toBeInTheDocument();
    });

    // accounts dropdown still populated
    await waitFor(() => {
      expect(screen.getByText('111 - Kas')).toBeInTheDocument();
    });
  });

  // GL-3c: Covers Branch ID 8 only — response with ledger but no accounts
  test('handles fetch response with ledger but without accounts key (covers result.accounts || [])', async () => {
    global.fetch = jest.fn(() =>
      okJson({ ledger: mockLedgerData }) // no 'accounts' key
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    await waitFor(() => {
      expect(screen.getByText('Pembelian barang')).toBeInTheDocument();
    });

    // account select should only show "Semua Akun" with no extra options
    const acctSelect = screen.getByDisplayValue('Semua Akun') as HTMLSelectElement;
    expect(acctSelect.options.length).toBe(1);
  });

  // GL-4: Covers Branch ID 13 Path[0,1], 14 Path[0,1], 15 Path[0], 16 Path[0,1]
  // PDF forEach — debit>0 and credit>0 items, balance>=0 with both normal_balance types
  test('PDF forEach covers debit>0, credit>0 and balance>=0 ternaries (Branches 13, 14, 15, 16)', async () => {
    const items = [
      {
        id: 1,
        date: '2026-05-01T00:00:00.000Z',
        description: 'Kas masuk debit positif',
        code: '111',
        name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',
        debit: 150000,  // debit > 0 → Branch 13 Path[0] (formatCurrency shown)
        credit: 0,      // credit = 0 → Branch 14 Path[1] (empty string)
        // running balance = +150000 (debit, >=0, normal=debit) → B15 Path[0], B16 Path[0] 'Dr'
      },
      {
        id: 2,
        date: '2026-05-02T00:00:00.000Z',
        description: 'Pendapatan kredit positif',
        code: '411',
        name: 'Pendapatan',
        type: 'pasiva',
        normal_balance: 'credit',
        debit: 0,       // debit = 0 → Branch 13 Path[1] (empty string)
        credit: 80000,  // credit > 0 → Branch 14 Path[0] (formatCurrency shown)
        // running balance = +80000 (credit, >=0, normal=credit) → B15 Path[0], B16 Path[1] 'Cr'
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: [] })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    // Wait for data to be fully rendered in the table (ensures ledgerData state is set)
    await waitFor(() => {
      expect(screen.getByText('Kas masuk debit positif')).toBeInTheDocument();
      expect(screen.getByText('Pendapatan kredit positif')).toBeInTheDocument();
    });

    // Also verify Dr/Cr are rendered in the UI table (confirms ledgerWithBalance ran with data)
    await waitFor(() => {
      expect(screen.getAllByText(/Dr|Cr/).length).toBeGreaterThan(0);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Download PDF'));
    });

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(expect.stringContaining('Buku_Besar_'));
      expect(goeyToast.success).toHaveBeenCalledWith('PDF berhasil diunduh', expect.any(Object));
    });
  });

  // GL-5: Covers Branch ID 15 Path[1], 17 Path[0], 17 Path[1]
  // PDF forEach — items with negative running balance (balance < 0)
  test('PDF forEach covers balance<0 ternaries: debit normal (Cr label) and credit normal (Dr label) (Branches 15, 17)', async () => {
    const items = [
      {
        id: 1,
        date: '2026-05-01T00:00:00.000Z',
        description: 'Retur kas balance negatif debit',
        code: '111',
        name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',
        debit: 0,
        credit: 50000,
        // running balance = 0 - 50000 = -50000 (debit account, negative)
        // → Branch 15 Path[1] (balance < 0), Branch 17 Path[0] (debit → 'Cr')
      },
      {
        id: 2,
        date: '2026-05-02T00:00:00.000Z',
        description: 'Retur pendapatan balance negatif credit',
        code: '411',
        name: 'Pendapatan',
        type: 'pasiva',
        normal_balance: 'credit',
        debit: 30000,
        credit: 0,
        // running balance = 0 - 30000 = -30000 (credit account, negative)
        // → Branch 15 Path[1] (balance < 0), Branch 17 Path[1] (credit → 'Dr')
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ ledger: items, accounts: [] })
    ) as unknown as typeof fetch;

    renderWithProviders(<GeneralLedgerPage />);

    // Confirm data is visible in the UI table before clicking PDF
    await waitFor(() => {
      expect(screen.getByText('Retur kas balance negatif debit')).toBeInTheDocument();
      expect(screen.getByText('Retur pendapatan balance negatif credit')).toBeInTheDocument();
    });

    // Confirm Cr and Dr labels are visible (balance < 0 rendering already works)
    await waitFor(() => {
      const crElements = screen.getAllByText(/Cr/);
      expect(crElements.length).toBeGreaterThan(0);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Download PDF'));
    });

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(expect.stringContaining('Buku_Besar_'));
      expect(goeyToast.success).toHaveBeenCalledWith('PDF berhasil diunduh', expect.any(Object));
    });
  });
});
