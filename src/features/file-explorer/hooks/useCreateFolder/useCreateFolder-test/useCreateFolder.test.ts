import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SolidContainer } from '@ldo/connected-solid';

import { validateFolderName, useCreateFolder } from '../useCreateFolder-file/useCreateFolder';

describe('validateFolderName', () => {
  it('returns error key for empty string', () => {
    expect(validateFolderName('')).toBe('fileExplorer.newFolderEmpty');
  });

  it('returns error key for whitespace-only string', () => {
    expect(validateFolderName('   ')).toBe('fileExplorer.newFolderEmpty');
  });

  it('returns error key for name containing "/"', () => {
    expect(validateFolderName('my/folder')).toBe('fileExplorer.newFolderInvalidChars');
  });

  it('returns error key for name containing "\\"', () => {
    expect(validateFolderName('my\\folder')).toBe('fileExplorer.newFolderInvalidChars');
  });

  it('returns error key for name containing ":"', () => {
    expect(validateFolderName('my:folder')).toBe('fileExplorer.newFolderInvalidChars');
  });

  it('returns null for valid name "my-folder"', () => {
    expect(validateFolderName('my-folder')).toBeNull();
  });

  it('returns null for valid name with surrounding whitespace', () => {
    expect(validateFolderName('  my folder  ')).toBeNull();
  });
});

describe('useCreateFolder', () => {
  const mockCreateChildAndOverwrite = vi.fn();

  const mockParentContainer = {
    createChildAndOverwrite: mockCreateChildAndOverwrite,
  } as unknown as SolidContainer;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createChildAndOverwrite with slug "my-new-folder/" for name "My New Folder"', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    await act(async () => {
      await result.current.createFolder(mockParentContainer, 'My New Folder');
    });

    expect(mockCreateChildAndOverwrite).toHaveBeenCalledWith('my-new-folder/');
  });

  it('throws when result.isError is true', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: true, message: 'Creation failed', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    await expect(
      act(async () => {
        await result.current.createFolder(mockParentContainer, 'My Folder');
      })
    ).rejects.toThrow('Creation failed');
  });

  it('sets isCreating to false after success', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: false, message: '', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    await act(async () => {
      await result.current.createFolder(mockParentContainer, 'My Folder');
    });

    expect(result.current.isCreating).toBe(false);
  });

  it('sets isCreating to false after failure', async () => {
    mockCreateChildAndOverwrite.mockResolvedValue({ isError: true, message: 'Fail', resource: {} });

    const { result } = renderHook(() => useCreateFolder());

    try {
      await act(async () => {
        await result.current.createFolder(mockParentContainer, 'My Folder');
      });
    } catch { /* expected */ }

    expect(result.current.isCreating).toBe(false);
  });
});
