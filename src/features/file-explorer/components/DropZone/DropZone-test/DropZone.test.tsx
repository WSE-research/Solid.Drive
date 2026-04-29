import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, opts?: Record<string, unknown>) =>
      opts?.destination ? `${key}:${opts.destination as string}` : key,
  ],
}));

import { DropZone } from '../DropZone-file/DropZone';

describe('DropZone', () => {
  it('renders nothing when visible is false', () => {
    const { container } = render(<DropZone visible={false} destinationLabel="My Drive" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the overlay with the destination label when visible', () => {
    render(<DropZone visible={true} destinationLabel="My Drive" />);
    expect(screen.getByText('fileExplorer.dropZoneLabel:My Drive')).toBeInTheDocument();
  });
});
