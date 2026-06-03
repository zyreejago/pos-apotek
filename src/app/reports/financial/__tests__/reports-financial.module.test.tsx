import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportsfinancialPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';

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
  }));
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
  period: { month: 5, year: 2026 },
  revenue: {
    total: 150000,
    details: [
      { label: 'Penjualan Obat', amount: 100000 },
      { label: 'Penjualan Vitamin', amount: 50000 },
    ],
  },
  cogs: {
    total: 60000,
    details: [
      { label: 'HPP Obat', amount: 40000 },
      { label: 'HPP Vitamin', amount: 20000 },
    ],
  },
  gross_profit: 90000,
  expenses: {
    total: 30000,
    details: [
      { label: 'Beban Listrik', amount: 10000 },
      { label: 'Beban Gaji', amount: 20000 },
    ],
  },
  net_profit: 60000,
};

const bigFinancialPayload = {
  period: { month: 5, year: 2026 },
  revenue: {
    total: 300000,
    details: Array.from({ length: 10 }, (_, i) => ({
      label: `Pendapatan ${i + 1}`,
      amount: 10000,
    })),
  },
  cogs: {
    total: 100000,
    details: Array.from({ length: 10 }, (_, i) => ({
      label: `HPP ${i + 1}`,
      amount: 5000,
    })),
  },
  gross_profit: 200000,
  expenses: {
    total: 50000,
    details: Array.from({ length: 10 }, (_, i) => ({
      label: `Beban ${i + 1}`,
      amount: 3000,
    })),
  },
  net_profit: 150000,
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
    render(<ReportsfinancialPage />);

    expect(screen.getByText('Laporan Laba - Rugi')).toBeInTheDocument();
    expect(screen.getByText('Laporan Keuangan')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Pendapatan Penjualan').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('1. Penjualan Obat')).toBeInTheDocument();
    expect(screen.getByText('2. Penjualan Vitamin')).toBeInTheDocument();
    expect(screen.getAllByText('Harga Pokok Penjualan').length).toBeGreaterThan(0);
    expect(screen.getByText('1. HPP Obat')).toBeInTheDocument();
    expect(screen.getByText('2. HPP Vitamin')).toBeInTheDocument();
    expect(screen.getAllByText('Laba Kotor').length).toBeGreaterThan(0);
    expect(screen.getByText('Beban & Penyesuaian Lainnya')).toBeInTheDocument();
    expect(screen.getByText('1. Beban Listrik')).toBeInTheDocument();
    expect(screen.getByText('2. Beban Gaji')).toBeInTheDocument();
    expect(screen.getByText('Laba Bersih / (Rugi)')).toBeInTheDocument();
    expect(screen.getAllByText('Rp 60.000').length).toBeGreaterThan(0);

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

    render(<ReportsfinancialPage />);

    expect(screen.getByText('Memuat laporan keuangan...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => financialPayload,
      text: async () => JSON.stringify(financialPayload),
    } as Response);

    await waitFor(() => {
      expect(screen.getAllByText('Pendapatan Penjualan').length).toBeGreaterThan(0);
    });
  });

  test('changes month and year then refetches data', async () => {
    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Pendapatan Penjualan').length).toBeGreaterThan(0);
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

    expect(screen.getByText('Periode: Bulan Januari, Tahun 2024')).toBeInTheDocument();
  });

  test('fetches without authorization header when token is missing', async () => {
    localStorage.removeItem('token');

    render(<ReportsfinancialPage />);

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

    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Server error',
        expect.any(Object)
      );
    });
  });

  test('shows fallback toast error when fetch response has no message', async () => {
    global.fetch = jest.fn(() => failJson({})) as unknown as typeof fetch;

    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal mengambil laporan keuangan',
        expect.any(Object)
      );
    });
  });

  test('shows toast error when fetch throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as unknown as typeof fetch;

    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal terhubung ke server',
        expect.any(Object)
      );
    });
  });

  test('downloads PDF successfully with data', async () => {
    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Pendapatan Penjualan').length).toBeGreaterThan(0);
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

    expect(textMock).toHaveBeenCalledWith('LAPORAN LABA - RUGI', 105, 45, {
      align: 'center',
    });
    expect(textMock).toHaveBeenCalledWith('PENDAPATAN PENJUALAN', 14, expect.any(Number));
    expect(textMock).toHaveBeenCalledWith('HARGA POKOK PENJUALAN', 14, expect.any(Number));
    expect(textMock).toHaveBeenCalledWith('LABA KOTOR', 14, expect.any(Number));
    expect(textMock).toHaveBeenCalledWith('LABA BERSIH / (RUGI)', 18, expect.any(Number));
  });

  test('downloads PDF even when data is still null', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    ) as unknown as typeof fetch;

    render(<ReportsfinancialPage />);

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

    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getByText('1. Pendapatan 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(addPageMock).toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalled();
    });
  });

  test('does not add new page when PDF content is short', async () => {
    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Pendapatan Penjualan').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
      expect(addPageMock).not.toHaveBeenCalled();
    });
  });

  test('shows toast error when PDF generation fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    saveMock.mockImplementationOnce(() => {
      throw new Error('PDF error');
    });

    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Pendapatan Penjualan').length).toBeGreaterThan(0);
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

    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Pendapatan Penjualan').length).toBeGreaterThan(0);
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

    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Pendapatan Penjualan').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });

    expect(textMock).toHaveBeenCalledWith('Admin', 140, expect.any(Number));
  });

  test('uses Admin fallback when user localStorage is missing', async () => {
    localStorage.removeItem('user');

    render(<ReportsfinancialPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Pendapatan Penjualan').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });

    expect(textMock).toHaveBeenCalledWith('Admin', 140, expect.any(Number));
  });
});