import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockContacts: { current: string[] } = { current: [] };
let mockWebId: string | undefined = 'https://owner.example/profile/card#me';
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: mockWebId } }),
}));

vi.mock('@/features/file-explorer/hooks/useContacts', () => ({
  useContacts: () => mockContacts.current,
}));

let lastToolbarProps: Record<string, unknown> | undefined;
vi.mock('@/features/onedrive-layout/components/views/SharedView/SharedView-file/SharedToolbar', () => ({
  SharedToolbar: (props: Record<string, unknown>) => {
    lastToolbarProps = props;
    return (
      <div data-testid="shared-toolbar" data-tab={String(props.tab)}>
        <button data-testid="select-by-you" onClick={() => (props.onTabChange as (next: string) => void)('by-you')}>
          By you
        </button>
      </div>
    );
  },
}));

let lastBodyProps: Record<string, unknown> | undefined;
vi.mock('@/features/onedrive-layout/components/views/SharedView/SharedView-file/SharedBody', () => ({
  SharedBody: (props: Record<string, unknown>) => {
    lastBodyProps = props;
    return (
      <div
        data-testid="shared-body"
        data-tab={String(props.tab)}
        data-contact-count={(props.contacts as string[]).length}
      />
    );
  },
}));

import { SharedView } from '../SharedView-file/SharedView';

describe('SharedView', () => {
  beforeEach(() => {
    mockContacts.current = [];
    lastToolbarProps = undefined;
    lastBodyProps = undefined;
    mockWebId = 'https://owner.example/profile/card#me';
  });

  it('renders both the toolbar and the body siblings', () => {
    render(<SharedView />);
    expect(screen.getByTestId('shared-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('shared-body')).toBeInTheDocument();
  });

  it('starts on the "with-you" tab and routes the tab id to both children', () => {
    render(<SharedView />);
    expect(screen.getByTestId('shared-toolbar').getAttribute('data-tab')).toBe('with-you');
    expect(screen.getByTestId('shared-body').getAttribute('data-tab')).toBe('with-you');
  });

  it('switches the active tab when the toolbar fires onTabChange', () => {
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-by-you'));
    expect(screen.getByTestId('shared-toolbar').getAttribute('data-tab')).toBe('by-you');
    expect(screen.getByTestId('shared-body').getAttribute('data-tab')).toBe('by-you');
  });

  it('filters out the owner WebID from the contacts list passed to the body', () => {
    mockContacts.current = [
      'https://owner.example/profile/card#me',
      'https://alice.example/profile/card#me',
    ];
    render(<SharedView />);
    expect(screen.getByTestId('shared-body').getAttribute('data-contact-count')).toBe('1');
    expect(lastBodyProps?.contacts).toEqual(['https://alice.example/profile/card#me']);
  });

  it('shares the same filters reference between toolbar and body', () => {
    render(<SharedView />);
    expect(lastToolbarProps?.filters).toBe(lastBodyProps?.filters);
  });

  it('shares the same chip list reference between toolbar and body', () => {
    render(<SharedView />);
    expect(lastToolbarProps?.chips).toBe(lastBodyProps?.chips);
  });

  it('does not switch tab when onTabChange is called with the same tab', () => {
    render(<SharedView />);
    // Start is 'with-you'; clicking the "By you" button switches to 'by-you'.
    fireEvent.click(screen.getByTestId('select-by-you'));
    expect(screen.getByTestId('shared-toolbar').getAttribute('data-tab')).toBe('by-you');
    // Clicking it again should stay on 'by-you' (same-tab branch returns early).
    fireEvent.click(screen.getByTestId('select-by-you'));
    expect(screen.getByTestId('shared-toolbar').getAttribute('data-tab')).toBe('by-you');
  });

  it('falls back to empty string ownerWebId when session.webId is undefined', () => {
    mockWebId = undefined;
    mockContacts.current = ['https://alice.example/profile/card#me'];
    render(<SharedView />);
    // With ownerWebId = '' the filter `webId !== ownerWebId` keeps alice
    // since alice !== ''.
    expect(screen.getByTestId('shared-body').getAttribute('data-contact-count')).toBe('1');
  });
});
