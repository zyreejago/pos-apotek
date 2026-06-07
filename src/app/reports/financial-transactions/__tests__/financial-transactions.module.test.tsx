import React from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinancialTransactionsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';
import { HeaderProvider, useHeader } from '@/context/HeaderContext';

jest.mock('lucide-react', () => ({
  Wallet: () => <span data-testid="wallet-icon" />,
  Landmark: () => <span data-testid="landmark-icon" />,
  TrendingUp: () => <span data-testid="trending-up-icon" />,
  Cpu: () => <span data-testid="cpu-icon" />,
  Truck: () => <span data-testid="truck-icon" />,
  UserCheck: () => <span data-testid="user-check-icon" />,
  RefreshCw: () => <span data-testid="refresh-icon" />,
  Send: () => <span data-testid="send-icon" />,
  Ban: () => <span data-testid="ban-icon" />,
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

const mockCheckActionPermission = jest.fn(() => true);

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: () => ({
    checkActionPermission: mockCheckActionPermission,
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

jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    setFont: jest.fn(),
    setTextColor: jest.fn(),
    setFillColor: jest.fn(),
    rect: jest.fn(),
    text: jest.fn(),
    setLineWidth: jest.fn(),
    line: jest.fn(),
    addPage: jest.fn(),
    save: jest.fn(),
    lastAutoTable: { finalY: 150 },
  }));
});

jest.mock('jspdf-autotable', () => {
  return jest.fn().mockImplementation((doc) => {
    doc.lastAutoTable = { finalY: 150 };
  });
});

const mockAccounts = [
  { id: 1, code: '101', name: 'Kas', type: 'aset', normal_balance: 'debit' },
  { id: 2, code: '102', name: 'Bank BCA', type: 'aset', normal_balance: 'debit' },
  { id: 3, code: '121', name: 'Peralatan Apotek', type: 'aset', normal_balance: 'debit' },
  { id: 4, code: '122', name: 'Komputer', type: 'aset', normal_balance: 'debit' },
  { id: 5, code: '123', name: 'Kendaraan', type: 'aset', normal_balance: 'debit' },
  { id: 6, code: '201', name: 'Hutang Usaha', type: 'kewajiban', normal_balance: 'credit' },
  { id: 7, code: '301', name: 'Modal Pemilik', type: 'modal', normal_balance: 'credit' },
  { id: 8, code: '302', name: 'Prive Pemilik', type: 'modal', normal_balance: 'debit' },
  { id: 9, code: '510', name: 'Beban Sewa', type: 'beban', normal_balance: 'debit' },
];

