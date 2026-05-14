import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SolidContainer } from '@ldo/connected-solid';

const mockCreateFolder = vi.fn();
const mockValidateName = vi.fn();
vi.mock('@/features/file-explorer/hooks/useCreateFolder', () => ({
  useCreateFolder: () => ({
    isCreating: false,
    createFolder: mockCreateFolder,
    validateName: mockValidateName,
  }),
}));

const mockShowError = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ showError: mockShowError }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => fallback ?? key,
  ],
}));

import { NewFolderDialog } from '../NewFolderDialog-file/NewFolderDialog';

const parentContainer = {
  uri: 'https://pod.example/my-solid-app/',
} as unknown as SolidContainer;

describe('NewFolderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFolder.mockResolvedValue(undefined);
    mockValidateName.mockReturnValue(null);
  });

  it('renders nothing when closed', () => {
    render(
      <NewFolderDialog
        open={false}
        parentContainer={parentContainer}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, name field, and Create / Cancel actions when open', () => {
    render(
      <NewFolderDialog
        open
        parentContainer={parentContainer}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/create a folder/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('Create button is disabled when name is empty', () => {
    render(
      <NewFolderDialog
        open
        parentContainer={parentContainer}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('Cancel calls onOpenChange(false) and does not create a folder', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <NewFolderDialog
        open
        parentContainer={parentContainer}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  it('shows the validation error key when validateName rejects the name', async () => {
    const user = userEvent.setup();
    mockValidateName.mockReturnValue('fileExplorer.newFolderInvalidChars');
    render(
      <NewFolderDialog
        open
        parentContainer={parentContainer}
        onOpenChange={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/name/i), 'bad/name');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(
      screen.getByText('fileExplorer.newFolderInvalidChars'),
    ).toBeInTheDocument();
    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  it('on successful submit, calls createFolder and closes the dialog', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <NewFolderDialog
        open
        parentContainer={parentContainer}
        onOpenChange={onOpenChange}
      />,
    );

    await user.type(screen.getByLabelText(/name/i), 'My New Folder');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalledWith(
        parentContainer,
        'My New Folder',
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('submits on Enter key', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <NewFolderDialog
        open
        parentContainer={parentContainer}
        onOpenChange={onOpenChange}
      />,
    );

    const input = screen.getByLabelText(/name/i);
    await user.type(input, 'Folder A{Enter}');

    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalledWith(parentContainer, 'Folder A');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows an error notification and stays open when createFolder throws', async () => {
    const user = userEvent.setup();
    mockCreateFolder.mockRejectedValue(new Error('boom'));
    const onOpenChange = vi.fn();
    render(
      <NewFolderDialog
        open
        parentContainer={parentContainer}
        onOpenChange={onOpenChange}
      />,
    );

    await user.type(screen.getByLabelText(/name/i), 'Folder');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('fileExplorer.newFolderError');
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('clears any prior validation error when the user edits the name', async () => {
    const user = userEvent.setup();
    mockValidateName.mockReturnValueOnce('fileExplorer.newFolderInvalidChars');
    render(
      <NewFolderDialog
        open
        parentContainer={parentContainer}
        onOpenChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/name/i);
    await user.type(input, 'bad/');
    await user.click(screen.getByRole('button', { name: /create/i }));
    expect(
      screen.getByText('fileExplorer.newFolderInvalidChars'),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'good' } });
    expect(
      screen.queryByText('fileExplorer.newFolderInvalidChars'),
    ).not.toBeInTheDocument();
  });

  it('resets the input when the dialog is reopened', () => {
    const { rerender } = render(
      <NewFolderDialog
        open
        parentContainer={parentContainer}
        onOpenChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/name/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Stale' } });
    expect(input.value).toBe('Stale');

    rerender(
      <NewFolderDialog
        open={false}
        parentContainer={parentContainer}
        onOpenChange={vi.fn()}
      />,
    );
    rerender(
      <NewFolderDialog
        open
        parentContainer={parentContainer}
        onOpenChange={vi.fn()}
      />,
    );

    expect(
      (screen.getByLabelText(/name/i) as HTMLInputElement).value,
    ).toBe('');
  });
});
