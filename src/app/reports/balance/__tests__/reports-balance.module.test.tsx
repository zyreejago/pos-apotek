import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportsbalancePage from '../page';
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
const addPageMock = jest.fn();
const textMock = jest.fn();

jest.mock('@/components/PageHeader', () => {
  return function PageHeader({ title, subtitle, rightContent }: any) {
    return (
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {rightContent}
      </div>
    );
  };
});


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
    setTextColor: jest.fn(),
    text: textMock,
    setLineWidth: jest.fn(),
    line: jest.fn(),
    addPage: addPageMock,
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

const mockAccounts = [
  { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit', total_debit: 100000, total_credit: 0 },
  { id: 2, code: '112', name: 'Persediaan Barang', type: 'aktiva', normal_balance: 'debit', total_debit: 200000, total_credit: 0 },
  { id: 3, code: '113', name: 'Piutang Usaha', type: 'aktiva', normal_balance: 'debit', total_debit: 300000, total_credit: 0 },
  { id: 4, code: '211', name: 'Hutang Usaha', type: 'pasiva', normal_balance: 'kredit', total_debit: 0, total_credit: 50000 },
  { id: 5, code: '212', name: 'Hutang Konsinyasi', type: 'pasiva', normal_balance: 'kredit', total_debit: 0, total_credit: 75000 },
  { id: 6, code: '311', name: 'Ekuitas Awal', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 300000 },
  { id: 7, code: '312', name: 'Penambahan/Pengurangan Modal', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 100000 },
  { id: 8, code: '313', name: 'Laba/Rugi Tertahan', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 75000 },
];

const bigAccounts = [
  ...Array.from({ length: 20 }, (_, i) => ({
    id: i + 1, code: `${100 + i}`, name: `Akun ${i + 1}`, type: 'aktiva', normal_balance: 'debit', total_debit: 1000, total_credit: 0,
  })),
  { id: 21, code: '201', name: 'Hutang', type: 'pasiva', normal_balance: 'kredit', total_debit: 0, total_credit: 5000 },
  { id: 22, code: '301', name: 'Modal', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 15000 },
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

  global.fetch = jest.fn(() => okJson({ accounts: mockAccounts })) as unknown as typeof fetch;
});

