import React from 'react';
import { render } from '@testing-library/react';
import { GoeyToaster, goeyToast } from '@/components/ui/goey-toaster';

jest.mock('goey-toast', () => ({
  GoeyToaster: jest.fn(({ position, ...props }) => <div data-testid="goey-toaster" data-position={position} {...props} />),
  goeyToast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

describe('GoeyToaster', () => {
  test('renders GoeyToaster with position top-center', () => {
    const { getByTestId } = render(<GoeyToaster />);
    expect(getByTestId('goey-toaster')).toHaveAttribute('data-position', 'top-center');
  });

  test('renders GoeyToaster with custom props', () => {
    const { getByTestId } = render(<GoeyToaster duration={3000} />);
    expect(getByTestId('goey-toaster')).toBeInTheDocument();
  });

  test('exports goeyToast', () => {
    expect(goeyToast).toBeDefined();
    expect(goeyToast.success).toBeDefined();
    expect(goeyToast.error).toBeDefined();
    expect(goeyToast.info).toBeDefined();
    expect(goeyToast.warning).toBeDefined();
  });
});
