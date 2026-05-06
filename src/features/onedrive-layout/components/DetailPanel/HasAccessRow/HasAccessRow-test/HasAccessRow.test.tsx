import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HasAccessRow } from '../HasAccessRow-file/HasAccessRow';

const mockSharingLabel = vi.fn();
vi.mock('@/features/onedrive-layout/hooks/useSharingLabel', () => ({
  useSharingLabel: () => mockSharingLabel(),
}));

vi.mock('@ldo/solid-react', () => ({
  useResource: () => ({}),
  useSubject: () => ({ fn: 'Alice' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string, vars?: Record<string, string>) => {
      if (vars?.name && fallback) {
        return fallback.replace('{{name}}', vars.name);
      }
      return fallback ?? key;
    },
  ],
}));

describe('HasAccessRow', () => {
  it('renders an empty row when the resource is private', () => {
    mockSharingLabel.mockReturnValue({ kind: 'private', agentWebIds: [], loading: false });
    const { container } = render(<HasAccessRow uri="https://pod/x/" />);
    expect(container.querySelector('has-access-row')).toBeEmptyDOMElement();
  });

  it('renders a Public marker when the resource is public', () => {
    mockSharingLabel.mockReturnValue({ kind: 'public', agentWebIds: [], loading: false });
    render(<HasAccessRow uri="https://pod/x/" />);
    expect(screen.getByText(/public/i)).toBeInTheDocument();
  });

  it('renders one avatar per shared agent', () => {
    mockSharingLabel.mockReturnValue({
      kind: 'shared',
      agentWebIds: ['https://alice/me', 'https://bob/me'],
      loading: false,
    });
    render(<HasAccessRow uri="https://pod/x/" />);
    const avatars = screen.getAllByRole('img', { name: /shared with/i });
    expect(avatars).toHaveLength(2);
  });

  it('renders an empty row while loading', () => {
    mockSharingLabel.mockReturnValue({ kind: 'private', agentWebIds: [], loading: true });
    const { container } = render(<HasAccessRow uri="https://pod/x/" />);
    expect(container.querySelector('has-access-row')).toBeEmptyDOMElement();
  });
});
