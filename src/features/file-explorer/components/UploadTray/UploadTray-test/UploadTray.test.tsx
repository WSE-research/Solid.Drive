import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { UploadQueueItem } from '@/features/file-explorer/hooks/useUploadQueue';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

import { UploadTray } from '../UploadTray-file/UploadTray';

function makeItem(overrides: Partial<UploadQueueItem> = {}): UploadQueueItem {
  return {
    id: 'id-1',
    file: new File(['x'], 'a.txt', { type: 'text/plain' }),
    destinationUri: 'https://pod.example/photos/',
    destinationLabel: 'My Drive',
    status: 'uploading',
    ...overrides,
  };
}

describe('UploadTray', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(<UploadTray items={[]} onDismiss={vi.fn()} onRetry={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one row per item with the filename', () => {
    render(
      <UploadTray
        items={[makeItem({ id: 'a', file: new File([''], 'one.txt') }), makeItem({ id: 'b', file: new File([''], 'two.txt') })]}
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText('one.txt')).toBeInTheDocument();
    expect(screen.getByText('two.txt')).toBeInTheDocument();
  });

  it('shows Retry only on errored rows and calls onRetry with the row id', () => {
    const onRetry = vi.fn();
    render(<UploadTray items={[makeItem({ id: 'err-1', status: 'error', error: 'boom' })]} onDismiss={vi.fn()} onRetry={onRetry} />);
    fireEvent.click(screen.getByLabelText('fileExplorer.uploadTrayRetry'));
    expect(onRetry).toHaveBeenCalledWith('err-1');
  });

  it('does not show Retry on success rows', () => {
    render(<UploadTray items={[makeItem({ id: 'ok-1', status: 'success' })]} onDismiss={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.queryByLabelText('fileExplorer.uploadTrayRetry')).toBeNull();
  });

  it('Dismiss calls onDismiss with the row id', () => {
    const onDismiss = vi.fn();
    render(<UploadTray items={[makeItem({ id: 'ok-1', status: 'success' })]} onDismiss={onDismiss} onRetry={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('fileExplorer.uploadTrayDismiss'));
    expect(onDismiss).toHaveBeenCalledWith('ok-1');
  });

  it('renders the queued ellipsis indicator for queued rows', () => {
    render(
      <UploadTray
        items={[makeItem({ id: 'q-1', status: 'queued' })]}
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText('…')).toBeInTheDocument();
  });

  it('Clear completed dismisses every settled row', () => {
    const onDismiss = vi.fn();
    render(
      <UploadTray
        items={[
          makeItem({ id: 'a', status: 'success' }),
          makeItem({ id: 'b', status: 'uploading' }),
          makeItem({ id: 'c', status: 'error', error: 'x' }),
        ]}
        onDismiss={onDismiss}
        onRetry={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('fileExplorer.uploadTrayClearCompleted'));
    expect(onDismiss).toHaveBeenCalledWith('a');
    expect(onDismiss).toHaveBeenCalledWith('c');
    expect(onDismiss).not.toHaveBeenCalledWith('b');
  });
});
