import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
    ChevronDownIcon: Stub,
    CheckmarkIcon: Stub,
  };
});

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: (uri: string) => {
    const tail = uri.split('/').pop() ?? uri;
    return { label: tail, description: '' };
  },
}));

import { TypeFilterChipsDropdown } from '../TypeFilterChips-file/TypeFilterChipsDropdown';
import {
  chipForClassUri,
  chipForFolder,
  FOLDER_CHIP_ID,
} from '../TypeFilterChips-file/chipCatalog';

const chips = [
  chipForFolder(),
  chipForClassUri('http://schema.org/DigitalDocument'),
  chipForClassUri('http://schema.org/ImageObject'),
];

describe('TypeFilterChipsDropdown', () => {
  let onToggle: ReturnType<typeof vi.fn>;
  let onReset: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToggle = vi.fn();
    onReset = vi.fn();
  });

  it('renders an "All" trigger button', () => {
    render(
      <TypeFilterChipsDropdown
        chips={chips}
        selected={new Set()}
        onToggle={onToggle}
        onReset={onReset}
      />,
    );
    expect(screen.getByRole('button', { name: /file type filter/i })).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('marks the trigger as active when no chip is selected', () => {
    render(
      <TypeFilterChipsDropdown
        chips={chips}
        selected={new Set()}
        onToggle={onToggle}
        onReset={onReset}
      />,
    );
    const trigger = screen.getByRole('button', { name: /file type filter/i });
    expect(trigger.className).toContain('odl-filter-chip--active');
  });

  it('opens the menu and lists every chip plus "All" when clicked', async () => {
    const user = userEvent.setup();
    render(
      <TypeFilterChipsDropdown
        chips={chips}
        selected={new Set()}
        onToggle={onToggle}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole('button', { name: /file type filter/i }));
    const items = await screen.findAllByRole('menuitemcheckbox');
    expect(items).toHaveLength(chips.length + 1);
  });

  it('fires onToggle with the chip id when a chip item is selected', async () => {
    const user = userEvent.setup();
    render(
      <TypeFilterChipsDropdown
        chips={chips}
        selected={new Set()}
        onToggle={onToggle}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole('button', { name: /file type filter/i }));
    const folderItem = await screen.findByRole('menuitemcheckbox', { name: /folder/i });
    await user.click(folderItem);
    expect(onToggle).toHaveBeenCalledWith(FOLDER_CHIP_ID);
  });

  it('fires onReset when the "All" item is selected', async () => {
    const user = userEvent.setup();
    render(
      <TypeFilterChipsDropdown
        chips={chips}
        selected={new Set([FOLDER_CHIP_ID])}
        onToggle={onToggle}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole('button', { name: /file type filter/i }));
    const allItem = await screen.findByRole('menuitemcheckbox', { name: 'All' });
    await user.click(allItem);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