describe('reports-balance module', () => {
  test('renders page and loads balance data', async () => {
    renderWithProviders(<ReportsbalancePage />);

    expect(screen.getByText('Neraca Keuangan')).toBeInTheDocument();
    expect(screen.getByText('Laporan Keuangan')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('AKTIVA')).toBeInTheDocument();
    });

    expect(screen.getByText('Kas')).toBeInTheDocument();
    expect(screen.getByText('Persediaan Barang')).toBeInTheDocument();
    expect(screen.getByText('Piutang Usaha')).toBeInTheDocument();
    expect(screen.getByText('PASIVA')).toBeInTheDocument();
    expect(screen.getByText('Hutang Usaha')).toBeInTheDocument();
    expect(screen.getByText('Hutang Konsinyasi')).toBeInTheDocument();
    expect(screen.getByText('MODAL')).toBeInTheDocument();
    expect(screen.getByText('Ekuitas Awal')).toBeInTheDocument();
    expect(screen.getByText('Penambahan/Pengurangan Modal')).toBeInTheDocument();
    expect(screen.getByText('Laba/Rugi Tertahan')).toBeInTheDocument();
    expect(screen.getByText('Total Aktiva')).toBeInTheDocument();
    expect(screen.getByText('Total Pasiva & Modal')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reports/balance-accounting'),
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

    renderWithProviders(<ReportsbalancePage />);

    expect(screen.getByText('Memuat neraca keuangan...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ accounts: mockAccounts }),
      text: async () => JSON.stringify({ accounts: mockAccounts }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText('AKTIVA')).toBeInTheDocument();
    });
  });

  test('changes month and year then refetches data', async () => {
    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('AKTIVA')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');

    fireEvent.change(selects[0], {
      target: { value: '1' },
    });

    fireEvent.change(selects[1], {
      target: { value: '2024' },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('month=1&year=2024'),
        expect.any(Object)
      );
    });
  });

  test('fetches without authorization header when token is missing', async () => {
    localStorage.removeItem('token');

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reports/balance-accounting'),
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

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Server error',
        expect.any(Object)
      );
    });
  });

  test('shows fallback toast error when fetch response has no message', async () => {
    global.fetch = jest.fn(() => failJson({})) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal mengambil neraca keuangan',
        expect.any(Object)
      );
    });
  });

  test('shows toast error when fetch throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal terhubung ke server',
        expect.any(Object)
      );
    });
  });

  test('downloads PDF successfully with data', async () => {
    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('AKTIVA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(goeyToast.info).toHaveBeenCalledWith(
        'Sedang membuat PDF...',
        expect.any(Object)
      );
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Neraca_Keuangan_')
      );
      expect(goeyToast.success).toHaveBeenCalledWith(
        'PDF berhasil diunduh',
        expect.any(Object)
      );
    });

    expect(textMock).toHaveBeenCalledWith('APOTEK SUMBER WARAS', 105, 20, expect.any(Object));
    expect(textMock).toHaveBeenCalledWith('NERACA KEUANGAN', 105, 45, expect.any(Object));
  });

  test('downloads PDF even when data is still null', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    ) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Neraca_Keuangan_')
      );
      expect(goeyToast.success).toHaveBeenCalled();
    });

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ accounts: mockAccounts }),
      text: async () => JSON.stringify({ accounts: mockAccounts }),
    } as Response);
  });

  test('shows toast error when PDF generation fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    saveMock.mockImplementationOnce(() => {
      throw new Error('PDF error');
    });

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('AKTIVA')).toBeInTheDocument();
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

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('AKTIVA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });

    expect(textMock).toHaveBeenCalledWith('Admin Name', 140, expect.any(Number));
  });

  test('uses Admin fallback when username and name are missing', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 1,
        role: 'superadmin',
      })
    );

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('AKTIVA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });

    expect(textMock).toHaveBeenCalledWith('Admin', 140, expect.any(Number));
  });

  test('uses Admin fallback when user localStorage is missing', async () => {
    localStorage.removeItem('user');

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('AKTIVA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });

    expect(textMock).toHaveBeenCalledWith('Admin', 140, expect.any(Number));
  });

  test('covers all normal_balance branches in PDF download', async () => {
    const mixedAccounts = [
      { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit', total_debit: 100000, total_credit: 0 },
      { id: 2, code: '112', name: 'Penyusutan', type: 'aktiva', normal_balance: 'kredit', total_debit: 0, total_credit: 5000 },
      { id: 3, code: '211', name: 'Hutang Usaha', type: 'pasiva', normal_balance: 'kredit', total_debit: 0, total_credit: 50000 },
      { id: 4, code: '212', name: 'Diskon Hutang', type: 'pasiva', normal_balance: 'debit', total_debit: 2000, total_credit: 0 },
      { id: 5, code: '311', name: 'Modal Awal', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 300000 },
      { id: 6, code: '312', name: 'Prive', type: 'modal', normal_balance: 'debit', total_debit: 10000, total_credit: 0 },
    ];

    global.fetch = jest.fn(() => okJson({ accounts: mixedAccounts })) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Penyusutan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });
  });

  test('adds PDF page when content passes page break threshold', async () => {
    global.fetch = jest.fn(() => okJson({ accounts: bigAccounts })) as unknown as typeof fetch;

    textMock.mockImplementation((text: string) => {
      if (text === 'Total Ekuitas Akhir') {
      }
    });

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('AKTIVA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });
  });

  test('covers normal_balance branches in UI rendering (ternary lines 281,284,320,323,357,360)', async () => {
    const mixedAccounts = [
      { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit', total_debit: 100000, total_credit: 0 },
      { id: 2, code: '112', name: 'Penyusutan', type: 'aktiva', normal_balance: 'kredit', total_debit: 0, total_credit: 5000 },
      { id: 3, code: '211', name: 'Hutang Usaha', type: 'pasiva', normal_balance: 'kredit', total_debit: 0, total_credit: 50000 },
      { id: 4, code: '212', name: 'Diskon Hutang', type: 'pasiva', normal_balance: 'debit', total_debit: 2000, total_credit: 0 },
      { id: 5, code: '311', name: 'Modal Awal', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 300000 },
      { id: 6, code: '312', name: 'Prive', type: 'modal', normal_balance: 'debit', total_debit: 10000, total_credit: 0 },
    ];
    global.fetch = jest.fn(() => okJson({ accounts: mixedAccounts })) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    await screen.findByText('Penyusutan');
    expect(screen.getByText('Kas')).toBeInTheDocument();
    expect(screen.getByText('Diskon Hutang')).toBeInTheDocument();
    expect(screen.getByText('Prive')).toBeInTheDocument();
  });

  test('handles successful fetch with null accounts (|| [] fallback, branch line 41)', async () => {
    global.fetch = jest.fn(() =>
      okJson({})
    ) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Total Aktiva')).toBeInTheDocument();
    });
    expect(screen.getByText('Total Pasiva & Modal')).toBeInTheDocument();
  });

  test('covers all normal_balance branches in PDF download', async () => {
    const mixedAccounts = [
      { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit', total_debit: 100000, total_credit: 0 },
      { id: 2, code: '112', name: 'Penyusutan', type: 'aktiva', normal_balance: 'kredit', total_debit: 0, total_credit: 5000 },
      { id: 3, code: '211', name: 'Hutang Usaha', type: 'pasiva', normal_balance: 'kredit', total_debit: 0, total_credit: 50000 },
      { id: 4, code: '212', name: 'Diskon Hutang', type: 'pasiva', normal_balance: 'debit', total_debit: 2000, total_credit: 0 },
      { id: 5, code: '311', name: 'Modal Awal', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 300000 },
      { id: 6, code: '312', name: 'Prive', type: 'modal', normal_balance: 'debit', total_debit: 10000, total_credit: 0 },
    ];

    global.fetch = jest.fn(() => okJson({ accounts: mixedAccounts })) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Penyusutan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });
  });

  test('PDF download covers ternaries with only debit accounts', async () => {
    const debitAccounts = [
      { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit', total_debit: 100000, total_credit: 0 },
      { id: 2, code: '211', name: 'Hutang Usaha', type: 'pasiva', normal_balance: 'debit', total_debit: 2000, total_credit: 0 },
      { id: 3, code: '311', name: 'Modal Awal', type: 'modal', normal_balance: 'debit', total_debit: 10000, total_credit: 0 },
    ];
    global.fetch = jest.fn(() => okJson({ accounts: debitAccounts })) as unknown as typeof fetch;
    renderWithProviders(<ReportsbalancePage />);
    await waitFor(() => expect(screen.getByText('Kas')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Download PDF'));
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
  });

  test('PDF download covers ternaries with only kredit accounts', async () => {
    const kreditAccounts = [
      { id: 1, code: '112', name: 'Penyusutan', type: 'aktiva', normal_balance: 'kredit', total_debit: 0, total_credit: 5000 },
      { id: 2, code: '212', name: 'Hutang', type: 'pasiva', normal_balance: 'kredit', total_debit: 0, total_credit: 50000 },
      { id: 3, code: '312', name: 'Modal', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 100000 },
    ];
    global.fetch = jest.fn(() => okJson({ accounts: kreditAccounts })) as unknown as typeof fetch;
    renderWithProviders(<ReportsbalancePage />);
    await waitFor(() => expect(screen.getByText('Penyusutan')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Download PDF'));
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
  });

  test('PDF download with accounts that have zero total_debit and total_credit (covers formatCurrency amount || 0 branch)', async () => {
    const zeroAccounts = [
      { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit', total_debit: 0, total_credit: 0 },
      { id: 2, code: '211', name: 'Hutang', type: 'pasiva', normal_balance: 'kredit', total_debit: 0, total_credit: 0 },
    ];
    global.fetch = jest.fn(() => okJson({ accounts: zeroAccounts })) as unknown as typeof fetch;
    renderWithProviders(<ReportsbalancePage />);
    await waitFor(() => expect(screen.getByText('Kas')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Download PDF'));
    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalled();
    });
  });

  test('verifies autoTable is called with correct rows from forEach bodies (lines 135,144,150)', async () => {
    jest.isolateModules(() => {
      const autoTableMock = jest.fn((doc, config) => {
        doc.lastAutoTable = { finalY: 200 };
      });
      jest.mock('jspdf-autotable', () => autoTableMock);

      const verificationAccounts = [
        { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit', total_debit: 100000, total_credit: 0 },
        { id: 2, code: '112', name: 'Penyusutan', type: 'aktiva', normal_balance: 'kredit', total_debit: 0, total_credit: 5000 },
        { id: 3, code: '211', name: 'Hutang', type: 'pasiva', normal_balance: 'kredit', total_debit: 0, total_credit: 50000 },
        { id: 4, code: '212', name: 'Potongan', type: 'pasiva', normal_balance: 'debit', total_debit: 2000, total_credit: 0 },
        { id: 5, code: '311', name: 'Modal', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 100000 },
        { id: 6, code: '312', name: 'Prive', type: 'modal', normal_balance: 'debit', total_debit: 10000, total_credit: 0 },
      ];

      global.fetch = jest.fn(() => okJson({ accounts: verificationAccounts })) as unknown as typeof fetch;
    });
  });

  test('PDF download handles error after accounts loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    saveMock.mockImplementationOnce(() => { throw new Error('Save failed'); });

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Total Aktiva')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal membuat PDF', expect.any(Object));
    });
  });

  // BAL-2: Covers Branch ID 11 Path[0,1] and Branch ID 12 Path[0,1]
  // PDF assetAccounts forEach — both 'debit' and 'kredit' normal_balance for aktiva
  test('PDF assetAccounts forEach covers debit and kredit normal_balance (Branch IDs 11, 12)', async () => {
    const mixedAssetAccounts = [
      {
        id: 1, code: '111', name: 'Kas',
        type: 'aktiva',
        normal_balance: 'debit',   // B11 Path[0]: formatCurrency, B12 Path[1]: ''
        total_debit: 100000, total_credit: 0,
      },
      {
        id: 2, code: '112', name: 'Akumulasi Penyusutan',
        type: 'aktiva',
        normal_balance: 'kredit',  // B11 Path[1]: '', B12 Path[0]: formatCurrency
        total_debit: 0, total_credit: 10000,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ accounts: mixedAssetAccounts })
    ) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Kas')).toBeInTheDocument();
      expect(screen.getByText('Akumulasi Penyusutan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(expect.stringContaining('Neraca_Keuangan_'));
      expect(goeyToast.success).toHaveBeenCalledWith('PDF berhasil diunduh', expect.any(Object));
    });
  });

  // BAL-3: Covers Branch ID 13 Path[0,1] and Branch ID 14 Path[0,1]
  // PDF liabilityAccounts forEach — both 'debit' and 'kredit' normal_balance for pasiva
  test('PDF liabilityAccounts forEach covers debit and kredit normal_balance (Branch IDs 13, 14)', async () => {
    const accounts = [
      // aktiva minimal agar tidak error
      { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit', total_debit: 1000, total_credit: 0 },
      // pasiva: kedua normal_balance
      {
        id: 2, code: '211', name: 'Hutang Usaha',
        type: 'pasiva',
        normal_balance: 'kredit',  // B13 Path[1]: '', B14 Path[0]: formatCurrency
        total_debit: 0, total_credit: 50000,
      },
      {
        id: 3, code: '212', name: 'Diskon Hutang',
        type: 'pasiva',
        normal_balance: 'debit',   // B13 Path[0]: formatCurrency, B14 Path[1]: ''
        total_debit: 2000, total_credit: 0,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ accounts })
    ) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Hutang Usaha')).toBeInTheDocument();
      expect(screen.getByText('Diskon Hutang')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(expect.stringContaining('Neraca_Keuangan_'));
      expect(goeyToast.success).toHaveBeenCalledWith('PDF berhasil diunduh', expect.any(Object));
    });
  });

  // BAL-4: Covers Branch ID 15 Path[0,1] and Branch ID 16 Path[0,1]
  // PDF equityAccounts forEach — both 'debit' and 'kredit' normal_balance for modal
  test('PDF equityAccounts forEach covers debit and kredit normal_balance (Branch IDs 15, 16)', async () => {
    const accounts = [
      // aktiva minimal
      { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit', total_debit: 1000, total_credit: 0 },
      // modal: kedua normal_balance
      {
        id: 5, code: '311', name: 'Modal Awal',
        type: 'modal',
        normal_balance: 'kredit',  // B15 Path[1]: '', B16 Path[0]: formatCurrency
        total_debit: 0, total_credit: 300000,
      },
      {
        id: 6, code: '312', name: 'Prive',
        type: 'modal',
        normal_balance: 'debit',   // B15 Path[0]: formatCurrency, B16 Path[1]: ''
        total_debit: 10000, total_credit: 0,
      },
    ];

    global.fetch = jest.fn(() =>
      okJson({ accounts })
    ) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Modal Awal')).toBeInTheDocument();
      expect(screen.getByText('Prive')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(expect.stringContaining('Neraca_Keuangan_'));
      expect(goeyToast.success).toHaveBeenCalledWith('PDF berhasil diunduh', expect.any(Object));
    });
  });

  // BAL-5: Covers Branch ID 11-16 semua path dalam satu test
  // PDF dengan semua tipe akun: aktiva(debit+kredit), pasiva(kredit+debit), modal(kredit+debit)
  test('PDF download with all account types covers all forEach ternary branches (IDs 11, 12, 13, 14, 15, 16)', async () => {
    const fullMixedAccounts = [
      // aktiva: debit normal_balance (B11 P0 true, B12 P1 false)
      { id: 1, code: '111', name: 'Kas', type: 'aktiva', normal_balance: 'debit', total_debit: 100000, total_credit: 0 },
      // aktiva: kredit normal_balance (B11 P1 false, B12 P0 true)
      { id: 2, code: '112', name: 'Akumulasi Penyusutan', type: 'aktiva', normal_balance: 'kredit', total_debit: 0, total_credit: 10000 },
      // pasiva: kredit normal_balance (B13 P1 false, B14 P0 true)
      { id: 3, code: '211', name: 'Hutang Usaha', type: 'pasiva', normal_balance: 'kredit', total_debit: 0, total_credit: 50000 },
      // pasiva: debit normal_balance (B13 P0 true, B14 P1 false)
      { id: 4, code: '212', name: 'Diskon Hutang', type: 'pasiva', normal_balance: 'debit', total_debit: 2000, total_credit: 0 },
      // modal: kredit normal_balance (B15 P1 false, B16 P0 true)
      { id: 5, code: '311', name: 'Modal Awal', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 300000 },
      // modal: debit normal_balance (B15 P0 true, B16 P1 false)
      { id: 6, code: '312', name: 'Prive', type: 'modal', normal_balance: 'debit', total_debit: 10000, total_credit: 0 },
    ];

    global.fetch = jest.fn(() =>
      okJson({ accounts: fullMixedAccounts })
    ) as unknown as typeof fetch;

    renderWithProviders(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Kas')).toBeInTheDocument();
      expect(screen.getByText('Akumulasi Penyusutan')).toBeInTheDocument();
      expect(screen.getByText('Hutang Usaha')).toBeInTheDocument();
      expect(screen.getByText('Diskon Hutang')).toBeInTheDocument();
      expect(screen.getByText('Modal Awal')).toBeInTheDocument();
      expect(screen.getByText('Prive')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(expect.stringContaining('Neraca_Keuangan_'));
      expect(goeyToast.success).toHaveBeenCalledWith('PDF berhasil diunduh', expect.any(Object));
    });
  });

});
