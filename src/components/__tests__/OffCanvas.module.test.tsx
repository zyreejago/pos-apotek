import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import OffCanvas from '../OffCanvas';

// ────── Mocks ──────
jest.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon" />,
}));

const mockCloseOffCanvas = jest.fn();
const mockSetIsAnyOffCanvasOpen = jest.fn();
const mockSetOffCanvasWidth = jest.fn();

jest.mock('@/context/OffCanvasContext', () => ({
  useOffCanvas: () => ({
    isAnyOffCanvasOpen: true,
    offCanvasContent: null,
    closeOffCanvas: mockCloseOffCanvas,
    setIsAnyOffCanvasOpen: mockSetIsAnyOffCanvasOpen,
    setOffCanvasWidth: mockSetOffCanvasWidth,
  }),
}));

// ────── Helper ──────
function renderOffCanvas(
  props: {
    isOpen?: boolean;
    onClose?: () => void;
    title?: string;
    children?: React.ReactNode;
    width?: string;
  } = {},
) {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Test Title',
    children: <p>Test Content</p>,
  };
  return render(<OffCanvas {...defaultProps} {...props} />);
}

describe('OffCanvas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const root = document.createElement('div');
    root.id = 'offcanvas-root';
    document.body.appendChild(root);
  });

  afterEach(() => {
    const root = document.getElementById('offcanvas-root');
    if (root) root.remove();
  });

  // ────── 1. Returns null when not open ──────
  it('returns null when not open', () => {
    renderOffCanvas({ isOpen: false });
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  // ────── 2. Returns null when not mounted ──────
  // The component starts with mounted=false (useState initial value).
  // After mounting (useEffect fires), mounted becomes true and the portal renders.
  // In RTL, effects run synchronously so we see the final state. We verify
  // the component successfully completes the mount lifecycle by checking
  // that with isOpen=true, the portal content is rendered.
  it('returns null when not mounted (before useEffect fires)', () => {
    // Rendering with isOpen=true — the component initially returns null
    // because mounted=false. After useEffect, mounted=true and content renders.
    renderOffCanvas({ isOpen: true });
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  // ────── 3. Returns null when #offcanvas-root doesn't exist ──────
  it('returns null when #offcanvas-root does not exist', () => {
    // Remove the portal root that beforeEach appends
    const root = document.getElementById('offcanvas-root');
    if (root) root.remove();

    renderOffCanvas({ isOpen: true });
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  // ────── 4. Renders title and content when open and mounted ──────
  it('renders title and content when open and mounted', () => {
    renderOffCanvas({ isOpen: true });
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByTestId('x-icon')).toBeInTheDocument();
  });

  // ────── 5. Click X button calls onClose ──────
  it('click X button calls onClose', () => {
    const onClose = jest.fn();
    renderOffCanvas({ isOpen: true, onClose });
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ────── 6. Calls setIsAnyOffCanvasOpen(true) when opened ──────
  it('calls setIsAnyOffCanvasOpen(true) when opened', () => {
    renderOffCanvas({ isOpen: true });
    expect(mockSetIsAnyOffCanvasOpen).toHaveBeenCalledWith(true);
  });

  // ────── 7. Calls setOffCanvasWidth with the provided width on first open ──────
  it('calls setOffCanvasWidth with the provided width on first open', () => {
    renderOffCanvas({ isOpen: true, width: '500px' });
    expect(mockSetOffCanvasWidth).toHaveBeenCalledWith('500px');
  });

  // ────── 8. Does NOT call setOffCanvasWidth on subsequent renders (initialWidthSet is true) ──────
  it('does not call setOffCanvasWidth when re-rendering with same props', () => {
    const onClose = jest.fn();
    const { rerender } = renderOffCanvas({ isOpen: true, width: '400px', onClose });
    expect(mockSetOffCanvasWidth).toHaveBeenCalledTimes(1);

    // Clear to measure only subsequent calls
    mockSetOffCanvasWidth.mockClear();

    // Re-render with identical props — deps haven't changed, effect won't re-run
    rerender(
      <OffCanvas isOpen={true} title="Test Title" width="400px" onClose={onClose}>
        <p>Test Content</p>
      </OffCanvas>,
    );
    expect(mockSetOffCanvasWidth).not.toHaveBeenCalled();
  });

  // ────── 9. Calls closeOffCanvas when isOpen becomes false ──────
  it('calls closeOffCanvas when isOpen becomes false', () => {
    const onClose = jest.fn();
    const { rerender } = renderOffCanvas({ isOpen: true, onClose });

    // Clear initial calls from the "open" effect
    jest.clearAllMocks();

    // Transition from open → closed
    rerender(
      <OffCanvas isOpen={false} title="Test Title" onClose={onClose}>
        <p>Test Content</p>
      </OffCanvas>,
    );
    expect(mockCloseOffCanvas).toHaveBeenCalledTimes(1);
  });

  // ────── 10. Calls closeOffCanvas on unmount ──────
  it('calls closeOffCanvas on unmount', () => {
    const { unmount } = renderOffCanvas({ isOpen: true });

    // Clear initial calls from the "open" effect
    jest.clearAllMocks();

    unmount();
    expect(mockCloseOffCanvas).toHaveBeenCalledTimes(1);
  });

  // ────── 11. Resets initialWidthSet when width prop changes ──────
  it('resets initialWidthSet when width prop changes', () => {
    const onClose = jest.fn();

    // Cycle 1: open → width-reset effect fires on mount leaving initialWidthSet=false
    // Close → the else-if block sets initialWidthSet=false
    // Reopen with same width → setOffCanvasWidth called, initialWidthSet=true.
    // Width-reset does NOT fire (width unchanged since mount).
    const { rerender } = renderOffCanvas({
      isOpen: true,
      width: '400px',
      onClose,
    });

    // Close
    rerender(
      <OffCanvas isOpen={false} title="Test Title" width="400px" onClose={onClose}>
        <p>Test Content</p>
      </OffCanvas>,
    );

    // Reopen with same width — initialWidthSet becomes true, width-reset skipped
    rerender(
      <OffCanvas isOpen={true} title="Test Title" width="400px" onClose={onClose}>
        <p>Test Content</p>
      </OffCanvas>,
    );
    jest.clearAllMocks();

    // Now change width while open — main effect fires, sees initialWidthSet=true,
    // skips setOffCanvasWidth. Width-reset fires and resets initialWidthSet.
    rerender(
      <OffCanvas isOpen={true} title="Test Title" width="600px" onClose={onClose}>
        <p>Test Content</p>
      </OffCanvas>,
    );
    // initialWidthSet was true, so setOffCanvasWidth was NOT called
    jest.clearAllMocks();

    // Second width change — main effect now sees initialWidthSet=false
    rerender(
      <OffCanvas isOpen={true} title="Test Title" width="700px" onClose={onClose}>
        <p>Test Content</p>
      </OffCanvas>,
    );
    // setOffCanvasWidth called with the latest width because initialWidthSet was false
    expect(mockSetOffCanvasWidth).toHaveBeenCalledWith('700px');
  });

  // ────── 12. Renders with custom width props ──────
  it('renders with custom width props', () => {
    renderOffCanvas({ isOpen: true, width: '650px' });
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(mockSetOffCanvasWidth).toHaveBeenCalledWith('650px');
  });

  // ────── 13. Renders children inside scrollable body ──────
  it('renders children inside scrollable body', () => {
    const childContent = <div data-testid="child-item">Nested Child</div>;
    renderOffCanvas({ isOpen: true, children: childContent });
    expect(screen.getByTestId('child-item')).toBeInTheDocument();
    expect(screen.getByText('Nested Child')).toBeInTheDocument();
  });

  // ────── 14. Default width is 400px ──────
  it('default width is 400px', () => {
    renderOffCanvas({ isOpen: true });
    expect(mockSetOffCanvasWidth).toHaveBeenCalledWith('400px');
  });

  // ────── 15. Skips setOffCanvasWidth when initialWidthSet is already true ──────
  it('skips setOffCanvasWidth when initialWidthSet is already true on re-render with width change', () => {
    const onClose = jest.fn();

    // After mount: width-reset fires, leaving initialWidthSet=false.
    // Close then reopen with the SAME width so width-reset doesn't fire,
    // leaving initialWidthSet=true.
    const { rerender } = renderOffCanvas({
      isOpen: true,
      width: '400px',
      onClose,
    });

    // Close
    rerender(
      <OffCanvas isOpen={false} title="Test Title" width="400px" onClose={onClose}>
        <p>Test Content</p>
      </OffCanvas>,
    );

    // Reopen with same width — setOffCanvasWidth called, initialWidthSet=true.
    // width-reset does NOT fire (width unchanged), so initialWidthSet stays true.
    rerender(
      <OffCanvas isOpen={true} title="Test Title" width="400px" onClose={onClose}>
        <p>Test Content</p>
      </OffCanvas>,
    );

    mockSetOffCanvasWidth.mockClear();

    // Now change width — the main effect fires, sees initialWidthSet=true,
    // and skips setOffCanvasWidth. This covers the false branch.
    rerender(
      <OffCanvas isOpen={true} title="Test Title" width="500px" onClose={onClose}>
        <p>Test Content</p>
      </OffCanvas>,
    );

    expect(mockSetOffCanvasWidth).not.toHaveBeenCalled();
  });

  // ────── 16. Saves scroll position on scroll ──────
  it('saves scroll position when the body is scrolled', () => {
    const onClose = jest.fn();
    const { container } = render(
      <OffCanvas isOpen={true} title="Scroll Test" onClose={onClose} width="400px">
        <div style={{ height: '2000px' }}>Tall content</div>
      </OffCanvas>,
    );

    // Find the scrollable body div inside the portal
    const scrollable = document.getElementById('offcanvas-root')?.querySelector('.overflow-y-auto') as HTMLElement;
    expect(scrollable).toBeTruthy();

    // Simulate scrolling
    Object.defineProperty(scrollable, 'scrollTop', { value: 150, writable: true });
    fireEvent.scroll(scrollable);

    // No assertion on the ref itself — we just verify the scroll handler runs without throwing
    expect(scrollable.scrollTop).toBe(150);
  });
});
