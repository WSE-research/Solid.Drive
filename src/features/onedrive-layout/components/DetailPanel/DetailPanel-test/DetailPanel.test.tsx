import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailPanel } from '../DetailPanel-file/DetailPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => fallback ?? key,
  ],
}));

describe('DetailPanel', () => {
  it('is aria-hidden when closed', () => {
    const { container } = render(
      <DetailPanel open={false} selected={null} onClose={vi.fn()} />,
    );
    expect(container.querySelector('detail-panel')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('is visible when open is true', () => {
    const { container } = render(
      <DetailPanel open selected={null} onClose={vi.fn()} />,
    );
    expect(container.querySelector('detail-panel')).toHaveAttribute(
      'aria-hidden',
      'false',
    );
  });

  it('shows the empty hint when nothing is selected', () => {
    render(<DetailPanel open selected={null} onClose={vi.fn()} />);
    expect(screen.getByText(/select an item/i)).toBeInTheDocument();
  });

  it('renders the file name when a file is selected', () => {
    render(
      <DetailPanel
        open
        selected={{ kind: 'file', uri: 'https://x/doc/', name: 'doc.pdf' }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'doc.pdf' })).toBeInTheDocument();
  });

  it('Close button forwards onClose', () => {
    const onClose = vi.fn();
    render(
      <DetailPanel
        open
        selected={{ kind: 'folder', uri: 'https://x/dir/', name: 'dir' }}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
