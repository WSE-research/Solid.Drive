import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateMenu } from '../CreateMenu-file/CreateMenu';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => fallback ?? key,
  ],
}));

describe('CreateMenu', () => {
  it('renders the + trigger with the localized aria-label', () => {
    render(<CreateMenu onNewFolder={vi.fn()} onFilesPicked={vi.fn()} />);
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('opening the menu reveals New folder and Upload files', async () => {
    const user = userEvent.setup();
    render(<CreateMenu onNewFolder={vi.fn()} onFilesPicked={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /create/i }));
    expect(await screen.findByRole('menuitem', { name: /new folder/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /upload files/i })).toBeInTheDocument();
  });

  it('selecting "New folder" calls onNewFolder', async () => {
    const user = userEvent.setup();
    const onNewFolder = vi.fn();
    render(<CreateMenu onNewFolder={onNewFolder} onFilesPicked={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /create/i }));
    await user.click(await screen.findByRole('menuitem', { name: /new folder/i }));
    expect(onNewFolder).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('menuitem', { name: /new folder/i }),
    ).not.toBeInTheDocument();
  });

  it('selecting "Upload files" opens the OS file picker (clicks the hidden input)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CreateMenu onNewFolder={vi.fn()} onFilesPicked={vi.fn()} />,
    );
    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) throw new Error('hidden file input not found');

    const clickSpy = vi.spyOn(fileInput as HTMLInputElement, 'click');
    await user.click(screen.getByRole('button', { name: /create/i }));
    await user.click(
      await screen.findByRole('menuitem', { name: /upload files/i }),
    );
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('forwards the picked files via onFilesPicked when the input changes', async () => {
    const user = userEvent.setup();
    const onFilesPicked = vi.fn();
    const { container } = render(
      <CreateMenu onNewFolder={vi.fn()} onFilesPicked={onFilesPicked} />,
    );
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    await user.upload(fileInput, file);

    expect(onFilesPicked).toHaveBeenCalledOnce();
    expect(onFilesPicked.mock.calls[0][0]).toEqual([file]);
  });

  it('does not call onFilesPicked when the file input fires change with no files', () => {
    const onFilesPicked = vi.fn();
    const { container } = render(
      <CreateMenu onNewFolder={vi.fn()} onFilesPicked={onFilesPicked} />,
    );
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    // Override the FileList getter — userEvent.upload won't model a null files property.
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      get: () => null,
    });
    fireEvent.change(fileInput);

    expect(onFilesPicked).not.toHaveBeenCalled();
  });
});
