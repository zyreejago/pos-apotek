import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { HeaderProvider, useHeader } from '@/context/HeaderContext';
import Header from '../Header';

jest.mock('../ProfileDropdown', () => ({
  __esModule: true,
  default: () => <div data-testid="profile-dropdown" />,
}));

function HeaderWithState({ state, children }: { state: any; children?: React.ReactNode }) {
  const { setHeaderState } = useHeader();
  useEffect(() => {
    setHeaderState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function renderHeader(state: any = {}) {
  return render(
    <HeaderProvider>
      <HeaderWithState state={state}>
        <Header />
      </HeaderWithState>
    </HeaderProvider>,
  );
}

describe('Header', () => {
  test('renders title when headerState has title and no breadcrumbs', () => {
    renderHeader({ title: 'Dashboard' });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  test('renders subtitle when headerState has subtitle and no breadcrumbs', () => {
    renderHeader({ subtitle: 'Overview of your store' });
    expect(screen.getByText('Overview of your store')).toBeInTheDocument();
  });

  test('renders both title and subtitle when both present', () => {
    renderHeader({ title: 'Dashboard', subtitle: 'Overview of your store' });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Overview of your store')).toBeInTheDocument();
  });

  test('renders breadcrumbs when breadcrumbs array has items', () => {
    renderHeader({
      breadcrumbs: [{ label: 'Home' }, { label: 'Reports' }],
    });
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  test('breadcrumbs with multiple items show "/" separators', () => {
    renderHeader({
      breadcrumbs: [
        { label: 'Home' },
        { label: 'Reports' },
        { label: 'Sales' },
      ],
    });
    const separators = screen.getAllByText('/');
    expect(separators).toHaveLength(2);
  });

  test('last breadcrumb has bold + gray-900 class', () => {
    renderHeader({
      breadcrumbs: [{ label: 'Home' }, { label: 'Reports' }],
    });
    const lastBreadcrumb = screen.getByText('Reports');
    expect(lastBreadcrumb).toHaveClass('font-bold', 'text-gray-900');
  });

  test('when breadcrumbs present, title/subtitle are NOT rendered', () => {
    renderHeader({
      title: 'Dashboard',
      subtitle: 'Subtitle text',
      breadcrumbs: [{ label: 'Home' }],
    });
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Subtitle text')).not.toBeInTheDocument();
  });

  test('renders rightContent when present', () => {
    renderHeader({
      title: 'Dashboard',
      rightContent: <span data-testid="right-content">Action Button</span>,
    });
    expect(screen.getByTestId('right-content')).toBeInTheDocument();
    expect(screen.getByText('Action Button')).toBeInTheDocument();
  });

  test('renders without title (title is falsy)', () => {
    renderHeader({ title: '' });
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  test('renders without subtitle (subtitle is falsy)', () => {
    const { container } = renderHeader({ title: 'Dashboard', subtitle: '' });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  test('renders ProfileDropdown component', () => {
    renderHeader({ title: 'Dashboard' });
    expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument();
  });
});
