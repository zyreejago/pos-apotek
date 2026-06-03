import React from 'react';
import { render, waitFor } from '@testing-library/react';
import HomePage from '../page';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    refresh: jest.fn(),
    back: jest.fn(),
  }),
}));

describe('home module', () => {
  test('redirects to dashboard', async () => {
    render(<HomePage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });
});
