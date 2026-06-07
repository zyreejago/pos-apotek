import React from 'react';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import ForgotpasswordPage from '../page';
import { goeyToast } from '@/components/ui/goey-toaster';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/forgot-password',
}));

jest.mock('next/link', () => {
  return function Link({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) {
    return <a href={href}>{children}</a>;
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

jest.mock('lucide-react', () => ({
  Eye: () => <span data-testid="eye-icon" />,
  EyeOff: () => <span data-testid="eye-off-icon" />,
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
}));

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

function errorJson(data: unknown, status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response);
}

function badJsonResponse(status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    json: async () => {
      throw new Error('bad json');
    },
    text: async () => '',
  } as unknown as Response);
}

beforeEach(() => {
  jest.clearAllMocks();

  global.fetch = jest.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/auth/forgot-password')) {
      return okJson({ success: true });
    }

    if (url.includes('/api/auth/verify-reset-code')) {
      return okJson({ resetToken: 'test-reset-token' });
    }

    if (url.includes('/api/auth/reset-password')) {
      return okJson({ success: true });
    }

    return okJson({});
  }) as unknown as typeof fetch;
});

function renderPage() {
  return render(<ForgotpasswordPage />);
}

async function goToVerifyStep(email = 'test@test.com') {
  renderPage();

  fireEvent.change(screen.getByPlaceholderText('email@email.com'), {
    target: { value: email },
  });

  fireEvent.click(screen.getByText('Kirim Kode'));

  expect(await screen.findByText('Kode Verifikasi')).toBeInTheDocument();
}

async function goToResetStep() {
  await goToVerifyStep();

  fireEvent.change(screen.getByPlaceholderText('______'), {
    target: { value: '123456' },
  });

  fireEvent.click(screen.getByText('Verifikasi Kode'));

  expect(await screen.findByText('Password Baru')).toBeInTheDocument();
}

