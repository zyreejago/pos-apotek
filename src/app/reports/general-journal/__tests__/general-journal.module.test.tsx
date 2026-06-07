import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GeneralJournalPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';

jest.mock('lucide-react', () => ({
  Plus: () => <span data-testid="plus-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  Calendar: () => <span data-testid="calendar-icon" />,
  Loader2: ({ className }: any) => <span data-testid="loader-icon" className={className} />,
  Save: () => <span data-testid="save-icon" />,
  FileText: () => <span data-testid="file-text-icon" />,
  X: () => <span data-testid="x-icon" />,
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

jest.mock('@/components/PageHeader', () => {
  return function MockPageHeader({ title, subtitle, rightContent }: any) {
    return (
      <div data-testid="page-header">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {rightContent}
      </div>
    );
  };
});

jest.mock('@/components/OffCanvas', () => {
  return function MockOffCanvas({ isOpen, onClose, title, children }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="off-canvas">
        <h2>{title}</h2>
        {children}
      </div>
    );
  };
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

const sampleAccounts = [
  { id: 1, code: '101', name: 'Kas', type: 'aset', normal_balance: 'debit' },
  { id: 2, code: '401', name: 'Penjualan', type: 'pendapatan', normal_balance: 'credit' },
  { id: 3, code: '501', name: 'Beban Gaji', type: 'beban', normal_balance: 'debit' },
];

const sampleEntries = [
  {
    id: 1,
    date: '2025-01-15',
    description: 'Pembayaran listrik',
    created_at: '2025-01-15T10:00:00Z',
    items: [
      { id: 1, debit: 50000, credit: 0, account_code: '501', account_name: 'Beban Listrik', account_type: 'beban' },
      { id: 2, debit: 0, credit: 50000, account_code: '101', account_name: 'Kas', account_type: 'aset' },
    ],
  },
  {
    id: 2,
    date: '2025-01-16',
    description: 'Pembayaran gaji',
    created_at: '2025-01-16T10:00:00Z',
    items: [
      { id: 3, debit: 100000, credit: 0, account_code: '502', account_name: 'Beban Gaji', account_type: 'beban' },
      { id: 4, debit: 0, credit: 100000, account_code: '101', account_name: 'Kas', account_type: 'aset' },
    ],
  },
];

const defaultMockFetch = jest.fn((url: string, init?: any) => {
  const urlStr = typeof url === 'string' ? url : url.url;
  if (init?.method === 'POST') return okJson({ message: 'created' });
  if (urlStr.includes('/api/accounting/journal-entries')) {
    return okJson({ data: sampleEntries });
  }
  if (urlStr.includes('/api/accounting/general-ledger')) {
    return okJson({ accounts: sampleAccounts });
  }
  return okJson({});
});

function openOffcanvas() {
  fireEvent.click(screen.getByText('Buat Jurnal Manual'));
}

function fillAndSubmitBalancedForm() {
  const debits = screen.getAllByPlaceholderText('Debit');
  fireEvent.change(debits[0], { target: { value: '100000' } });
  const credits = screen.getAllByPlaceholderText('Kredit');
  fireEvent.change(credits[1], { target: { value: '100000' } });
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: '1' } });
  fireEvent.change(selects[1], { target: { value: '2' } });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'test-token');
  defaultMockFetch.mockClear();
  global.fetch = defaultMockFetch;
});

