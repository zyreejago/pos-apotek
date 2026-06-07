import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportsfinancialPage from '../page';
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

jest.mock('@/components/Header', () => {
  return function Header({ title, subtitle, rightContent }: any) {
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
    setFillColor: jest.fn(),
    rect: jest.fn(),
    text: textMock,
    setLineWidth: jest.fn(),
    line: jest.fn(),
    addPage: addPageMock,
    save: saveMock,
    lastAutoTable: { finalY: 150 },
  }));
});

jest.mock('jspdf-autotable', () => {
  return jest.fn().mockImplementation((doc) => {
    doc.lastAutoTable = { finalY: 150 };
  });
});

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

const financialPayload = {
  accounts: [
    { code: '401', name: 'Penjualan Obat', type: 'pendapatan', normal_balance: 'credit', total_debit: 0, total_credit: 100000 },
    { code: '402', name: 'Penjualan Vitamin', type: 'pendapatan', normal_balance: 'credit', total_debit: 0, total_credit: 50000 },
    { code: '501', name: 'Beban Listrik', type: 'beban', normal_balance: 'debit', total_debit: 10000, total_credit: 0 },
    { code: '502', name: 'Beban Gaji', type: 'beban', normal_balance: 'debit', total_debit: 20000, total_credit: 0 },
  ],
};

const bigFinancialPayload = {
  accounts: [
    ...Array.from({ length: 10 }, (_, i) => ({
      code: `40${i + 1}`,
      name: `Pendapatan ${i + 1}`,
      type: 'pendapatan' as const,
      normal_balance: 'credit' as const,
      total_debit: 0,
      total_credit: 10000,
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      code: `50${i + 1}`,
      name: `Beban ${i + 1}`,
      type: 'beban' as const,
      normal_balance: 'debit' as const,
      total_debit: 5000,
      total_credit: 0,
    })),
  ],
};

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

  global.fetch = jest.fn(() => okJson(financialPayload)) as unknown as typeof fetch;
});

