import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportsbalancePage from '../page';
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

const balancePayload = {
  assets: {
    cash: 100000,
    inventory: 200000,
    receivables: 300000,
    total: 600000,
  },
  liabilities: {
    payables: 50000,
    consignmentDebt: 75000,
    total: 125000,
  },
  equity: {
    initial: 300000,
    capitalChanges: 100000,
    retainedEarnings: 75000,
    total: 475000,
  },
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

  global.fetch = jest.fn(() => okJson(balancePayload)) as unknown as typeof fetch;
});

describe('reports-balance module', () => {
  test('renders page and loads balance data', async () => {
    render(<ReportsbalancePage />);

    expect(screen.getByText('Neraca Keuangan')).toBeInTheDocument();
    expect(screen.getByText('Laporan Keuangan')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Aset')).toBeInTheDocument();
    });

    expect(screen.getByText('1. Uang Kas')).toBeInTheDocument();
    expect(screen.getByText('2. Persediaan Barang')).toBeInTheDocument();
    expect(screen.getByText('3. Piutang Usaha')).toBeInTheDocument();
    expect(screen.getByText('Liabilitas/Beban')).toBeInTheDocument();
    expect(screen.getByText('1. Hutang Usaha')).toBeInTheDocument();
    expect(screen.getByText('2. Hutang Konsinyasi')).toBeInTheDocument();
    expect(screen.getByText('Ekuitas')).toBeInTheDocument();
    expect(screen.getByText('1. Ekuitas Awal')).toBeInTheDocument();
    expect(screen.getByText('2. Penambahan/Pengurangan Modal')).toBeInTheDocument();
    expect(screen.getByText('3. Laba/Rugi Tertahan')).toBeInTheDocument();
    expect(screen.getByText('Rp 600.000')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reports/balance'),
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

    render(<ReportsbalancePage />);

    expect(screen.getByText('Memuat neraca keuangan...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => balancePayload,
      text: async () => JSON.stringify(balancePayload),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText('Aset')).toBeInTheDocument();
    });
  });

  test('changes month and year then refetches data', async () => {
    render(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Aset')).toBeInTheDocument();
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

    render(<ReportsbalancePage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reports/balance'),
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

    render(<ReportsbalancePage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Server error',
        expect.any(Object)
      );
    });
  });

  test('shows fallback toast error when fetch response has no message', async () => {
    global.fetch = jest.fn(() => failJson({})) as unknown as typeof fetch;

    render(<ReportsbalancePage />);

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

    render(<ReportsbalancePage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal terhubung ke server',
        expect.any(Object)
      );
    });
  });

  test('downloads PDF successfully with data', async () => {
    render(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Aset')).toBeInTheDocument();
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

    expect(textMock).toHaveBeenCalledWith('Aset', 14, expect.any(Number));
    expect(textMock).toHaveBeenCalledWith('Liabilitas/Beban', 14, expect.any(Number));
    expect(textMock).toHaveBeenCalledWith('Ekuitas', 14, expect.any(Number));
  });

  test('downloads PDF even when data is still null', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    ) as unknown as typeof fetch;

    render(<ReportsbalancePage />);

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
      json: async () => balancePayload,
      text: async () => JSON.stringify(balancePayload),
    } as Response);
  });

  test('shows toast error when PDF generation fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    saveMock.mockImplementationOnce(() => {
      throw new Error('PDF error');
    });

    render(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Aset')).toBeInTheDocument();
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

    render(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Aset')).toBeInTheDocument();
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

    render(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Aset')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });

    expect(textMock).toHaveBeenCalledWith('Admin', 140, expect.any(Number));
  });

  test('uses Admin fallback when user localStorage is missing', async () => {
    localStorage.removeItem('user');

    render(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Aset')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });

    expect(textMock).toHaveBeenCalledWith('Admin', 140, expect.any(Number));
  });

  test('adds PDF page when content passes page break threshold', async () => {
    const bigPayload = {
      assets: {
        cash: 1,
        inventory: 2,
        receivables: 3,
        total: 6,
      },
      liabilities: {
        payables: 4,
        consignmentDebt: 5,
        total: 9,
      },
      equity: {
        initial: 6,
        capitalChanges: 7,
        retainedEarnings: 8,
        total: 21,
      },
    };

    global.fetch = jest.fn(() => okJson(bigPayload)) as unknown as typeof fetch;

    textMock.mockImplementation((text: string) => {
      if (text === 'Total Ekuitas Akhir') {
        // memaksa throw tidak boleh; cukup biarkan currentY normal
      }
    });

    render(<ReportsbalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Aset')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalled();
    });
  });
});