import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextualToolbar } from '../ContextualToolbar-file/ContextualToolbar';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => fallback ?? key,
  ],
}));

const baseProps = {
  sort: { key: 'name' as const, direction: 'asc' as const },
  onSortChange: vi.fn(),
  detailsOpen: false,
  onToggleDetails: vi.fn(),
};

describe('ContextualToolbar', () => {
  it('renders Sort and Details buttons', () => {
    render(<ContextualToolbar {...baseProps} />);
    expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument();
  });

  it('opening Sort reveals all four keys', async () => {
    const user = userEvent.setup();
    render(<ContextualToolbar {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /sort/i }));
    for (const label of ['name', 'modified', 'size', 'sharing']) {
      expect(
        await screen.findByRole('menuitemradio', { name: new RegExp(label, 'i') }),
      ).toBeInTheDocument();
    }
  });

  it('selecting a sort key calls onSortChange with asc default', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<ContextualToolbar {...baseProps} onSortChange={onSortChange} />);
    await user.click(screen.getByRole('button', { name: /sort/i }));
    const item = await screen.findByRole('menuitemradio', { name: /modified/i });
    await user.click(item);
    expect(onSortChange).toHaveBeenCalledWith({ key: 'modified', direction: 'asc' });
  });

  it('selecting the active sort key flips its direction', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <ContextualToolbar
        {...baseProps}
        sort={{ key: 'name', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /sort/i }));
    const item = await screen.findByRole('menuitemradio', { name: /name/i });
    await user.click(item);
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' });
  });

  it('Details button reflects open state and forwards clicks', async () => {
    const user = userEvent.setup();
    const onToggleDetails = vi.fn();
    render(
      <ContextualToolbar
        {...baseProps}
        detailsOpen
        onToggleDetails={onToggleDetails}
      />,
    );
    const details = screen.getByRole('button', { name: /details/i });
    expect(details).toHaveAttribute('aria-pressed', 'true');
    await user.click(details);
    expect(onToggleDetails).toHaveBeenCalledOnce();
  });
});
