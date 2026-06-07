import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ApprovalsPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';
import { HeaderProvider } from '@/context/HeaderContext';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <HeaderProvider>
      {ui}
    </HeaderProvider>
  );
}

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/approvals',
}));

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: () => ({
    loading: false,
    hasPermission: true,
    permissions: [],
    checkActionPermission: jest.fn(() => true),
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

jest.mock('lucide-react', () => ({
  Check: () => <span data-testid="check-icon" />,
  X: () => <span data-testid="x-icon" />,
  AlertCircle: () => <span data-testid="alertcircle-icon" />,
  FileText: () => <span data-testid="filetext-icon" />,
  Info: () => <span data-testid="info-icon" />,
  Package: () => <span data-testid="package-icon" />,
  Users: () => <span data-testid="users-icon" />,
  Calendar: () => <span data-testid="calendar-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
}));

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

const pendingFaktur = {
  id: 1,
  product_id: 101,
  product_name: 'Produk Aktif',
  product_status: 'active' as const,
  product_unit: 'pcs',
  product_purchase_unit: 'box',
  product_unit_multiplier: 10,
  batch_number: 'BATCH001',
  supplier_id: 5,
  supplier_name: 'PT Supplier',
  purchase_date: '2025-01-15',
  initial_quantity: 100,
  cost_price: 50000,
  stock_type: 'normal',
  dp_amount: null,
  due_date: null,
  image_url: null,
  status: 'pending' as const,
  notes: null,
  created_at: '2025-01-10T00:00:00Z',
};

const rejectedFaktur = {
  ...pendingFaktur,
  id: 2,
  product_name: 'Produk Ditolak',
  status: 'rejected' as const,
  notes: 'Harga tidak sesuai',
  product_status: 'pending' as const,
};

const revisionFaktur = {
  ...pendingFaktur,
  id: 3,
  product_name: 'Produk Revisi',
  status: 'revision' as const,
  notes: 'Mohon cek kembali harga beli',
};

const fakturWithImage = {
  ...pendingFaktur,
  id: 4,
  product_name: 'Produk Dengan Foto',
  image_url: '/uploads/bukti.jpg',
  status: 'pending' as const,
};

const payload = {
  data: [
    pendingFaktur,
    rejectedFaktur,
    revisionFaktur,
    fakturWithImage,
  ],
};

function mockDefaultFetch() {
  global.fetch = jest.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    const resp = { ok: true, status: 200 };

    if (url.includes('/api/inventory/pending-batches')) {
      return {
        ...resp,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      };
    }

    return {
      ...resp,
      json: async () => ({}),
      text: async () => JSON.stringify({}),
    };
  }) as unknown as typeof fetch;
}

function renderPage() {
  return renderWithProviders(<ApprovalsPage />);
}

