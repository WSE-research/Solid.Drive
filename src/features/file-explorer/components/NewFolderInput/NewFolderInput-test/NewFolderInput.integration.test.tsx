/**
 * Integration test: NewFolderInput + useCreateFolder + validateFolderName together.
 *
 * Only the LDP/catalog network boundary is stubbed.
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

const mockSolidFetch = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({
    session: { webId: 'https://pod.example/profile/card#me' },
    fetch: mockSolidFetch,
  }),
}));

const mockAppendFolderToCatalog = vi.fn();
const mockLinkCatalogToProfile = vi.fn();
vi.mock('@/infrastructure/solid/catalog', () => ({
  appendFolderToCatalog: (...args: unknown[]) => mockAppendFolderToCatalog(...args),
  linkCatalogToProfile: (...args: unknown[]) => mockLinkCatalogToProfile(...args),
}));

vi.mock('@/shared/hooks/useCatalogVersion', () => ({
  notifyCatalogChanged: vi.fn(),
}));

import { NewFolderInput } from '../NewFolderInput-file/NewFolderInput';

const catalogUri = 'https://pod.example/catalog.ttl';

describe('NewFolderInput (integration)', () => {
  const mockCreateChildAndOverwrite = vi.fn();
  const mockContainer = {
    uri: 'https://pod.example/files/',
    createChildAndOverwrite: mockCreateChildAndOverwrite,
  } as unknown as SolidContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSolidFetch.mockResolvedValue({ ok: true });
    mockAppendFolderToCatalog.mockResolvedValue(undefined);
    mockLinkCatalogToProfile.mockResolvedValue(undefined);
  });

  it('calls createChildAndOverwrite with a slugified container URI for a valid name', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} catalogUri={catalogUri} profileHasCatalog onDone={onDone} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My Project Docs' } });
    fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.createFolder' }));

    await waitFor(() => {
      expect(mockCreateChildAndOverwrite).toHaveBeenCalledWith('my-project-docs/');
    });
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('registers the typed name as the catalog title', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} catalogUri={catalogUri} profileHasCatalog onDone={onDone} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My Project Docs' } });
    fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.createFolder' }));

    await waitFor(() => {
      expect(mockAppendFolderToCatalog).toHaveBeenCalledWith({
        catalogUri,
        folderUri: 'https://pod.example/files/my-project-docs/',
        parentUri: 'https://pod.example/files/',
        title: 'My Project Docs',
        modified: expect.any(String),
        publisherWebId: 'https://pod.example/profile/card#me',
        fetch: mockSolidFetch,
      });
    });
  });

  it('trims whitespace from the name before creating the container', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} catalogUri={catalogUri} profileHasCatalog onDone={onDone} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  trimmed name  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.createFolder' }));

    await waitFor(() => {
      expect(mockCreateChildAndOverwrite).toHaveBeenCalledWith('trimmed-name/');
    });
  });

  it('blocks submission and shows validation error for names with illegal characters', async () => {
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} catalogUri={catalogUri} profileHasCatalog onDone={onDone} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'bad/name' } });
    fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.createFolder' }));

    expect(screen.getByText('fileExplorer.newFolderInvalidChars')).toBeInTheDocument();
    expect(mockCreateChildAndOverwrite).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('shows the notification error and stays open when the LDP call fails', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: true, message: 'Permission denied' });
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} catalogUri={catalogUri} profileHasCatalog onDone={onDone} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'valid-name' } });
    fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.createFolder' }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('fileExplorer.newFolderError');
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('shows the notification error and removes the folder when the catalog write fails', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });
    mockAppendFolderToCatalog.mockRejectedValue(new Error('Catalog PATCH failed'));
    const onDone = vi.fn();
    render(<NewFolderInput parentContainer={mockContainer} catalogUri={catalogUri} profileHasCatalog onDone={onDone} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'valid-name' } });
    fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.createFolder' }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('fileExplorer.newFolderError');
    });
    expect(mockSolidFetch).toHaveBeenCalledWith('https://pod.example/files/valid-name/', { method: 'DELETE' });
    expect(onDone).not.toHaveBeenCalled();
  });
});
