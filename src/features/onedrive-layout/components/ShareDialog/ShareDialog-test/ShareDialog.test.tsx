import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareDialog } from '../ShareDialog-file/ShareDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

vi.mock('@/features/file-explorer/components/SharePanel', () => ({
  SharePanel: ({ containerUri }: { containerUri: string }) => (
    <div data-testid="mock-share-panel" data-uri={containerUri} />
  ),
}));

const baseProps = {
  containerUri: 'https://pod/app/doc/',
  catalogUri: 'https://pod/catalog',
  appContainerUri: 'https://pod/app/',
  contacts: [],
  sharedEntry: { uri: 'https://pod/app/doc/index.ttl' } as never,
};

describe('ShareDialog', () => {
  it('renders nothing when closed', () => {
    render(<ShareDialog open={false} onOpenChange={vi.fn()} {...baseProps} />);
    expect(screen.queryByTestId('mock-share-panel')).not.toBeInTheDocument();
  });

  it('renders the SharePanel with the right containerUri when open', () => {
    render(<ShareDialog open onOpenChange={vi.fn()} {...baseProps} />);
    const panel = screen.getByTestId('mock-share-panel');
    expect(panel).toHaveAttribute('data-uri', 'https://pod/app/doc/');
  });

  it('calls onOpenChange(false) when the Close button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ShareDialog open onOpenChange={onOpenChange} {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
