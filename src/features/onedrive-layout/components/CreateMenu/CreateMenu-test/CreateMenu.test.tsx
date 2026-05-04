import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateMenu } from '../CreateMenu-file/CreateMenu';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => fallback ?? key,
  ],
}));

describe('CreateMenu', () => {
  it('renders the + trigger with the localized aria-label', () => {
    render(<CreateMenu onNewFolder={vi.fn()} onUploadFiles={vi.fn()} />);
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('opening the menu reveals New folder and Upload files', async () => {
    const user = userEvent.setup();
    render(<CreateMenu onNewFolder={vi.fn()} onUploadFiles={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /create/i }));
    expect(await screen.findByRole('menuitem', { name: /new folder/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /upload files/i })).toBeInTheDocument();
  });

  it('selecting "New folder" calls onNewFolder', async () => {
    const user = userEvent.setup();
    const onNewFolder = vi.fn();
    render(<CreateMenu onNewFolder={onNewFolder} onUploadFiles={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /create/i }));
    await user.click(await screen.findByRole('menuitem', { name: /new folder/i }));
    expect(onNewFolder).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('menuitem', { name: /new folder/i }),
    ).not.toBeInTheDocument();
  });

  it('selecting "Upload files" calls onUploadFiles', async () => {
    const user = userEvent.setup();
    const onUploadFiles = vi.fn();
    render(<CreateMenu onNewFolder={vi.fn()} onUploadFiles={onUploadFiles} />);
    await user.click(screen.getByRole('button', { name: /create/i }));
    await user.click(await screen.findByRole('menuitem', { name: /upload files/i }));
    expect(onUploadFiles).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('menuitem', { name: /upload files/i }),
    ).not.toBeInTheDocument();
  });
});