describe('general-journal module', () => {
  test('renders page and loads data on mount', async () => {
    render(<GeneralJournalPage />);

    expect(screen.getByText('Jurnal Umum (General Journal)')).toBeInTheDocument();
    expect(screen.getByText('Pencatatan transaksi manual dan daftar seluruh ayat jurnal sistem')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('ID Jurnal: #1'))).toBeInTheDocument();
    });

    expect(screen.getByText('Keterangan: Pembayaran listrik')).toBeInTheDocument();
    expect(screen.getByText('Keterangan: Pembayaran gaji')).toBeInTheDocument();
    expect(screen.getByText('Beban Listrik')).toBeInTheDocument();
    expect(screen.getByText('Beban Gaji')).toBeInTheDocument();
    expect(screen.getAllByText('Kas').length).toBe(2);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/accounting/journal-entries'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/accounting/general-ledger'),
      expect.any(Object)
    );
  });

  test('shows loading state before data loads', async () => {
    let resolveJournalFetch: (value: Response) => void = jest.fn();
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/api/accounting/general-ledger')) {
        return okJson({ accounts: sampleAccounts });
      }
      return new Promise<Response>((resolve) => {
        resolveJournalFetch = resolve;
      });
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    expect(screen.getByText('Sedang memuat jurnal...')).toBeInTheDocument();

    resolveJournalFetch!(okJson({ data: sampleEntries }) as any);

    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('ID Jurnal: #1'))).toBeInTheDocument();
    });
  });

  test('renders empty state when no journal entries', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/api/accounting/general-ledger')) {
        return okJson({ accounts: sampleAccounts });
      }
      return okJson({ data: [] });
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText('Tidak ada transaksi jurnal pada rentang tanggal ini.')).toBeInTheDocument();
    });
  });

  test('shows dash for zero debit and credit values', async () => {
    const entriesWithZeroValues = [
      {
        id: 1,
        date: '2025-01-15',
        description: 'Test entry',
        created_at: '2025-01-15T10:00:00Z',
        items: [
          { id: 1, debit: 0, credit: 1000, account_code: '401', account_name: 'Pendapatan', account_type: 'pendapatan' },
          { id: 2, debit: 1000, credit: 0, account_code: '101', account_name: 'Kas', account_type: 'aset' },
        ],
      },
    ];

    global.fetch = jest.fn((url: string) => {
      if (url.includes('/api/accounting/general-ledger')) {
        return okJson({ accounts: sampleAccounts });
      }
      return okJson({ data: entriesWithZeroValues });
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('ID Jurnal: #1'))).toBeInTheDocument();
    });

    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  test('renders credit items with pl-8 indented styling', async () => {
    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText('Beban Listrik')).toBeInTheDocument();
    });

    const kasElements = screen.getAllByText('Kas');
    const creditItemDiv = kasElements[0].closest('div');
    expect(creditItemDiv?.className).toContain('pl-8');
  });

  test('renders debit items with font-medium styling', async () => {
    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText('Beban Listrik')).toBeInTheDocument();
    });

    const bebanListrikElements = screen.getAllByText('Beban Listrik');
    const debitItemDiv = bebanListrikElements[0].closest('div');
    expect(debitItemDiv?.className).toContain('font-medium');
  });

  test('formats debit and credit as currency', async () => {
    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('ID Jurnal: #1'))).toBeInTheDocument();
    });

    const currencyElements = screen.getAllByText((c) => c.includes('50.000') || c.includes('100.000'));
    expect(currencyElements.length).toBeGreaterThanOrEqual(2);
  });

  test('fetches without Authorization header when token is missing', async () => {
    localStorage.removeItem('token');

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/journal-entries'),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });
  });

  test('shows error toast when journal fetch response is not ok with message', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/api/accounting/general-ledger')) {
        return okJson({ accounts: sampleAccounts });
      }
      return failJson({ message: 'Server error' });
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Server error');
    });
  });

  test('shows fallback error toast when journal fetch error has no message', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/api/accounting/general-ledger')) {
        return okJson({ accounts: sampleAccounts });
      }
      return failJson({});
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal mengambil jurnal umum');
    });
  });

  test('shows error toast on journal fetch network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/api/accounting/general-ledger')) {
        return okJson({ accounts: sampleAccounts });
      }
      return Promise.reject(new Error('Network error'));
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal terhubung ke server');
    });
  });

  test('handles accounts fetch failure gracefully', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/api/accounting/general-ledger')) {
        return Promise.reject(new Error('Accounts error'));
      }
      return okJson({ data: sampleEntries });
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('ID Jurnal: #1'))).toBeInTheDocument();
    });

    expect(console.error).toHaveBeenCalledWith(
      'Error fetching accounts:',
      expect.any(Error)
    );
  });

  test('refetches entries when filter button is clicked', async () => {
    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('ID Jurnal: #1'))).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue((v) => v.includes('-'));
    fireEvent.change(dateInputs[0], { target: { value: '2025-01-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2025-01-31' } });

    fireEvent.click(screen.getByText('Filter Laporan'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('startDate=2025-01-01&endDate=2025-01-31'),
        expect.any(Object)
      );
    });
  });

  test('opens and closes the offcanvas', async () => {
    render(<GeneralJournalPage />);

    expect(screen.queryByTestId('off-canvas')).not.toBeInTheDocument();

    openOffcanvas();

    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });
    expect(screen.getByText('Buat Jurnal Umum Manual')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Batal'));

    await waitFor(() => {
      expect(screen.queryByTestId('off-canvas')).not.toBeInTheDocument();
    });
  });

  test('handles add and remove input rows in the form', async () => {
    render(<GeneralJournalPage />);
    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('combobox')).toHaveLength(2);

    fireEvent.click(screen.getByText('+ Tambah Baris'));
    await waitFor(() => {
      expect(screen.getAllByRole('combobox')).toHaveLength(3);
    });

    fireEvent.click(screen.getByText('+ Tambah Baris'));
    await waitFor(() => {
      expect(screen.getAllByRole('combobox')).toHaveLength(4);
    });

    const trashButtons = screen.getAllByTestId('trash-icon');
    fireEvent.click(trashButtons[0].closest('button')!);
    await waitFor(() => {
      expect(screen.getAllByRole('combobox')).toHaveLength(3);
    });
  });

  test('prevents removing row when only 2 rows exist', async () => {
    render(<GeneralJournalPage />);
    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    const trashButtons = screen.getAllByTestId('trash-icon');
    expect(trashButtons).toHaveLength(2);

    fireEvent.click(trashButtons[0].closest('button')!);

    expect(goeyToast.error).toHaveBeenCalledWith(
      'Jurnal minimal memiliki 2 baris (Debit & Kredit)'
    );

    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  test('handles item field changes', async () => {
    render(<GeneralJournalPage />);
    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    const debitInputs = screen.getAllByPlaceholderText('Debit');
    fireEvent.change(debitInputs[0], { target: { value: '50000' } });
    expect(debitInputs[0]).toHaveValue(50000);

    const creditInputs = screen.getAllByPlaceholderText('Kredit');
    fireEvent.change(creditInputs[1], { target: { value: '50000' } });
    expect(creditInputs[1]).toHaveValue(50000);
  });

  test('disables debit input when credit is entered and vice versa', async () => {
    render(<GeneralJournalPage />);
    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    const firstDebit = screen.getAllByPlaceholderText('Debit')[0];
    const firstCredit = screen.getAllByPlaceholderText('Kredit')[0];

    expect(firstDebit).not.toBeDisabled();
    expect(firstCredit).not.toBeDisabled();

    fireEvent.change(firstDebit, { target: { value: '50000' } });
    expect(firstCredit).toBeDisabled();

    fireEvent.change(firstDebit, { target: { value: '' } });
    fireEvent.change(firstCredit, { target: { value: '50000' } });
    expect(firstDebit).toBeDisabled();
  });

  test('shows balanced status in the form', async () => {
    render(<GeneralJournalPage />);
    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    expect(screen.getByText(/Belum Seimbang/)).toBeInTheDocument();

    const debitInputs = screen.getAllByPlaceholderText('Debit');
    const creditInputs = screen.getAllByPlaceholderText('Kredit');
    fireEvent.change(debitInputs[0], { target: { value: '100' } });
    fireEvent.change(creditInputs[1], { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByText(/Seimbang/)).toBeInTheDocument();
    });
  });

  test('prevents submit when not balanced', async () => {
    render(<GeneralJournalPage />);
    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    fillAndSubmitBalancedForm();

    const debits = screen.getAllByPlaceholderText('Debit');
    const credits = screen.getAllByPlaceholderText('Kredit');
    fireEvent.change(debits[0], { target: { value: '100' } });
    fireEvent.change(credits[1], { target: { value: '200' } });

    const form = screen.getByTestId('off-canvas').querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Total Debit dan Kredit harus seimbang (dan lebih besar dari 0)'
      );
    });
  });

  test('prevents submit when less than 2 accounts selected', async () => {
    render(<GeneralJournalPage />);
    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    const debits = screen.getAllByPlaceholderText('Debit');
    const credits = screen.getAllByPlaceholderText('Kredit');
    fireEvent.change(debits[0], { target: { value: '100' } });
    fireEvent.change(credits[1], { target: { value: '100' } });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });

    const form = screen.getByTestId('off-canvas').querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith(
        'Pilih setidaknya 2 akun valid'
      );
    });
  });

  test('submits journal entry successfully', async () => {
    const postMock = jest.fn(() => okJson({ message: 'created' }));
    global.fetch = jest.fn((url: string, init?: any) => {
      const urlStr = typeof url === 'string' ? url : url.url;
      if (init?.method === 'POST') return postMock();
      if (urlStr.includes('/api/accounting/general-ledger')) {
        return okJson({ accounts: sampleAccounts });
      }
      return okJson({ data: sampleEntries });
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('Buat Jurnal Manual'))).toBeInTheDocument();
    });

    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    fillAndSubmitBalancedForm();

    const form = screen.getByTestId('off-canvas').querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Jurnal Umum berhasil disimpan');
    });

    expect(postMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.queryByTestId('off-canvas')).not.toBeInTheDocument();
    });
  });

  test('shows error toast on submit API failure', async () => {
    global.fetch = jest.fn((url: string, init?: any) => {
      const urlStr = typeof url === 'string' ? url : url.url;
      if (init?.method === 'POST') return failJson({ message: 'Invalid data' });
      if (urlStr.includes('/api/accounting/general-ledger')) {
        return okJson({ accounts: sampleAccounts });
      }
      return okJson({ data: sampleEntries });
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('Buat Jurnal Manual'))).toBeInTheDocument();
    });

    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    fillAndSubmitBalancedForm();

    const form = screen.getByTestId('off-canvas').querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Invalid data');
    });
  });

  test('shows fallback error toast on submit API failure without message', async () => {
    global.fetch = jest.fn((url: string, init?: any) => {
      const urlStr = typeof url === 'string' ? url : url.url;
      if (init?.method === 'POST') return failJson({});
      if (urlStr.includes('/api/accounting/general-ledger')) {
        return okJson({ accounts: sampleAccounts });
      }
      return okJson({ data: sampleEntries });
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('Buat Jurnal Manual'))).toBeInTheDocument();
    });

    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    fillAndSubmitBalancedForm();

    const form = screen.getByTestId('off-canvas').querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menyimpan jurnal');
    });
  });

  test('shows error toast on submit network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn((url: string, init?: any) => {
      const urlStr = typeof url === 'string' ? url : url.url;
      if (init?.method === 'POST') return Promise.reject(new Error('Network error'));
      if (urlStr.includes('/api/accounting/general-ledger')) {
        return okJson({ accounts: sampleAccounts });
      }
      return okJson({ data: sampleEntries });
    }) as unknown as typeof fetch;

    render(<GeneralJournalPage />);

    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('Buat Jurnal Manual'))).toBeInTheDocument();
    });

    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    fillAndSubmitBalancedForm();

    const form = screen.getByTestId('off-canvas').querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan koneksi');
    });
  });

  test('changes entryDate and entryDescription (lines 330,340)', async () => {
    render(<GeneralJournalPage />);
    openOffcanvas();
    await waitFor(() => {
      expect(screen.getByTestId('off-canvas')).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue((v) => v.includes('-'));
    fireEvent.change(dateInputs[2], { target: { value: '2025-06-15' } });

    const descInput = screen.getByPlaceholderText('Contoh: Pembayaran internet bulanan');
    fireEvent.change(descInput, { target: { value: 'Test description' } });

    expect(descInput).toHaveValue('Test description');
  });
});