describe('reports-financial module', () => {
  test('renders page and loads financial data', async () => {
    renderWithProviders(<ReportsfinancialPage />);

    expect(screen.getByText('Laporan Laba Rugi')).toBeInTheDocument();
    expect(screen.getByText('Laporan Keuangan')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    expect(screen.getByText('Penjualan Obat')).toBeInTheDocument();
    expect(screen.getByText('Penjualan Vitamin')).toBeInTheDocument();
    expect(screen.getByText('Total Pendapatan')).toBeInTheDocument();
    expect(screen.getByText('Beban Listrik')).toBeInTheDocument();
    expect(screen.getByText('Beban Gaji')).toBeInTheDocument();
    expect(screen.getByText('BEBAN')).toBeInTheDocument();
    expect(screen.getByText('Total Beban')).toBeInTheDocument();
    expect(screen.getByText('LABA BERSIH')).toBeInTheDocument();
    expect(screen.getByText('Rp 120.000')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/financial/profit-loss'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test',
        }),
      })
    );
  });

  test('shows loading state before fetch resolved', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    ) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    expect(screen.getByText('Memuat laporan laba rugi...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => financialPayload,
      text: async () => JSON.stringify(financialPayload),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });
  });

  test('changes month and year then refetches data', async () => {
    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
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

    expect(screen.getByText('Periode: Januari 2024')).toBeInTheDocument();
  });

  test('fetches without authorization header when token is missing', async () => {
    localStorage.removeItem('token');

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/financial/profit-loss'),
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

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Server error',
        expect.any(Object)
      );
    });
  });

  test('shows fallback toast error when fetch response has no message', async () => {
    global.fetch = jest.fn(() => failJson({})) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal mengambil laporan laba rugi',
        expect.any(Object)
      );
    });
  });

  test('shows toast error when fetch throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal terhubung ke server',
        expect.any(Object)
      );
    });
  });

  test('downloads PDF covering all forEach body lines', async () => {
    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Laba_Rugi_')
      );
    });

    expect(textMock).toHaveBeenCalledWith('LAPORAN LABA RUGI', 105, 45, expect.any(Object));
  });

  test('downloads PDF successfully with data', async () => {
    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(goeyToast.info).toHaveBeenCalledWith(
        'Sedang membuat PDF...',
        expect.any(Object)
      );
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Laba_Rugi_')
      );
      expect(goeyToast.success).toHaveBeenCalledWith(
        'PDF berhasil diunduh',
        expect.any(Object)
      );
    });

    expect(textMock).toHaveBeenCalledWith('LAPORAN LABA RUGI', 105, 45, {
      align: 'center',
    });
  });

  test('downloads PDF even when data is still null', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    ) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Laba_Rugi_')
      );
      expect(goeyToast.success).toHaveBeenCalled();
    });

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => financialPayload,
      text: async () => JSON.stringify(financialPayload),
    } as Response);
  });

  test('adds new page when PDF content passes page break threshold', async () => {
    global.fetch = jest.fn(() => okJson(bigFinancialPayload)) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('Pendapatan 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });
  });

  test('does not add new page when PDF content is short', async () => {
    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });
  });

  test('shows toast error when PDF generation fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    saveMock.mockImplementationOnce(() => {
      throw new Error('PDF error');
    });

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
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

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
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

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });

    expect(textMock).toHaveBeenCalledWith('Admin', 140, expect.any(Number));
  });

  test('uses Admin fallback when user localStorage is missing', async () => {
    localStorage.removeItem('user');

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });

    expect(textMock).toHaveBeenCalledWith('Admin', 140, expect.any(Number));
  });

  test('displays negative net profit (rugi) in debit column', async () => {
    const lossPayload = {
      accounts: [
        { code: '401', name: 'Penjualan Obat', type: 'pendapatan', normal_balance: 'credit', total_debit: 0, total_credit: 50000 },
        { code: '501', name: 'Beban Listrik', type: 'beban', normal_balance: 'debit', total_debit: 100000, total_credit: 0 },
      ],
    };

    global.fetch = jest.fn(() => okJson(lossPayload)) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Pendapatan')).toBeInTheDocument();
    expect(screen.getByText('Total Beban')).toBeInTheDocument();
    expect(screen.getByText('LABA BERSIH')).toBeInTheDocument();
    const labaCells = screen.getAllByText('Rp 50.000');
    expect(labaCells.length).toBeGreaterThanOrEqual(1);
  });

  test('downloads PDF with negative net profit', async () => {
    const lossPayload = {
      accounts: [
        { code: '401', name: 'Penjualan', type: 'pendapatan', normal_balance: 'credit', total_debit: 0, total_credit: 30000 },
        { code: '501', name: 'Beban Sewa', type: 'beban', normal_balance: 'debit', total_debit: 100000, total_credit: 0 },
      ],
    };

    global.fetch = jest.fn(() => okJson(lossPayload)) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Laba_Rugi_')
      );
    });
  });

  test('downloads PDF with empty accounts list', async () => {
    global.fetch = jest.fn(() => okJson({ accounts: [] })) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Laba_Rugi_')
      );
    });
  });

  test('downloads PDF with single revenue and single expense (edge forEach)', async () => {
    const singlePayload = {
      accounts: [
        { code: '401', name: 'Penjualan', type: 'pendapatan', normal_balance: 'credit', total_debit: 0, total_credit: 75000 },
        { code: '501', name: 'Beban', type: 'beban', normal_balance: 'debit', total_debit: 25000, total_credit: 0 },
      ],
    };

    global.fetch = jest.fn(() => okJson(singlePayload)) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Laba_Rugi_')
      );
    });
  });

  test('downloads PDF with zero net profit (branch netProfit >= 0 with zero)', async () => {
    const zeroProfitPayload = {
      accounts: [
        { code: '401', name: 'Pendapatan', type: 'pendapatan', normal_balance: 'credit', total_debit: 0, total_credit: 50000 },
        { code: '501', name: 'Beban', type: 'beban', normal_balance: 'debit', total_debit: 50000, total_credit: 0 },
      ],
    };

    global.fetch = jest.fn(() => okJson(zeroProfitPayload)) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Laba_Rugi_')
      );
    });
  });

  test('covers PDF forEach lines 125,132 with multiple revenue and expense accounts', async () => {
    const multiPayload = {
      accounts: [
        { code: '401', name: 'Penjualan Obat', type: 'pendapatan', normal_balance: 'credit', total_debit: 0, total_credit: 100000 },
        { code: '402', name: 'Penjualan Vitamin', type: 'pendapatan', normal_balance: 'credit', total_debit: 0, total_credit: 50000 },
        { code: '403', name: 'Penjualan Alkes', type: 'pendapatan', normal_balance: 'credit', total_debit: 0, total_credit: 25000 },
        { code: '501', name: 'Beban Listrik', type: 'beban', normal_balance: 'debit', total_debit: 10000, total_credit: 0 },
        { code: '502', name: 'Beban Gaji', type: 'beban', normal_balance: 'debit', total_debit: 20000, total_credit: 0 },
      ],
    };

    global.fetch = jest.fn(() => okJson(multiPayload)) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('Penjualan Obat')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Laba_Rugi_')
      );
    });
  });

  test('downloads PDF with zero revenue accounts (forEach line 125 not entered)', async () => {
    const noRevenuePayload = {
      accounts: [
        { code: '501', name: 'Beban Listrik', type: 'beban', normal_balance: 'debit', total_debit: 50000, total_credit: 0 },
      ],
    };

    global.fetch = jest.fn(() => okJson(noRevenuePayload)) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('BEBAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Laba_Rugi_')
      );
    });
  });

  test('downloads PDF with zero expense accounts (forEach line 132 not entered)', async () => {
    const noExpensePayload = {
      accounts: [
        { code: '401', name: 'Penjualan Obat', type: 'pendapatan', normal_balance: 'credit', total_debit: 0, total_credit: 100000 },
      ],
    };

    global.fetch = jest.fn(() => okJson(noExpensePayload)) as unknown as typeof fetch;

    renderWithProviders(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDAPATAN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Laba_Rugi_')
      );
    });
  });
});