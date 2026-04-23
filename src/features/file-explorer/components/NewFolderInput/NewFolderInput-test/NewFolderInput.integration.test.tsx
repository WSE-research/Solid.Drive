/**
 * Integration test: NewFolderInput + useCreateFolder + validateFolderName together.
 *
 * Only the LDP network boundary (createChildAndOverwrite) is stubbed.
 * Validation, slug generation, and hook lifecycle run for real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SolidContainer } from '@ldo/connected-solid';

const mockShowError = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ showError: mockShowError }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

import { NewFolderInput } from '../NewFolderInput-file/NewFolderInput';

describe('NewFolderInput (integration)', () => {
  const mockCreateChildAndOverwrite = vi.fn();
  const mockContainer = {
    uri: 'https://pod.example/files/',
    createChildAndOverwrite: mockCreateChildAndOverwrite,
  } as unknown as SolidContainer;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createChildAndOverwrite with a slugified container URI for a valid name', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} onDone={onDone} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My Project Docs' } });
    fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.createFolder' }));

    await waitFor(() => {
      expect(mockCreateChildAndOverwrite).toHaveBeenCalledWith('my-project-docs/');
    });
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('trims whitespace from the name before creating the container', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} onDone={onDone} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  trimmed name  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.createFolder' }));

    await waitFor(() => {
      expect(mockCreateChildAndOverwrite).toHaveBeenCalledWith('trimmed-name/');
    });
  });

  it('blocks submission and shows validation error for names with illegal characters', async () => {
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} onDone={onDone} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'bad/name' } });
    fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.createFolder' }));

    expect(screen.getByText('fileExplorer.newFolderInvalidChars')).toBeInTheDocument();
    expect(mockCreateChildAndOverwrite).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('shows the notification error and stays open when the LDP call fails', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: true, message: 'Permission denied' });
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} onDone={onDone} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'valid-name' } });
    fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.createFolder' }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('fileExplorer.newFolderError');
    });
    expect(onDone).not.toHaveBeenCalled();
  });
});
