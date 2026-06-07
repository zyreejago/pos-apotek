import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardShortcutsProvider, useKeyboardShortcuts } from '../KeyboardShortcutsContext';

const pushMock = jest.fn();
const toggleSidebarMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('../SidebarContext', () => ({
  useSidebar: () => ({ toggleSidebar: toggleSidebarMock }),
}));

function SearchRefSetter({ ref }: { ref: React.MutableRefObject<HTMLInputElement | null> }) {
  const { setSearchInputRef } = useKeyboardShortcuts();
  React.useEffect(() => {
    setSearchInputRef(ref);
  }, [setSearchInputRef, ref]);
  return null;
}

describe('KeyboardShortcutsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ---------------------------------------------------------------------------
  // 1. Renders children inside provider
  // ---------------------------------------------------------------------------
  test('renders children inside provider', () => {
    render(
      <KeyboardShortcutsProvider>
        <div data-testid="child">Hello</div>
      </KeyboardShortcutsProvider>
    );
    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  // ---------------------------------------------------------------------------
  // 2. setSearchInputRef updates the ref
  // ---------------------------------------------------------------------------
  test('setSearchInputRef updates the ref', () => {
    function TestComp() {
      const { searchInputRef, setSearchInputRef } = useKeyboardShortcuts();
      return (
        <>
          <span data-testid="ref-value">
            {searchInputRef.current instanceof HTMLInputElement ? 'set' : 'null'}
          </span>
          <button
            onClick={() =>
              setSearchInputRef({ current: document.createElement('input') })
            }
          >
            Set
          </button>
        </>
      );
    }

    render(
      <KeyboardShortcutsProvider>
        <TestComp />
      </KeyboardShortcutsProvider>
    );

    expect(screen.getByTestId('ref-value').textContent).toBe('null');
    fireEvent.click(screen.getByText('Set'));
    expect(screen.getByTestId('ref-value').textContent).toBe('set');
  });

  // ---------------------------------------------------------------------------
  // 3. searchInputRef is null by default
  // ---------------------------------------------------------------------------
  test('searchInputRef is null by default', () => {
    function TestComp() {
      const { searchInputRef } = useKeyboardShortcuts();
      return (
        <span data-testid="ref-value">{String(searchInputRef.current)}</span>
      );
    }

    render(
      <KeyboardShortcutsProvider>
        <TestComp />
      </KeyboardShortcutsProvider>
    );

    expect(screen.getByTestId('ref-value').textContent).toBe('null');
  });

  // ---------------------------------------------------------------------------
  // 4. Ctrl+B calls toggleSidebar and prevents default
  // ---------------------------------------------------------------------------
  test('Ctrl+B calls toggleSidebar and prevents default', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    const event = new KeyboardEvent('keydown', {
      key: 'b',
      ctrlKey: true,
      bubbles: true,
    });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(toggleSidebarMock).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 5. Cmd+B calls toggleSidebar and prevents default
  // ---------------------------------------------------------------------------
  test('Cmd+B calls toggleSidebar and prevents default', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    const event = new KeyboardEvent('keydown', {
      key: 'b',
      metaKey: true,
      bubbles: true,
    });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(toggleSidebarMock).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 6. Number key 1 navigates to /dashboard
  // ---------------------------------------------------------------------------
  test('number key 1 navigates to /dashboard', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '1' });
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
  });

  // ---------------------------------------------------------------------------
  // 7. Number key 2 navigates to /products
  // ---------------------------------------------------------------------------
  test('number key 2 navigates to /products', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '2' });
    expect(pushMock).toHaveBeenCalledWith('/products');
  });

  // ---------------------------------------------------------------------------
  // 8. Number key 3 navigates to /stock-opname
  // ---------------------------------------------------------------------------
  test('number key 3 navigates to /stock-opname', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '3' });
    expect(pushMock).toHaveBeenCalledWith('/stock-opname');
  });

  // ---------------------------------------------------------------------------
  // 9. Number key 4 navigates to /suppliers
  // ---------------------------------------------------------------------------
  test('number key 4 navigates to /suppliers', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '4' });
    expect(pushMock).toHaveBeenCalledWith('/suppliers');
  });

  // ---------------------------------------------------------------------------
  // 10. Number key 5 navigates to /prescriptions
  // ---------------------------------------------------------------------------
  test('number key 5 navigates to /prescriptions', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '5' });
    expect(pushMock).toHaveBeenCalledWith('/prescriptions');
  });

  // ---------------------------------------------------------------------------
  // 11. Number key 6 navigates to /transactions
  // ---------------------------------------------------------------------------
  test('number key 6 navigates to /transactions', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '6' });
    expect(pushMock).toHaveBeenCalledWith('/transactions');
  });

  // ---------------------------------------------------------------------------
  // 12. Number key 7 navigates to /users
  // ---------------------------------------------------------------------------
  test('number key 7 navigates to /users', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '7' });
    expect(pushMock).toHaveBeenCalledWith('/users');
  });

  // ---------------------------------------------------------------------------
  // 13. Number key 8 navigates to /recommendations
  // ---------------------------------------------------------------------------
  test('number key 8 navigates to /recommendations', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '8' });
    expect(pushMock).toHaveBeenCalledWith('/recommendations');
  });

  // ---------------------------------------------------------------------------
  // 14. Number key does NOT navigate when target is INPUT
  // ---------------------------------------------------------------------------
  test('number key does NOT navigate when target is INPUT', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: '1' });
    expect(pushMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 15. Number key does NOT navigate when target is TEXTAREA
  // ---------------------------------------------------------------------------
  test('number key does NOT navigate when target is TEXTAREA', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    fireEvent.keyDown(textarea, { key: '2' });
    expect(pushMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 16. Number key does NOT navigate when target is SELECT
  // ---------------------------------------------------------------------------
  test('number key does NOT navigate when target is SELECT', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    const select = document.createElement('select');
    document.body.appendChild(select);
    select.focus();

    fireEvent.keyDown(select, { key: '3' });
    expect(pushMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 17. Number key does NOT navigate when target is contentEditable
  // ---------------------------------------------------------------------------
  test('number key does NOT navigate when target is contentEditable', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    const editableDiv = document.createElement('div');
    editableDiv.setAttribute('contenteditable', 'true');
    Object.defineProperty(editableDiv, 'isContentEditable', { value: true });
    document.body.appendChild(editableDiv);
    (editableDiv as HTMLElement).focus();

    const event = new KeyboardEvent('keydown', { key: '4', bubbles: true });
    editableDiv.dispatchEvent(event);
    expect(pushMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 18. Number key does NOT navigate when ctrlKey is true
  // ---------------------------------------------------------------------------
  test('number key does NOT navigate when ctrlKey is true', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '1', ctrlKey: true });
    expect(pushMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 19. Number key does NOT navigate when metaKey is true
  // ---------------------------------------------------------------------------
  test('number key does NOT navigate when metaKey is true', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '2', metaKey: true });
    expect(pushMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 20. Number key does NOT navigate when altKey is true
  // ---------------------------------------------------------------------------
  test('number key does NOT navigate when altKey is true', () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '3', altKey: true });
    expect(pushMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 21. "/" focuses and selects search input, prevents default
  // ---------------------------------------------------------------------------
  test('"/" focuses and selects search input, prevents default', () => {
    const mockInput = document.createElement('input');
    const focusSpy = jest.spyOn(mockInput, 'focus');
    const selectSpy = jest.spyOn(mockInput, 'select');
    const ref = { current: mockInput };

    render(
      <KeyboardShortcutsProvider>
        <SearchRefSetter ref={ref} />
      </KeyboardShortcutsProvider>
    );

    const event = new KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
    });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(focusSpy).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 22. Ctrl+K focuses and selects search input, prevents default
  // ---------------------------------------------------------------------------
  test('Ctrl+K focuses and selects search input, prevents default', () => {
    const mockInput = document.createElement('input');
    const focusSpy = jest.spyOn(mockInput, 'focus');
    const selectSpy = jest.spyOn(mockInput, 'select');
    const ref = { current: mockInput };

    render(
      <KeyboardShortcutsProvider>
        <SearchRefSetter ref={ref} />
      </KeyboardShortcutsProvider>
    );

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(focusSpy).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 23. Alpha key focuses search input (no preventDefault)
  // ---------------------------------------------------------------------------
  test('alpha key focuses search input (no preventDefault)', () => {
    const mockInput = document.createElement('input');
    const focusSpy = jest.spyOn(mockInput, 'focus');
    const ref = { current: mockInput };

    render(
      <KeyboardShortcutsProvider>
        <SearchRefSetter ref={ref} />
      </KeyboardShortcutsProvider>
    );

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
    });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(focusSpy).toHaveBeenCalled();
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 24. Alpha key does NOT focus when no searchInputRef set
  // ---------------------------------------------------------------------------
  test('alpha key does NOT focus when no searchInputRef set', () => {
    const mockInput = document.createElement('input');
    const focusSpy = jest.spyOn(mockInput, 'focus');

    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: 'a' });

    expect(focusSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 25. "/" does NOT focus when no searchInputRef set
  // ---------------------------------------------------------------------------
  test('"/" does NOT focus when no searchInputRef set', () => {
    const mockInput = document.createElement('input');
    const focusSpy = jest.spyOn(mockInput, 'focus');

    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: '/' });

    expect(focusSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 26. Multiple shortcuts don't fire after cleanup (unmount removes listener)
  // ---------------------------------------------------------------------------
  test("shortcuts don't fire after cleanup (unmount removes listener)", () => {
    const { unmount } = render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    unmount();

    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

    expect(pushMock).not.toHaveBeenCalled();
    expect(toggleSidebarMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 27. useKeyboardShortcuts outside provider throws error
  // ---------------------------------------------------------------------------
  test('useKeyboardShortcuts outside provider throws error', () => {
    const originalError = console.error;
    console.error = jest.fn();

    function ComponentOutsideProvider() {
      useKeyboardShortcuts();
      return null;
    }

    expect(() => render(<ComponentOutsideProvider />)).toThrow(
      'useKeyboardShortcuts must be used within a KeyboardShortcutsProvider'
    );

    console.error = originalError;
  });

  // ---------------------------------------------------------------------------
  // 28. Search shortcuts skipped when target is INPUT (already typing)
  // ---------------------------------------------------------------------------
  test('search shortcuts skipped when target is INPUT (already typing)', () => {
    const mockInput = document.createElement('input');
    const focusSpy = jest.spyOn(mockInput, 'focus');
    const ref = { current: mockInput };

    render(
      <KeyboardShortcutsProvider>
        <SearchRefSetter ref={ref} />
      </KeyboardShortcutsProvider>
    );

    const typingInput = document.createElement('input');
    document.body.appendChild(typingInput);
    typingInput.focus();

    fireEvent.keyDown(typingInput, { key: '/' });

    expect(focusSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 29. Modifier key doesn't trigger navigation
  // ---------------------------------------------------------------------------
  test("modifier key doesn't trigger navigation", () => {
    render(
      <KeyboardShortcutsProvider>
        <div>test</div>
      </KeyboardShortcutsProvider>
    );

    fireEvent.keyDown(window, { key: 'Control', ctrlKey: true });

    expect(pushMock).not.toHaveBeenCalled();
  });
});
