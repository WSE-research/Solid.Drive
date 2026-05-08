import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SharedFilters as SharedFiltersState } from '@/features/onedrive-layout/hooks/useSharedFilters';

vi.mock('@/features/onedrive-layout/components/filters/TypeFilterChips', () => ({
  TypeFilterChips: ({ selected }: { selected: ReadonlySet<string> }) => (
    <div data-testid="chips" data-count={selected.size} />
  ),
}));

vi.mock('@/features/onedrive-layout/components/filters/PersonNameFilter', () => ({
  PersonNameFilter: ({ value }: { value: string }) => (
    <div data-testid="person" data-value={value} />
  ),
}));

import { SharedFilters } from '../SharedFilters-file/SharedFilters';

const makeFilters = (overrides: Partial<SharedFiltersState> = {}): SharedFiltersState => ({
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

describe('SharedFilters', () => {
  it('renders both children with the wired-through state', () => {
    render(
      <SharedFilters
        chips={[]}
        filters={makeFilters({
          selectedClasses: new Set(['http://schema.org/ImageObject']),
          personQuery: 'alice',
        })}
      />,
    );
    expect(screen.getByTestId('chips').getAttribute('data-count')).toBe('1');
    expect(screen.getByTestId('person').getAttribute('data-value')).toBe('alice');
  });
});
