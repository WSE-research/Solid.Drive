import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import { SelectionActions } from '../SelectionActions-file/SelectionActions';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

const fileSelection: NonNullable<SelectedResource> = {
  kind: 'file',
  uri: 'https://pod/app/doc/',
  name: 'doc.pdf',
};

const baseHandlers = {
  onShare: vi.fn(),
  onCopyLink: vi.fn(),
  onDelete: vi.fn(),
  onDownload: vi.fn(),
  onMoveTo: vi.fn(),
  onRename: vi.fn(),
};

const ALL_ACTION_LABELS = [
  'share',
  'copy link',
  'delete',
  'download',
  'move to',
  'rename',
] as const;

describe('SelectionActions', () => {
  it('renders no action buttons when nothing is selected', () => {
    render(<SelectionActions selection={null} {...baseHandlers} />);
    for (const label of ALL_ACTION_LABELS) {
      expect(
        screen.queryByRole('button', { name: new RegExp(label, 'i') }),
      ).not.toBeInTheDocument();
    }
  });

  it('renders all six action buttons when a file is selected', () => {
    render(<SelectionActions selection={fileSelection} {...baseHandlers} />);
    for (const label of ALL_ACTION_LABELS) {
      expect(
        screen.getByRole('button', { name: new RegExp(label, 'i') }),
      ).toBeInTheDocument();
    }
  });

  it('clicking Share fires onShare', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(
      <SelectionActions
        {...baseHandlers}
        selection={fileSelection}
        onShare={onShare}
      />,
    );
    await user.click(screen.getByRole('button', { name: /share/i }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('clicking Copy link fires onCopyLink', async () => {
    const user = userEvent.setup();
    const onCopyLink = vi.fn();
    render(
      <SelectionActions
        {...baseHandlers}
        selection={fileSelection}
        onCopyLink={onCopyLink}
      />,
    );
    await user.click(screen.getByRole('button', { name: /copy link/i }));
    expect(onCopyLink).toHaveBeenCalledOnce();
  });

  it('clicking Download fires onDownload', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <SelectionActions
        {...baseHandlers}
        selection={fileSelection}
        onDownload={onDownload}
      />,
    );
    await user.click(screen.getByRole('button', { name: /download/i }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it('clicking Delete fires onDelete (not stubbed — wired in OneDriveLayout)', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <SelectionActions
        {...baseHandlers}
        selection={fileSelection}
        onDelete={onDelete}
      />,
    );
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    expect(deleteBtn).not.toHaveAttribute('data-stub');
    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('Move To and Rename are stubbed (data-stub) but still forward clicks', async () => {
    const user = userEvent.setup();
    const onMoveTo = vi.fn();
    const onRename = vi.fn();
    render(
      <SelectionActions
        {...baseHandlers}
        selection={fileSelection}
        onMoveTo={onMoveTo}
        onRename={onRename}
      />,
    );
    const moveBtn = screen.getByRole('button', { name: /move to/i });
    const renameBtn = screen.getByRole('button', { name: /rename/i });
    expect(moveBtn).toHaveAttribute('data-stub', 'true');
    expect(renameBtn).toHaveAttribute('data-stub', 'true');
    await user.click(moveBtn);
    await user.click(renameBtn);
    expect(onMoveTo).toHaveBeenCalledOnce();
    expect(onRename).toHaveBeenCalledOnce();
  });
});
