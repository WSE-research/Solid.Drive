import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderEntry } from '../FolderEntry-file/FolderEntry';

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

  it('extracts folder name correctly from a URI without a trailing slash', () => {
    render(<FolderEntry uri="https://pod.example.com/folder" onNavigate={vi.fn()} />);
    expect(screen.getByText('folder')).toBeInTheDocument();
  });

  it('renders the folder icon and arrow as CSS icon spans', () => {
    const { container } = render(<FolderEntry uri="https://pod.example.com/test/" onNavigate={vi.fn()} />);
    expect(container.querySelector('.icon--folder')).toBeInTheDocument();
    expect(container.querySelector('.folder-entry__arrow')).toBeInTheDocument();
  });

  it('renders a clickable button even when URI is an empty string', () => {
    render(<FolderEntry uri="" onNavigate={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not attach DnD listeners when onDrop is not provided', () => {
    const { container } = render(<FolderEntry uri="https://pod.example/x/" onNavigate={vi.fn()} />);
    expect(container.querySelector('.folder-entry--drop-target')).toBeNull();
  });

  it('calls onDrop with the dropped files, target uri, and the raw DataTransfer', () => {
    const onDrop = vi.fn();
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={onDrop} onDragOverChange={vi.fn()} />
    );
    const button = container.querySelector('button')!;
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const dataTransfer = { files: [file], types: ['Files'] };
    fireEvent.drop(button, { dataTransfer });
    expect(onDrop).toHaveBeenCalledWith([file], 'https://pod.example/photos/', expect.any(Object));
  });

  it('pings onDragOverChange when files enter and leave', () => {
    const onDragOverChange = vi.fn();
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={vi.fn()} onDragOverChange={onDragOverChange} />
    );
    const button = container.querySelector('button')!;
    fireEvent.dragEnter(button, { dataTransfer: { types: ['Files'] } });
    expect(onDragOverChange).toHaveBeenCalledWith(true);
    fireEvent.dragLeave(button);
    expect(onDragOverChange).toHaveBeenCalledWith(false);
  });

  it('applies the drop-target modifier class while a file is over the card', () => {
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={vi.fn()} onDragOverChange={vi.fn()} />
    );
    const button = container.querySelector('button')!;
    fireEvent.dragEnter(button, { dataTransfer: { types: ['Files'] } });
    expect(button.classList.contains('folder-entry--drop-target')).toBe(true);
    fireEvent.dragLeave(button);
    expect(button.classList.contains('folder-entry--drop-target')).toBe(false);
  });

  it('drag-over with Files preventDefaults so the browser fires drop', () => {
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={vi.fn()} onDragOverChange={vi.fn()} />
    );
    const button = container.querySelector('button')!;
    const prevented = !fireEvent.dragOver(button, { dataTransfer: { types: ['Files'] } });
    expect(prevented).toBe(true);
  });

  it('drag-over with non-Files data does not preventDefault', () => {
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={vi.fn()} onDragOverChange={vi.fn()} />
    );
    const button = container.querySelector('button')!;
    const prevented = !fireEvent.dragOver(button, { dataTransfer: { types: ['text/plain'] } });
    expect(prevented).toBe(false);
  });

  it('drag-enter with non-Files data is ignored', () => {
    const onDragOverChange = vi.fn();
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={vi.fn()} onDragOverChange={onDragOverChange} />
    );
    const button = container.querySelector('button')!;
    fireEvent.dragEnter(button, { dataTransfer: { types: ['text/plain'] } });
    expect(onDragOverChange).not.toHaveBeenCalled();
  });
});
