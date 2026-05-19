import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  WordChipIcon,
  ExcelChipIcon,
  PowerPointChipIcon,
  PdfChipIcon,
  FolderChipIcon,
  ImageChipIcon,
  VideoChipIcon,
  AudioChipIcon,
  GenericFileChipIcon,
} from '../icons-file/chipIcons';

describe('chip icons', () => {
  const cases = [
    ['WordChipIcon', WordChipIcon],
    ['ExcelChipIcon', ExcelChipIcon],
    ['PowerPointChipIcon', PowerPointChipIcon],
    ['PdfChipIcon', PdfChipIcon],
    ['FolderChipIcon', FolderChipIcon],
    ['ImageChipIcon', ImageChipIcon],
    ['VideoChipIcon', VideoChipIcon],
    ['AudioChipIcon', AudioChipIcon],
    ['GenericFileChipIcon', GenericFileChipIcon],
  ] as const;

  it.each(cases)('renders %s as an svg with a 24-unit viewBox', (_label, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
  });
});
