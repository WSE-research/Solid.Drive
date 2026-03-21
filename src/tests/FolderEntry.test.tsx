import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderEntry } from '../FolderEntry';

describe('FolderEntry', () => {
  it('extracts and displays the folder name from the URI', () => {
    render(<FolderEntry uri="https://pod.example.com/my-app/documents/" onNavigate={vi.fn()} />);
    expect(screen.getByText('documents')).toBeInTheDocument();
  });

  it('decodes percent-encoded characters in the folder name', () => {
    render(<FolderEntry uri="https://pod.example.com/my-app/my%20folder/" onNavigate={vi.fn()} />);
    expect(screen.getByText('my folder')).toBeInTheDocument();
  });

  it('calls onNavigate with the full URI when clicked', () => {
    const onNavigate = vi.fn();
    const uri = 'https://pod.example.com/my-app/documents/';
    render(<FolderEntry uri={uri} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onNavigate).toHaveBeenCalledWith(uri);
  });

  it('calls onNavigate exactly once per click', () => {
    const onNavigate = vi.fn();
    render(<FolderEntry uri="https://pod.example.com/folder/" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
