import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CatalogEntry } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, opts?: Record<string, unknown>) => {
      if (opts?.query !== undefined) return `${key}:${opts.query as string}`;
      if (opts?.count !== undefined) return `${key}:${opts.count as number}`;
      return key;
    },
  ],
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  toContainerUri: (uri: string) => uri.replace(/index\.ttl$/, ''),
}));

vi.mock('@/features/file-explorer/components/FileCard', () => ({
  FileCard: ({ containerUri, catalogUri }: { containerUri: string; catalogUri: string }) => (
    <div data-testid="file-card" data-container={containerUri} data-catalog={catalogUri} />
  ),
}));

import { SearchResults } from '../SearchResults-file/SearchResults';

const makeEntry = (uri: string, title = 'Untitled'): CatalogEntry => ({
  uri, conformsTo: '', title, description: '', modified: '',
  publisher: '', mediaType: 'application/pdf', byteSize: 0, accessURL: '',
});

const CATALOG_URI = 'https://pod.example/catalog.ttl';
const REPORT_ENTRY_URI = 'https://pod.example/report/index.ttl';
const INVOICE_ENTRY_URI = 'https://pod.example/invoice/index.ttl';

describe('SearchResults', () => {
  it('renders the empty state with the query interpolated when results is empty', () => {
    render(<SearchResults query="report" results={[]} catalogUri={CATALOG_URI} />);
    expect(screen.getByText('fileExplorer.searchNoResults:report')).toBeInTheDocument();
    expect(screen.queryAllByTestId('file-card')).toHaveLength(0);
  });

  it('renders one FileCard per hit with containerUri derived from the entry URI', () => {
    const matchingEntries = [
      makeEntry(REPORT_ENTRY_URI, 'Report'),
      makeEntry(INVOICE_ENTRY_URI, 'Invoice'),
    ];
    render(<SearchResults query="report" results={matchingEntries} catalogUri={CATALOG_URI} />);
    const renderedCards = screen.getAllByTestId('file-card');
    expect(renderedCards).toHaveLength(2);
    expect(renderedCards[0]).toHaveAttribute('data-container', 'https://pod.example/report/');
    expect(renderedCards[0]).toHaveAttribute('data-catalog', CATALOG_URI);
    expect(renderedCards[1]).toHaveAttribute('data-container', 'https://pod.example/invoice/');
  });

  it('renders the match count above the results', () => {
    const matchingEntries = [
      makeEntry(REPORT_ENTRY_URI, 'Report'),
      makeEntry(INVOICE_ENTRY_URI, 'Invoice'),
    ];
    render(<SearchResults query="report" results={matchingEntries} catalogUri={CATALOG_URI} />);
    expect(screen.getByText('fileExplorer.searchMatchCount:2')).toBeInTheDocument();
  });
});
