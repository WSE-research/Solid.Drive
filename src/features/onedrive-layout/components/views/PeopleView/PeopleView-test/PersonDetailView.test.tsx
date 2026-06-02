import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

vi.mock('@/shared/components/Avatar', () => ({
  Avatar: ({ alt, initial }: { alt: string; initial: string }) => (
    <span data-testid="avatar" data-alt={alt} data-initial={initial} />
  ),
}));

vi.mock('@/shared/hooks/useContactProfile', () => ({
  useContactProfile: () => ({
    displayName: 'Alice Doe',
    avatarUrl: 'https://alice.example/avatar.png',
    initial: 'A',
    isLoading: false,
  }),
}));

vi.mock('@/features/onedrive-layout/icons', () => ({
  ChevronLeftIcon: () => <span data-testid="chevron-left" />,
}));

vi.mock('@/features/file-explorer/components/ContactCatalogBrowser', () => ({
  ContactCatalogBrowser: (props: { contactWebId: string; viewerWebId: string }) => (
    <div data-testid="catalog-browser" data-contact={props.contactWebId} data-viewer={props.viewerWebId} />
  ),
}));

vi.mock('@/features/onedrive-layout/components/filters/TypeFilterChips', () => ({
  TypeFilterChips: () => <div data-testid="chips-inline" />,
  TypeFilterChipsDropdown: () => <div data-testid="chips-dropdown" />,
}));

vi.mock('@/features/onedrive-layout/components/filters/PersonNameFilter', () => ({
  PersonNameFilter: ({ value }: { value: string }) => (
    <div data-testid="person-filter" data-value={value} />
  ),
}));

let lastTableProps: Record<string, unknown> | undefined;
vi.mock(
  '@/features/onedrive-layout/components/views/SharedView/SharedView-file/SharedFilesTable',
  () => ({
    SharedFilesTable: (props: Record<string, unknown>) => {
      lastTableProps = props;
      return (
        <div
          data-testid="shared-files-table"
          data-direction={String(props.direction)}
          data-contacts={(props.contacts as string[]).join(',')}
          data-viewer={String(props.viewerWebId)}
        />
      );
    },
  }),
);

vi.mock('@/features/onedrive-layout/hooks/useSharedFilters', () => ({
  useSharedFilters: () => ({
    selectedClasses: new Set(),
    toggleClass: vi.fn(),
    resetClasses: vi.fn(),
    personQuery: 'alice',
    setPersonQuery: vi.fn(),
    isActive: true,
    matchesEntry: () => true,
    matchesContact: () => true,
  }),
}));

vi.mock(
  '@/features/onedrive-layout/components/views/SharedView/SharedView-file/useObservedSharedTypes',
  () => ({
    useObservedSharedTypes: () => ({
      chips: [],
      report: vi.fn(),
      reset: vi.fn(),
    }),
  }),
);

import { PersonDetailView } from '../PeopleView-file/PersonDetailView';

const renderDetail = (onBack = vi.fn()) =>
  render(
    <PersonDetailView
      contactWebId="https://alice.example/profile/card#me"
      ownerWebId="https://owner.example/profile/card#me"
      onBack={onBack}
    />,
  );

beforeEach(() => {
  lastTableProps = undefined;
});

describe('PersonDetailView', () => {
  it('renders the back button with the localized label', () => {
    renderDetail();
    const back = screen.getByRole('button', { name: /back to people/i });
    expect(back).toBeInTheDocument();
    expect(back.querySelector('[data-testid="chevron-left"]')).not.toBeNull();
  });

  it('fires onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    renderDetail(onBack);
    fireEvent.click(screen.getByRole('button', { name: /back to people/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders the contact's avatar + display name in the toolbar identity slot", () => {
    renderDetail();
    expect(screen.getByText('Alice Doe')).toBeInTheDocument();
    const avatar = screen.getByTestId('avatar');
    expect(avatar.getAttribute('data-alt')).toBe('Alice Doe');
    expect(avatar.getAttribute('data-initial')).toBe('A');
  });

  it('renders both chip variants and the person filter input', () => {
    renderDetail();
    expect(screen.getByTestId('chips-inline')).toBeInTheDocument();
    expect(screen.getByTestId('chips-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('person-filter').getAttribute('data-value')).toBe('alice');
  });

  it('renders SharedFilesTable scoped to the selected contact (with-you direction)', () => {
    renderDetail();
    const table = screen.getByTestId('shared-files-table');
    expect(table.getAttribute('data-direction')).toBe('with-you');
    expect(table.getAttribute('data-contacts')).toBe(
      'https://alice.example/profile/card#me',
    );
    expect(table.getAttribute('data-viewer')).toBe(
      'https://owner.example/profile/card#me',
    );
  });

  it('forwards the onObserve callback to the table', () => {
    renderDetail();
    expect(typeof lastTableProps?.onObserve).toBe('function');
  });

  describe('catalog drill-down', () => {
    it('shows a Catalog button next to the name, and the browser is not inline', () => {
      renderDetail();
      expect(screen.getByRole('button', { name: 'Catalog' })).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-browser')).not.toBeInTheDocument();
    });

    it('opens the MyFiles-style catalog screen when Catalog is clicked', () => {
      renderDetail();
      fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
      const browser = screen.getByTestId('catalog-browser');
      expect(browser.getAttribute('data-contact')).toBe('https://alice.example/profile/card#me');
      expect(browser.getAttribute('data-viewer')).toBe('https://owner.example/profile/card#me');
      // The catalog screen replaces the shared files table.
      expect(screen.queryByTestId('shared-files-table')).not.toBeInTheDocument();
    });

    it('returns to the contact detail from the catalog screen', () => {
      renderDetail();
      fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
      fireEvent.click(screen.getByRole('button', { name: /alice doe/i }));
      expect(screen.getByTestId('shared-files-table')).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-browser')).not.toBeInTheDocument();
    });
  });
});
