import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailPanel } from '../DetailPanel-file/DetailPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => fallback ?? key,
  ],
}));

vi.mock('../EditableDescription', () => ({
  EditableDescription: ({ initial }: { initial: string | undefined }) => (
    <div data-testid="mock-editable-description" data-initial={initial ?? ''} />
  ),
}));

vi.mock('../HasAccessRow', () => ({
  HasAccessRow: ({ uri }: { uri: string }) => (
    <div data-testid="mock-has-access-row" data-uri={uri} />
  ),
}));

const fileSelected = {
  kind: 'file' as const,
  uri: 'https://pod/app/report/',
  name: 'report.pdf',
};

const folderSelected = {
  kind: 'folder' as const,
  uri: 'https://pod/app/docs/',
  name: 'docs',
};

const fileDetails = {
  kind: 'file' as const,
  uri: 'https://pod/app/report/',
  name: 'report.pdf',
  metadataUri: 'https://pod/app/report/index.ttl',
  description: undefined,
  mediaType: 'application/pdf',
  byteSize: 12345,
  modified: '2026-04-01T00:00:00Z',
  created: undefined,
};

const folderDetails = {
  kind: 'folder' as const,
  uri: 'https://pod/app/docs/',
  name: 'docs',
  itemCount: 4,
  modified: undefined,
};

describe('DetailPanel', () => {
  it('is aria-hidden when closed', () => {
    const { container } = render(
      <DetailPanel
        open={false}
        selected={null}
        details={null}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('detail-panel')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('is visible when open is true', () => {
    const { container } = render(
      <DetailPanel
        open
        selected={null}
        details={null}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('detail-panel')).toHaveAttribute(
      'aria-hidden',
      'false',
    );
  });

  it('shows the empty hint when nothing is selected', () => {
    render(
      <DetailPanel open selected={null} details={null} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/select an item/i)).toBeInTheDocument();
  });

  it('renders the file name when a file is selected', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'report.pdf' }),
    ).toBeInTheDocument();
  });

  it('Close button forwards onClose', () => {
    const onClose = vi.fn();
    render(
      <DetailPanel
        open
        selected={folderSelected}
        details={folderDetails}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows the More details divider when a file is selected', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/more details/i)).toBeInTheDocument();
  });

  it('renders the Type row with the mediaType for files', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
  });

  it('renders the Items count for folders instead of file size', () => {
    render(
      <DetailPanel
        open
        selected={folderSelected}
        details={folderDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('does not render the Type row for folders', () => {
    render(
      <DetailPanel
        open
        selected={folderSelected}
        details={folderDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/^type$/i)).not.toBeInTheDocument();
  });

  it('renders the EditableDescription only for files', () => {
    const { rerender } = render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mock-editable-description')).toBeInTheDocument();
    rerender(
      <DetailPanel
        open
        selected={folderSelected}
        details={folderDetails}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId('mock-editable-description'),
    ).not.toBeInTheDocument();
  });

  it('renders HasAccessRow for both files and folders', () => {
    const { rerender } = render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mock-has-access-row')).toHaveAttribute(
      'data-uri',
      'https://pod/app/report/',
    );
    rerender(
      <DetailPanel
        open
        selected={folderSelected}
        details={folderDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mock-has-access-row')).toHaveAttribute(
      'data-uri',
      'https://pod/app/docs/',
    );
  });

  it('passes the description through to EditableDescription', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, description: 'The Q1 report' }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mock-editable-description')).toHaveAttribute(
      'data-initial',
      'The Q1 report',
    );
  });

  it('renders the Pod URI row with the resource URI', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('https://pod/app/report/')).toBeInTheDocument();
  });
});
