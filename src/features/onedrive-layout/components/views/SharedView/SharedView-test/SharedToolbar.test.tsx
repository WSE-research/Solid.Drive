import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FilterChipDef } from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';
import type { SharedFilters as SharedFiltersState } from '@/features/onedrive-layout/hooks/useSharedFilters';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

vi.mock('@/features/onedrive-layout/components/filters/TypeFilterChips', () => ({
  TypeFilterChips: ({ chips }: { chips: readonly FilterChipDef[] }) => (
    <div data-testid="chips-inline" data-chip-count={chips.length} />
  ),
  TypeFilterChipsDropdown: ({ chips }: { chips: readonly FilterChipDef[] }) => (
    <div data-testid="chips-dropdown" data-chip-count={chips.length} />
  ),
}));

vi.mock('@/features/onedrive-layout/components/filters/PersonNameFilter', () => ({
  PersonNameFilter: ({ value }: { value: string }) => (
    <div data-testid="person" data-value={value} />
  ),
}));

import { SharedToolbar } from '../SharedView-file/SharedToolbar';

const filtersStub = (overrides: Partial<SharedFiltersState> = {}): SharedFiltersState => ({
  selectedClasses: new Set(),
  toggleClass: vi.fn(),
  resetClasses: vi.fn(),
  personQuery: '',
  setPersonQuery: vi.fn(),
  isActive: false,
  matchesEntry: () => true,
  matchesContact: () => true,
  ...overrides,
});

const stubChip = (id: string, label: string): FilterChipDef => ({
  id,
  label,
  Icon: () => null,
  iconAccent: '#000',
  matches: () => true,
});

describe('SharedToolbar', () => {
  it('renders both tabs with the right active state', () => {
    render(
      <SharedToolbar
        tab="with-you"
        onTabChange={vi.fn()}
        chips={[]}
        filters={filtersStub()}
      />,
    );
    expect(screen.getByRole('tab', { name: 'With you' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'By you' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('fires onTabChange when the user clicks a tab', () => {
    const onTabChange = vi.fn();
    render(
      <SharedToolbar
        tab="with-you"
        onTabChange={onTabChange}
        chips={[]}
        filters={filtersStub()}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'By you' }));
    expect(onTabChange).toHaveBeenCalledWith('by-you');
  });

  it('fires onTabChange("with-you") when the user clicks the "With you" tab', () => {
    const onTabChange = vi.fn();
    render(
      <SharedToolbar
        tab="by-you"
        onTabChange={onTabChange}
        chips={[]}
        filters={filtersStub()}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'With you' }));
    expect(onTabChange).toHaveBeenCalledWith('with-you');
  });

  it('passes the chip list down to both inline and dropdown variants', () => {
    render(
      <SharedToolbar
        tab="with-you"
        onTabChange={vi.fn()}
        chips={[stubChip('a', 'Alpha'), stubChip('b', 'Beta')]}
        filters={filtersStub()}
      />,
    );
    expect(screen.getByTestId('chips-inline').getAttribute('data-chip-count')).toBe('2');
    expect(screen.getByTestId('chips-dropdown').getAttribute('data-chip-count')).toBe('2');
  });

  it('applies the active CSS class to the "with-you" tab when tab=with-you', () => {
    render(
      <SharedToolbar
        tab="with-you"
        onTabChange={vi.fn()}
        chips={[]}
        filters={filtersStub()}
      />,
    );
    const withYouTab = screen.getByRole('tab', { name: 'With you' });
    expect(withYouTab.className).toContain('odl-shared-tabs__trigger--active');
    const byYouTab = screen.getByRole('tab', { name: 'By you' });
    expect(byYouTab.className).not.toContain('odl-shared-tabs__trigger--active');
  });

  it('applies the active CSS class to the "by-you" tab when tab=by-you', () => {
    render(
      <SharedToolbar
        tab="by-you"
        onTabChange={vi.fn()}
        chips={[]}
        filters={filtersStub()}
      />,
    );
    const byYouTab = screen.getByRole('tab', { name: 'By you' });
    expect(byYouTab.className).toContain('odl-shared-tabs__trigger--active');
    const withYouTab = screen.getByRole('tab', { name: 'With you' });
    expect(withYouTab.className).not.toContain('odl-shared-tabs__trigger--active');
  });

  it('passes the person query down to PersonNameFilter', () => {
    render(
      <SharedToolbar
        tab="with-you"
        onTabChange={vi.fn()}
        chips={[]}
        filters={filtersStub({ personQuery: 'alice' })}
      />,
    );
    expect(screen.getByTestId('person').getAttribute('data-value')).toBe('alice');
  });
});
