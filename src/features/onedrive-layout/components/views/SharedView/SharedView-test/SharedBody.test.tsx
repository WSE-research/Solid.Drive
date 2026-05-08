import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SharedFilters as SharedFiltersState } from '@/features/onedrive-layout/hooks/useSharedFilters';

let lastTableProps: Record<string, unknown> | undefined;
vi.mock('@/features/onedrive-layout/components/views/SharedView/SharedView-file/SharedFilesTable', () => ({
  SharedFilesTable: (props: Record<string, unknown>) => {
    lastTableProps = props;
    return (
      <div
        data-testid="files-table"
        data-direction={String(props.direction)}
        data-count={(props.contacts as string[]).length}
      />
    );
  },
}));

import { SharedBody } from '../SharedView-file/SharedBody';

const filtersStub = (): SharedFiltersState => ({
  selectedClasses: new Set(),
  toggleClass: vi.fn(),
  resetClasses: vi.fn(),
  personQuery: '',
  setPersonQuery: vi.fn(),
  isActive: false,
  matchesEntry: () => true,
  matchesContact: () => true,
});

beforeEach(() => {
  lastTableProps = undefined;
});

describe('SharedBody', () => {
  it('renders SharedFilesTable with direction=with-you on the with-you tab', () => {
    render(
      <SharedBody
        tab="with-you"
        contacts={['https://alice/me']}
        viewerWebId="https://owner/me"
        filters={filtersStub()}
        chips={[]}
        onObserve={vi.fn()}
      />,
    );
    expect(screen.getByTestId('files-table').getAttribute('data-direction')).toBe('with-you');
  });

  it('renders SharedFilesTable with direction=by-you on the by-you tab', () => {
    render(
      <SharedBody
        tab="by-you"
        contacts={['https://alice/me']}
        viewerWebId="https://owner/me"
        filters={filtersStub()}
        chips={[]}
        onObserve={vi.fn()}
      />,
    );
    expect(screen.getByTestId('files-table').getAttribute('data-direction')).toBe('by-you');
  });

  it('forwards the contacts list, viewerWebId, filters, chips and onObserve to the table', () => {
    const filters = filtersStub();
    const onObserve = vi.fn();
    render(
      <SharedBody
        tab="with-you"
        contacts={['https://alice/me', 'https://bob/me']}
        viewerWebId="https://owner/me"
        filters={filters}
        chips={[]}
        onObserve={onObserve}
      />,
    );
    expect(lastTableProps?.contacts).toEqual(['https://alice/me', 'https://bob/me']);
    expect(lastTableProps?.viewerWebId).toBe('https://owner/me');
    expect(lastTableProps?.filters).toBe(filters);
    expect(lastTableProps?.onObserve).toBe(onObserve);
  });
});
