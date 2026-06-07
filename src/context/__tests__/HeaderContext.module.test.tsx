import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { HeaderProvider, useHeader } from '@/context/HeaderContext';

function HeaderDisplay() {
  const { headerState } = useHeader();
  return (
    <div data-testid="header">
      <h1>{headerState.title}</h1>
      {headerState.subtitle && <p>{headerState.subtitle}</p>}
      {headerState.rightContent && <span data-testid="right-content">{headerState.rightContent}</span>}
      {headerState.breadcrumbs && (
        <nav data-testid="breadcrumbs">
          {headerState.breadcrumbs.map((crumb, idx) => (
            <span key={idx}>{crumb.label}</span>
          ))}
        </nav>
      )}
    </div>
  );
}

function HeaderUpdater({ newState }: { newState: Record<string, unknown> }) {
  const { headerState, setHeaderState } = useHeader();
  return (
    <button onClick={() => setHeaderState({ ...headerState, ...newState })}>
      Update
    </button>
  );
}

describe('HeaderContext', () => {
  describe('HeaderProvider', () => {
    test('renders children inside provider', () => {
      render(
        <HeaderProvider>
          <div data-testid="child">Child Content</div>
        </HeaderProvider>
      );

      expect(screen.getByTestId('child')).toHaveTextContent('Child Content');
    });
  });

  describe('useHeader', () => {
    test('throws error when used outside HeaderProvider', () => {
      const originalError = console.error;
      console.error = jest.fn();

      function ComponentOutsideProvider() {
        useHeader();
        return null;
      }

      expect(() => render(<ComponentOutsideProvider />)).toThrow(
        'useHeader must be used within a HeaderProvider'
      );

      console.error = originalError;
    });

    test('returns headerState and setHeaderState', () => {
      let capturedValue: ReturnType<typeof useHeader> | null = null;

      function CaptureContext() {
        capturedValue = useHeader();
        return null;
      }

      render(
        <HeaderProvider>
          <CaptureContext />
        </HeaderProvider>
      );

      expect(capturedValue).not.toBeNull();
      expect(capturedValue).toHaveProperty('headerState');
      expect(capturedValue).toHaveProperty('setHeaderState');
      expect(typeof capturedValue!.setHeaderState).toBe('function');
    });
  });

  describe('default header state', () => {
    test('has correct initial values', () => {
      render(
        <HeaderProvider>
          <HeaderDisplay />
        </HeaderProvider>
      );

      const header = screen.getByTestId('header');
      expect(header.querySelector('h1')).toBeEmptyDOMElement();
      expect(header.querySelector('p')).toBeNull();
      expect(screen.queryByTestId('right-content')).toBeNull();
      expect(screen.queryByTestId('breadcrumbs')).toBeNull();
    });
  });

  describe('state updates', () => {
    test('setHeaderState updates the state', () => {
      render(
        <HeaderProvider>
          <HeaderDisplay />
          <HeaderUpdater newState={{ title: 'New Title' }} />
        </HeaderProvider>
      );

      expect(screen.getByTestId('header').querySelector('h1')).toBeEmptyDOMElement();

      act(() => {
        screen.getByText('Update').click();
      });

      expect(screen.getByTestId('header').querySelector('h1')).toHaveTextContent('New Title');
    });

    test('partial state update preserves other fields', () => {
      render(
        <HeaderProvider>
          <HeaderDisplay />
          <HeaderUpdater newState={{ title: 'Dashboard' }} />
        </HeaderProvider>
      );

      act(() => {
        screen.getByText('Update').click();
      });

      expect(screen.getByTestId('header').querySelector('h1')).toHaveTextContent('Dashboard');
    });

    test('setHeaderState can update breadcrumbs', () => {
      render(
        <HeaderProvider>
          <HeaderDisplay />
          <HeaderUpdater
            newState={{
              breadcrumbs: [
                { label: 'Home', href: '/' },
                { label: 'Settings' },
              ],
            }}
          />
        </HeaderProvider>
      );

      act(() => {
        screen.getByText('Update').click();
      });

      const breadcrumbs = screen.getByTestId('breadcrumbs');
      expect(breadcrumbs.children).toHaveLength(2);
      expect(breadcrumbs.children[0]).toHaveTextContent('Home');
      expect(breadcrumbs.children[1]).toHaveTextContent('Settings');
    });

    test('setHeaderState can set subtitle and rightContent', () => {
      render(
        <HeaderProvider>
          <HeaderDisplay />
          <HeaderUpdater
            newState={{
              subtitle: 'Overview',
              rightContent: <button>Action</button>,
            }}
          />
        </HeaderProvider>
      );

      act(() => {
        screen.getByText('Update').click();
      });

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByTestId('right-content')).toContainHTML('<button>Action</button>');
    });
  });
});
