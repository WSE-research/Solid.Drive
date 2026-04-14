import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SolidContainer } from '@ldo/connected-solid';

const mockCreateFolder = vi.fn();
const mockValidateName = vi.fn();
vi.mock('@/features/file-explorer/hooks/useCreateFolder', () => ({
  useCreateFolder: () => ({ isCreating: false, createFolder: mockCreateFolder, validateName: mockValidateName }),
}));

const mockShowError = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ showError: mockShowError }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

import { NewFolderInput } from '../NewFolderInput-file/NewFolderInput';

const mockContainer = { uri: 'https://pod.example/my-solid-app/' } as unknown as SolidContainer;

describe('NewFolderInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFolder.mockResolvedValue(undefined);
    mockValidateName.mockReturnValue(null);
  });

  it('shows validation error message when submit clicked with invalid name', async () => {
    mockValidateName.mockReturnValue('fileExplorer.createFolderEmpty');
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} onDone={onDone} />);

    const submitButton = screen.getByRole('button', { name: 'fileExplorer.createFolder' });
    fireEvent.click(submitButton);

    expect(screen.getByText('fileExplorer.createFolderEmpty')).toBeInTheDocument();
    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  it('calls onDone when cancel clicked without making a network call', () => {
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} onDone={onDone} />);

    const cancelButton = screen.getByRole('button', { name: 'profileSidebar.cancel' });
    fireEvent.click(cancelButton);

    expect(onDone).toHaveBeenCalledOnce();
    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  it('calls createFolder with correct args and then onDone on successful submit', async () => {
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} onDone={onDone} />);

    const nameInput = screen.getByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'My New Folder' } });

    const submitButton = screen.getByRole('button', { name: 'fileExplorer.createFolder' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalledWith(mockContainer, 'My New Folder');
      expect(onDone).toHaveBeenCalledOnce();
    });
  });

  it('calls showError and NOT onDone when createFolder throws', async () => {
    mockCreateFolder.mockRejectedValue(new Error('Network error'));
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} onDone={onDone} />);

    const nameInput = screen.getByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'My Folder' } });

    const submitButton = screen.getByRole('button', { name: 'fileExplorer.createFolder' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('fileExplorer.newFolderError');
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('shows validation error on input blur', () => {
    mockValidateName.mockReturnValue('fileExplorer.createFolderEmpty');
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} onDone={onDone} />);

    const nameInput = screen.getByRole('textbox');
    fireEvent.blur(nameInput);

    expect(screen.getByText('fileExplorer.createFolderEmpty')).toBeInTheDocument();
  });
});
