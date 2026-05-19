import { describe, it, expect, vi } from 'vitest';

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

import {
  chipForClassUri,
  chipForFolder,
  chipForPdf,
  deriveChipsFromEntries,
  entryMatchesChipSelection,
  FOLDER_CHIP_ID,
  PDF_CHIP_ID,
} from '../TypeFilterChips-file/chipCatalog';

describe('chipForClassUri', () => {
  it('uses the class URI as the chip id', () => {
    expect(chipForClassUri('http://schema.org/ImageObject').id).toBe('http://schema.org/ImageObject');
  });

  it('looks up the friendly label from the file type registry', () => {
    expect(chipForClassUri('http://schema.org/ImageObject').label).toBe('ImageObject');
  });

  it('matches catalog entries with the same conformsTo URI', () => {
    const chip = chipForClassUri('http://schema.org/ImageObject');
    expect(chip.matches({ conformsTo: 'http://schema.org/ImageObject' })).toBe(true);
    expect(chip.matches({ conformsTo: 'http://schema.org/DigitalDocument' })).toBe(false);
  });
});

describe('chipForFolder', () => {
  it('uses the folder sentinel id', () => {
    expect(chipForFolder().id).toBe(FOLDER_CHIP_ID);
  });

  it('matches only entries where isFolder is true', () => {
    const chip = chipForFolder();
    expect(chip.matches({ isFolder: true })).toBe(true);
    expect(chip.matches({ isFolder: false })).toBe(false);
    expect(chip.matches({})).toBe(false);
  });
});

describe('chipForPdf', () => {
  it('uses the PDF sentinel id', () => {
    expect(chipForPdf().id).toBe(PDF_CHIP_ID);
  });

  it('matches application/pdf media types', () => {
    expect(chipForPdf().matches({ mediaType: 'application/pdf' })).toBe(true);
    expect(chipForPdf().matches({ mediaType: 'APPLICATION/PDF' })).toBe(true);
  });

  it('matches by .pdf extension when mediaType is missing', () => {
    expect(chipForPdf().matches({ name: 'paper.PDF' })).toBe(true);
    expect(chipForPdf().matches({ name: 'paper.docx' })).toBe(false);
  });
});

describe('deriveChipsFromEntries', () => {
  it('returns an empty list when no entries are observed', () => {
    expect(deriveChipsFromEntries([])).toEqual([]);
  });

  it('returns one chip per distinct schema.org class', () => {
    const chips = deriveChipsFromEntries([
      { conformsTo: 'http://schema.org/ImageObject' },
      { conformsTo: 'http://schema.org/ImageObject' },
      { conformsTo: 'http://schema.org/DigitalDocument' },
    ]);
    expect(chips.map((chip) => chip.id)).toEqual([
      'http://schema.org/DigitalDocument',
      'http://schema.org/ImageObject',
    ]);
  });

  it('sorts class chips alphabetically by label', () => {
    const chips = deriveChipsFromEntries([
      { conformsTo: 'http://schema.org/VideoObject' },
      { conformsTo: 'http://schema.org/AudioObject' },
    ]);
    expect(chips.map((chip) => chip.label)).toEqual(['AudioObject', 'VideoObject']);
  });

  it('prepends synthetic Folder + PDF chips before class chips', () => {
    const chips = deriveChipsFromEntries([
      { isFolder: true },
      { mediaType: 'application/pdf' },
      { conformsTo: 'http://schema.org/DigitalDocument' },
    ]);
    expect(chips.map((chip) => chip.id)).toEqual([
      FOLDER_CHIP_ID,
      PDF_CHIP_ID,
      'http://schema.org/DigitalDocument',
    ]);
  });

  it('omits the Folder chip when no folders are observed', () => {
    const chips = deriveChipsFromEntries([
      { conformsTo: 'http://schema.org/DigitalDocument' },
    ]);
    expect(chips.find((chip) => chip.id === FOLDER_CHIP_ID)).toBeUndefined();
  });

  it('omits the PDF chip when no PDFs are observed', () => {
    const chips = deriveChipsFromEntries([
      { conformsTo: 'http://schema.org/DigitalDocument' },
    ]);
    expect(chips.find((chip) => chip.id === PDF_CHIP_ID)).toBeUndefined();
  });

  it('skips entries with empty or missing conformsTo (non-folder, non-PDF)', () => {
    const chips = deriveChipsFromEntries([
      { conformsTo: '' },
      {},
      { conformsTo: 'http://schema.org/ImageObject' },
    ]);
    expect(chips.map((chip) => chip.id)).toEqual(['http://schema.org/ImageObject']);
  });
});

describe('entryMatchesChipSelection', () => {
  const imageChip = chipForClassUri('http://schema.org/ImageObject');
  const docChip = chipForClassUri('http://schema.org/DigitalDocument');

  it('returns true when no chip is selected (all-mode)', () => {
    expect(
      entryMatchesChipSelection(
        { conformsTo: 'http://schema.org/ImageObject' },
        new Set(),
        [imageChip, docChip],
      ),
    ).toBe(true);
  });

  it('returns true when at least one selected chip matches', () => {
    expect(
      entryMatchesChipSelection(
        { conformsTo: 'http://schema.org/ImageObject' },
        new Set(['http://schema.org/ImageObject']),
        [imageChip, docChip],
      ),
    ).toBe(true);
  });

  it('returns false when no selected chip matches', () => {
    expect(
      entryMatchesChipSelection(
        { conformsTo: 'http://schema.org/ImageObject' },
        new Set(['http://schema.org/DigitalDocument']),
        [imageChip, docChip],
      ),
    ).toBe(false);
  });

  it('matches the PDF chip via mediaType', () => {
    const pdfChip = chipForPdf();
    expect(
      entryMatchesChipSelection(
        { mediaType: 'application/pdf' },
        new Set([PDF_CHIP_ID]),
        [pdfChip],
      ),
    ).toBe(true);
  });
});
