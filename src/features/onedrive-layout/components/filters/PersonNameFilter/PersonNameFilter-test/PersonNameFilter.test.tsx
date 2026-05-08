import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

import { PersonNameFilter } from '../PersonNameFilter-file/PersonNameFilter';

describe('PersonNameFilter', () => {
  it('renders an input with the current value', () => {
    render(<PersonNameFilter value="alice" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('alice')).toBeInTheDocument();
  });

  it('fires onChange with each keystroke', () => {
    const handleChange = vi.fn();
    render(<PersonNameFilter value="" onChange={handleChange} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bob' } });
    expect(handleChange).toHaveBeenCalledWith('bob');
  });

  it('uses the localized placeholder', () => {
    render(<PersonNameFilter value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Filter by name or WebID')).toBeInTheDocument();
  });
});