function accountsPayload(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

function failPayload(data: unknown) {
  return Promise.resolve({
    ok: false,
    status: 500,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

function okPayload(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'test-token');
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' })
  );
  mockCheckActionPermission.mockReturnValue(true);
  global.fetch = jest.fn(() => accountsPayload({ accounts: mockAccounts })) as unknown as typeof fetch;
});

describe('financial-transactions module', () => {
  test('renders page and loads accounts (expense tab default)', async () => {
    renderWithProviders(<FinancialTransactionsPage />);

    expect(screen.getByText('Pencatatan Transaksi Keuangan')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('-- Pilih Kas/Bank --')).toBeInTheDocument();
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/accounting/general-ledger'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
  });

  test('switches between all tabs', async () => {
    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Modal & Prive'));
    expect(screen.getByText('Catat Modal & Prive')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Aset Tetap'));
    expect(screen.getByText('Beli Aset Tetap')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Biaya Operasional'));
    expect(screen.getByText('Catat Biaya Operasional')).toBeInTheDocument();
  });

  test('fetches without authorization header when token is missing', async () => {
    localStorage.removeItem('token');

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/general-ledger'),
        expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
      );
    });
  });

  test('handles accounts fetch error (console.error)', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching accounts:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  test('handles accounts fetch not ok response', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response)
    ) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  test('renders with empty accounts', async () => {
    global.fetch = jest.fn(() => accountsPayload({ accounts: [] })) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('-- Pilih Beban --')).toBeInTheDocument();
    });
  });

  function getExpenseForm() {
    return screen.getByRole('button', { name: /Posting Biaya/ }).closest('form')!;
  }

  async function waitForAccounts() {
    // Wait until the expense accounts select has options loaded
    await waitFor(() => {
      const combobox = screen.getAllByRole('combobox')[0];
      expect(combobox.options.length).toBeGreaterThan(1);
    });
  }

  async function selectOptionOrSetValue(select: HTMLSelectElement, value: string) {
    const hasOption = Array.from(select.options).some(o => o.value === value);
    if (hasOption) {
      const user = userEvent.setup();
      await user.selectOptions(select, value);
    } else {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
      const user = userEvent.setup();
      await user.selectOptions(select, value);
    }
  }

  async function fillExpenseForm(expenseAccountValue: string, paymentAccountValue: string, amount: string, date?: string) {
    const comboboxes = screen.getAllByRole('combobox');
    await waitForAccounts();
    const user = userEvent.setup();
    await selectOptionOrSetValue(comboboxes[0], expenseAccountValue);
    await selectOptionOrSetValue(comboboxes[1], paymentAccountValue);
    if (date) {
      const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
      await user.clear(dateInputs[0]);
      await user.type(dateInputs[0], date);
    }
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: amount } });
    await act(async () => {});
    const form = getExpenseForm();
    fireEvent.submit(form);
  }

  test('expense form validation fails', async () => {
    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    const form = getExpenseForm();
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Harap lengkapi semua field dengan benar');
    });
  });

  test('expense form account not found (silent return)', async () => {
    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    await fillExpenseForm('999', '1', '50000');

    await waitFor(() => {
      expect(goeyToast.error).not.toHaveBeenCalledWith('Harap lengkapi semua field dengan benar');
    });
  });

  test('expense form submits successfully', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(accountsPayload({ accounts: mockAccounts }))
      .mockResolvedValueOnce(okPayload({ success: true })) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    await fillExpenseForm('9', '1', '50000', '2026-06-06');

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Transaksi Keuangan berhasil diposting!');
    });
  });

  test('expense form submits without custom description (uses default)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(accountsPayload({ accounts: mockAccounts }))
      .mockResolvedValueOnce(okPayload({ success: true })) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    await fillExpenseForm('9', '1', '25000');

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Transaksi Keuangan berhasil diposting!');
    });
  });

  test('expense form API error', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(accountsPayload({ accounts: mockAccounts }))
      .mockResolvedValueOnce(failPayload({ message: 'Gagal menyimpan' })) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    await fillExpenseForm('9', '1', '50000');

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menyimpan');
    });
  });

  test('expense form API error without message uses fallback', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(accountsPayload({ accounts: mockAccounts }))
      .mockResolvedValueOnce(failPayload({})) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    await fillExpenseForm('9', '1', '50000');

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menyimpan transaksi');
    });
  });

  test('expense form network error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(accountsPayload({ accounts: mockAccounts }))
      .mockRejectedValueOnce(new Error('Network error')) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    await fillExpenseForm('9', '1', '50000');

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal terhubung ke server');
      expect(consoleSpy).toHaveBeenCalledWith('Error posting transaction:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  test('shows loading spinner during form submission', async () => {
    let resolvePost: (value: Response) => void;

    global.fetch = jest.fn((url: string) => {
      if (url.includes('journal-entries')) {
        return new Promise<Response>((resolve) => {
          resolvePost = resolve;
        });
      }
      return accountsPayload({ accounts: mockAccounts });
    }) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    const comboboxes = screen.getAllByRole('combobox');
    await waitForAccounts();
    await selectOptionOrSetValue(comboboxes[0], '9');
    await selectOptionOrSetValue(comboboxes[1], '1');
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '50000' } });

    await act(async () => {});
    const btn = screen.getByRole('button', { name: /Posting Biaya/ });
    const form = btn.closest('form')!;
    fireEvent.submit(form);

    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();

    await act(async () => {
      resolvePost!(okPayload({ success: true }));
    });
  });

  async function fillEquityForm(paymentAccountValue: string, amount: string) {
    const combobox = screen.getByRole('combobox');
    await waitForAccounts();
    await selectOptionOrSetValue(combobox, paymentAccountValue);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: amount } });
    await act(async () => {});
    const form = screen.getByRole('button', { name: /Posting Permodalan/ }).closest('form')!;
    fireEvent.submit(form);
  }

  test('equity form validation fails', async () => {
    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Modal & Prive'));

    await waitFor(() => {
      expect(screen.getByText('Posting Permodalan (Setor Modal)')).toBeInTheDocument();
    });

    await act(async () => {});
    const form = screen.getByRole('button', { name: /Posting Permodalan/ }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Harap lengkapi semua field dengan benar');
    });
  });

  test('equity form account not found', async () => {
    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Modal & Prive'));

    await waitFor(() => {
      expect(screen.getByText('Posting Permodalan (Setor Modal)')).toBeInTheDocument();
    });

    await fillEquityForm('999', '50000');

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Akun modal/prive tidak ditemukan di database.');
    });
  });

  test('equity form account not found when code 301/302 missing', async () => {
    const accountsNoModal = mockAccounts.filter((a) => a.code !== '301' && a.code !== '302');

    global.fetch = jest.fn(() =>
      accountsPayload({ accounts: accountsNoModal })
    ) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Modal & Prive'));

    await waitFor(() => {
      expect(screen.getByText('Posting Permodalan (Setor Modal)')).toBeInTheDocument();
    });

    await fillEquityForm('1', '50000');

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Akun modal/prive tidak ditemukan di database.');
    });
  });

  test('equity form setor success', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(accountsPayload({ accounts: mockAccounts }))
      .mockResolvedValueOnce(okPayload({ success: true })) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Modal & Prive'));

    await waitFor(() => {
      expect(screen.getByText('Posting Permodalan (Setor Modal)')).toBeInTheDocument();
    });

    await fillEquityForm('1', '100000');

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Transaksi Keuangan berhasil diposting!');
    });
  });

  test('equity form tarik success', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(accountsPayload({ accounts: mockAccounts }))
      .mockResolvedValueOnce(okPayload({ success: true })) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Modal & Prive'));

    await waitFor(() => {
      expect(screen.getByText('Posting Permodalan (Setor Modal)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Prive (Tarik Tunai)'));

    await fillEquityForm('1', '50000');

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Transaksi Keuangan berhasil diposting!');
    });
  });

  async function fillAssetForm(accountValue: string, amount: string, paymentAccountValue?: string) {
    const comboboxes = screen.getAllByRole('combobox');
    await waitForAccounts();
    await selectOptionOrSetValue(comboboxes[0], accountValue);
    if (paymentAccountValue) {
      await selectOptionOrSetValue(comboboxes[1], paymentAccountValue);
    }
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: amount } });
    await act(async () => {});
    const form = screen.getByRole('button', { name: /Posting Pembelian Aset/ }).closest('form')!;
    fireEvent.submit(form);
  }

  test('asset form validation fails', async () => {
    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aset Tetap'));

    await waitFor(() => {
      expect(screen.getByText('Posting Pembelian Aset')).toBeInTheDocument();
    });

    await act(async () => {});
    const form = screen.getByRole('button', { name: /Posting Pembelian Aset/ }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Harap lengkapi semua field dengan benar');
    });
  });

  test('asset form asset account not found (silent return)', async () => {
    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aset Tetap'));

    await waitFor(() => {
      expect(screen.getByText('Posting Pembelian Aset')).toBeInTheDocument();
    });

    await fillAssetForm('999', '50000');

    await waitFor(() => {
      expect(goeyToast.error).not.toHaveBeenCalledWith('Harap lengkapi semua field dengan benar');
    });
  });

  test('asset form tunai without payment account', async () => {
    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aset Tetap'));

    await waitFor(() => {
      expect(screen.getByText('Posting Pembelian Aset')).toBeInTheDocument();
    });

    await fillAssetForm('3', '1000000');

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Pilih akun kas atau bank pembayar');
    });
  });

  test('asset form kredit without debtAcc (code 201 missing)', async () => {
    const accountsNoDebt = mockAccounts.filter((a) => a.code !== '201');

    global.fetch = jest.fn(() =>
      accountsPayload({ accounts: accountsNoDebt })
    ) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aset Tetap'));

    await waitFor(() => {
      expect(screen.getByText('Posting Pembelian Aset')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Kredit (Hutang)'));

    await fillAssetForm('3', '2000000');

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Akun Hutang Usaha tidak ditemukan');
    });
  });

  test('asset form tunai success', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(accountsPayload({ accounts: mockAccounts }))
      .mockResolvedValueOnce(okPayload({ success: true })) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aset Tetap'));

    await waitFor(() => {
      expect(screen.getByText('Posting Pembelian Aset')).toBeInTheDocument();
    });

    await fillAssetForm('3', '1500000', '1');

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Transaksi Keuangan berhasil diposting!');
    });
  });

  test('asset form kredit success', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(accountsPayload({ accounts: mockAccounts }))
      .mockResolvedValueOnce(okPayload({ success: true })) as unknown as typeof fetch;

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aset Tetap'));

    await waitFor(() => {
      expect(screen.getByText('Posting Pembelian Aset')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Kredit (Hutang)'));

    await fillAssetForm('3', '3000000');

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Transaksi Keuangan berhasil diposting!');
    });
  });

  test('canCreate false shows Akses Ditolak and disables buttons', async () => {
    mockCheckActionPermission.mockReturnValue(false);

    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Akses Ditolak')).toBeInTheDocument();
    });

    expect(screen.getByText('Akses Ditolak').closest('button')).toBeDisabled();

    fireEvent.click(screen.getByText('Modal & Prive'));
    await waitFor(() => {
      expect(screen.getByText('Akses Ditolak')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aset Tetap'));
    await waitFor(() => {
      expect(screen.getByText('Akses Ditolak')).toBeInTheDocument();
    });
  });

  test('expense amount <= 0 triggers validation', async () => {
    renderWithProviders(<FinancialTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });

    const comboboxes = screen.getAllByRole('combobox');
    await waitForAccounts();
    await selectOptionOrSetValue(comboboxes[0], '9');
    await selectOptionOrSetValue(comboboxes[1], '1');
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '0' } });

    await act(async () => {});
    const form = getExpenseForm();
    fireEvent.submit(form);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Harap lengkapi semua field dengan benar');
    });
  });

  test('fills expense description textarea (line 348)', async () => {
    renderWithProviders(<FinancialTransactionsPage />);
    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('Contoh: Bayar air PAM bulan Juni');
    fireEvent.change(textarea, { target: { value: 'Biaya listrik' } });
    expect(textarea).toHaveValue('Biaya listrik');
  });

  test('fills equity description and date (lines 401,443)', async () => {
    renderWithProviders(<FinancialTransactionsPage />);
    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Modal & Prive'));
    await waitFor(() => {
      expect(screen.getByText('Catat Modal & Prive')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('Contoh: Setoran tambahan modal awal apotek');
    fireEvent.change(textarea, { target: { value: 'Setoran modal' } });
    expect(textarea).toHaveValue('Setoran modal');

    fireEvent.click(screen.getByText('Prive (Tarik Tunai)'));
    await waitFor(() => {
      expect(screen.getByText('Posting Permodalan (Tarik Prive)')).toBeInTheDocument();
    });
    const priveTextarea = screen.getByPlaceholderText('Contoh: Ambil kas apotek keperluan mendesak pemilik');
    fireEvent.change(priveTextarea, { target: { value: 'Penarikan prive' } });
    expect(priveTextarea).toHaveValue('Penarikan prive');
  });

  test('fills asset description and changes payment method (lines 501,561)', async () => {
    renderWithProviders(<FinancialTransactionsPage />);
    await waitFor(() => {
      expect(screen.getByText('Posting Biaya')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aset Tetap'));
    await waitFor(() => {
      expect(screen.getByText('Beli Aset Tetap')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('Contoh: Beli AC Sharp untuk Apotek baru');
    fireEvent.change(textarea, { target: { value: 'Beli komputer' } });
    expect(textarea).toHaveValue('Beli komputer');

    fireEvent.click(screen.getByText('Kredit (Hutang)'));
    await waitFor(() => {
      expect(screen.getByText(/akan secara otomatis dicatat ke akun/)).toBeInTheDocument();
    });
  });
});
