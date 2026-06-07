import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { OffCanvasProvider } from '@/context/OffCanvasContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { HeaderProvider } from '@/context/HeaderContext';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <OffCanvasProvider>
      <SidebarProvider>
        <HeaderProvider>
          {ui}
        </HeaderProvider>
      </SidebarProvider>
    </OffCanvasProvider>
  );
}

import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import ProfileDropdown from '@/components/ProfileDropdown';
import ConfirmModal from '@/components/ConfirmModal';
import AuthProvider from '@/components/AuthProvider';
import { GoeyToaster } from '@/components/ui/goey-toaster';
import { goeyToast } from '@/components/ui/goey-toaster';

jest.mock('@/components/AuthProvider', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { id: 1, role: 'superadmin' },
    authHeaders: { 'Authorization': 'Bearer test' },
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: () => '/',
}));

const mockPush = jest.fn();
jest.requireMock('next/navigation').useRouter.mockReturnValue({ push: mockPush });

jest.mock('next/link', () => {
  return function Link({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
    return <a href={href} onClick={onClick}>{children}</a>;
  };
});

jest.mock('@/hooks/useRequirePermission', () => ({
  useRequirePermission: () => ({
    loading: false,
    hasPermission: true,
    permissions: [],
    checkActionPermission: () => true,
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

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

beforeEach(() => {
  localStorage.setItem('token', 'test');
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' }));
  jest.clearAllMocks();

  global.fetch = jest.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/api/profile')) return okJson({ id: 1, username: 'test', role: 'superadmin', email: 'test@test.com' });
    return okJson({});
  }) as unknown as typeof fetch;
});

describe('components module', () => {
  test('renders Header', () => {
    expect(() => renderWithProviders(<Header />)).not.toThrow();
  });

  test('renders Sidebar', () => {
    expect(() => renderWithProviders(<Sidebar />)).not.toThrow();
  });

  test('renders GoeyToaster', () => {
    expect(() => renderWithProviders(<GoeyToaster />)).not.toThrow();
  });

  test('renders AuthProvider', () => {
    expect(() => renderWithProviders(<AuthProvider><div /></AuthProvider>)).not.toThrow();
  });

  test('ProfileDropdown toggles open/close', () => {
    const { getByText, queryByText } = renderWithProviders(<ProfileDropdown />);
    expect(queryByText("My Account")).not.toBeInTheDocument();
    
    const btn = document.querySelector('button[class*="w-10 h-10"]');
    if (btn) fireEvent.click(btn);
    
    expect(getByText("My Account")).toBeInTheDocument();
    
    if (btn) fireEvent.click(btn);
    expect(queryByText("My Account")).not.toBeInTheDocument();
  });

  test('ProfileDropdown closes when clicking outside', () => {
    const { getByText } = renderWithProviders(<ProfileDropdown />);
    const btn = document.querySelector('button[class*="w-10 h-10"]');
    if (btn) fireEvent.click(btn);
    
    expect(getByText("My Account")).toBeInTheDocument();
    
    fireEvent.mouseDown(document.body);
    expect(document.querySelector(".absolute.right-0")).not.toBeInTheDocument();
  });

  test('ProfileDropdown handles logout', () => {
    const { getByText } = renderWithProviders(<ProfileDropdown />);
    const btn = document.querySelector('button[class*="w-10 h-10"]');
    if (btn) fireEvent.click(btn);
    
    const logoutBtn = getByText("Logout");
    fireEvent.click(logoutBtn);
    
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(goeyToast.success).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  test('ProfileDropdown Profile link closes dropdown', () => {
    const { getByText, container } = renderWithProviders(<ProfileDropdown />);
    const btn = document.querySelector('button[class*="w-10 h-10"]');
    if (btn) fireEvent.click(btn);
    
    expect(getByText("My Account")).toBeInTheDocument();

    const profileLink = getByText("Profile");
    fireEvent.click(profileLink);
    
    expect(container.querySelector(".absolute.right-0")).not.toBeInTheDocument();
  });









  test('ConfirmModal is null when isOpen is false', () => {
    const { container } = renderWithProviders(
      <ConfirmModal 
        isOpen={false} 
        onConfirm={jest.fn()} 
        onClose={jest.fn()} 
        title="Test" 
        message="Test" 
      />
    );
    expect(container.firstChild).toBeNull();
  });

  test('ConfirmModal renders danger variant', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByText } = renderWithProviders(
      <ConfirmModal 
        isOpen={true} 
        variant="danger"
        onConfirm={onConfirm} 
        onClose={onClose} 
        title="Test Title" 
        message="Test Message" 
        confirmText="Yes"
        cancelText="No"
      />
    );
    expect(getByText("Test Title")).toBeInTheDocument();
    expect(getByText("Test Message")).toBeInTheDocument();
    expect(getByText("Yes")).toBeInTheDocument();
    expect(getByText("No")).toBeInTheDocument();
    
    fireEvent.click(getByText("Yes"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    
    fireEvent.click(getByText("No"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('ConfirmModal renders warning variant', () => {
    const { getByText } = renderWithProviders(
      <ConfirmModal 
        isOpen={true} 
        variant="warning"
        onConfirm={jest.fn()} 
        onClose={jest.fn()} 
        title="Warning" 
        message="Warning message" 
      />
    );
    expect(getByText("Warning")).toBeInTheDocument();
  });

  test('ConfirmModal renders info variant', () => {
    const { getByText } = renderWithProviders(
      <ConfirmModal 
        isOpen={true} 
        variant="info"
        onConfirm={jest.fn()} 
        onClose={jest.fn()} 
        title="Info" 
        message="Info message" 
      />
    );
    expect(getByText("Info")).toBeInTheDocument();
  });

  test('ConfirmModal shows loading state', () => {
    const { getByRole } = renderWithProviders(
      <ConfirmModal 
        isOpen={true} 
        isLoading={true}
        onConfirm={jest.fn()} 
        onClose={jest.fn()} 
        title="Loading" 
        message="Please wait" 
      />
    );
    const confirmBtn = getByRole('button', { name: /Confirm/i });
    expect(confirmBtn).toBeDisabled();
  });

  test('ConfirmModal close via X button', () => {
    const onClose = jest.fn();
    const { container } = renderWithProviders(
      <ConfirmModal 
        isOpen={true} 
        onConfirm={jest.fn()} 
        onClose={onClose} 
        title="Test" 
        message="Test" 
      />
    );
    const closeBtn = container.querySelector('button[class*="text-gray-400"]');
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
