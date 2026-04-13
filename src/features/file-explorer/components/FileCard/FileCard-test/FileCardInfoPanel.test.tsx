import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileCardInfoPanel } from '../FileCard-file/FileCardInfoPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@/shared/utils/formatBytes', () => ({
  formatBytes: (v: string) => `formatted(${v})`,
}));

const baseProps = {
  uploadedAt: '2024-01-15',
  dateModified: '2024-02-20',
  fileType: { label: 'Document', description: 'A digital document' },
};

describe('FileCardInfoPanel', () => {
  it('renders the file type row with label and description', () => {
    render(<FileCardInfoPanel {...baseProps} />);
    expect(screen.getByText('fileCard.fileType')).toBeInTheDocument();
    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('A digital document')).toBeInTheDocument();
  });

  it('omits file type description when empty', () => {
    render(
      <FileCardInfoPanel {...baseProps} fileType={{ label: 'Image', description: '' }} />
    );
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.queryByText('A digital document')).not.toBeInTheDocument();
  });

  it('renders name row when name is provided', () => {
    render(<FileCardInfoPanel {...baseProps} name="My File" />);
    expect(screen.getByText('fileCard.title')).toBeInTheDocument();
    expect(screen.getByText('My File')).toBeInTheDocument();
  });

  it('does not render name row when name is absent', () => {
    render(<FileCardInfoPanel {...baseProps} />);
    expect(screen.queryByText('fileCard.title')).not.toBeInTheDocument();
  });

  it('renders description row when description is provided', () => {
    render(<FileCardInfoPanel {...baseProps} description="Some description" />);
    expect(screen.getByText('fileCard.description')).toBeInTheDocument();
    expect(screen.getByText('Some description')).toBeInTheDocument();
  });

  it('does not render description row when absent', () => {
    render(<FileCardInfoPanel {...baseProps} />);
    expect(screen.queryByText('fileCard.description')).not.toBeInTheDocument();
  });

  it('renders format row when encodingFormat is provided', () => {
    render(<FileCardInfoPanel {...baseProps} encodingFormat="application/pdf" />);
    expect(screen.getByText('fileCard.format')).toBeInTheDocument();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
  });

  it('does not render format row when absent', () => {
    render(<FileCardInfoPanel {...baseProps} />);
    expect(screen.queryByText('fileCard.format')).not.toBeInTheDocument();
  });

  it('renders size row with formatted bytes when contentSize is provided', () => {
    render(<FileCardInfoPanel {...baseProps} contentSize="2048" />);
    expect(screen.getByText('fileCard.size')).toBeInTheDocument();
    expect(screen.getByText('formatted(2048)')).toBeInTheDocument();
  });

  it('does not render size row when absent', () => {
    render(<FileCardInfoPanel {...baseProps} />);
    expect(screen.queryByText('fileCard.size')).not.toBeInTheDocument();
  });

  it('renders uploadedAt row', () => {
    render(<FileCardInfoPanel {...baseProps} />);
    expect(screen.getByText('fileCard.uploadedOn')).toBeInTheDocument();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });

  it('renders dateModified row', () => {
    render(<FileCardInfoPanel {...baseProps} />);
    expect(screen.getByText('fileCard.lastUpdated')).toBeInTheDocument();
    expect(screen.getByText('2024-02-20')).toBeInTheDocument();
  });

  it('renders publisher row when publisherWebId is provided', () => {
    render(
      <FileCardInfoPanel
        {...baseProps}
        publisherWebId="https://pod.example/profile/card#me"
        publisherName="Alice"
      />
    );
    expect(screen.getByText('fileCard.uploadedBy')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('does not render publisher row when publisherWebId is absent', () => {
    render(<FileCardInfoPanel {...baseProps} publisherName="Alice" />);
    expect(screen.queryByText('fileCard.uploadedBy')).not.toBeInTheDocument();
  });

  it('renders isPartOf row when isPartOf has @id', () => {
    render(
      <FileCardInfoPanel {...baseProps} isPartOf={{ '@id': 'https://example.com/collection' }} />
    );
    expect(screen.getByText('fileCard.partOf')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/collection')).toBeInTheDocument();
  });

  it('does not render isPartOf row when absent', () => {
    render(<FileCardInfoPanel {...baseProps} />);
    expect(screen.queryByText('fileCard.partOf')).not.toBeInTheDocument();
  });

  it('does not render uploadedAt when empty string', () => {
    render(<FileCardInfoPanel {...baseProps} uploadedAt="" dateModified="2024-02-20" />);
    expect(screen.queryByText('fileCard.uploadedOn')).not.toBeInTheDocument();
  });

  it('does not render dateModified when empty string', () => {
    render(<FileCardInfoPanel {...baseProps} uploadedAt="2024-01-15" dateModified="" />);
    expect(screen.queryByText('fileCard.lastUpdated')).not.toBeInTheDocument();
  });
});
