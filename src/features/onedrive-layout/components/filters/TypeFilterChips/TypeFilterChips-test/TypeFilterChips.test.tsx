import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

vi.mock('@/features/onedrive-layout/icons', () => {
  const Stub = () => null;
  return {
    WordChipIcon: Stub,
    ExcelChipIcon: Stub,
    PowerPointChipIcon: Stub,
    PdfChipIcon: Stub,
    FolderChipIcon: Stub,
    ImageChipIcon: Stub,
    VideoChipIcon: Stub,
    AudioChipIcon: Stub,
    GenericFileChipIcon: Stub,
  };
});

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: (uri: string) => {
    const tail = uri.split('/').pop() ?? uri;
    return { label: tail, description: '' };
  },
}));

import { TypeFilterChips } from '../TypeFilterChips-file/TypeFilterChips';
import {
  chipForClassUri,
  chipForFolder,
  FOLDER_CHIP_ID,
} from '../TypeFilterChips-file/chipCatalog';

describe('TypeFilterChips', () => {
  let onToggle: ReturnType<typeof vi.fn>;
  let onReset: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToggle = vi.fn();
    onReset = vi.fn();
  });

  const chips = [
    chipForFolder(),
    chipForClassUri('http://schema.org/DigitalDocument'),
    chipForClassUri('http://schema.org/ImageObject'),
  ];

  it('renders the All chip plus one chip per derived type', () => {
    render(
      <TypeFilterChips chips={chips} selected={new Set()} onToggle={onToggle} onReset={onReset} />,
    );
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Folder')).toBeInTheDocument();
    expect(screen.getByText('DigitalDocument')).toBeInTheDocument();
    expect(screen.getByText('ImageObject')).toBeInTheDocument();
  });

  it('renders only the All chip when chips is empty', () => {
    render(
      <TypeFilterChips chips={[]} selected={new Set()} onToggle={onToggle} onReset={onReset} />,
    );
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.queryByText('Folder')).not.toBeInTheDocument();
  });

  it('marks the All chip active when no chip is selected', () => {
    render(
      <TypeFilterChips chips={chips} selected={new Set()} onToggle={onToggle} onReset={onReset} />,
    );
    expect(screen.getByText('All').closest('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks a specific chip active when its id is in the selection', () => {
    render(
      <TypeFilterChips
        chips={chips}
        selected={new Set([FOLDER_CHIP_ID])}
        onToggle={onToggle}
        onReset={onReset}
      />,
    );
    expect(screen.getByText('Folder').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('All').closest('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('fires onToggle with the chip id when a chip is clicked', () => {
    render(
      <TypeFilterChips chips={chips} selected={new Set()} onToggle={onToggle} onReset={onReset} />,
    );
    fireEvent.click(screen.getByText('ImageObject'));
    expect(onToggle).toHaveBeenCalledWith('http://schema.org/ImageObject');
  });

  it('fires onReset when the All chip is clicked', () => {
    render(
      <TypeFilterChips
        chips={chips}
        selected={new Set([FOLDER_CHIP_ID])}
        onToggle={onToggle}
        onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByText('All'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
