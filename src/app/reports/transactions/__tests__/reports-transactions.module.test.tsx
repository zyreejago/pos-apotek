import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportstransactionsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';

const mockSave = jest.fn();
const mockAddPage = jest.fn();
const mockAutoTableFinalY = jest.fn(() => 100);

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
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-count={data?.length || 0}>
      {children}
    </div>
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Line: () => <div data-testid="line" />,
  XAxis: ({ tickFormatter }: any) => (
    <div data-testid="x-axis">
      {tickFormatter ? tickFormatter('2026-05-23') : null}
    </div>
  ),
  YAxis: ({ tickFormatter }: any) => (
    <div data-testid="y-axis">
      {tickFormatter ? tickFormatter(50000) : null}
    </div>
  ),
  Tooltip: ({ formatter, labelFormatter }: any) => {
    const formattedValue = formatter ? formatter(50000) : [];
    const formattedLabel = labelFormatter ? labelFormatter('2026-05-23') : '';

    return (
      <div data-testid="tooltip">
        <span>{Array.isArray(formattedValue) ? formattedValue[0] : formattedValue}</span>
        <span>{formattedLabel}</span>
      </div>
    );
  },
}));

jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    setFont: jest.fn(),
    text: jest.fn(),
    setLineWidth: jest.fn(),
    line: jest.fn(),
    addPage: mockAddPage,
    save: mockSave,
    lastAutoTable: { finalY: 100 },
  }));
});

jest.mock('jspdf-autotable', () =>
  jest.fn((doc) => {
    doc.lastAutoTable = { finalY: mockAutoTableFinalY() };
  })
);

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

const reportPayload = {
  transactions: [
    {
      id: 1,
      transaction_date: '2026-05-23T10:00:00.000Z',
      total_amount: 50000,
      items: [
        { product_name: 'Paracetamol', quantity: 2, price: 25000 },
        { product_name: 'Vitamin C', quantity: 1, price: 15000 },
      ],
    },
  ],
  chartData: [{ date: '2026-05-23', total: 50000 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAutoTableFinalY.mockReturnValue(100);

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

  global.fetch = jest.fn(() => okJson(reportPayload)) as unknown as typeof fetch;
});

describe('reports-transactions module', () => {
  test('renders page and loads transaction data', async () => {
    render(<ReportstransactionsPage />);

    expect(screen.getByText('Laporan Transaksi')).toBeInTheDocument();
    expect(screen.getByText('Sales Report')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    expect(screen.getByText('Vitamin C')).toBeInTheDocument();
    expect(screen.getByText('Total Penjualan')).toBeInTheDocument();
    expect(screen.getByText('Total Transaksi')).toBeInTheDocument();

    expect(screen.getAllByText('Rp 50.000')).toHaveLength(3);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toHaveTextContent('50k');
    expect(screen.getByTestId('tooltip')).toHaveTextContent('Rp 50.000');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reports/transactions'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test',
        }),
      })
    );
  });

  test('renders empty transaction state but chart still appears because date range is filled', async () => {
    global.fetch = jest.fn(() =>
      okJson({ transactions: [], chartData: [] })
    ) as unknown as typeof fetch;

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Tidak ada transaksi pada periode ini')).toBeInTheDocument();
    });

    expect(screen.getByText('Rp 0')).toBeInTheDocument();
    expect(screen.getByText('Total Penjualan')).toBeInTheDocument();
    expect(screen.getByText('Total Transaksi')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  test('renders real chart empty state when start date is empty', async () => {
    global.fetch = jest.fn(() =>
      okJson({ transactions: [], chartData: [] })
    ) as unknown as typeof fetch;

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);

    fireEvent.change(dateInputs[0], {
      target: { value: '' },
    });

    fireEvent.click(screen.getByTitle('Filter Data'));

    await waitFor(() => {
      expect(screen.getByText('Tidak ada data grafik untuk periode ini')).toBeInTheDocument();
    });
  });

  test('renders real chart empty state when end date is empty', async () => {
    global.fetch = jest.fn(() =>
      okJson({ transactions: [], chartData: [] })
    ) as unknown as typeof fetch;

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);

    fireEvent.change(dateInputs[1], {
      target: { value: '' },
    });

    fireEvent.click(screen.getByTitle('Filter Data'));

    await waitFor(() => {
      expect(screen.getByText('Tidak ada data grafik untuk periode ini')).toBeInTheDocument();
    });
  });

  test('shows loading state before fetch resolved', async () => {
    let resolveFetch: (value: Response) => void = jest.fn();

    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    ) as unknown as typeof fetch;

    render(<ReportstransactionsPage />);

    expect(screen.getByText('Loading data...')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => reportPayload,
      text: async () => JSON.stringify(reportPayload),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });
  });

  test('calls fetch again when filter button is clicked', async () => {
    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByTitle('Filter Data'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  test('changes date inputs and filters data', async () => {
    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);

    fireEvent.change(dateInputs[0], {
      target: { value: '2026-05-01' },
    });

    fireEvent.change(dateInputs[1], {
      target: { value: '2026-05-23' },
    });

    fireEvent.click(screen.getByTitle('Filter Data'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('startDate=2026-05-01&endDate=2026-05-23'),
        expect.any(Object)
      );
    });
  });

  test('fetches without authorization header when token is missing', async () => {
    localStorage.removeItem('token');

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reports/transactions'),
        expect.objectContaining({
          headers: {},
        })
      );
    });
  });

  test('uses username when downloading PDF', async () => {
    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.stringContaining('Laporan_Transaksi_'));
      expect(goeyToast.success).toHaveBeenCalled();
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

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
      expect(goeyToast.success).toHaveBeenCalled();
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

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
      expect(goeyToast.success).toHaveBeenCalled();
    });
  });

  test('uses Admin fallback when user localStorage is missing', async () => {
    localStorage.removeItem('user');

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
      expect(goeyToast.success).toHaveBeenCalled();
    });
  });

  test('downloads PDF and writes table rows from transaction items', async () => {
    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(goeyToast.info).toHaveBeenCalledWith(
        'Sedang membuat PDF...',
        expect.any(Object)
      );
      expect(mockSave).toHaveBeenCalledWith(
        expect.stringContaining('Laporan_Transaksi_')
      );
      expect(goeyToast.success).toHaveBeenCalledWith(
        'PDF berhasil diunduh',
        expect.any(Object)
      );
    });
  });

  test('adds new page when PDF table is too long', async () => {
    mockAutoTableFinalY.mockReturnValueOnce(260);

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(mockAddPage).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });
  });

  test('does not add new page when PDF table is short', async () => {
    mockAutoTableFinalY.mockReturnValueOnce(120);

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
      expect(mockAddPage).not.toHaveBeenCalled();
    });
  });

  test('shows toast error when download PDF fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSave.mockImplementationOnce(() => {
      throw new Error('PDF error');
    });

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal membuat PDF',
        expect.any(Object)
      );
    });
  });

  test('shows toast error when fetch response is not ok with message', async () => {
    global.fetch = jest.fn(() =>
      failJson({ message: 'Server error' })
    ) as unknown as typeof fetch;

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Server error',
        expect.any(Object)
      );
    });
  });

  test('shows fallback toast error when fetch response has no message', async () => {
    global.fetch = jest.fn(() => failJson({})) as unknown as typeof fetch;

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal mengambil laporan transaksi',
        expect.any(Object)
      );
    });
  });

  test('shows toast error when fetch throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as unknown as typeof fetch;

    render(<ReportstransactionsPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Gagal terhubung ke server',
        expect.any(Object)
      );
    });
  });
});