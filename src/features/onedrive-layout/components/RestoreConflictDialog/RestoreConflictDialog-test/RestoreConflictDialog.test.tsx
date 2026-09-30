import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallbackOrOpts?: unknown) => {
      if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
      const opts = fallbackOrOpts as { defaultValue?: string; name?: string } | undefined;
      const template = opts?.defaultValue ?? key;
      return opts?.name ? template.replace('{{name}}', opts.name) : template;
    },
  ],
}));

import { RestoreConflictDialog } from '../RestoreConflictDialog-file/RestoreConflictDialog';

const conflict = {
  current: { modified: '2026-02-01T00:00:00.000Z', byteSize: 2048 },
  trashed: { modified: '2026-01-01T00:00:00.000Z', byteSize: 1024 },
};

describe('RestoreConflictDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <RestoreConflictDialog
        open={false}
        itemTitle="photo.jpg"
        conflict={conflict}
        isResolving={false}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the conflicting item in the title', () => {
    render(
      <RestoreConflictDialog open itemTitle="photo.jpg" conflict={conflict} isResolving={false} onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('"photo.jpg" already exists')).toBeInTheDocument();
  });

  it('shows the size for both the current and the trashed version', () => {
    render(
      <RestoreConflictDialog open itemTitle="photo.jpg" conflict={conflict} isResolving={false} onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
  });

  it('falls back to an "Unknown" label when a version has neither a size nor a date', () => {
    render(
      <RestoreConflictDialog
        open
        itemTitle="photo.jpg"
        conflict={{ current: {}, trashed: conflict.trashed }}
        isResolving={false}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('resolves as keepBoth when "Keep both" is clicked', async () => {
    const onResolve = vi.fn();
    render(
      <RestoreConflictDialog open itemTitle="photo.jpg" conflict={conflict} isResolving={false} onResolve={onResolve} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Keep both' }));
    expect(onResolve).toHaveBeenCalledWith('keepBoth');
  });

  it('resolves as replace when "Replace current version" is clicked', async () => {
    const onResolve = vi.fn();
    render(
      <RestoreConflictDialog open itemTitle="photo.jpg" conflict={conflict} isResolving={false} onResolve={onResolve} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Replace current version' }));
    expect(onResolve).toHaveBeenCalledWith('replace');
  });

  it('cancels instead of resolving when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    const onResolve = vi.fn();
    render(
      <RestoreConflictDialog open itemTitle="photo.jpg" conflict={conflict} isResolving={false} onResolve={onResolve} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('cancels when dismissed by pressing Escape, not just by the Cancel button', async () => {
    const onCancel = vi.fn();
    render(
      <RestoreConflictDialog open itemTitle="photo.jpg" conflict={conflict} isResolving={false} onResolve={vi.fn()} onCancel={onCancel} />,
    );
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables every action while a resolution is in progress', () => {
    render(
      <RestoreConflictDialog open itemTitle="photo.jpg" conflict={conflict} isResolving onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Keep both' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Replace current version' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
