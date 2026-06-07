import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import OffCanvasRenderer from '../OffCanvasRenderer';

jest.mock('@/context/OffCanvasContext', () => ({
  useOffCanvas: jest.fn(),
}));

function mockOffCanvas(overrides = {}) {
  const { useOffCanvas } = jest.requireMock('@/context/OffCanvasContext');
  useOffCanvas.mockReturnValue({
    isAnyOffCanvasOpen: false,
    offCanvasContent: null,
    closeOffCanvas: jest.fn(),
    ...overrides,
  });
}

describe('OffCanvasRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when no offcanvas is open', () => {
    mockOffCanvas({ isAnyOffCanvasOpen: false });
    const { container } = render(<OffCanvasRenderer />);
    expect(container.firstChild).toBeNull();
  });

  test('in inline mode, renders only offCanvasContent without backdrop', () => {
    const content = <div data-testid="test-content">Inline Content</div>;
    mockOffCanvas({ isAnyOffCanvasOpen: true, offCanvasContent: content });
    const { getByTestId, container } = render(<OffCanvasRenderer inline />);
    expect(getByTestId('test-content')).toBeInTheDocument();
    expect(container.querySelector('.fixed.inset-0.z-50')).toBeNull();
  });

  test('in overlay mode, renders backdrop and offCanvasContent inside positioned div', () => {
    const content = <div data-testid="test-content">Overlay Content</div>;
    const closeOffCanvas = jest.fn();
    mockOffCanvas({ isAnyOffCanvasOpen: true, offCanvasContent: content, closeOffCanvas });
    const { getByTestId, container } = render(<OffCanvasRenderer />);
    expect(getByTestId('test-content')).toBeInTheDocument();
    expect(container.querySelector('.fixed.inset-0.z-50')).toBeInTheDocument();
    expect(container.querySelector('.bg-black\\/50')).toBeInTheDocument();
    expect(container.querySelector('.absolute.top-0.right-0.h-full.bg-white.shadow-2xl')).toBeInTheDocument();
  });

  test('clicking backdrop calls closeOffCanvas', () => {
    const closeOffCanvas = jest.fn();
    mockOffCanvas({ isAnyOffCanvasOpen: true, offCanvasContent: <div>test</div>, closeOffCanvas });
    const { container } = render(<OffCanvasRenderer />);
    const backdrop = container.querySelector('.bg-black\\/50');
    fireEvent.click(backdrop!);
    expect(closeOffCanvas).toHaveBeenCalledTimes(1);
  });
});
