import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

import { SearchInput } from '../SearchInput-file/SearchInput';

describe('SearchInput', () => {
  it('renders a search input with the translated placeholder and aria-label', () => {
    render(<SearchInput value="" onChange={() => {}} />);
    const input = screen.getByLabelText('fileExplorer.searchPlaceholder');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'search');
  });

  it('reflects the value prop', () => {
    render(<SearchInput value="hello" onChange={() => {}} />);
    expect(screen.getByLabelText('fileExplorer.searchPlaceholder')).toHaveValue('hello');
  });

  it('calls onChange when the user types', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('fileExplorer.searchPlaceholder'), {
      target: { value: 'abc' },
    });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('does not render the clear button when value is empty', () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.queryByLabelText('fileExplorer.searchClearLabel')).toBeNull();
  });

  it('renders the clear button when value is non-empty and clicking it clears', () => {
    const onChange = vi.fn();
    render(<SearchInput value="hi" onChange={onChange} />);
    const clear = screen.getByLabelText('fileExplorer.searchClearLabel');
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith('');
  });
});