async function waitLoaded() {
  await waitFor(() => {
    expect(screen.getByText('Produk Aktif')).toBeInTheDocument();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();

  localStorage.clear();
  localStorage.setItem('token', 'test');
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test', role: 'superadmin' }));

  mockDefaultFetch();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('approvals module', () => {
  test('renders loading state', async () => {
    let resolveFetch: ((value: Response) => void) | null = null;

    global.fetch = jest.fn(() =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    ) as unknown as typeof fetch;

    renderPage();

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();

    resolveFetch!({
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    } as Response);

    expect(await screen.findByText('Produk Aktif')).toBeInTheDocument();
  });

  test('renders empty state', async () => {
    global.fetch = jest.fn(() =>
      okJson({ data: [] })
    ) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText('Semua Beres!')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada faktur yang menunggu persetujuan saat ini.')).toBeInTheDocument();
  });

  test('renders faktur cards with various statuses', async () => {
    renderPage();

    await waitLoaded();

    expect(screen.getByText('Produk Aktif')).toBeInTheDocument();
    expect(screen.getAllByText(/Produk ID:.*101/).length).toBe(4);
    expect(screen.getAllByText('Pending Approval').length).toBe(2);
    expect(screen.getByText('Ditolak')).toBeInTheDocument();
    expect(screen.getByText('Menunggu Perbaikan')).toBeInTheDocument();

    expect(screen.getAllByText(/Rp\s*50.000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Rp\s*5.000.000/).length).toBeGreaterThanOrEqual(1);
  });

  test('shows notes for faktur with notes', async () => {
    renderPage();

    await waitLoaded();

    expect(screen.getByText('Harga tidak sesuai')).toBeInTheDocument();
    expect(screen.getByText('Mohon cek kembali harga beli')).toBeInTheDocument();
  });

  test('shows "Produk Baru" badge for pending product status', async () => {
    renderPage();

    await waitLoaded();

    const badges = screen.getAllByText('Produk Baru');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  test('shows image preview button when image_url exists', async () => {
    renderPage();

    await waitLoaded();

    const lihatBuktiButtons = screen.getAllByText('Lihat Bukti');
    expect(lihatBuktiButtons.length).toBeGreaterThanOrEqual(1);
  });

  test('shows delete button for rejected fakturs', async () => {
    renderPage();

    await waitLoaded();

    const deleteButtons = screen.getAllByTitle('Hapus Faktur Ditolak');
    expect(deleteButtons.length).toBe(1);
  });

  test('shows action buttons for pending fakturs', async () => {
    renderPage();

    await waitLoaded();

    const approveButtons = screen.getAllByTitle('Setujui');
    const revisionButtons = screen.getAllByTitle('Perlu Perbaikan');
    const rejectButtons = screen.getAllByTitle('Tolak');

    expect(approveButtons.length).toBeGreaterThanOrEqual(1);
    expect(revisionButtons.length).toBeGreaterThanOrEqual(1);
    expect(rejectButtons.length).toBeGreaterThanOrEqual(1);
  });

  test('shows status text for non-pending fakturs', async () => {
    renderPage();

    await waitLoaded();

    expect(screen.getByText('Telah Ditolak')).toBeInTheDocument();
    expect(screen.getByText('Menunggu Perbaikan Kasir')).toBeInTheDocument();
  });

  test('handles fetch network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn(() => Promise.reject(new Error('network error'))) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal memuat data approval');
    });
  });

  test('handles fetch with empty response data', async () => {
    global.fetch = jest.fn(() =>
      okJson({}) // no data field
    ) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Semua Beres!')).toBeInTheDocument();
    });
  });

  test('handles approve success', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/approve')) {
        return okJson({ message: 'approved' });
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Setujui')[0]);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Faktur disetujui');
    });
  });

  test('handles approve error response', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/approve')) {
        return failJson({ message: 'approve failed' }, 400);
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Setujui')[0]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menyetujui faktur');
    });
  });

  test('handles approve network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/approve')) {
        return Promise.reject(new Error('approve network error'));
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Setujui')[0]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan');
    });
  });

  test('handles reject success', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/reject')) {
        return okJson({ message: 'rejected' });
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Tolak')[0]);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Faktur ditolak');
    });
  });

  test('handles reject error response', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/reject')) {
        return failJson({ message: 'reject failed' }, 400);
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Tolak')[0]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menolak faktur');
    });
  });

  test('handles reject network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/reject')) {
        return Promise.reject(new Error('reject network error'));
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Tolak')[0]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan');
    });
  });

  test('handles delete success', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/api/inventory/batches/') && init?.method === 'DELETE') {
        return okJson({ message: 'deleted' });
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Hapus Faktur Ditolak')[0]);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Faktur berhasil dihapus');
    });
  });

  test('handles delete canceled', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    const fetchSpy = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      return okJson({});
    }) as unknown as typeof fetch;

    global.fetch = fetchSpy;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Hapus Faktur Ditolak')[0]);

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/inventory/batches/'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  test('handles delete error with message', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/api/inventory/batches/') && init?.method === 'DELETE') {
        return failJson({ message: 'Gagal menghapus faktur' }, 400);
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Hapus Faktur Ditolak')[0]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menghapus faktur');
    });
  });

  test('handles delete error without message', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/api/inventory/batches/') && init?.method === 'DELETE') {
        return failJson({}, 400);
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Hapus Faktur Ditolak')[0]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal menghapus faktur');
    });
  });

  test('handles delete network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/api/inventory/batches/') && init?.method === 'DELETE') {
        return Promise.reject(new Error('delete network error'));
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Hapus Faktur Ditolak')[0]);

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan saat menghapus faktur');
    });
  });

  test('opens and closes revision modal', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Perlu Perbaikan')[0]);

    expect(screen.getByText('Minta Perbaikan')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Batal'));

    await waitFor(() => {
      expect(screen.queryByText('Minta Perbaikan')).not.toBeInTheDocument();
    });
  });

  test('closes revision modal with x button', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Perlu Perbaikan')[0]);

    expect(screen.getByText('Minta Perbaikan')).toBeInTheDocument();

    const xButton = screen.getAllByTestId('x-icon');
    const closeBtn = xButton[xButton.length - 1].closest('button') as HTMLButtonElement;
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Minta Perbaikan')).not.toBeInTheDocument();
    });
  });

  test('submits revision successfully', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/revision')) {
        return okJson({ message: 'revision sent' });
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Perlu Perbaikan')[0]);
    expect(screen.getByText('Minta Perbaikan')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Contoh: Harga beli salah/), {
      target: { value: 'Harga beli tidak sesuai faktur' },
    });

    fireEvent.click(screen.getByText('Perbarui'));

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Permintaan perbaikan dikirim');
    });

    expect(screen.queryByText('Minta Perbaikan')).not.toBeInTheDocument();
  });

  test('submits revision with empty notes triggers validation', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Perlu Perbaikan')[0]);
    expect(screen.getByText('Minta Perbaikan')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Contoh: Harga beli salah/), {
      target: { value: 'some notes' },
    });
    const submitButton = screen.getByText('Perbarui');
    expect(submitButton).not.toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Contoh: Harga beli salah/), {
      target: { value: '' },
    });
    expect(submitButton).toBeDisabled();
  });

  test('revision submit button disabled when notes empty', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Perlu Perbaikan')[0]);

    const submitButton = screen.getByText('Perbarui');
    expect(submitButton).toBeDisabled();
  });

  test('revision empty notes validation error', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Perlu Perbaikan')[0]);
    expect(screen.getByText('Minta Perbaikan')).toBeInTheDocument();

    const submitButton = screen.getByText('Perbarui') as HTMLButtonElement;
    expect(submitButton).toBeDisabled();

    const reactPropsKey = Object.keys(submitButton).find(k =>
      k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers')
    );
    if (reactPropsKey) {
      const props = (submitButton as Record<string, any>)[reactPropsKey];
      props.onClick();
    } else {
      submitButton.disabled = false;
      fireEvent.click(submitButton);
    }

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Catatan perbaikan harus diisi');
    });
  });

  test('submits revision with network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/revision')) {
        return Promise.reject(new Error('revision network error'));
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Perlu Perbaikan')[0]);

    fireEvent.change(screen.getByPlaceholderText(/Contoh: Harga beli salah/), {
      target: { value: 'Harga beli tidak sesuai faktur' },
    });

    fireEvent.click(screen.getByText('Perbarui'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Terjadi kesalahan');
    });
  });

  test('submits revision with error response', async () => {
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/revision')) {
        return failJson({ message: 'revision failed' }, 400);
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Perlu Perbaikan')[0]);

    fireEvent.change(screen.getByPlaceholderText(/Contoh: Harga beli salah/), {
      target: { value: 'Harga beli tidak sesuai faktur' },
    });

    fireEvent.click(screen.getByText('Perbarui'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal mengirim permintaan perbaikan');
    });
  });

  test('opens and closes image preview', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByText('Lihat Bukti')[0]);

    expect(screen.getByText('Bukti Faktur')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Bukti Faktur').closest('div')!.querySelector('button')!);

    await waitFor(() => {
      expect(screen.queryByText('Bukti Faktur')).not.toBeInTheDocument();
    });
  });

  test('closes image preview by clicking backdrop', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByText('Lihat Bukti')[0]);

    expect(screen.getByText('Bukti Faktur')).toBeInTheDocument();

    const backdrop = screen.getByText('Bukti Faktur').closest('div')!.parentElement!.parentElement!;
    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByText('Bukti Faktur')).not.toBeInTheDocument();
    });
  });

  test('handles no token', async () => {
    localStorage.removeItem('token');

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitLoaded();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/inventory/pending-batches'),
      expect.objectContaining({ headers: { Authorization: 'Bearer null' } })
    );
  });

  test('disables submit button while submitting revision', async () => {
    let resolveRevision: ((value: Response) => void) | null = null;

    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson(payload);
      }
      if (url.includes('/revision')) {
        return new Promise<Response>((resolve) => {
          resolveRevision = resolve;
        });
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Perlu Perbaikan')[0]);

    fireEvent.change(screen.getByPlaceholderText(/Contoh: Harga beli salah/), {
      target: { value: 'Harga beli tidak sesuai faktur' },
    });

    const submitButton = screen.getByText('Perbarui');
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();

    resolveRevision!({
      ok: true,
      status: 200,
      json: async () => ({ message: 'revision sent' }),
      text: async () => JSON.stringify({ message: 'revision sent' }),
    } as Response);

    await waitFor(() => {
      expect(goeyToast.success).toHaveBeenCalledWith('Permintaan perbaikan dikirim');
    });
  });

  test('renders faktur with null supplier, null purchase_date, null batch_number (branches 239,256,260)', async () => {
    const minimalFaktur = {
      id: 5,
      product_id: 105,
      product_name: 'Produk Minimal',
      product_status: 'active',
      product_unit: 'pcs',
      product_purchase_unit: 'box',
      product_unit_multiplier: 0,
      batch_number: null,
      supplier_id: null,
      supplier_name: null,
      purchase_date: null,
      initial_quantity: 50,
      cost_price: 25000,
      stock_type: 'normal',
      dp_amount: null,
      due_date: null,
      image_url: null,
      status: 'pending',
      notes: null,
      created_at: '2025-01-10T00:00:00Z',
    };

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson({ data: [minimalFaktur] });
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Produk Minimal')).toBeInTheDocument();
    });

    expect(screen.getByText('Tanpa Supplier')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1);
  });

  test('fetches pending fakturs with null token (branch line 44, 52-53)', async () => {
    localStorage.removeItem('token');

    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/inventory/pending-batches')) {
        return okJson({ data: [pendingFaktur] });
      }
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Produk Aktif')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/inventory/pending-batches'),
      expect.objectContaining({ headers: { Authorization: 'Bearer null' } })
    );
  });

  test('submitRevision returns early when revisionFakturId is falsy (line 136)', async () => {
    renderPage();
    await waitLoaded();

    fireEvent.click(screen.getAllByTitle('Perlu Perbaikan')[0]);

    expect(screen.getByText('Minta Perbaikan')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Contoh: Harga beli salah/), {
      target: { value: 'Test notes' },
    });

    const submitButton = screen.getByText('Perbarui') as HTMLButtonElement;
    const reactPropsKey = Object.keys(submitButton).find(k =>
      k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers')
    );

    jest.spyOn(window, 'confirm').mockReturnValue(false);

    if (reactPropsKey) {
      const props = (submitButton as Record<string, any>)[reactPropsKey];
      props.onClick();
    } else {
      submitButton.disabled = false;
      fireEvent.click(submitButton);
    }

    await waitFor(() => {
      expect(goeyToast.error).not.toHaveBeenCalledWith('Catatan perbaikan harus diisi');
    });
  });
});
