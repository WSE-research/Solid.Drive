import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLoadTBox = vi.fn();
const mockValidateMetadata = vi.fn();
const mockResolveClass = vi.fn();

vi.mock('@/infrastructure/validation/tboxValidator', () => ({
  loadTBox: (...args: unknown[]) => mockLoadTBox(...args),
  validateMetadata: (...args: unknown[]) => mockValidateMetadata(...args),
}));

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  resolveClass: (...args: unknown[]) => mockResolveClass(...args),
}));

import { validateFile } from '../validateFile-file/validateFile';

const fakeShapes = new Map();
const fakeParents = new Map();

describe('validateFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadTBox.mockResolvedValue({ shapes: fakeShapes, parents: fakeParents });
    mockResolveClass.mockReturnValue('https://schema.org/DigitalDocument');
    mockValidateMetadata.mockReturnValue({ valid: true, violations: [], shape: null });
  });

  it('passes a normal file with title and description', async () => {
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    const result = await validateFile(file, 'My note', 'A short description', 'https://pod.example/profile/card#me');
    expect(result.valid).toBe(true);
    expect(mockResolveClass).toHaveBeenCalledWith('text/plain');
    expect(mockValidateMetadata).toHaveBeenCalledOnce();
  });

  it('falls back to filename when title is empty', async () => {
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    await validateFile(file, '', '', 'https://pod.example/profile/card#me');
    const snapshot = mockValidateMetadata.mock.calls[0][0] as Record<string, unknown>;
    expect(snapshot.name).toBe('note.txt');
  });

  it('returns the violations from validateMetadata when invalid', async () => {
    mockValidateMetadata.mockReturnValue({
      valid: false,
      violations: [{ path: 'schema:name', localName: 'name', label: 'Title', description: '', minCount: 1 }],
      shape: { uri: 'X', label: 'Doc', requiredProperties: [], optionalProperties: [] },
    });
    const file = new File(['hi'], 'thing.bin', { type: 'application/octet-stream' });
    const result = await validateFile(file, '', '', 'https://pod.example/profile/card#me');
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].localName).toBe('name');
  });

  it('passes the resolved class URI through to validateMetadata', async () => {
    mockResolveClass.mockReturnValue('https://w3id.org/solid-drive#TextDocument');
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    await validateFile(file, 'A', '', 'https://pod.example/profile/card#me');
    expect(mockValidateMetadata).toHaveBeenCalledOnce();
    const classUri = mockValidateMetadata.mock.calls[0][1] as string;
    expect(classUri).toBe('https://w3id.org/solid-drive#TextDocument');
  });
});