describe('forgot-password module', () => {
  test('renders initial request page', () => {
    renderPage();

    expect(screen.getByText('Lupa Password')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Masukkan email terdaftar untuk menerima kode verifikasi.'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText('email@email.com')
    ).toBeInTheDocument();

    expect(screen.getByText('Kirim Kode')).toBeDisabled();

    expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
  });

  test('back button pushes login', () => {
    renderPage();

    fireEvent.click(screen.getByText('Kembali ke Login'));

    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  test('enables request button for valid email', () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('email@email.com'), {
      target: { value: 'test@test.com' },
    });

    expect(screen.getByText('Kirim Kode')).not.toBeDisabled();
  });

  test('requests code successfully', async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('email@email.com'), {
      target: { value: 'test@test.com' },
    });

    fireEvent.click(screen.getByText('Kirim Kode'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(
      await screen.findByText('Kode Verifikasi')
    ).toBeInTheDocument();

    expect(goeyToast.success).toHaveBeenCalled();
  });

  test('handles forgot password backend error', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/auth/forgot-password')) {
        return errorJson({ message: 'Email not found' }, 404);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('email@email.com'), {
      target: { value: 'test@test.com' },
    });

    fireEvent.click(screen.getByText('Kirim Kode'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalled();
    });
  });

  test('handles forgot password json parse fallback', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/auth/forgot-password')) {
        return badJsonResponse(500);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('email@email.com'), {
      target: { value: 'test@test.com' },
    });

    fireEvent.click(screen.getByText('Kirim Kode'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalled();
    });
  });

  test('handles forgot password network error', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('network'))
    ) as unknown as typeof fetch;

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('email@email.com'), {
      target: { value: 'test@test.com' },
    });

    fireEvent.click(screen.getByText('Kirim Kode'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalled();
    });
  });

  test('verifies code successfully', async () => {
    await goToVerifyStep();

    fireEvent.change(screen.getByPlaceholderText('______'), {
      target: { value: '123456' },
    });

    fireEvent.click(screen.getByText('Verifikasi Kode'));

    expect(await screen.findByText('Password Baru')).toBeInTheDocument();

    expect(goeyToast.success).toHaveBeenCalled();
  });

  test('handles verify code error', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/auth/forgot-password')) {
        return okJson({ success: true });
      }

      if (url.includes('/api/auth/verify-reset-code')) {
        return errorJson({ message: 'Wrong code' }, 400);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    await goToVerifyStep();

    fireEvent.change(screen.getByPlaceholderText('______'), {
      target: { value: '123456' },
    });

    fireEvent.click(screen.getByText('Verifikasi Kode'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalled();
    });
  });

  test('handles verify code json parse fallback', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/auth/forgot-password')) {
        return okJson({ success: true });
      }

      if (url.includes('/api/auth/verify-reset-code')) {
        return badJsonResponse(400);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    await goToVerifyStep();

    fireEvent.change(screen.getByPlaceholderText('______'), {
      target: { value: '123456' },
    });

    fireEvent.click(screen.getByText('Verifikasi Kode'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalled();
    });
  });

  test('handles verify code network error', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/auth/forgot-password')) {
        return okJson({ success: true });
      }

      if (url.includes('/api/auth/verify-reset-code')) {
        return Promise.reject(new Error('network'));
      }

      return okJson({});
    }) as unknown as typeof fetch;

    await goToVerifyStep();

    fireEvent.change(screen.getByPlaceholderText('______'), {
      target: { value: '123456' },
    });

    fireEvent.click(screen.getByText('Verifikasi Kode'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalled();
    });
  });

  test('toggles password visibility', async () => {
    await goToResetStep();

    const passwordInput =
      screen.getByPlaceholderText('Minimal 6 karakter');

    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByTestId('eye-icon'));

    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByTestId('eye-off-icon'));

    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('resets password successfully', async () => {
    await goToResetStep();

    fireEvent.change(
      screen.getByPlaceholderText('Minimal 6 karakter'),
      {
        target: { value: 'newpass123' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText('Ulangi password baru'),
      {
        target: { value: 'newpass123' },
      }
    );

    fireEvent.click(screen.getByText('Simpan Password Baru'));

    expect(
      await screen.findByText(
        'Selesai. Anda bisa login menggunakan password baru.'
      )
    ).toBeInTheDocument();

    expect(goeyToast.success).toHaveBeenCalled();
  });

  test('handles reset password error', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/auth/forgot-password')) {
        return okJson({ success: true });
      }

      if (url.includes('/api/auth/verify-reset-code')) {
        return okJson({ resetToken: 'test-reset-token' });
      }

      if (url.includes('/api/auth/reset-password')) {
        return errorJson({ message: 'Reset failed' }, 400);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    await goToResetStep();

    fireEvent.change(
      screen.getByPlaceholderText('Minimal 6 karakter'),
      {
        target: { value: 'newpass123' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText('Ulangi password baru'),
      {
        target: { value: 'newpass123' },
      }
    );

    fireEvent.click(screen.getByText('Simpan Password Baru'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalled();
    });
  });

  test('handles reset password json parse fallback', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/auth/forgot-password')) {
        return okJson({ success: true });
      }

      if (url.includes('/api/auth/verify-reset-code')) {
        return okJson({ resetToken: 'test-reset-token' });
      }

      if (url.includes('/api/auth/reset-password')) {
        return badJsonResponse(400);
      }

      return okJson({});
    }) as unknown as typeof fetch;

    await goToResetStep();

    fireEvent.change(
      screen.getByPlaceholderText('Minimal 6 karakter'),
      {
        target: { value: 'newpass123' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText('Ulangi password baru'),
      {
        target: { value: 'newpass123' },
      }
    );

    fireEvent.click(screen.getByText('Simpan Password Baru'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalled();
    });
  });
  test('disable verify button when code empty', async () => {
  await goToVerifyStep();

  const btn = screen.getByText('Verifikasi Kode');

  expect(btn).toBeDisabled();
});

test('disable reset button when password empty', async () => {
  await goToResetStep();

  const btn = screen.getByText('Simpan Password Baru');

  expect(btn).toBeDisabled();
});

test('disable reset button when confirm password mismatch', async () => {
  await goToResetStep();

  fireEvent.change(
    screen.getByPlaceholderText('Minimal 6 karakter'),
    {
      target: { value: 'password123' },
    }
  );

  fireEvent.change(
    screen.getByPlaceholderText('Ulangi password baru'),
    {
      target: { value: 'beda123' },
    }
  );

  expect(
    screen.getByText('Simpan Password Baru')
  ).toBeDisabled();
});

test('enable reset button when passwords match', async () => {
  await goToResetStep();

  fireEvent.change(
    screen.getByPlaceholderText('Minimal 6 karakter'),
    {
      target: { value: 'password123' },
    }
  );

  fireEvent.change(
    screen.getByPlaceholderText('Ulangi password baru'),
    {
      target: { value: 'password123' },
    }
  );

  expect(
    screen.getByText('Simpan Password Baru')
  ).not.toBeDisabled();
});

  test('handles reset password network error', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/auth/forgot-password')) {
        return okJson({ success: true });
      }

      if (url.includes('/api/auth/verify-reset-code')) {
        return okJson({ resetToken: 'test-reset-token' });
      }

      if (url.includes('/api/auth/reset-password')) {
        return Promise.reject(new Error('network'));
      }

      return okJson({});
    }) as unknown as typeof fetch;

    await goToResetStep();

    fireEvent.change(
      screen.getByPlaceholderText('Minimal 6 karakter'),
      {
        target: { value: 'newpass123' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText('Ulangi password baru'),
      {
        target: { value: 'newpass123' },
      }
    );

    fireEvent.click(screen.getByText('Simpan Password Baru'));

    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalled();
    });
  });

  test('requestCode with invalid email shows toast', async () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('email@email.com'), {
      target: { value: 'invalid-email' },
    });
    const btn = screen.getByText('Kirim Kode') as HTMLButtonElement;
    const fiberKey = Object.keys(btn).find(k => k.startsWith('__reactFiber'));
    if (fiberKey) {
      const fiber = (btn as any)[fiberKey];
      const props = fiber.memoizedProps || fiber.pendingProps || {};
      if (props.onClick) await props.onClick();
    }
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Email tidak valid', expect.any(Object));
    });
  });

  test('verifyCode with short code shows invalid data toast', async () => {
    await goToVerifyStep();
    fireEvent.change(screen.getByPlaceholderText('______'), {
      target: { value: '12' },
    });
    const btn = screen.getByText('Verifikasi Kode') as HTMLButtonElement;
    const fiberKey = Object.keys(btn).find(k => k.startsWith('__reactFiber'));
    if (fiberKey) {
      const fiber = (btn as any)[fiberKey];
      const props = fiber.memoizedProps || fiber.pendingProps || {};
      if (props.onClick) await props.onClick();
    }
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Data tidak valid', expect.any(Object));
    });
  });

  test('verifyCode with no resetToken in response shows toast', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/auth/forgot-password')) return okJson({ success: true });
      if (url.includes('/api/auth/verify-reset-code')) return okJson({});
      return okJson({});
    }) as unknown as typeof fetch;

    await goToVerifyStep();
    fireEvent.change(screen.getByPlaceholderText('______'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('Verifikasi Kode'));
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Gagal verifikasi', expect.any(Object));
    });
  });

  test('resetPassword shows password mismatch toast when passwords dont match', async () => {
    await goToResetStep();
    fireEvent.change(screen.getByPlaceholderText('Minimal 6 karakter'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ulangi password baru'), {
      target: { value: 'different456' },
    });
    const btn = screen.getByText('Simpan Password Baru') as HTMLButtonElement;
    const fiberKey = Object.keys(btn).find(k => k.startsWith('__reactFiber'));
    if (fiberKey) {
      const fiber = (btn as any)[fiberKey];
      const props = fiber.memoizedProps || fiber.pendingProps || {};
      if (props.onClick) await props.onClick();
    }
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Password tidak sama', expect.any(Object));
    });
  });

  test('resetPassword shows data incomplete toast when passwords too short', async () => {
    await goToResetStep();
    fireEvent.change(screen.getByPlaceholderText('Minimal 6 karakter'), {
      target: { value: 'abc' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ulangi password baru'), {
      target: { value: 'abc' },
    });
    const btn = screen.getByText('Simpan Password Baru') as HTMLButtonElement;
    const fiberKey = Object.keys(btn).find(k => k.startsWith('__reactFiber'));
    if (fiberKey) {
      const fiber = (btn as any)[fiberKey];
      const props = fiber.memoizedProps || fiber.pendingProps || {};
      if (props.onClick) await props.onClick();
    }
    await waitFor(() => {
      expect(goeyToast.error).toHaveBeenCalledWith('Data belum lengkap', expect.any(Object));
    });
  });

  test('ganti email button resets step to request', async () => {
    await goToVerifyStep();
    fireEvent.click(screen.getByText('Ganti email'));
    expect(await screen.findByText('Kirim Kode')).toBeInTheDocument();
  });

  test('covers done step button onClick handler line 296', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/auth/forgot-password')) return okJson({ success: true });
      if (url.includes('/api/auth/verify-reset-code')) return okJson({ resetToken: 'test-reset-token' });
      if (url.includes('/api/auth/reset-password')) return okJson({ success: true });
      return okJson({});
    }) as unknown as typeof fetch;

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('email@email.com'), { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByText('Kirim Kode'));
    await screen.findByText('Kode Verifikasi');

    fireEvent.change(screen.getByPlaceholderText('______'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verifikasi Kode'));
    await screen.findByText('Password Baru');

    fireEvent.change(screen.getByPlaceholderText('Minimal 6 karakter'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByPlaceholderText('Ulangi password baru'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByText('Simpan Password Baru'));

    const kembaliBtns = await screen.findAllByText('Kembali ke Login');
    fireEvent.click(kembaliBtns[kembaliBtns.length - 1]);
    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  test('done step kembali ke login button navigates to /login', async () => {
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/auth/forgot-password')) return okJson({ success: true });
      if (url.includes('/api/auth/verify-reset-code')) return okJson({ resetToken: 'test-reset-token' });
      if (url.includes('/api/auth/reset-password')) return okJson({ success: true });
      return okJson({});
    }) as unknown as typeof fetch;

    await goToResetStep();
    fireEvent.change(screen.getByPlaceholderText('Minimal 6 karakter'), {
      target: { value: 'newpass123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ulangi password baru'), {
      target: { value: 'newpass123' },
    });
    fireEvent.click(screen.getByText('Simpan Password Baru'));

    const kembaliBtns = await screen.findAllByText('Kembali ke Login');
    const doneBtn = kembaliBtns[kembaliBtns.length - 1];
    fireEvent.click(doneBtn);
    expect(pushMock).toHaveBeenCalledWith('/login');
  });
});