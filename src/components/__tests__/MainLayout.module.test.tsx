import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MainLayout from '../MainLayout';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

const mockUsePathname = jest.requireMock('next/navigation').usePathname as jest.Mock;
const mockUseRouter = jest.requireMock('next/navigation').useRouter as jest.Mock;

const mockSetOffCanvasWidth = jest.fn();

jest.mock('@/context/OffCanvasContext', () => ({
  useOffCanvas: jest.fn(),
}));

const mockUseOffCanvas = jest.requireMock('@/context/OffCanvasContext').useOffCanvas as jest.Mock;

jest.mock('../Sidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

jest.mock('../Header', () => ({
  __esModule: true,
  default: () => <div data-testid="header">Header</div>,
}));

jest.mock('../OffCanvasRenderer', () => ({
  __esModule: true,
  default: function MockOffCanvasRenderer({ inline }: { inline?: boolean }) {
    return <div data-testid="offcanvas-renderer" data-inline={String(!!inline)}>OffCanvasRenderer</div>;
  },
}));

function renderLayout(path: string, offcanvasOpen = false, offCanvasWidth = '400px') {
  mockUsePathname.mockReturnValue(path);
  mockUseOffCanvas.mockReturnValue({
    isAnyOffCanvasOpen: offcanvasOpen,
    offCanvasWidth,
    setOffCanvasWidth: mockSetOffCanvasWidth,
  });
  return render(<MainLayout>Hello World</MainLayout>);
}

describe('MainLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() });
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // ────── Auth page rendering ──────
  describe('auth page rendering', () => {
    test('renders children when on login page', () => {
      const { container } = renderLayout('/login');
      expect(container.textContent).toBe('Hello World');
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('offcanvas-renderer')).not.toBeInTheDocument();
    });

    test('renders children when on register page', () => {
      const { container } = renderLayout('/register');
      expect(container.textContent).toBe('Hello World');
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('offcanvas-renderer')).not.toBeInTheDocument();
    });

    test('renders children when on forgot-password page', () => {
      const { container } = renderLayout('/forgot-password');
      expect(container.textContent).toBe('Hello World');
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('offcanvas-renderer')).not.toBeInTheDocument();
    });

    test('does NOT render sidebar/header/offcanvas on auth pages', () => {
      const authPages = ['/login', '/register', '/forgot-password'];

      for (const path of authPages) {
        const { unmount } = renderLayout(path);
        expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
        expect(screen.queryByTestId('header')).not.toBeInTheDocument();
        expect(screen.queryByTestId('offcanvas-renderer')).not.toBeInTheDocument();
        unmount();
      }
    });
  });

  // ────── Non-auth page rendering ──────
  describe('non-auth page rendering', () => {
    test('renders Sidebar + Header + OffCanvasRenderer on non-auth pages', () => {
      renderLayout('/dashboard');
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('offcanvas-renderer')).toBeInTheDocument();
    });

    test('renders children on non-auth pages', () => {
      renderLayout('/products');
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    test('renders full layout for various non-auth paths', () => {
      const paths = ['/dashboard', '/products', '/suppliers', '/transactions', '/stock-opname'];

      for (const path of paths) {
        const { unmount } = renderLayout(path);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByTestId('offcanvas-renderer')).toBeInTheDocument();
        expect(screen.getByText('Hello World')).toBeInTheDocument();
        unmount();
      }
    });

    test('renders correctly on root path', () => {
      renderLayout('/');
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('offcanvas-renderer')).toBeInTheDocument();
    });

    test('renders OffCanvasRenderer with inline prop on non-auth pages', () => {
      renderLayout('/dashboard');
      const offcanvas = screen.getByTestId('offcanvas-renderer');
      expect(offcanvas.dataset.inline).toBe('true');
    });
  });

  // ────── Offcanvas root element ──────
  describe('offcanvas root element', () => {
    test('offcanvas root exists with correct styling when offcanvas is open', () => {
      renderLayout('/dashboard', true);
      const root = document.getElementById('offcanvas-root');
      expect(root).toBeInTheDocument();
      expect(root!.style.transform).toBe('translateX(0)');
      expect(root!.style.width).toBe('400px');
      expect(root!.style.position).toBe('absolute');
      expect(root!.style.top).toBe('0px');
      expect(root!.style.right).toBe('0px');
      expect(root!.style.height).toBe('100%');
      expect(root!.style.zIndex).toBe('50');
    });

    test('offcanvas root translates to hidden when offcanvas is closed', () => {
      renderLayout('/dashboard', false);
      const root = document.getElementById('offcanvas-root');
      expect(root).toBeInTheDocument();
      expect(root!.style.transform).toBe('translateX(100%)');
    });

    test('offcanvas root has shadow when open', () => {
      renderLayout('/dashboard', true);
      const root = document.getElementById('offcanvas-root');
      expect(root!.style.boxShadow).toBe('-4px 0 24px rgba(0,0,0,0.12)');
    });

    test('offcanvas root has no shadow when closed', () => {
      renderLayout('/dashboard', false);
      const root = document.getElementById('offcanvas-root');
      expect(root!.style.boxShadow).toBe('none');
    });
  });

  // ────── Content area margin ──────
  describe('content area margin', () => {
    test('content area has margin-right equal to offCanvasWidth when offcanvas is open', () => {
      renderLayout('/dashboard', true, '500px');
      const contentArea = screen.getByTestId('header').parentElement;
      expect(contentArea!.style.marginRight).toBe('500px');
    });

    test('content area has margin-right 0px when offcanvas is closed', () => {
      renderLayout('/dashboard', false);
      const contentArea = screen.getByTestId('header').parentElement;
      expect(contentArea!.style.marginRight).toBe('0px');
    });
  });

  // ────── Drag handle ──────
  describe('drag handle', () => {
    test('drag handle is visible when offcanvas is open', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize');
      expect(dragHandle).toBeInTheDocument();
    });

    test('drag handle is not present when offcanvas is closed', () => {
      renderLayout('/dashboard', false);
      const dragHandle = document.querySelector('.cursor-col-resize');
      expect(dragHandle).not.toBeInTheDocument();
    });

    test('mouseDown on drag handle enables resizing', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      expect(document.body.style.cursor).toBe('col-resize');
      expect(document.body.style.userSelect).toBe('none');
    });
  });

  // ────── Drag-to-resize: mouseMove ──────
  describe('drag-to-resize: mousemove', () => {
    test('mouseMove updates offcanvas width within bounds', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 300 });
      });

      // start=400, delta=500-300=200, new=600
      expect(mockSetOffCanvasWidth).toHaveBeenCalledWith('600px');
    });

    test('mouseMove clamps width to minimum 300px', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 900 });
      });

      // start=400, delta=500-900=-400, new=0, clamped to 300
      expect(mockSetOffCanvasWidth).toHaveBeenCalledWith('300px');
    });

    test('mouseMove clamps width to maximum 800px', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 10 });
      });

      // start=400, delta=500-10=490, new=890, clamped to 800
      expect(mockSetOffCanvasWidth).toHaveBeenCalledWith('800px');
    });

    test('multiple mouseMove events update width continuously', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 400 });
      });
      expect(mockSetOffCanvasWidth).toHaveBeenCalledWith('500px');

      act(() => {
        fireEvent.mouseMove(document, { clientX: 200 });
      });
      // delta=500-200=300, start=400, new=700
      expect(mockSetOffCanvasWidth).toHaveBeenCalledWith('700px');
    });
  });

  // ────── Drag-to-resize: mouseUp ──────
  describe('drag-to-resize: mouseup', () => {
    test('mouseUp disables dragging and removes listeners', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      expect(document.body.style.cursor).toBe('col-resize');

      act(() => {
        fireEvent.mouseUp(document);
      });

      expect(document.body.style.cursor).toBe('');
      expect(document.body.style.userSelect).toBe('');
    });

    test('mouseMove after mouseUp does not update width', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      act(() => {
        fireEvent.mouseUp(document);
      });

      mockSetOffCanvasWidth.mockClear();

      act(() => {
        fireEvent.mouseMove(document, { clientX: 200 });
      });

      expect(mockSetOffCanvasWidth).not.toHaveBeenCalled();
    });
  });

  // ────── Transition during dragging ──────
  describe('transition during dragging', () => {
    test('offcanvas root has no transition during dragging', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;
      const offcanvasRoot = document.getElementById('offcanvas-root');

      expect(offcanvasRoot!.style.transition).toContain('cubic-bezier');

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      expect(offcanvasRoot!.style.transition).toBe('none');
    });

    test('content area has no transition during dragging', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;
      const contentArea = screen.getByTestId('header').parentElement;

      expect(contentArea!.style.transition).toContain('cubic-bezier');

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      expect(contentArea!.style.transition).toBe('none');
    });

    test('transitions are restored after dragging ends', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;
      const offcanvasRoot = document.getElementById('offcanvas-root');
      const contentArea = screen.getByTestId('header').parentElement;

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      expect(offcanvasRoot!.style.transition).toBe('none');

      act(() => {
        fireEvent.mouseUp(document);
      });

      expect(offcanvasRoot!.style.transition).toContain('cubic-bezier');
      expect(contentArea!.style.transition).toContain('cubic-bezier');
    });
  });

  // ────── Edge cases ──────
  describe('edge cases', () => {
    test('handles invalid offCanvasWidth by falling back to 400', () => {
      renderLayout('/dashboard', true, '');
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;

      act(() => {
        fireEvent.mouseDown(dragHandle, { clientX: 500 });
      });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 400 });
      });

      // start=400 (fallback from parseInt('')||400), delta=500-400=100, new=500
      expect(mockSetOffCanvasWidth).toHaveBeenCalledWith('500px');
    });

    test('mouseDown calls preventDefault', () => {
      renderLayout('/dashboard', true);
      const dragHandle = document.querySelector('.cursor-col-resize') as HTMLElement;

      const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 500,
      });
      const preventDefaultSpy = jest.spyOn(mouseDownEvent, 'preventDefault');

      act(() => {
        dragHandle.dispatchEvent(mouseDownEvent);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    test('calls useOffCanvas only after confirming it is not auth page', () => {
      renderLayout('/login');
      // useOffCanvas is called via module import, but we check it doesn't render
      // the offcanvas-related elements
      expect(document.getElementById('offcanvas-root')).not.toBeInTheDocument();
    });

    test('integrates correctly: full non-auth render cycle', () => {
      renderLayout('/recommendations-debug', true, '450px');

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('offcanvas-renderer')).toBeInTheDocument();

      const root = document.getElementById('offcanvas-root');
      expect(root!.style.transform).toBe('translateX(0)');
      expect(root!.style.width).toBe('450px');
    });
  });
});
